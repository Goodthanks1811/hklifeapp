import { Router } from "express";

const router = Router();

const BASE           = "https://www.itipfooty.com.au";
const UA             = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DEFAULT_COMPID = process.env.ITIPFOOTY_COMPID ?? "132428";

// ── Session (in-memory) ───────────────────────────────────────────────────────

let _cookie:        string | null = null;
let _cookieExpiry:  number        = 0;
let _loginPending:  boolean       = false;
let _loginWaiters:  Array<(ok: boolean) => void> = [];

async function doLogin(username: string, password: string): Promise<boolean> {
  try {
    const body = new URLSearchParams({ todo: "weblogmemin", tippingname: username, password });
    const r = await fetch(`${BASE}/services/login.php`, {
      method:   "POST",
      headers:  {
        "User-Agent":   UA,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept":       "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.9",
        "Origin":       BASE,
        "Referer":      `${BASE}/login.php`,
      },
      body:     body.toString(),
      redirect: "manual",
    });
    const raw = r.headers.get("set-cookie") ?? "";
    const sid = raw.match(/PHPSESSID=([^;,\s]+)/)?.[1];
    if (!sid) return false;
    _cookie       = `PHPSESSID=${sid}`;
    _cookieExpiry = Date.now() + 28 * 60 * 1000;
    return true;
  } catch {
    return false;
  }
}

async function ensureSession(): Promise<boolean> {
  if (_cookie && Date.now() < _cookieExpiry) return true;

  if (_loginPending) {
    return new Promise(resolve => { _loginWaiters.push(resolve); });
  }

  _loginPending = true;
  const u   = process.env.ITIPFOOTY_USERNAME;
  const p   = process.env.ITIPFOOTY_PASSWORD;
  const ok  = u && p ? await doLogin(u, p) : false;
  _loginPending = false;

  for (const w of _loginWaiters) w(ok);
  _loginWaiters = [];
  return ok;
}

async function getPage(url: string): Promise<string> {
  const headers: Record<string, string> = {
    "User-Agent":      UA,
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-AU,en;q=0.9",
    "Referer":         `${BASE}/home.php`,
  };
  if (_cookie) headers["Cookie"] = _cookie;
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

// ── Date / time helpers ───────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseLabel(label: string, year: number): Date | null {
  const t = label.trim().toLowerCase();
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (t === "today")    return today;
  if (t === "yesterday"){ const d = new Date(today); d.setDate(d.getDate() - 1); return d; }
  if (t === "tomorrow") { const d = new Date(today); d.setDate(d.getDate() + 1); return d; }
  const m = t.match(/\w+,\s*(\d{1,2})\s+(\w{3,})/);
  if (m) {
    const day = parseInt(m[1], 10);
    const mo  = MONTH_MAP[m[2].slice(0, 3)];
    if (mo !== undefined) return new Date(year, mo, day);
  }
  return null;
}

function toISO(base: Date | null, rawTime: string): string {
  if (!base) return "";
  const m = rawTime.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!m) return "";
  let h     = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3].toLowerCase() === "pm" && h !== 12) h += 12;
  if (m[3].toLowerCase() === "am" && h === 12) h = 0;
  // Sydney time — NRL season runs Feb–Oct, mostly AEST (UTC+10)
  return new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate(), h - 10, min)).toISOString();
}

// ── HTML extraction helpers ───────────────────────────────────────────────────

function longName(chunk: string): string {
  const i = chunk.indexOf('id="longteamname"');
  if (i < 0) return "";
  const s = chunk.slice(i, i + 200);
  return s.match(/<strong>([^<]+)<\/strong>/)?.[1]?.trim() ?? "";
}

function shortName(chunk: string): string {
  const i = chunk.indexOf('id="shortteamname"');
  if (i < 0) return "";
  const s = chunk.slice(i, i + 200);
  return s.match(/<strong>([A-Z]{2,5})<\/strong>/)?.[1] ?? "";
}

function scoreVal(chunk: string): number | null {
  const m = chunk.match(/<span style="font-size:18px;[^"]*font-weight: bold;">(\d+)<\/span>/);
  return m ? parseInt(m[1], 10) : null;
}

function lastBefore<T>(html: string, rx: RegExp, before: number, pick: (m: RegExpExecArray) => T, fallback: T): T {
  let last = fallback;
  rx.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(html)) !== null) {
    if (m.index >= before) break;
    last = pick(m);
  }
  return last;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ITipGame {
  gameId:        string;
  isOrigin:      boolean;
  dateLabel:     string;
  kickoff:       string;
  venue:         string;
  locked:        boolean;
  homeTeam:      string;
  homeTeamShort: string;
  awayTeam:      string;
  awayTeamShort: string;
  homeScore:     number | null;
  awayScore:     number | null;
  currentTip:    "H" | "A" | null;
  homeOdds:      string | null;
  awayOdds:      string | null;
}

export interface ITipFixture {
  compid:              string;
  round:               number;
  memberid:            string;
  tipref:              string;
  todo:                "add" | "update";
  tippingOpen:         boolean;
  jokerCount:          string;
  currentJokerCount:   string;
  jokerRoundSelected:  boolean;
  cutoff:              string;
  code:                string;
  margin:              string;
  games:               ITipGame[];
  oldFields:           Record<string, string>;
}

// ── Core HTML parser ──────────────────────────────────────────────────────────

function parseFixture(html: string): ITipFixture {
  const year = new Date().getFullYear();

  const compid            = html.match(/<input name="COMPID" type="hidden" value="(\d+)">/)?.[1]                   ?? "";
  const round             = parseInt(html.match(/<input name="ROUND" type="hidden" value="(\d+)">/)?.[1]           ?? "1", 10);
  // Permissive regex: match postmemberid field regardless of attribute order or quote style
  const memberid          = html.match(/name="postmemberid"[^>]*value="(\d*)"/)?.[1]
                         ?? html.match(/value="(\d+)"[^>]*name="postmemberid"/)?.[1]
                         ?? html.match(/name='postmemberid'[^>]*value='(\d*)'/)?.[1]
                         ?? "";
  // Permissive: handle any attribute order (same fix as memberid)
  const tipref            = html.match(/name="tipref"[^>]*value="(\d+)"/)?.[1]
                         ?? html.match(/value="(\d+)"[^>]*name="tipref"/)?.[1]
                         ?? "";
  // todo="add" for first-time tips (no prior picks), "update" when tips already exist.
  // tipref is only present in "update" mode — it's absent for first submissions.
  const todo = html.match(/name="todo"[^>]*value="(add|update)"/)?.[1]
            ?? html.match(/value="(add|update)"[^>]*name="todo"/)?.[1]
            ?? "update";

  // tippingOpen: round is ready for submission when either:
  //   - todo="add"    → first-ever submission for this round (no tipref needed)
  //   - todo="update" → tips already exist and we have a tipref to reference
  // It is NOT open when the "not yet available" banner appears (round is future/scheduled).
  const notAvailableText = html.includes("not yet available for tipping") || html.includes("This round is not yet available");
  const tippingOpen = !notAvailableText && (todo === "add" || !!tipref);
  if (!tippingOpen) {
    const snip = html.match(/<input[^>]*tipref[^>]*>/)?.[0] ?? "(tipref tag not found)";
    console.warn("[fixture] tipping not open — todo:", todo, "tipref:", tipref || "(empty)", "notAvail:", notAvailableText, "raw tipref tag:", snip);
  }
  const jokerCount        = html.match(/<input name="JOKERCOUNT" type="hidden" value="(\d+)">/)?.[1]                ?? "1";
  const currentJokerCount = html.match(/<input name="CURRENTJOKERCOUNT" type="hidden" value="(\d+)">/)?.[1]         ?? "0";
  const cutoff            = html.match(/<input name="cutoff" type="hidden" value="([^"]+)">/)?.[1]                  ?? "GAME";
  const code              = html.match(/<input name="code" type="hidden" value="([^"]+)">/)?.[1]                    ?? "NRL";
  const margin            = html.match(/<input type="number" name="margin" value="([^"]*)"[^>]*id="margin">/)?.[1]  ?? "";

  // Whether the user has already activated their joker for this round.
  // The checkbox renders as <input name="jokerround" ... checked> when selected.
  const jokerRoundSelected = /name="jokerround"[^>]*\bchecked\b/.test(html)
                          || /\bchecked\b[^>]*name="jokerround"/.test(html);

  const oldFields: Record<string, string> = {};
  // Capture all hidden passthrough fields iTipFooty requires to be round-tripped:
  //   OldTip1..8, OldTipORIGIN, OldMargin, OldMarginNonSub, ORIGINincluded, jokerincluded
  const oldRx = /<input name="(OldTip(?:\d+|ORIGIN)|OldMargin(?:NonSub)?|ORIGINincluded|jokerincluded)" type="hidden"[^>]+value="([^"]*)"/g;
  let ot: RegExpExecArray | null;
  while ((ot = oldRx.exec(html)) !== null) oldFields[ot[1]] = ot[2];

  // Find all game H-row positions in document order
  const gameHRx = /id="(\d+|ORIGIN)H"/g;
  const positions: Array<{ gameId: string; pos: number }> = [];
  let gh: RegExpExecArray | null;
  while ((gh = gameHRx.exec(html)) !== null) {
    positions.push({ gameId: gh[1], pos: gh.index });
  }

  const games: ITipGame[] = [];

  for (let i = 0; i < positions.length; i++) {
    const { gameId, pos } = positions[i];
    const nextPos         = i + 1 < positions.length ? positions[i + 1].pos : html.length;
    const awayTag         = `id="${gameId}A"`;
    const awayPos         = html.indexOf(awayTag, pos);

    const homeChunk = awayPos > pos ? html.slice(pos, awayPos) : html.slice(pos, pos + 800);
    const awayChunk = awayPos > 0   ? html.slice(awayPos, nextPos) : "";

    // Selected state — check the <tr> opening tag that contains the id attribute
    const homeTagStart = html.lastIndexOf("<tr ", pos);
    const homeTagSnip  = homeTagStart >= 0 ? html.slice(homeTagStart, html.indexOf(">", homeTagStart) + 1) : "";
    const homeSelected = homeTagSnip.includes('class="selected"');

    const awayTagStart = awayPos > 0 ? html.lastIndexOf("<tr ", awayPos) : -1;
    const awayTagSnip  = awayTagStart >= 0 ? html.slice(awayTagStart, html.indexOf(">", awayTagStart) + 1) : "";
    const awaySelected = awayTagSnip.includes('class="selected"');

    // Date label: last bg-green-dark <th> text before this game
    const dateLabel = lastBefore(
      html,
      /<th[^>]*>([^<]+)<i[^>]*class="fa fa-calendar/g,
      pos,
      m => m[1].trim(),
      "",
    );

    // Time + venue: last font-10 span before this game
    const rawTV = lastBefore(
      html,
      /<span class="font-10 mb-0 mt-n1"><strong>([^<]+)<\/strong>/g,
      pos,
      m => m[1].trim(),
      "",
    );

    // Lock: last lock/unlock icon before this game
    const locked = lastBefore(
      html,
      /<i class="fa fa-(lock|unlock) font-20/g,
      pos,
      m => m[1] === "lock",
      false,
    );

    // Split "7:45 pm (Sydney time) @ Accor Stadium"
    const atIdx   = rawTV.indexOf(" @ ");
    const rawTime = atIdx >= 0 ? rawTV.slice(0, atIdx) : rawTV;
    const venue   = atIdx >= 0 ? rawTV.slice(atIdx + 3).trim() : "";
    const timeStr = rawTime.replace(/\s*\([^)]+\)/g, "").trim();

    const base    = parseLabel(dateLabel, year);
    const kickoff = toISO(base, timeStr);

    // Odds — first two badge spans in this game's section
    const section    = html.slice(pos, nextPos);
    const oddMatches = [...section.matchAll(/<span class="badge bg-grass-dark color-white font-11">\$([\d.]+)<\/span>/g)];
    const homeOdds   = oddMatches[0] ? `$${oddMatches[0][1]}` : null;
    const awayOdds   = oddMatches[1] ? `$${oddMatches[1][1]}` : null;

    games.push({
      gameId,
      isOrigin:      gameId === "ORIGIN",
      dateLabel,
      kickoff,
      venue,
      locked,
      homeTeam:      longName(homeChunk),
      homeTeamShort: shortName(homeChunk),
      awayTeam:      longName(awayChunk),
      awayTeamShort: shortName(awayChunk),
      homeScore:     scoreVal(homeChunk),
      awayScore:     scoreVal(awayChunk),
      currentTip:    homeSelected ? "H" : awaySelected ? "A" : null,
      homeOdds,
      awayOdds,
    });
  }

  return { compid, round, memberid, tipref, todo, tippingOpen, jokerCount, currentJokerCount, jokerRoundSelected, cutoff, code, margin, games, oldFields };
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/session", (_req, res) => {
  res.json({ loggedIn: !!_cookie && Date.now() < _cookieExpiry });
});

router.post("/login", async (_req, res) => {
  const u = process.env.ITIPFOOTY_USERNAME;
  const p = process.env.ITIPFOOTY_PASSWORD;
  if (!u || !p) {
    res.status(400).json({ error: "ITIPFOOTY_USERNAME and ITIPFOOTY_PASSWORD env vars must be set" });
    return;
  }
  _cookie = null;
  const ok = await doLogin(u, p);
  if (ok) {
    res.json({ success: true, message: "Logged in" });
  } else {
    res.status(401).json({ error: "Login failed — check credentials" });
  }
});

router.get("/fixture", async (req, res) => {
  const compid = String(req.query.compid ?? DEFAULT_COMPID);
  const round  = req.query.round != null ? String(req.query.round) : undefined;

  try {
    if (!await ensureSession()) {
      res.status(401).json({ error: "Not authenticated — set ITIPFOOTY_USERNAME and ITIPFOOTY_PASSWORD env vars" });
      return;
    }

    const url = round
      ? `${BASE}/tipping.php?compid=${compid}&round=${round}`
      : `${BASE}/tipping.php?compid=${compid}`;

    let html = await getPage(url);

    // Detect session expiry (redirected to login page)
    if (!html.includes("SubmitTips") && html.includes("tippingname")) {
      _cookie = null;
      if (!await ensureSession()) {
        res.status(401).json({ error: "Session expired and re-login failed" });
        return;
      }
      html = await getPage(url);
    }

    // Never cache fixture responses — tipref, currentTip, and lock state
    // change during the day; a stale 304 causes silent submission failures.
    res.set("Cache-Control", "no-store");
    res.json(parseFixture(html));
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

// ── Post-submission verification ──────────────────────────────────────────────
// After a "successful" redirect from iTipFooty, fetch the fixture and confirm
// the submitted tips actually appear as currentTip on the server.
// Returns true if all submitted picks match, false if any differ.
// On fetch/parse error we return true (benefit of the doubt — don't block on
// infrastructure failures unrelated to the actual tip save).
async function verifyTips(
  compid: string, round: number, submitted: Record<string, string>
): Promise<boolean> {
  const tipCount = Object.keys(submitted).length;
  if (tipCount === 0) return true;
  try {
    const html    = await getPage(`${BASE}/tipping.php?compid=${compid}&round=${round}`);
    const fixture = parseFixture(html);
    const serverMap: Record<string, string | null> = {};
    for (const g of fixture.games) serverMap[String(g.gameId)] = g.currentTip ?? null;
    let matched = 0;
    for (const [id, pick] of Object.entries(submitted)) {
      if (serverMap[id] === pick) matched++;
    }
    const ok = matched === tipCount;
    if (!ok) {
      console.warn("[tips] verification: server tips don't match submitted", {
        round, submitted, serverTips: Object.entries(serverMap),
      });
    }
    return ok;
  } catch (err) {
    console.warn("[tips] verification fetch failed — assuming success", { err: String(err) });
    return true; // infrastructure error, don't block the user
  }
}

router.post("/tips", async (req, res) => {
  const { compid, round, memberid, margin, jokerCount, currentJokerCount, cutoff, code, tips, oldFields, jokerRound } = req.body ?? {};
  // tipref may be stale/absent from a cached fixture — we'll recover it below if needed
  let tipref: string = String(req.body?.tipref ?? "");
  // todo="add" for first-ever submission (no tipref), "update" for subsequent changes.
  // Default to "update" for backward compatibility if not provided.
  let todo: string = String(req.body?.todo ?? "update");

  if (tipref && !/^\d+$/.test(tipref)) {
    console.error("[tips] 400: tipref present but not numeric", { round, tipref });
    res.status(400).json({ error: "Invalid tipref value." });
    return;
  }
  if (memberid != null && memberid !== "" && !/^\d+$/.test(String(memberid))) {
    console.error("[tips] 400: memberid not numeric", { memberid });
    res.status(400).json({ error: "memberid must be numeric if provided" });
    return;
  }
  if (!round || isNaN(Number(round))) {
    console.error("[tips] 400: round invalid", { round });
    res.status(400).json({ error: "round is required and must be numeric" });
    return;
  }

  try {
    if (!await ensureSession()) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    // For "update" mode: tipref is required. If it's missing (stale cached fixture),
    // fetch a fresh fixture page to recover the real tipref before submitting.
    // For "add" mode: tipref is never present on a first submission — don't try to recover.
    if (todo === "update" && !tipref) {
      console.warn("[tips] tipref empty for update — fetching fresh fixture to recover it", { round });
      try {
        const freshHtml    = await getPage(`${BASE}/tipping.php?compid=${compid ?? DEFAULT_COMPID}&round=${round}`);
        const freshFixture = parseFixture(freshHtml);
        if (freshFixture.tipref) {
          tipref = String(freshFixture.tipref);
          todo   = freshFixture.todo; // sync todo with recovered fixture state
          console.info("[tips] recovered tipref from fresh fixture", { round, tipref, todo });
        } else if (freshFixture.todo === "add") {
          // The fixture is actually in "add" mode — switch to add
          todo = "add";
          console.info("[tips] fresh fixture is in add mode — switching todo to add", { round });
        } else {
          console.warn("[tips] fresh fixture also has no tipref and is not in add mode — round may not be open", { round });
          res.status(400).json({ error: "This round is not currently open for tipping on iTipFooty." });
          return;
        }
      } catch (fetchErr) {
        console.error("[tips] failed to fetch fresh fixture for tipref recovery", { round, err: String(fetchErr) });
        res.status(500).json({ error: "Could not verify tipping state — please try again." });
        return;
      }
    }

    const body = new URLSearchParams();
    body.set("todo",              todo);
    body.set("postmemberid",      String(memberid          ?? ""));
    body.set("COMPID",            String(compid            ?? DEFAULT_COMPID));
    body.set("ROUND",             String(round             ?? ""));
    body.set("JOKERCOUNT",        String(jokerCount        ?? "1"));
    body.set("CURRENTJOKERCOUNT", String(currentJokerCount ?? "0"));
    body.set("cutoff",            cutoff ?? "GAME");
    body.set("code",              code   ?? "NRL");
    body.set("margin",            String(margin ?? ""));
    // Only include tipref when it's present (update mode).
    // For todo=add (first submission), iTipFooty's form has no tipref field — omit it entirely.
    if (tipref) body.set("tipref", tipref);

    for (const [k, v] of Object.entries(tips      ?? {})) body.set(k, String(v));
    for (const [k, v] of Object.entries(oldFields ?? {})) body.set(k, String(v));
    // Only send jokerround=YES when the user has activated their joker for this round.
    // Never send it as NO/empty — the checkbox absence means "not joker round".
    if (jokerRound === true) body.set("jokerround", "YES");

    const gameCount = Object.keys(tips ?? {}).length;
    console.info("[tips] submitting", { round, memberid, tipref, margin, gameCount, tips });

    const doPost = (cookie: string) => fetch(`${BASE}/services/SubmitTips.php`, {
      method:   "POST",
      redirect: "manual",
      headers: {
        "User-Agent":   UA,
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie":       cookie,
        "Referer":      `${BASE}/tipping.php?compid=${compid ?? DEFAULT_COMPID}&round=${round}`,
      },
      body: body.toString(),
    });

    const r        = await doPost(_cookie ?? "");
    const location = r.headers.get("location") ?? "";
    const bodyText = await r.text().catch(() => "");

    console.info("[tips] SubmitTips response", {
      status:   r.status,
      location,
      bodySnip: bodyText.slice(0, 300),
    });

    // With redirect:"manual", iTipFooty signals outcomes via the Location header:
    //   Success       → 302 to tipping.php
    //   Session fail  → 302 to login.php  OR  200 with login-page HTML
    //   Other failure → anything else (e.g. error page, unexpected redirect)
    const sessionFailed = (loc: string, b: string) =>
      loc.includes("login") || b.includes("tippingname") || b.includes("weblogmemin");

    const submissionAccepted = (loc: string) =>
      loc.includes("tipping.php") || loc.includes("/home");

    if (sessionFailed(location, bodyText)) {
      // Invalidate cached session and try to re-establish
      _cookie = null;
      if (!await ensureSession()) {
        res.status(401).json({ error: "Session expired and re-login failed" });
        return;
      }
      const r2   = await doPost(_cookie ?? "");
      const loc2 = r2.headers.get("location") ?? "";
      const bod2 = await r2.text().catch(() => "");
      console.info("[tips] SubmitTips retry", { status: r2.status, location: loc2, bodySnip: bod2.slice(0, 300) });

      if (sessionFailed(loc2, bod2)) {
        res.status(401).json({ error: "Session re-established but submission still rejected" });
        return;
      }
      if (!submissionAccepted(loc2)) {
        console.error("[tips] unexpected response after retry", { status: r2.status, location: loc2, bodySnip: bod2.slice(0, 500) });
        res.status(500).json({ error: `iTipFooty rejected the submission (retry). status=${r2.status} location=${loc2}` });
        return;
      }
      // Verify tips were actually saved on iTipFooty's server
      const verified = await verifyTips(String(compid ?? DEFAULT_COMPID), Number(round), tips ?? {});
      if (!verified) {
        res.status(500).json({ error: "Tips were accepted but don't appear to have saved on iTipFooty. Please check the website directly." });
        return;
      }
      res.json({ success: true, statusCode: r2.status, location: loc2, retried: true });
      return;
    }

    if (!submissionAccepted(location)) {
      // iTipFooty didn't redirect to login (so session is fine) but also didn't
      // redirect back to tipping.php — something unexpected happened.
      console.error("[tips] unexpected response", { status: r.status, location, bodySnip: bodyText.slice(0, 500) });
      res.status(500).json({ error: `iTipFooty rejected the submission. status=${r.status} location=${location}` });
      return;
    }

    // The redirect looks like success — verify tips actually persisted.
    // iTipFooty returns 302 → tipping.php for both success AND silent failures
    // (e.g. wrong tipref), so we can't trust the redirect alone.
    const verified = await verifyTips(String(compid ?? DEFAULT_COMPID), Number(round), tips ?? {});
    if (!verified) {
      console.error("[tips] redirect accepted but tips not saved — tipref may have been wrong", { round, tipref });
      res.status(500).json({ error: "Tips were accepted but don't appear to have saved on iTipFooty. Please check the website directly." });
      return;
    }

    res.json({ success: true, statusCode: r.status, location });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

export default router;
