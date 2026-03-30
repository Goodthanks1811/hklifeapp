import { Router } from "express";

const router = Router();

const RSS_URL  = "https://www.foxsports.com.au/content-feeds/rugby-league";
const MAX_ITEMS = 30;
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
  if (["cookie", "subscribe", "sign up", "newsletter", "privacy"].some(p => t.includes(p))) return true;
  if (/^watch every game\b/i.test(cleanLine(raw))) return true;
  return false;
}

function isBlockedSectionHeading(s: string): boolean {
  const t = cleanLine(s).toLowerCase();
  if (/^more nrl news\b/.test(t)) return true;
  if (/^crawls?\b/.test(t)) return true;
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
  const lower = ["a","an","and","as","at","but","by","for","from","in","into","of","on","or","the","to","vs","via","with"];
  let titleish = 0, alphaWords = 0;
  for (const word of words) {
    const plain = word.replace(/[^A-Za-z''\\-]/g, "");
    if (!plain) continue;
    alphaWords++;
    if (lower.includes(plain.toLowerCase())) { titleish++; continue; }
    if (/^[A-Z][a-zA-Z''\\-]*$/.test(plain) || /^[A-Z]{2,}$/.test(plain)) titleish++;
  }
  if (alphaWords < 3) return false;
  return (titleish / alphaWords) >= 0.72;
}

function isHeadingLike(s: string): boolean {
  return isAllCapsHeadingLike(s) || isTitleCaseHeadingLike(s);
}

function getOgTitle(html: string): string {
  const m = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)
         || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i);
  if (m) return decodeHtml(m[1]).trim();
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t) return decodeHtml(t[1]).trim();
  return "Article";
}

function getCleanTitle(html: string): string {
  return getOgTitle(html)
    .replace(/\s*\|\s*FOX SPORTS.*/i, "")
    .replace(/\s*\|\s*Fox Sports.*/i, "")
    .replace(/\s*-\s*Fox Sports.*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── RSS parsing ───────────────────────────────────────────────────────────────

interface RssItem { title: string; link: string; pubDate: string }

function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRx = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let itemM: RegExpExecArray | null;
  while ((itemM = itemRx.exec(xml)) !== null) {
    const block = itemM[1];
    const title   = cleanLine(decodeHtml((block.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) || block.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || ["",""])[1]));
    const link    = cleanLine((block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || ["",""])[1]);
    const pubDate = cleanLine((block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || ["",""])[1]);
    if (title && link) items.push({ title, link, pubDate });
  }
  return items;
}

// ── Article parsing ───────────────────────────────────────────────────────────

export interface ArticleBlock { type: "heading" | "paragraph"; text: string }

function parseArticle(html: string): ArticleBlock[] {
  const articleM = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (!articleM) return [];

  const content = articleM[1];
  const blockRx = /<(h2|h3|p)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const blocks: ArticleBlock[] = [];
  let blocked = false;
  let m: RegExpExecArray | null;

  while ((m = blockRx.exec(content)) !== null) {
    const tag  = m[1].toLowerCase();
    const text = cleanLine(stripTags(m[2]));
    if (!text || isJunkLine(text)) continue;

    if (tag === "h2" || tag === "h3") {
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
    const response = await fetch(RSS_URL, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      res.status(502).json({ error: `RSS fetch failed: ${response.status}` });
      return;
    }
    const xml   = await response.text();
    const items = parseRss(xml).slice(0, MAX_ITEMS);
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
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(14_000),
    });
    if (!response.ok) {
      res.status(502).json({ error: `Article fetch failed: ${response.status}` });
      return;
    }
    const html   = await response.text();
    const title  = getCleanTitle(html);
    const blocks = parseArticle(html).slice(0, 80);
    res.json({ title, blocks });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

export default router;
