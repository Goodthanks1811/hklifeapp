import { Router } from "express";

const router = Router();

const BASE_URL   = "https://www.nrl.com";
const NEWS_URL   = "https://www.nrl.com/news/";
const MAX_ITEMS  = 30;
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// ── Helpers ───────────────────────────────────────────────────────────────────

function decodeHtml(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_: string, n: string) => String.fromCharCode(parseInt(n, 10)));
}

function stripTags(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
  ).replace(/\n{3,}/g, "\n\n").trim();
}

function cleanLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function isJunkLine(raw: string): boolean {
  const t = raw.toLowerCase();
  if (!t) return true;
  if (["cookie", "subscribe", "sign up", "newsletter", "privacy", "follow the nrl"].some(p => t.includes(p))) return true;
  return false;
}

function isBlockedSectionHeading(s: string): boolean {
  const t = cleanLine(s).toLowerCase();
  if (/^more nrl news\b/.test(t)) return true;
  if (/^crawls?\b/.test(t)) return true;
  if (/^up next\b/.test(t)) return true;
  return false;
}

function isAllCapsHeadingLike(s: string): boolean {
  const t = cleanLine(s);
  if (t.length < 10 || t.length > 120) return false;
  if (/[.!?]$/.test(t)) return false;
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length < 10) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return (upper / letters.length) >= 0.82;
}

function isTitleCaseHeadingLike(s: string): boolean {
  const t = cleanLine(s);
  if (t.length < 16 || t.length > 95) return false;
  if (/[.!?]$/.test(t)) return false;
  if (/:/.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 14) return false;
  const lower = ["a","an","and","as","at","but","by","for","from","in","into","of","on","or","the","to","vs","via","with","v"];
  let titleish = 0, alphaWords = 0;
  for (const word of words) {
    const plain = word.replace(/[^A-Za-z''\-]/g, "");
    if (!plain) continue;
    alphaWords++;
    if (lower.includes(plain.toLowerCase())) { titleish++; continue; }
    if (/^[A-Z][a-zA-Z''\-]*$/.test(plain) || /^[A-Z]{2,}$/.test(plain)) titleish++;
  }
  if (alphaWords < 3) return false;
  return (titleish / alphaWords) >= 0.72;
}

function isHeadingLike(s: string): boolean {
  return isAllCapsHeadingLike(s) || isTitleCaseHeadingLike(s);
}

// ── NRL.com news listing parser ───────────────────────────────────────────────

interface NewsItem { title: string; link: string; pubDate: string; category: string }

function parseNewsList(html: string): NewsItem[] {
  const items: NewsItem[] = [];
  const seenLinks = new Set<string>();
  const junkTitles = new Set(["see more", "load more", "read more", "watch"]);

  // For each card-content__text, scan backwards to find the nearest news link.
  // This correctly pairs titles to links even when hero cards have no text element.
  const titleRx = /<p[^>]+class="[^"]*card-content__text[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
  const linkRx  = /href="(\/news\/\d{4}\/[^"]+)"/g;

  // Build index of all link positions: { path, index }
  const allLinks: { path: string; index: number }[] = [];
  let lm: RegExpExecArray | null;
  while ((lm = linkRx.exec(html)) !== null) {
    allLinks.push({ path: lm[1], index: lm.index });
  }

  // Build index of all topic (category) positions
  const topicRx = /<h3[^>]+class="[^"]*card-content__topic[^"]*"[^>]*>([\s\S]*?)<\/h3>/gi;
  const allTopics: { text: string; index: number }[] = [];
  let topm: RegExpExecArray | null;
  while ((topm = topicRx.exec(html)) !== null) {
    const t = cleanLine(decodeHtml(stripTags(topm[1])));
    if (t) allTopics.push({ text: t, index: topm.index });
  }

  let tm: RegExpExecArray | null;
  while ((tm = titleRx.exec(html)) !== null && items.length < MAX_ITEMS) {
    const titleText = cleanLine(decodeHtml(stripTags(tm[1])));
    if (!titleText || titleText.length <= 5 || junkTitles.has(titleText.toLowerCase())) continue;

    const titlePos = tm.index;

    // Find the nearest link that appears BEFORE this title
    let bestLink = "";
    for (let i = allLinks.length - 1; i >= 0; i--) {
      if (allLinks[i].index < titlePos && !seenLinks.has(allLinks[i].path)) {
        bestLink = allLinks[i].path;
        break;
      }
    }
    if (!bestLink) continue;
    seenLinks.add(bestLink);

    // Find the nearest topic that appears BEFORE this title (within 2000 chars)
    let category = "";
    for (let i = allTopics.length - 1; i >= 0; i--) {
      if (allTopics[i].index < titlePos && titlePos - allTopics[i].index < 2000) {
        category = allTopics[i].text;
        break;
      }
    }

    items.push({
      title: titleText,
      link: BASE_URL + bestLink,
      pubDate: "",
      category,
    });
  }

  return items;
}

// ── NRL.com article parser ────────────────────────────────────────────────────

export interface ArticleBlock { type: "heading" | "paragraph"; text: string }

function getArticleTitle(html: string): string {
  const h1 = html.match(/<h1[^>]+class="[^"]*header__title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return cleanLine(decodeHtml(stripTags(h1[1])));
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)
                || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i);
  if (ogTitle) return cleanLine(decodeHtml(ogTitle[1])).replace(/\s*\|\s*NRL.*/i, "").trim();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) return cleanLine(decodeHtml(title[1])).replace(/\s*\|\s*NRL.*/i, "").trim();
  return "Article";
}

function parseArticle(html: string): ArticleBlock[] {
  // Try to find the main article body
  const articleM = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)
                || html.match(/<div[^>]+class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
                || html.match(/<div[^>]+class="[^"]*content[^"]*body[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

  const content = articleM ? articleM[1] : html;
  const blockRx = /<(h1|h2|h3|p)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const blocks: ArticleBlock[] = [];
  let blocked = false;
  let m: RegExpExecArray | null;

  while ((m = blockRx.exec(content)) !== null) {
    const tag  = m[1].toLowerCase();
    const text = cleanLine(stripTags(m[2]));
    if (!text || isJunkLine(text)) continue;

    if (tag === "h1" || tag === "h2" || tag === "h3") {
      if (text.length < 8) continue;
      if (isBlockedSectionHeading(text)) { blocked = true; continue; }
      blocked = false;
      blocks.push({ type: "heading", text });
      continue;
    }

    if (tag === "p") {
      if (blocked) continue;
      if (isHeadingLike(text)) {
        if (isBlockedSectionHeading(text)) { blocked = true; continue; }
        blocked = false;
        blocks.push({ type: "heading", text });
      } else if (text.length >= 40) {
        blocks.push({ type: "paragraph", text });
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return blocks.filter(b => {
    const k = b.type + ":" + b.text;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/news", async (_req, res) => {
  try {
    const response = await fetch(NEWS_URL, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.9",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      res.status(502).json({ error: `NRL news fetch failed: ${response.status}` });
      return;
    }
    const html  = await response.text();
    const items = parseNewsList(html);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

router.get("/article", async (req, res) => {
  const url = String(req.query.url ?? "").trim();
  if (!url || !url.startsWith("http")) {
    res.status(400).json({ error: "Missing or invalid url param" });
    return;
  }
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.9",
      },
      signal: AbortSignal.timeout(14_000),
    });
    if (!response.ok) {
      res.status(502).json({ error: `Article fetch failed: ${response.status}` });
      return;
    }
    const html   = await response.text();
    const title  = getArticleTitle(html);
    const blocks = parseArticle(html).slice(0, 80);
    res.json({ title, blocks });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

export default router;
