import { Router, type IRouter } from "express";

const router: IRouter = Router();

const NOTION_VERSION = "2022-06-28";

function notionHeaders(apiKey: string) {
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

function extractTitle(titleProp: any): string {
  if (!titleProp) return "Untitled";
  const arr = titleProp.title || titleProp.rich_text || [];
  return arr.map((t: any) => t.plain_text).join("") || "Untitled";
}

function extractStatus(props: Record<string, any>): string {
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (prop.type === "status" && prop.status?.name) {
      return prop.status.name;
    }
    if (prop.type === "select" && prop.select?.name) {
      return prop.select.name;
    }
  }
  return "Not started";
}

function extractStatusFieldName(schema: Record<string, any>): string | null {
  for (const key of Object.keys(schema)) {
    if (schema[key].type === "status" || schema[key].type === "select") {
      return key;
    }
  }
  return null;
}

function extractPriority(props: Record<string, any>): string | undefined {
  for (const key of Object.keys(props)) {
    const lower = key.toLowerCase();
    if (lower === "priority") {
      const prop = props[key];
      if (prop.type === "select" && prop.select?.name) return prop.select.name;
    }
  }
  return undefined;
}

function extractDate(props: Record<string, any>): string | undefined {
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (prop.type === "date" && prop.date?.start) {
      return prop.date.start;
    }
  }
  return undefined;
}

function extractTags(props: Record<string, any>): string[] {
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (prop.type === "multi_select" && Array.isArray(prop.multi_select)) {
      return prop.multi_select.map((t: any) => t.name);
    }
  }
  return [];
}

function extractDescription(props: Record<string, any>): string | undefined {
  for (const key of Object.keys(props)) {
    const lower = key.toLowerCase();
    if (
      (lower === "description" || lower === "notes" || lower === "summary") &&
      props[key].type === "rich_text"
    ) {
      const arr = props[key].rich_text || [];
      const text = arr.map((t: any) => t.plain_text).join("");
      return text || undefined;
    }
  }
  return undefined;
}

router.get("/databases", async (req, res) => {
  const apiKey = req.headers["x-notion-key"] as string;
  if (!apiKey) {
    res.status(400).json({ message: "Missing Notion API key" });
    return;
  }

  try {
    const response = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: notionHeaders(apiKey),
      body: JSON.stringify({ filter: { value: "database", property: "object" } }),
    });

    if (!response.ok) {
      const err = await response.json();
      res.status(response.status).json({ message: err.message || "Notion error" });
      return;
    }

    const data = await response.json();
    const databases = (data.results || []).map((db: any) => {
      // For database objects, title is a top-level array of rich text segments
      const titleArr: any[] = Array.isArray(db.title) ? db.title : [];
      const title = titleArr.map((t: any) => t.plain_text || "").join("").trim() || "Untitled";
      return { id: db.id, title, statuses: [] };
    });

    res.json({ databases });
  } catch (e: any) {
    req.log?.error({ err: e }, "Failed to fetch Notion databases");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/tasks", async (req, res) => {
  const apiKey = req.headers["x-notion-key"] as string;
  const databaseId = req.query.database_id as string;

  if (!apiKey) {
    res.status(400).json({ message: "Missing Notion API key" });
    return;
  }
  if (!databaseId) {
    res.status(400).json({ message: "Missing database_id" });
    return;
  }

  try {
    const allTasks: any[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const body: any = { page_size: 100 };
      if (cursor) body.start_cursor = cursor;

      const response = await fetch(
        `https://api.notion.com/v1/databases/${databaseId}/query`,
        {
          method: "POST",
          headers: notionHeaders(apiKey),
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        res.status(response.status).json({ message: err.message || "Notion error" });
        return;
      }

      const data = await response.json();
      allTasks.push(...(data.results || []));
      hasMore = data.has_more;
      cursor = data.next_cursor;
    }

    const tasks = allTasks.map((page: any) => {
      const props = page.properties || {};
      const titleProp = Object.values(props).find(
        (p: any) => p.type === "title"
      ) as any;

      return {
        id: page.id,
        title: extractTitle(titleProp),
        status: extractStatus(props),
        priority: extractPriority(props),
        dueDate: extractDate(props),
        description: extractDescription(props),
        tags: extractTags(props),
        url: page.url,
      };
    });

    res.json({ tasks });
  } catch (e: any) {
    req.log?.error({ err: e }, "Failed to fetch Notion tasks");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/tasks/:taskId", async (req, res) => {
  const apiKey = req.headers["x-notion-key"] as string;
  const { taskId } = req.params;
  const { status } = req.body;

  if (!apiKey) {
    res.status(400).json({ message: "Missing Notion API key" });
    return;
  }
  if (!status) {
    res.status(400).json({ message: "Missing status" });
    return;
  }

  try {
    const pageRes = await fetch(`https://api.notion.com/v1/pages/${taskId}`, {
      headers: notionHeaders(apiKey),
    });

    if (!pageRes.ok) {
      const err = await pageRes.json();
      res.status(pageRes.status).json({ message: err.message || "Notion error" });
      return;
    }

    const page = await pageRes.json();
    const props = page.properties || {};

    let statusPropName: string | null = null;
    let statusPropType: string | null = null;

    for (const key of Object.keys(props)) {
      if (props[key].type === "status") {
        statusPropName = key;
        statusPropType = "status";
        break;
      }
    }
    if (!statusPropName) {
      for (const key of Object.keys(props)) {
        if (props[key].type === "select") {
          statusPropName = key;
          statusPropType = "select";
          break;
        }
      }
    }

    if (!statusPropName || !statusPropType) {
      res.status(400).json({ message: "No status property found on this page" });
      return;
    }

    const updateBody: any = {
      properties: {
        [statusPropName]:
          statusPropType === "status"
            ? { status: { name: status } }
            : { select: { name: status } },
      },
    };

    const updateRes = await fetch(`https://api.notion.com/v1/pages/${taskId}`, {
      method: "PATCH",
      headers: notionHeaders(apiKey),
      body: JSON.stringify(updateBody),
    });

    if (!updateRes.ok) {
      const err = await updateRes.json();
      res.status(updateRes.status).json({ message: err.message || "Update failed" });
      return;
    }

    res.json({ success: true });
  } catch (e: any) {
    req.log?.error({ err: e }, "Failed to update Notion task");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/schema/:dbId", async (req, res) => {
  const apiKey = req.headers["x-notion-key"] as string;
  const { dbId } = req.params;
  if (!apiKey) { res.status(400).json({ message: "Missing Notion API key" }); return; }
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
      headers: notionHeaders(apiKey),
    });
    if (!response.ok) {
      const err = await response.json();
      res.status(response.status).json({ message: err.message || "Notion error" });
      return;
    }
    const db = await response.json();
    const props = db.properties || {};
    const priProp = props["-"];
    const priType = priProp?.type || "select";
    const priOptions =
      priType === "select" ? (priProp?.select?.options || []).map((o: any) => o.name.replace(/\uFE0F/g, "")) :
      priType === "status" ? (priProp?.status?.options || []).map((o: any) => o.name.replace(/\uFE0F/g, "")) : null;
    const epicProp = props["Epic"];
    const epicType = epicProp?.type || "select";
    const priorityProp = props["Priority"];
    const priorityType = priorityProp?.type || "select";
    const categoryProp = props["Category"];
    const categoryType = categoryProp?.type || "select";
    res.json({ priType, priOptions, epicType, priorityType, categoryType });
  } catch (e: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/pages", async (req, res) => {
  const apiKey = req.headers["x-notion-key"] as string;
  const { dbId, title, epic, emoji, priType, priOptions, epicType, priorityType, category } = req.body;
  if (!apiKey) { res.status(400).json({ message: "Missing Notion API key" }); return; }
  if (!dbId || !title) { res.status(400).json({ message: "Missing dbId or title" }); return; }

  const IR_PRIORITY_NOW = " ".repeat(23) + "\u2757\uFE0F Now";

  function findBest(wanted: string, options: string[] | null): string {
    if (!options) return wanted;
    const w = wanted.toLowerCase().trim();
    for (const o of options) { if (o.toLowerCase().trim() === w) return o; }
    return wanted;
  }

  try {
    const body: any = {
      parent: { database_id: dbId },
      properties: {
        Task: { title: [{ type: "text", text: { content: title } }] },
        Done: { checkbox: false },
      },
    };

    if (priorityType === "select") body.properties.Priority = { select: { name: IR_PRIORITY_NOW } };
    else if (priorityType === "status") body.properties.Priority = { status: { name: IR_PRIORITY_NOW } };

    if (category) {
      // Try select first, fall back to status — caller can pass categoryType to override
      const categoryType = req.body.categoryType || "select";
      if (categoryType === "select") body.properties.Category = { select: { name: category } };
      else if (categoryType === "status") body.properties.Category = { status: { name: category } };
    }

    if (epic) {
      if (epicType === "select") body.properties.Epic = { select: { name: epic } };
      else if (epicType === "status") body.properties.Epic = { status: { name: epic } };
    }

    const emojiVal = String(emoji || "\uD83D\uDD25").replace(/\uFE0F/g, "");
    if (priType === "select") body.properties["-"] = { select: { name: findBest(emojiVal, priOptions) } };
    else if (priType === "status") body.properties["-"] = { status: { name: findBest(emojiVal, priOptions) } };
    else body.properties["-"] = { rich_text: [{ type: "text", text: { content: emojiVal } }] };

    const response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: notionHeaders(apiKey),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json();
      res.status(response.status).json({ message: err.message || "Notion error" });
      return;
    }
    const page = await response.json();
    res.json({ success: true, id: page.id });
  } catch (e: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Life Tasks ────────────────────────────────────────────────────────────────
const LIFE_DB_ID = "2c8b7eba3523802abbe2e934df42a4e2";

router.get("/life-tasks", async (req, res) => {
  const apiKey = req.headers["x-notion-key"] as string;
  const { category } = req.query;
  if (!apiKey) { res.status(400).json({ message: "Missing Notion API key" }); return; }

  try {
    const filterClauses: any[] = [
      { property: "Done", checkbox: { equals: false } },
    ];
    if (category) {
      filterClauses.push({ property: "Category", select: { equals: category as string } });
    }

    const body: any = {
      page_size: 100,
      filter: { and: filterClauses },
      sorts: [{ property: "Sort Order", direction: "ascending" }],
    };

    const response = await fetch(
      `https://api.notion.com/v1/databases/${LIFE_DB_ID}/query`,
      { method: "POST", headers: notionHeaders(apiKey), body: JSON.stringify(body) }
    );
    if (!response.ok) {
      const err = await response.json();
      res.status(response.status).json({ message: err.message || "Notion error" });
      return;
    }

    const data = await response.json();
    const tasks = (data.results || []).map((page: any) => {
      const props = page.properties || {};
      const titleArr: any[] = props.Task?.title || [];
      const title = titleArr.map((t: any) => t.plain_text).join("") || "Untitled";

      const emojiProp = props["-"];
      let emoji = "-";
      if (emojiProp?.type === "select" && emojiProp.select?.name)       emoji = emojiProp.select.name;
      else if (emojiProp?.type === "status" && emojiProp.status?.name)  emoji = emojiProp.status.name;
      else if (emojiProp?.type === "rich_text")
        emoji = (emojiProp.rich_text || []).map((t: any) => t.plain_text).join("") || "-";

      const sortOrder: number | null = props["Sort Order"]?.number ?? null;

      // Reference URL (URL-type or rich_text with link)
      let url: string | null = null;
      const refProp = props["Reference"];
      if (refProp?.type === "url") {
        url = refProp.url ?? null;
      } else if (refProp?.type === "rich_text") {
        for (const block of (refProp.rich_text || [])) {
          if (block.href)               { url = block.href;               break; }
          if (block.text?.link?.url)    { url = block.text.link.url;      break; }
        }
      }
      // Fallback: first URL-type property
      if (!url) {
        for (const key of Object.keys(props)) {
          if (props[key].type === "url" && props[key].url) { url = props[key].url; break; }
        }
      }

      return { id: page.id, title, emoji, sortOrder, url };
    });

    res.json({ tasks });
  } catch (e: any) {
    req.log?.error({ err: e }, "Failed to fetch life tasks");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/life-tasks/:pageId", async (req, res) => {
  const apiKey = req.headers["x-notion-key"] as string;
  const { pageId } = req.params;
  if (!apiKey) { res.status(400).json({ message: "Missing Notion API key" }); return; }
  try {
    const r = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "PATCH",
      headers: notionHeaders(apiKey),
      body: JSON.stringify({ archived: true }),
    });
    if (!r.ok) {
      const err = await r.json();
      res.status(r.status).json({ message: err.message || "Archive failed" });
      return;
    }
    res.json({ success: true });
  } catch (e: any) {
    req.log?.error({ err: e }, "Failed to archive life task");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/life-tasks/:pageId", async (req, res) => {
  const apiKey = req.headers["x-notion-key"] as string;
  const { pageId } = req.params;
  const { emoji, sortOrder, done, title } = req.body;
  if (!apiKey) { res.status(400).json({ message: "Missing Notion API key" }); return; }

  try {
    const updateProps: any = {};

    if (title !== undefined) {
      updateProps.Task = { title: [{ type: "text", text: { content: title } }] };
    }
    if (done !== undefined) {
      updateProps.Done = { checkbox: done };
    }
    if (sortOrder !== undefined) {
      updateProps["Sort Order"] = { number: sortOrder };
    }
    if (emoji !== undefined) {
      // Fetch the page to discover the "-" property type
      const pageRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        headers: notionHeaders(apiKey),
      });
      if (pageRes.ok) {
        const page = await pageRes.json();
        const propType = page.properties?.["-"]?.type || "select";
        const clean = String(emoji).replace(/\uFE0F/g, "");
        if (propType === "select")      updateProps["-"] = { select: { name: clean } };
        else if (propType === "status") updateProps["-"] = { status: { name: clean } };
        else                            updateProps["-"] = { rich_text: [{ type: "text", text: { content: clean } }] };
      }
    }

    if (Object.keys(updateProps).length === 0) { res.json({ success: true }); return; }

    const updateRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "PATCH",
      headers: notionHeaders(apiKey),
      body: JSON.stringify({ properties: updateProps }),
    });
    if (!updateRes.ok) {
      const err = await updateRes.json();
      res.status(updateRes.status).json({ message: err.message || "Update failed" });
      return;
    }
    res.json({ success: true });
  } catch (e: any) {
    req.log?.error({ err: e }, "Failed to patch life task");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/page-blocks/:pageId", async (req, res) => {
  const apiKey = req.headers["x-notion-key"] as string;
  const { pageId } = req.params;
  if (!apiKey) { res.status(400).json({ message: "Missing Notion API key" }); return; }

  try {
    const response = await fetch(
      `https://api.notion.com/v1/blocks/${pageId}/children?page_size=50`,
      { headers: notionHeaders(apiKey) }
    );
    if (!response.ok) {
      const err = await response.json();
      res.status(response.status).json({ message: err.message || "Notion error" });
      return;
    }
    const data = await response.json();

    const extractText = (block: any): string => {
      const type = block.type;
      const arr: any[] = block[type]?.rich_text || block[type]?.text || [];
      return arr.map((t: any) => t.plain_text || "").join("");
    };

    const lines = (data.results || [])
      .map((b: any) => extractText(b))
      .filter((t: string) => t.length > 0);

    res.json({ body: lines.join("\n") });
  } catch (e: any) {
    req.log?.error({ err: e }, "Failed to fetch page blocks");
    res.status(500).json({ message: "Internal server error" });
  }
});

// Replace all paragraph blocks on a page with new text
router.patch("/page-blocks/:pageId", async (req, res) => {
  const apiKey = req.headers["x-notion-key"] as string;
  const { pageId } = req.params;
  const { body } = req.body as { body: string };
  if (!apiKey) { res.status(400).json({ message: "Missing Notion API key" }); return; }

  try {
    // 1. Fetch existing block IDs
    const listRes = await fetch(
      `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`,
      { headers: notionHeaders(apiKey) }
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      const blockIds: string[] = (listData.results || []).map((b: any) => b.id);
      // Delete each existing block
      await Promise.all(
        blockIds.map(bid =>
          fetch(`https://api.notion.com/v1/blocks/${bid}`, {
            method: "DELETE",
            headers: notionHeaders(apiKey),
          })
        )
      );
    }

    // 2. Append new paragraph blocks (one per non-empty line)
    const lines = (body || "").split("\n").filter(l => l.trim().length > 0);
    const children = lines.length > 0
      ? lines.map(line => ({
          type: "paragraph",
          paragraph: { rich_text: [{ type: "text", text: { content: line } }] },
        }))
      : [{ type: "paragraph", paragraph: { rich_text: [] } }];

    const appendRes = await fetch(
      `https://api.notion.com/v1/blocks/${pageId}/children`,
      {
        method: "PATCH",
        headers: notionHeaders(apiKey),
        body: JSON.stringify({ children }),
      }
    );
    if (!appendRes.ok) {
      const err = await appendRes.json();
      res.status(appendRes.status).json({ message: err.message || "Failed to update blocks" });
      return;
    }
    res.json({ success: true });
  } catch (e: any) {
    req.log?.error({ err: e }, "Failed to patch page blocks");
    res.status(500).json({ message: "Internal server error" });
  }
});

function toMonthKey(d: string | null): string | null {
  return d ? d.slice(0, 7) : null;
}
function toWeekOfMonth(d: string | null): string | null {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : "W" + Math.ceil(dt.getDate() / 7);
}
function getWeeksInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return Math.ceil(new Date(y, m, 0).getDate() / 7);
}
function getVisibleWeekCount(key: string): number {
  const now = new Date();
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const max = getWeeksInMonth(key);
  if (key < cur) return max;
  if (key === cur) return Math.min(Math.ceil(now.getDate() / 7), max);
  return 0;
}

router.get("/workload", async (req, res) => {
  const apiKey = req.headers["x-notion-key"] as string;
  const { database_id } = req.query;
  if (!apiKey) { res.status(400).json({ message: "Missing Notion API key" }); return; }
  if (!database_id) { res.status(400).json({ message: "Missing database_id" }); return; }

  type WeekBucket = { created: number; done: number; createdItems: string[]; doneItems: string[] };
  type MonthWeeks = Record<string, WeekBucket>;
  type CatBucket = { created: number; done: number; doneItems: string[] };

  try {
    const allPages: any[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const body: any = { page_size: 100 };
      if (cursor) body.start_cursor = cursor;
      const response = await fetch(
        `https://api.notion.com/v1/databases/${database_id}/query`,
        { method: "POST", headers: notionHeaders(apiKey), body: JSON.stringify(body) }
      );
      if (!response.ok) {
        const err = await response.json();
        res.status(response.status).json({ message: err.message || "Notion error" });
        return;
      }
      const data = await response.json();
      allPages.push(...(data.results || []));
      hasMore = data.has_more;
      cursor = data.next_cursor;
    }

    const monthData: Record<string, MonthWeeks> = {};
    const categoryMonthData: Record<string, Record<string, CatBucket>> = {};

    for (const page of allPages) {
      const props = page.properties || {};
      const cs: string | null = props.Created?.created_time || page.created_time || null;
      const us: string | null = props.Updated?.last_edited_time || page.last_edited_time || null;
      const done = props.Done?.checkbox === true;
      const cat: string = props.Category?.type === "select"
        ? (props.Category.select?.name || "Uncategorised")
        : "Uncategorised";
      const titleArr: any[] = props.Task?.title || [];
      const title = titleArr.map((t: any) => t.plain_text || "").join("") || "Untitled";

      const cm = toMonthKey(cs);
      const cw = toWeekOfMonth(cs);
      if (cm && cw) {
        if (!monthData[cm]) monthData[cm] = {};
        if (!monthData[cm][cw]) monthData[cm][cw] = { created: 0, done: 0, createdItems: [], doneItems: [] };
        monthData[cm][cw].created++;
        monthData[cm][cw].createdItems.push(title);
        if (!categoryMonthData[cm]) categoryMonthData[cm] = {};
        if (!categoryMonthData[cm][cat]) categoryMonthData[cm][cat] = { created: 0, done: 0, doneItems: [] };
        categoryMonthData[cm][cat].created++;
      }

      if (done && us) {
        const dm = toMonthKey(us);
        const dw = toWeekOfMonth(us);
        if (dm && dw) {
          if (!monthData[dm]) monthData[dm] = {};
          if (!monthData[dm][dw]) monthData[dm][dw] = { created: 0, done: 0, createdItems: [], doneItems: [] };
          monthData[dm][dw].done++;
          monthData[dm][dw].doneItems.push(title);
        }
        if (dm) {
          if (!categoryMonthData[dm]) categoryMonthData[dm] = {};
          if (!categoryMonthData[dm][cat]) categoryMonthData[dm][cat] = { created: 0, done: 0, doneItems: [] };
          categoryMonthData[dm][cat].done++;
          categoryMonthData[dm][cat].doneItems.push(title);
        }
      }
    }

    // Fill missing weeks
    for (const mk of Object.keys(monthData)) {
      for (let w = 1; w <= getWeeksInMonth(mk); w++) {
        const wk = `W${w}`;
        if (!monthData[mk][wk]) monthData[mk][wk] = { created: 0, done: 0, createdItems: [], doneItems: [] };
      }
    }

    const sortedKeys = Object.keys(monthData).sort();

    const months = sortedKeys.map((key) => {
      const visibleCount = getVisibleWeekCount(key);
      const visibleWeeks = Array.from({ length: visibleCount }, (_, i) => `W${i + 1}`);
      const weeks = monthData[key];
      const tc = visibleWeeks.reduce((a, w) => a + (weeks[w]?.created || 0), 0);
      const td = visibleWeeks.reduce((a, w) => a + (weeks[w]?.done || 0), 0);
      const maxWeekVal = Math.max(1, ...visibleWeeks.map((w) => Math.max(weeks[w]?.created || 0, weeks[w]?.done || 0)));
      const [y, m] = key.split("-").map(Number);
      const label = new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
      const catEntries = Object.entries(categoryMonthData[key] || {})
        .sort((a, b) => (b[1].created + b[1].done) - (a[1].created + a[1].done))
        .slice(0, 8);
      const maxCatVal = Math.max(1, ...catEntries.map(([, v]) => Math.max(v.created, v.done)));
      return {
        key, label, totalCreated: tc, totalDone: td, maxWeekVal,
        visibleWeeks,
        weeks: Object.fromEntries(
          Object.entries(weeks).map(([k, v]) => [k, {
            created: v.created, done: v.done,
            createdItems: v.createdItems, doneItems: v.doneItems,
          }])
        ),
        categories: catEntries.map(([name, v]) => ({
          name, created: v.created, done: v.done, doneItems: v.doneItems,
        })),
        maxCatVal,
      };
    });

    res.json({ months });
  } catch (e: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

const MOOD_ORDER = ["Awesome", "Good", "Meh", "Tired", "Low", "Stressed"];

router.get("/moods", async (req, res) => {
  const apiKey = req.headers["x-notion-key"] as string;
  const { database_id } = req.query;
  if (!apiKey) { res.status(400).json({ message: "Missing Notion API key" }); return; }
  if (!database_id) { res.status(400).json({ message: "Missing database_id" }); return; }

  try {
    const allPages: any[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const body: any = {
        page_size: 100,
        sorts: [{ property: "Date", direction: "ascending" }],
      };
      if (cursor) body.start_cursor = cursor;

      const response = await fetch(
        `https://api.notion.com/v1/databases/${database_id}/query`,
        { method: "POST", headers: notionHeaders(apiKey), body: JSON.stringify(body) }
      );

      if (!response.ok) {
        const err = await response.json();
        res.status(response.status).json({ message: err.message || "Notion error" });
        return;
      }

      const data = await response.json();
      allPages.push(...(data.results || []));
      hasMore = data.has_more;
      cursor = data.next_cursor;
    }

    const months: Record<string, Record<string, number>> = {};

    for (const page of allPages) {
      const props = page.properties || {};
      const titleArr = (props.Mood?.title || []) as any[];
      const raw = titleArr.map((t: any) => t.plain_text).join("").trim();
      if (!raw) continue;

      let mood: string | null = null;
      for (const m of MOOD_ORDER) {
        if (raw.toLowerCase().includes(m.toLowerCase())) { mood = m; break; }
      }
      if (!mood) mood = raw.replace(/[^\w\s]/gu, "").trim() || null;
      if (!mood) continue;

      const dateStr = props.Date?.date?.start;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!months[key]) months[key] = {};
      months[key][mood] = (months[key][mood] || 0) + 1;
    }

    const sortedKeys = Object.keys(months).sort();
    res.json({ months: sortedKeys.map((key) => ({ key, counts: months[key] })) });
  } catch (e: any) {
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
