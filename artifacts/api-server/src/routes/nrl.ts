import { Router } from "express";

const router = Router();

// Zero Tackle news is sourced via the WordPress REST API (not HTML scraping).
// The listing page URL in the task spec (/nrl-news/) returns a 404; the WP API
// at /wp-json/wp/v2/posts is stable and returns clean JSON.
// Category 18176 = "Latest NRL News" on zerotackle.com.
const ZT_API_URL  = "https://www.zerotackle.com/wp-json/wp/v2/posts";
const ZT_CATEGORY = 18176;
const MAX_ITEMS   = 40;
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// Prefixes that are blocked from the NRL News tab
// (team-list prefixes are routed to the Team Lists tab instead)
const NRL_NEWS_BLOCKED_PREFIXES = [
  "full time",
  "updated team lists",
  "final teams",
  "coach's corner",
  "coaches corner",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function decodeHtml(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8216;/g, "\u2018")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8220;/g, "\u201C")
    .replace(/&#8221;/g, "\u201D")
    .replace(/&#8211;/g, "\u2013")
    .replace(/&#8212;/g, "\u2014")
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

function normalizeQuotes(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
}

function hasBlockedPrefix(title: string): boolean {
  const t = normalizeQuotes(title).toLowerCase().trim();
  return NRL_NEWS_BLOCKED_PREFIXES.some(p => t.startsWith(p));
}

// ── Zero Tackle WP API types ──────────────────────────────────────────────────

interface WpPost {
  id: number;
  date: string;
  title: { rendered: string };
  link: string;
  categories: number[];
  _embedded?: {
    "wp:term"?: Array<Array<{ id: number; name: string; slug: string }>>;
  };
}

interface NewsItem { title: string; link: string; pubDate: string; category: string; _blocked: boolean }

// ── Zero Tackle article parser (HTML scraping of individual article pages) ────

export interface ArticleBlock { type: "heading" | "paragraph"; text: string }

function getArticleTitle(html: string): string {
  const h1 = html.match(/<h1[^>]+class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
           || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return cleanLine(decodeHtml(stripTags(h1[1])));
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)
                || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i);
  if (ogTitle) return cleanLine(decodeHtml(ogTitle[1])).replace(/\s*[-|]\s*Zero Tackle.*/i, "").trim();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) return cleanLine(decodeHtml(title[1])).replace(/\s*[-|]\s*Zero Tackle.*/i, "").trim();
  return "Article";
}

function parseZtArticle(html: string): ArticleBlock[] {
  let content = html;

  // Strip known junk blocks before parsing
  content = content.replace(/<div[^>]+class="[^"]*code-block[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
  content = content.replace(/<div[^>]+class="[^"]*td-post-sharing[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
  content = content.replace(/<div[^>]+class="[^"]*td-author[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
  content = content.replace(/<div[^>]+class="[^"]*td-post-next-prev[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
  content = content.replace(/<div[^>]+class="[^"]*td-related[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");

  // Find the article body
  const articleM = content.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)
                 || content.match(/<div[^>]+class="[^"]*td-post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
                 || content.match(/<div[^>]+class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

  const body = articleM ? articleM[1] : content;

  const blockRx = /<(h1|h2|h3|p)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const blocks: ArticleBlock[] = [];
  let blocked = false;
  let m: RegExpExecArray | null;

  while ((m = blockRx.exec(body)) !== null) {
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

async function fetchPage(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-AU,en;q=0.9",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.text();
}

async function fetchWpPosts(page: number): Promise<WpPost[]> {
  const url = `${ZT_API_URL}?categories=${ZT_CATEGORY}&per_page=20&page=${page}&_embed=wp:term`;
  const r = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json",
    },
    signal: AbortSignal.timeout(12_000),
  });
  // Page 2 can return 400 when there are fewer than 21 total posts — treat as empty
  if (!r.ok) {
    if (page > 1 && r.status === 400) return [];
    throw new Error(`WP API error: ${r.status}`);
  }
  return r.json();
}

function wpPostToNewsItem(post: WpPost): NewsItem {
  const title = cleanLine(decodeHtml(post.title.rendered));

  // Extract primary category name from embedded terms
  let category = "";
  const terms = post._embedded?.["wp:term"]?.[0] ?? [];
  // Skip the catch-all categories (18176, 6) and pick the first meaningful one
  const skipIds = new Set([ZT_CATEGORY, 6]);
  const catTerm = terms.find(t => !skipIds.has(t.id));
  if (catTerm) category = decodeHtml(catTerm.name);

  return {
    title,
    link: post.link,
    pubDate: post.date ?? "",
    category,
    _blocked: hasBlockedPrefix(title),
  };
}

router.get("/news", async (_req, res) => {
  try {
    // Fetch pages 1 and 2 in parallel for ~40 articles
    const [posts1, posts2] = await Promise.all([
      fetchWpPosts(1),
      fetchWpPosts(2),
    ]);

    const seen = new Set<string>();
    const combined: NewsItem[] = [];
    for (const post of [...posts1, ...posts2]) {
      if (seen.has(post.link)) continue;
      seen.add(post.link);
      combined.push(wpPostToNewsItem(post));
      if (combined.length >= MAX_ITEMS) break;
    }

    res.json({ items: combined });
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
    const parsed = new URL(url);
    const ALLOWED_HOSTS = new Set(["zerotackle.com", "www.zerotackle.com"]);
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      res.status(400).json({ error: "URL must be a zerotackle.com article" });
      return;
    }
  } catch {
    res.status(400).json({ error: "Invalid url param" });
    return;
  }
  try {
    const html   = await fetchPage(url);
    const title  = getArticleTitle(html);
    const blocks = parseZtArticle(html).slice(0, 80);
    res.json({ title, blocks });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

export default router;
