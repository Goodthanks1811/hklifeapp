// ════════════════════════════════════════════════════════════════════════════
// HK Life Chrome Extension — popup.js
//
// Mirrors the logic in artifacts/task-manager/app/life/[slug].tsx
//
// Key design decisions from the app:
//  • Notion DB: 2c8b7eba3523802abbe2e934df42a4e2
//  • Emoji property: "-"  (select or status or rich_text)
//  • Sort Order property: "Sort Order" (number)
//  • HIDDEN_EMOJI: "👎"  — items with this emoji are NEVER shown
//  • DEFAULT_EMOJI: "-"  — items with no emoji assigned
//  • Filtering: only show items whose emoji is in the category's allowList
//    (for categories with sortEmojis; otherwise allow FULL_PICKER)
//  • Sort order: emojiGroupIndex ASC → sortOrder ASC → title ASC
//  • Epic colours: exact EPIC_COLOUR_MAP from the app
//  • Banded sort orders: new items land at top of their emoji group (minOrder−1)
// ════════════════════════════════════════════════════════════════════════════

"use strict";

// ── Notion config ─────────────────────────────────────────────────────────
const LIFE_DB_ID = "2c8b7eba3523802abbe2e934df42a4e2";
const NOTION_API = "https://api.notion.com/v1";
const NOTION_VER = "2022-06-28";

// ── Emoji constants ───────────────────────────────────────────────────────
const HIDDEN_EMOJI  = "👎";
const DEFAULT_EMOJI = "-";

// Full emoji picker used for categories that don't specify sortEmojis
const FULL_PICKER = ["🔥","🚩","👀","🧠","💳","💰","🎧","📌","📕","🏡","🖥️"];

// ── Category configuration — mirrors SLUG_MAP in [slug].tsx ──────────────
//
// sortEmojis: the ordered list used for grouping + filtering.
//   If absent → use FULL_PICKER.
// showEpic: whether to show epic chips (Development only)
//
const CATEGORIES = [
  {
    slug:       "life-admin",
    label:      "Life Admin",
    catValue:   "\uD83D\uDCDD Life Admin",
    emojis:     ["🔥","🖥️","🏡"],
    // No sortEmojis → FULL_PICKER used for filtering
  },
  {
    slug:       "investigate",
    label:      "Investigate",
    catValue:   "\uD83D\uDD0E To Investigate",
    emojis:     ["🔥","🚩","👀","🧠"],
  },
  {
    slug:       "to-buy",
    label:      "To Buy",
    catValue:   "\uD83D\uDCB0 To Buy",
    emojis:     ["🔥","💳","💰"],
  },
  {
    slug:       "music",
    label:      "Music",
    catValue:   "\uD83C\uDFA7 Music",
    emojis:     ["🎧"],
  },
  {
    slug:       "reference",
    label:      "Reference",
    catValue:   "\uD83D\uDCCC Reference",
    emojis:     ["📌"],
  },
  {
    slug:       "to-read",
    label:      "To Read",
    catValue:   "\uD83D\uDCD5 Read",
    emojis:     ["📕"],
  },
  {
    slug:       "development",
    label:      "Development",
    catValue:   "\u26A1\uFE0FDevelopment",
    emojis:     ["🔥","🚆","🏡","👀","💡","👎"],
    sortEmojis: ["-","🔥","🚆","🏡","👀","💡"],   // used for group-sort + filtering
    showEpic:   true,
  },
];

// ── Epic colour map — exact EPIC_COLOUR_MAP from the app ─────────────────
//
// Each entry: [bg, border, text]
// Used for both inline row pills and the epic picker in detail/quick-add.
//
const EPIC_COLOUR_MAP = {
  "Enhancement": { bg: "rgba(64,192,87,0.14)",   border: "rgba(64,192,87,0.40)",   text: "#40C057" },
  "HK Life":     { bg: "rgba(224,49,49,0.14)",   border: "rgba(224,49,49,0.40)",   text: "#E03131" },
  "IR App":      { bg: "rgba(51,154,240,0.14)",  border: "rgba(51,154,240,0.40)",  text: "#339AF0" },
  "General":     { bg: "rgba(134,142,150,0.14)", border: "rgba(134,142,150,0.40)", text: "#868E96" },
  "New App":     { bg: "rgba(250,176,5,0.14)",   border: "rgba(250,176,5,0.40)",   text: "#FAB005" },
};
const EPIC_FALLBACK = { bg: "rgba(134,142,150,0.12)", border: "rgba(134,142,150,0.30)", text: "#868E96" };

// Epics that should NOT appear in pickers (same as app's BLOCKED_EPICS)
const BLOCKED_EPICS = new Set(["Redesign", "Spike", "Redesign / Rebuild"]);

// Display order for epics (same as app's EPIC_ORDER)
const EPIC_ORDER = ["HK Life", "IR App", "Enhancement", "New App", "General"];

function epicColor(epic) {
  return EPIC_COLOUR_MAP[epic] || EPIC_FALLBACK;
}

function filterEpics(opts) {
  const allowed = (opts || []).filter(e => !BLOCKED_EPICS.has(e));
  return [...allowed].sort((a, b) => {
    const ai = EPIC_ORDER.indexOf(a);
    const bi = EPIC_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return  1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

// ── Emoji helpers ─────────────────────────────────────────────────────────

// Strip variation selectors — matches app's `norm()` fn
const norm = e => (e || "").replace(/[\uFE00-\uFE0F\u200D\u20E3]/g, "").trim();

// Return the sort-group index for a given emoji within the active category.
// Group 0 = DEFAULT_EMOJI / no emoji, then each sortEmoji in order.
// This is the emojiIdxFn used throughout the app's sort/filter logic.
function emojiGroupIndex(emoji, cat) {
  const list = cat.sortEmojis || FULL_PICKER;
  if (!emoji || emoji === DEFAULT_EMOJI) return 0;
  const idx = list.findIndex(e => norm(e) === norm(emoji));
  return idx === -1 ? list.length : idx + 1;
}

// ── App state ─────────────────────────────────────────────────────────────
let activeCat      = CATEGORIES[0];
let selectedEmoji  = null;  // quick-add
let selectedEpic   = null;  // quick-add
let qaCat          = CATEGORIES[0]; // category selected inside quick-add

let apiKey         = null;
let tasks          = [];       // { id, title, emoji, sortOrder, url, epic, pageUrl }
let epicOptions    = [];       // fetched from schema endpoint
let isLoading      = false;

// Detail sheet state
let detailTask     = null;
let detailEmoji    = null;
let detailEpic     = null;

// ── DOM refs ──────────────────────────────────────────────────────────────
const catNav            = document.getElementById("cat-nav");
const taskList          = document.getElementById("task-list");
const headerSectionTitle= document.getElementById("header-section-title");

const quickAddBar       = document.getElementById("quick-add-bar");
const qaCatRow          = document.getElementById("qa-cat-row");
const qaInput           = document.getElementById("qa-input");
const qaSubmit          = document.getElementById("qa-submit");
const qaEmojiRow        = document.getElementById("qa-emoji-row");
const qaEpicSection     = document.getElementById("qa-epic-section");
const qaEpicRow         = document.getElementById("qa-epic-row");
const headerAddBtn      = document.getElementById("header-add-btn");

const settingsOverlay   = document.getElementById("settings-overlay");
const settingsOpenBtn   = document.getElementById("settings-open-btn");
const settingsClose     = document.getElementById("settings-close");
const notionKeyInput    = document.getElementById("notion-key-input");
const saveKeyBtn        = document.getElementById("save-key-btn");
const saveMsg           = document.getElementById("save-msg");

const detailOverlay     = document.getElementById("detail-overlay");
const detailClose       = document.getElementById("detail-close");
const detailTitleInput  = document.getElementById("detail-title-input");
const detailEmojiRow    = document.getElementById("detail-emoji-row");
const detailEpicSection = document.getElementById("detail-epic-section");
const detailEpicRow     = document.getElementById("detail-epic-row");
const detailNotesSec    = document.getElementById("detail-notes-section");
const detailNotesBody   = document.getElementById("detail-notes-body");
const detailOpenBtn     = document.getElementById("detail-open-btn");
const detailCancelBtn   = document.getElementById("detail-cancel-btn");
const detailSaveBtn     = document.getElementById("detail-save-btn");

// ════════════════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════════════════
async function init() {
  const stored = await chrome.storage.local.get("notionKey");
  apiKey = stored.notionKey || null;

  buildCatNav();
  updateHeaderTitle();

  if (!apiKey) {
    renderNoKey();
  } else {
    fetchTasks();
    fetchSchema();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CATEGORY NAV
// ════════════════════════════════════════════════════════════════════════════
function buildCatNav() {
  catNav.innerHTML = "";
  CATEGORIES.forEach(cat => {
    const chip = document.createElement("button");
    chip.className = "cat-chip" + (cat === activeCat ? " active" : "");
    chip.textContent = cat.label;
    chip.setAttribute("role", "tab");
    chip.setAttribute("aria-selected", cat === activeCat ? "true" : "false");
    chip.addEventListener("click", () => selectCat(cat));
    catNav.appendChild(chip);
  });
}

function selectCat(cat) {
  activeCat = cat;
  buildCatNav();
  updateHeaderTitle();
  closeQuickAdd();
  if (apiKey) fetchTasks();
}

function updateHeaderTitle() {
  headerSectionTitle.textContent = activeCat.label;
}

// ════════════════════════════════════════════════════════════════════════════
// QUICK-ADD
// ════════════════════════════════════════════════════════════════════════════
function openQuickAdd() {
  qaCat = activeCat;
  selectedEmoji = null;
  selectedEpic  = null;
  qaInput.value = "";
  buildQaCatRow();
  buildQaEmojiRow();
  buildQaEpicSection();
  quickAddBar.classList.remove("hidden");
  setTimeout(() => qaInput.focus(), 60);
}

function closeQuickAdd() {
  quickAddBar.classList.add("hidden");
  qaInput.value  = "";
  selectedEmoji  = null;
  selectedEpic   = null;
}

function buildQaCatRow() {
  qaCatRow.innerHTML = "";
  CATEGORIES.forEach(cat => {
    const chip = document.createElement("button");
    chip.className = "qa-cat-chip" + (cat === qaCat ? " active" : "");
    chip.textContent = cat.label;
    chip.addEventListener("click", () => {
      qaCat = cat;
      selectedEmoji = null;
      selectedEpic  = null;
      buildQaCatRow();
      buildQaEmojiRow();
      buildQaEpicSection();
    });
    qaCatRow.appendChild(chip);
  });
}

function buildQaEmojiRow() {
  qaEmojiRow.innerHTML = "";
  // Show the category's emojis but NOT the hidden emoji 👎
  const emojis = (qaCat.emojis || []).filter(e => norm(e) !== norm(HIDDEN_EMOJI));
  emojis.forEach(em => {
    const btn = document.createElement("button");
    btn.className = "emoji-chip" + (norm(em) === norm(selectedEmoji) ? " selected" : "");
    btn.textContent = em;
    btn.title = em;
    btn.addEventListener("click", () => {
      selectedEmoji = (norm(selectedEmoji) === norm(em)) ? null : em;
      buildQaEmojiRow();
    });
    qaEmojiRow.appendChild(btn);
  });
}

function buildQaEpicSection() {
  if (!qaCat.showEpic || !epicOptions.length) {
    qaEpicSection.classList.add("hidden");
    return;
  }
  qaEpicSection.classList.remove("hidden");
  qaEpicRow.innerHTML = "";
  filterEpics(epicOptions).forEach(ep => {
    const ec  = epicColor(ep);
    const btn = document.createElement("button");
    btn.className  = "epic-chip";
    btn.textContent = ep;
    applyEpicStyle(btn, ep, selectedEpic === ep);
    btn.addEventListener("click", () => {
      selectedEpic = (selectedEpic === ep) ? null : ep;
      buildQaEpicSection();
    });
    qaEpicRow.appendChild(btn);
  });
}

function applyEpicStyle(el, epicName, isSelected) {
  const ec = epicColor(epicName);
  if (isSelected) {
    el.style.background   = ec.bg;
    el.style.borderColor  = ec.border;
    el.style.color        = ec.text;
  } else {
    el.style.background   = "transparent";
    el.style.borderColor  = "var(--border)";
    el.style.color        = "var(--text-sec)";
  }
}

headerAddBtn.addEventListener("click", () => {
  if (quickAddBar.classList.contains("hidden")) {
    openQuickAdd();
  } else {
    closeQuickAdd();
  }
});

// ── Quick-add submit ──────────────────────────────────────────────────────
async function submitQuickAdd() {
  const title = qaInput.value.trim();
  if (!title || !apiKey) return;

  qaSubmit.disabled = true;
  qaSubmit.textContent = "…";

  // Emoji val: strip variation selectors, default to "-"
  const emojiVal = norm(selectedEmoji || DEFAULT_EMOJI);

  try {
    const body = buildCreatePayload(title, emojiVal, qaCat.catValue, selectedEpic);
    const resp = await notionFetch(`/pages`, { method: "POST", body: JSON.stringify(body) });
    if (!resp.ok) throw new Error(`Notion error ${resp.status}`);
    const page    = await resp.json();
    const newTask = parsePage(page);
    if (newTask) {
      // Prepend at top of its emoji group — mirrors app's handleQuickAdded
      const gi        = emojiGroupIndex(newTask.emoji, activeCat);
      const groupBase = (gi + 1) * 100;
      const groupTasks = tasks.filter(t => emojiGroupIndex(t.emoji, activeCat) === gi);
      const minOrder  = groupTasks.length
        ? Math.min(...groupTasks.map(t => t.sortOrder ?? (groupBase + 50)))
        : groupBase;
      newTask.sortOrder = minOrder - 1;

      // Persist the sort order back to Notion
      await patchTask(newTask.id, { sortOrder: newTask.sortOrder });

      tasks.unshift(newTask);
      sortTasks();
      renderTasks();
    }
    closeQuickAdd();
  } catch (err) {
    renderError(err.message);
  } finally {
    qaSubmit.disabled = false;
    qaSubmit.textContent = "Add";
  }
}

function buildCreatePayload(title, emojiVal, catValue, epic) {
  const payload = {
    parent: { database_id: LIFE_DB_ID },
    properties: {
      Name:     { title: [{ type: "text", text: { content: title } }] },
      Category: { select: { name: catValue } },
      "-":      { select: { name: emojiVal } },
    },
  };
  if (epic) {
    payload.properties["Epic"] = { select: { name: epic } };
  }
  return payload;
}

qaSubmit.addEventListener("click", submitQuickAdd);
qaInput.addEventListener("keydown", e => {
  if (e.key === "Enter")  submitQuickAdd();
  if (e.key === "Escape") closeQuickAdd();
});

// ════════════════════════════════════════════════════════════════════════════
// NOTION API
// ════════════════════════════════════════════════════════════════════════════
function notionFetch(path, opts = {}) {
  return fetch(`${NOTION_API}${path}`, {
    ...opts,
    headers: {
      "Authorization":  `Bearer ${apiKey}`,
      "Notion-Version": NOTION_VER,
      "Content-Type":   "application/json",
      ...(opts.headers || {}),
    },
  });
}

// ── Fetch schema (epic options) ───────────────────────────────────────────
async function fetchSchema() {
  if (!apiKey) return;
  try {
    const resp = await notionFetch(`/databases/${LIFE_DB_ID}`);
    if (!resp.ok) return;
    const db   = await resp.json();
    const epicProp = db.properties?.["Epic"];
    if (epicProp) {
      const rawOpts = epicProp.select?.options || epicProp.status?.options || [];
      epicOptions   = rawOpts.map(o => o.name).filter(Boolean);
    }
  } catch (_) {}
}

// ── Fetch tasks ───────────────────────────────────────────────────────────
async function fetchTasks() {
  if (!apiKey || isLoading) return;
  isLoading = true;
  renderLoader();

  try {
    const filter = {
      property: "Category",
      select:   { equals: activeCat.catValue },
    };

    // Request sorted ascending by Sort Order
    const resp = await notionFetch(`/databases/${LIFE_DB_ID}/query`, {
      method: "POST",
      body:   JSON.stringify({
        filter,
        sorts:     [{ property: "Sort Order", direction: "ascending" }],
        page_size: 100,
      }),
    });

    if (resp.status === 401) throw new Error("Invalid Notion API key. Check Settings.");
    if (!resp.ok)            throw new Error(`Notion error ${resp.status}`);

    const data   = await resp.json();
    const parsed = (data.results || []).map(parsePage).filter(Boolean);

    // ── Filter: drop HIDDEN_EMOJI items + items outside the allowList ────
    const allowList = activeCat.sortEmojis || FULL_PICKER;
    tasks = parsed.filter(t => {
      if (norm(t.emoji) === norm(HIDDEN_EMOJI)) return false;
      if (t.emoji === DEFAULT_EMOJI || !t.emoji)  return true;
      return allowList.some(e => norm(e) === norm(t.emoji));
    });

    sortTasks();
    renderTasks();
  } catch (err) {
    renderError(err.message);
  } finally {
    isLoading = false;
  }
}

// ── Parse a Notion page into a task object ────────────────────────────────
function parsePage(page) {
  const props = page.properties || {};

  // Title
  const titleProp = props["Name"] || props["Title"] || props["Task"] || {};
  const title     = (titleProp.title || []).map(t => t.plain_text).join("").trim();
  if (!title) return null;

  // Emoji ("-" property — can be select, status, or rich_text)
  const emojiProp = props["-"] || {};
  let emoji = DEFAULT_EMOJI;
  if (emojiProp.type === "select"    && emojiProp.select?.name)  emoji = emojiProp.select.name;
  if (emojiProp.type === "status"    && emojiProp.status?.name)  emoji = emojiProp.status.name;
  if (emojiProp.type === "rich_text") {
    emoji = (emojiProp.rich_text || []).map(t => t.plain_text).join("") || DEFAULT_EMOJI;
  }
  emoji = norm(emoji) || DEFAULT_EMOJI;

  // Sort Order (number property)
  const sortOrder = props["Sort Order"]?.number ?? null;

  // Epic
  const epicProp  = props["Epic"] || {};
  let epic = null;
  if (epicProp.type === "select" && epicProp.select?.name)  epic = epicProp.select.name;
  if (epicProp.type === "status" && epicProp.status?.name)  epic = epicProp.status.name;

  // URL — try Reference url property first, then fall back to page URL
  const refProp  = props["Reference"] || props["URL"] || props["Link"] || {};
  let url = null;
  if (refProp.type === "url")       url = refProp.url;
  if (refProp.type === "rich_text") url = (refProp.rich_text || [])[0]?.href || null;
  const pageUrl = page.url || null;

  return { id: page.id, title, emoji, sortOrder, url, epic, pageUrl };
}

// ── PATCH a task (emoji, epic, sortOrder, title, done) ────────────────────
async function patchTask(taskId, updates) {
  if (!apiKey) return;
  const updateProps = {};
  if (updates.title !== undefined) {
    updateProps["Name"] = { title: [{ type: "text", text: { content: updates.title } }] };
  }
  if (updates.emoji !== undefined) {
    const v = norm(updates.emoji) || DEFAULT_EMOJI;
    updateProps["-"] = { select: { name: v } };
  }
  if (updates.epic !== undefined) {
    updateProps["Epic"] = { select: { name: updates.epic } };
  }
  if (updates.sortOrder !== undefined) {
    updateProps["Sort Order"] = { number: updates.sortOrder };
  }
  if (updates.done === true) {
    // Archive the page (marks it as done — mirrors app's handleCheckOff → done:true → PATCH)
    await notionFetch(`/pages/${taskId}`, {
      method: "PATCH",
      body:   JSON.stringify({ archived: true }),
    }).catch(() => {});
    return;
  }
  if (!Object.keys(updateProps).length) return;
  await notionFetch(`/pages/${taskId}`, {
    method: "PATCH",
    body:   JSON.stringify({ properties: updateProps }),
  }).catch(() => {});
}

// ── DELETE (archive) a page ───────────────────────────────────────────────
async function deleteTask(taskId) {
  if (!apiKey) return;
  await notionFetch(`/pages/${taskId}`, {
    method: "PATCH",
    body:   JSON.stringify({ archived: true }),
  }).catch(() => {});
}

// ════════════════════════════════════════════════════════════════════════════
// SORTING
// Mirrors app's sort: emojiGroupIndex ASC → sortOrder ASC → title ASC
// ════════════════════════════════════════════════════════════════════════════
function sortTasks() {
  tasks.sort((a, b) => {
    const ei = emojiGroupIndex(a.emoji, activeCat) - emojiGroupIndex(b.emoji, activeCat);
    if (ei !== 0) return ei;
    const aOrd = a.sortOrder ?? 9999;
    const bOrd = b.sortOrder ?? 9999;
    if (aOrd !== bOrd) return aOrd - bOrd;
    return a.title.localeCompare(b.title);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// RENDER
// ════════════════════════════════════════════════════════════════════════════
function renderLoader() {
  taskList.innerHTML = `<div class="loader-wrap"><div class="spinner"></div></div>`;
}

function renderError(msg) {
  taskList.innerHTML = `
    <div class="error-state">
      ⚠ ${escHtml(msg)}
      <br/>
      <button class="retry-btn" id="retry-btn">Retry</button>
    </div>`;
  document.getElementById("retry-btn")?.addEventListener("click", fetchTasks);
}

function renderNoKey() {
  taskList.innerHTML = `
    <div class="no-key-state">
      <span class="nk-icon">🔑</span>
      <span class="nk-title">Connect Notion</span>
      <span class="nk-sub">Add your Notion API key in Settings to view your Life tasks.</span>
      <button class="primary-btn" id="nk-open-settings" style="margin-top:4px">Open Settings</button>
    </div>`;
  document.getElementById("nk-open-settings")?.addEventListener("click", openSettings);
}

function renderTasks() {
  taskList.innerHTML = "";

  if (!tasks.length) {
    taskList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">✨</span>
        <span class="empty-text">All clear in ${escHtml(activeCat.label)}.<br>Nothing left to do here.</span>
      </div>`;
    return;
  }

  tasks.forEach((task, idx) => {
    const row = buildTaskRow(task, idx);
    taskList.appendChild(row);
  });
}

function buildTaskRow(task, idx) {
  const item = document.createElement("div");
  item.className = "task-item";
  item.dataset.id = task.id;
  item.style.animationDelay = `${Math.min(idx, 12) * 0.03}s`;

  // ── Emoji ──
  const emojiEl = document.createElement("span");
  const isDefault = (!task.emoji || task.emoji === DEFAULT_EMOJI);
  emojiEl.className = "task-emoji" + (isDefault ? " is-default" : "");
  emojiEl.textContent = isDefault ? "·" : task.emoji;
  item.appendChild(emojiEl);

  // ── Title ──
  const titleEl = document.createElement("span");
  titleEl.className   = "task-title";
  titleEl.textContent  = task.title;
  item.appendChild(titleEl);

  // ── Epic pill (Development category only) ──
  if (task.epic && activeCat.showEpic) {
    const ec      = epicColor(task.epic);
    const epicEl  = document.createElement("span");
    epicEl.className   = "task-epic";
    epicEl.textContent  = task.epic;
    epicEl.style.background   = ec.bg;
    epicEl.style.borderColor  = ec.border;
    epicEl.style.color        = ec.text;
    item.appendChild(epicEl);
  }

  // ── Action buttons (revealed on hover via CSS) ──
  const actions = document.createElement("div");
  actions.className = "task-item-actions";

  const checkBtn = document.createElement("button");
  checkBtn.className = "action-btn action-btn-check";
  checkBtn.title     = "Mark done";
  checkBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  checkBtn.addEventListener("click", e => { e.stopPropagation(); handleCheckOff(task.id); });

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "action-btn action-btn-delete";
  deleteBtn.title     = "Delete";
  deleteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
  deleteBtn.addEventListener("click", e => { e.stopPropagation(); handleDelete(task.id); });

  actions.appendChild(checkBtn);
  actions.appendChild(deleteBtn);
  item.appendChild(actions);

  // ── Click → open detail sheet ──
  item.addEventListener("click", () => openDetail(task));

  return item;
}

// ── Check off ─────────────────────────────────────────────────────────────
function handleCheckOff(taskId) {
  tasks = tasks.filter(t => t.id !== taskId);
  renderTasks();
  patchTask(taskId, { done: true });
}

// ── Delete ────────────────────────────────────────────────────────────────
function handleDelete(taskId) {
  tasks = tasks.filter(t => t.id !== taskId);
  renderTasks();
  deleteTask(taskId);
}

// ════════════════════════════════════════════════════════════════════════════
// DETAIL SHEET
// ════════════════════════════════════════════════════════════════════════════
function openDetail(task) {
  detailTask  = task;
  detailEmoji = task.emoji || DEFAULT_EMOJI;
  detailEpic  = task.epic  || null;

  detailTitleInput.value = task.title;

  // Emoji row — category emojis + HIDDEN_EMOJI at end
  buildDetailEmojiRow();

  // Epic section
  if (activeCat.showEpic && epicOptions.length) {
    detailEpicSection.classList.remove("hidden");
    buildDetailEpicRow();
  } else {
    detailEpicSection.classList.add("hidden");
  }

  // Notes (basic — extension doesn't fetch page blocks)
  detailNotesSec.classList.add("hidden");

  // Open in Notion button
  const openUrl = task.url || task.pageUrl;
  if (openUrl) {
    detailOpenBtn.style.display = "";
    detailOpenBtn.onclick = () => chrome.tabs.create({ url: openUrl });
  } else {
    detailOpenBtn.style.display = "none";
  }

  detailOverlay.classList.remove("hidden");
  setTimeout(() => detailTitleInput.focus(), 80);
}

function buildDetailEmojiRow() {
  detailEmojiRow.innerHTML = "";
  // Emojis for the current category + HIDDEN_EMOJI at end (matches app's displayEmojis logic)
  const base   = (activeCat.emojis || []).filter(e => norm(e) !== norm(HIDDEN_EMOJI));
  const emojis = [...base, HIDDEN_EMOJI];
  emojis.forEach((e, i) => {
    const isSelected = norm(e) === norm(detailEmoji);
    const chip = document.createElement("button");
    chip.className   = "emoji-chip" + (isSelected ? " selected" : "");
    chip.textContent = e;
    chip.title       = e;
    chip.addEventListener("click", () => {
      detailEmoji = e;
      buildDetailEmojiRow();
    });
    detailEmojiRow.appendChild(chip);
  });
}

function buildDetailEpicRow() {
  detailEpicRow.innerHTML = "";
  filterEpics(epicOptions).forEach(ep => {
    const isSelected = ep === detailEpic;
    const chip = document.createElement("button");
    chip.className   = "epic-chip";
    chip.textContent = ep;
    applyEpicStyle(chip, ep, isSelected);
    chip.addEventListener("click", () => {
      detailEpic = (detailEpic === ep) ? null : ep;
      buildDetailEpicRow();
    });
    detailEpicRow.appendChild(chip);
  });
}

function closeDetail() {
  detailOverlay.classList.add("hidden");
  detailTask  = null;
  detailEmoji = null;
  detailEpic  = null;
}

// ── Save ──────────────────────────────────────────────────────────────────
async function handleDetailSave() {
  if (!detailTask || !apiKey) { closeDetail(); return; }

  const newTitle = detailTitleInput.value.trim() || detailTask.title;
  const updates  = {};

  if (newTitle !== detailTask.title) updates.title = newTitle;
  if (norm(detailEmoji) !== norm(detailTask.emoji)) updates.emoji = detailEmoji;
  if (detailEpic !== detailTask.epic) updates.epic = detailEpic || "General";

  // Optimistic update
  tasks = tasks.map(t => {
    if (t.id !== detailTask.id) return t;
    return { ...t, title: newTitle, emoji: detailEmoji, epic: detailEpic };
  });
  sortTasks();
  renderTasks();
  closeDetail();

  if (Object.keys(updates).length) {
    await patchTask(detailTask.id, updates).catch(() => {});
  }
}

detailClose.addEventListener("click",     closeDetail);
detailCancelBtn.addEventListener("click", closeDetail);
detailSaveBtn.addEventListener("click",   handleDetailSave);
detailOverlay.addEventListener("click", e => {
  if (e.target === detailOverlay) closeDetail();
});
detailTitleInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) handleDetailSave();
  if (e.key === "Escape") closeDetail();
});

// ════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════════════════
function openSettings() {
  if (apiKey) notionKeyInput.value = apiKey;
  settingsOverlay.classList.remove("hidden");
  setTimeout(() => notionKeyInput.focus(), 80);
}
function closeSettings() {
  settingsOverlay.classList.add("hidden");
}

settingsOpenBtn.addEventListener("click", openSettings);
settingsClose.addEventListener("click",   closeSettings);
settingsOverlay.addEventListener("click", e => {
  if (e.target === settingsOverlay) closeSettings();
});

saveKeyBtn.addEventListener("click", async () => {
  const key = notionKeyInput.value.trim();
  if (!key) return;
  await chrome.storage.local.set({ notionKey: key });
  apiKey = key;
  saveMsg.classList.remove("hidden");
  setTimeout(async () => {
    saveMsg.classList.add("hidden");
    closeSettings();
    await fetchSchema();
    fetchTasks();
  }, 900);
});

notionKeyInput.addEventListener("keydown", e => {
  if (e.key === "Enter")  saveKeyBtn.click();
  if (e.key === "Escape") closeSettings();
});

// ════════════════════════════════════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════════════════════════════════════
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ════════════════════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════════════════════
init();
