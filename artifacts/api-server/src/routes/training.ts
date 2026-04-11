import { Router, type IRouter } from "express";

const router: IRouter = Router();

const NOTION_VERSION = "2022-06-28";
const TRAINING_DB_ID = "31cb7eba352380219424cc5f81ba0430";

function notionHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

function extractTitle(titleProp: any): string {
  if (!titleProp) return "Untitled";
  const arr: any[] = titleProp.title || titleProp.rich_text || [];
  return arr.map((t: any) => t.plain_text as string).join("") || "Untitled";
}

function extractRichText(prop: any): string {
  if (!prop) return "";
  const arr: any[] = prop.rich_text || prop.title || [];
  return arr.map((t: any) => t.plain_text as string).join("");
}

const ALL_BODY_PARTS = ["Chest", "Back", "Legs", "Arms", "Shoulders", "Cardio"];

async function fetchExercisesByBodyPart(apiKey: string, bodyPart: string): Promise<any[]> {
  const allPages: any[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const body: Record<string, unknown> = {
      page_size: 100,
      filter: {
        and: [
          { property: "Select", select: { equals: "Baseline" } },
          { property: "Body Part", select: { equals: bodyPart } },
        ],
      },
    };
    if (cursor) body.start_cursor = cursor;

    const response = await fetch(
      `https://api.notion.com/v1/databases/${TRAINING_DB_ID}/query`,
      { method: "POST", headers: notionHeaders(apiKey), body: JSON.stringify(body) }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error((err as any).message || "Notion error");
    }

    const data = await response.json();
    allPages.push(...((data as any).results || []));
    hasMore = (data as any).has_more;
    cursor = (data as any).next_cursor;
  }

  return allPages.map((page: any) => {
    const props = page.properties || {};
    const titleProp = (Object.values(props) as any[]).find((p: any) => p.type === "title");
    const name = extractTitle(titleProp);
    const setupProp: any = props["Setup"] || props["Setup Notes"] || null;
    const setup = setupProp ? extractRichText(setupProp) : "";
    const bodyPartProp: any = props["Body Part"];
    const bp: string = bodyPartProp?.type === "select"
      ? (bodyPartProp?.select?.name as string) || bodyPart
      : bodyPart;
    return { id: page.id as string, name, setup, bodyPart: bp };
  });
}

router.get("/exercises/all", async (req, res) => {
  const apiKey = req.headers["x-notion-key"] as string;

  if (!apiKey) {
    res.status(400).json({ message: "Missing Notion API key" });
    return;
  }

  try {
    const results = await Promise.all(
      ALL_BODY_PARTS.map(bp => fetchExercisesByBodyPart(apiKey, bp))
    );
    const exercises = results.flat();
    res.json({ exercises });
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Internal server error" });
  }
});

router.get("/exercises/:bodyPart", async (req, res) => {
  const apiKey = req.headers["x-notion-key"] as string;
  const { bodyPart } = req.params;

  if (!apiKey) {
    res.status(400).json({ message: "Missing Notion API key" });
    return;
  }

  try {
    const exercises = await fetchExercisesByBodyPart(apiKey, bodyPart);
    res.json({ exercises });
  } catch (e: any) {
    res.status(500).json({ message: e.message || "Internal server error" });
  }
});

interface LogSet {
  setNumber: number;
  reps: string;
  weight: string;
}

interface LogEntry {
  name: string;
  bodyPart: string;
  setup: string;
  notes: string;
  sets: LogSet[];
}

router.post("/log", async (req, res) => {
  const apiKey = req.headers["x-notion-key"] as string;
  const { entries } = req.body as { entries: LogEntry[] };

  if (!apiKey) {
    res.status(400).json({ message: "Missing Notion API key" });
    return;
  }
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ message: "Missing or empty entries array" });
    return;
  }

  const results: { id: string }[] = [];
  const errors: { exercise: string; set: number; error: string }[] = [];

  for (const entry of entries) {
    for (const set of entry.sets) {
      const repsNum = parseFloat(set.reps) || 0;
      const weightNum = parseFloat(set.weight) || 0;

      const properties: Record<string, unknown> = {
        Movement: {
          title: [{ type: "text", text: { content: entry.name } }],
        },
        "Body Part": { select: { name: entry.bodyPart } },
        "Set number": { number: set.setNumber },
        Reps: { number: repsNum },
        "Weight (Kgs)": { number: weightNum },
      };

      if (entry.setup && entry.setup.trim()) {
        properties["Setup"] = {
          rich_text: [{ type: "text", text: { content: entry.setup.trim() } }],
        };
      }

      if (entry.notes && entry.notes.trim()) {
        properties["Notes"] = {
          rich_text: [{ type: "text", text: { content: entry.notes.trim() } }],
        };
      }

      const pageBody = {
        parent: { database_id: TRAINING_DB_ID },
        properties,
      };

      try {
        const response = await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers: notionHeaders(apiKey),
          body: JSON.stringify(pageBody),
        });

        if (!response.ok) {
          const err = await response.json();
          errors.push({ exercise: entry.name, set: set.setNumber, error: (err as any).message || "Notion error" });
        } else {
          const page = await response.json();
          results.push({ id: (page as any).id as string });
        }
      } catch (e: any) {
        errors.push({ exercise: entry.name, set: set.setNumber, error: e.message as string });
      }
    }
  }

  if (errors.length > 0) {
    const msg =
      results.length === 0
        ? "All entries failed to log"
        : `Partial failure: ${results.length} sets logged, ${errors.length} failed`;
    res.status(500).json({ message: msg, errors, created: results.length });
    return;
  }

  res.json({ success: true, created: results.length, errors: [] });
});

export default router;
