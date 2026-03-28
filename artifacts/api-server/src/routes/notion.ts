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

export default router;
