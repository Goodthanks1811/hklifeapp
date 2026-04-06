// ── Constants ────────────────────────────────────────────────────────
const LIFE_DB_ID = "2c8b7eba3523802abbe2e934df42a4e2";
const NOTION_API = "https://api.notion.com/v1";
const NOTION_VER = "2022-06-28";

const CATEGORIES = [
  { label: "📝 Life Admin",    catValue: "\uD83D\uDCDD Life Admin",       emojis: ["🔥","🖥️","🏡"] },
  { label: "🔎 Investigate",  catValue: "\uD83D\uDD0E To Investigate",   emojis: ["🔥","🚩","👀","🧠"] },
  { label: "💰 To Buy",       catValue: "\uD83D\uDCB0 To Buy",           emojis: ["🔥","💳","💰"] },
  { label: "🎧 Music",        catValue: "\uD83C\uDFA7 Music",            emojis: ["🎧"] },
  { label: "📌 Reference",    catValue: "\uD83D\uDCCC Reference",        emojis: ["📌"] },
  { label: "📕 To Read",      catValue: "\uD83D\uDCD5 Read",             emojis: ["📕"] },
  { label: "⚡️ Dev",          catValue: "⚡️Development",                emojis: ["🔥","🚆","🏡","👀","💡"] },
];

const EPIC_COLOURS = {
  "HK LIFE":       { bg: "rgba(224,49,49,0.15)",  border: "#6b2020", text: "#ff7070" },
  "MI CORAZON":    { bg: "rgba(214,72,169,0.15)", border: "#6b2060", text: "#f080d0" },
  "AUTOMATION":    { bg: "rgba(49,130,224,0.15)", border: "#204080", text: "#70aaff" },
  "NRL":           { bg: "rgba(49,200,100,0.15)", border: "#206040", text: "#70df90" },
  "MUSIC PLAYER":  { bg: "rgba(200,150,49,0.15)", border: "#604020", text: "#dfb870" },
};

// ── State ────────────────────────────────────────────────────────────
let activeCat    = CATEGORIES[0];
let selectedEmoji = null;
let apiKey       = null;
let tasks        = [];
let loading      = false;

// ── DOM refs ─────────────────────────────────────────────────────────
const catNav         = document.getElementById("cat-nav");
const taskList       = document.getElementById("task-list");
const loader         = document.getElementById("loader");
const quickAddBar    = document.getElementById("quick-add-bar");
const qaInput        = document.getElementById("qa-input");
const qaSubmit       = document.getElementById("qa-submit");
const qaEmojiRow     = document.getElementById("qa-emoji-row");
const headerAddBtn   = document.getElementById("header-add-btn");
const settingsOverlay= document.getElementById("settings-overlay");
const settingsOpen   = document.getElementById("settings-open-btn");
const settingsClose  = document.getElementById("settings-close");
const notionKeyInput = document.getElementById("notion-key-input");
const saveKeyBtn     = document.getElementById("save-key-btn");
const saveMsg        = document.getElementById("save-msg");

// ── Init ─────────────────────────────────────────────────────────────
async function init() {
  const stored = await chrome.storage.local.get("notionKey");
  apiKey = stored.notionKey || null;
  buildCatNav();
  if (!apiKey) {
    showNoKey();
  } else {
    fetchTasks();
  }
}

// ── Category nav ─────────────────────────────────────────────────────
function buildCatNav() {
  catNav.innerHTML = "";
  CATEGORIES.forEach(cat => {
    const chip = document.createElement("button");
    chip.className = "cat-chip" + (cat === activeCat ? " active" : "");
    chip.textContent = cat.label;
    chip.addEventListener("click", () => selectCat(cat));
    catNav.appendChild(chip);
  });
}

function selectCat(cat) {
  activeCat = cat;
  selectedEmoji = null;
  buildCatNav();
  buildEmojiRow();
  if (apiKey) fetchTasks();
}

// ── Emoji row ────────────────────────────────────────────────────────
function buildEmojiRow() {
  qaEmojiRow.innerHTML = "";
  activeCat.emojis.forEach(em => {
    const btn = document.createElement("button");
    btn.className = "emoji-chip" + (em === selectedEmoji ? " selected" : "");
    btn.textContent = em;
    btn.title = em;
    btn.addEventListener("click", () => {
      selectedEmoji = (selectedEmoji === em) ? null : em;
      buildEmojiRow();
    });
    qaEmojiRow.appendChild(btn);
  });
}

// ── Quick-add toggle ─────────────────────────────────────────────────
function toggleQuickAdd(forceOpen) {
  const isHidden = quickAddBar.classList.contains("hidden");
  const shouldOpen = forceOpen !== undefined ? forceOpen : isHidden;
  if (shouldOpen) {
    quickAddBar.classList.remove("hidden");
    buildEmojiRow();
    setTimeout(() => qaInput.focus(), 50);
  } else {
    quickAddBar.classList.add("hidden");
    qaInput.value = "";
    selectedEmoji = null;
  }
}

headerAddBtn.addEventListener("click", () => toggleQuickAdd());

// ── Notion API helpers ────────────────────────────────────────────────
function notionHeaders() {
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Notion-Version": NOTION_VER,
    "Content-Type": "application/json",
  };
}

// Build category filter for Notion query
function buildCategoryFilter(catValue) {
  const variants = [catValue, catValue.trim()];
  if (variants.length === 1) {
    return { property: "Category", select: { equals: catValue } };
  }
  return {
    or: variants.map(v => ({ property: "Category", select: { equals: v } }))
  };
}

// ── Fetch tasks ───────────────────────────────────────────────────────
async function fetchTasks() {
  if (!apiKey || loading) return;
  loading = true;
  showLoader();

  const filter = buildCategoryFilter(activeCat.catValue);

  try {
    const resp = await fetch(`${NOTION_API}/databases/${LIFE_DB_ID}/query`, {
      method: "POST",
      headers: notionHeaders(),
      body: JSON.stringify({
        filter,
        sorts: [{ timestamp: "created_time", direction: "descending" }],
        page_size: 50,
      }),
    });

    if (resp.status === 401) throw new Error("Invalid Notion API key. Check Settings.");
    if (!resp.ok) throw new Error(`Notion error ${resp.status}`);

    const data = await resp.json();
    tasks = (data.results || []).map(parseTask).filter(Boolean);
    renderTasks();
  } catch (err) {
    showError(err.message);
  } finally {
    loading = false;
  }
}

function parseTask(page) {
  const props = page.properties || {};

  // Title
  const titleProp = props["Name"] || props["Title"] || props["Task"] || {};
  const titleArr  = titleProp.title || [];
  const title     = titleArr.map(t => t.plain_text).join("").trim();
  if (!title) return null;

  // Emoji / priority
  const emojiProp = props["-"] || {};
  let emoji = "-";
  if (emojiProp.type === "select"     && emojiProp.select?.name)  emoji = emojiProp.select.name;
  if (emojiProp.type === "status"     && emojiProp.status?.name)  emoji = emojiProp.status.name;
  if (emojiProp.type === "rich_text") {
    emoji = (emojiProp.rich_text || []).map(t => t.plain_text).join("") || "-";
  }
  // Strip VS16 variation selectors
  emoji = emoji.replace(/\uFE0F/g, "");

  // Epic
  const epicProp = props["Epic"] || {};
  let epic = null;
  if (epicProp.type === "select"  && epicProp.select?.name)  epic = epicProp.select.name;
  if (epicProp.type === "status"  && epicProp.status?.name)  epic = epicProp.status.name;

  return { id: page.id, title, emoji, epic };
}

// ── Render ────────────────────────────────────────────────────────────
function showLoader() {
  taskList.innerHTML = "";
  const l = document.createElement("div");
  l.className = "loader";
  l.innerHTML = '<div class="spinner"></div>';
  taskList.appendChild(l);
}

function renderTasks() {
  taskList.innerHTML = "";

  if (tasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <span class="empty-icon">✨</span>
      <span class="empty-text">All clear in ${activeCat.label}.<br>Nothing left to do here.</span>
    `;
    taskList.appendChild(empty);
    return;
  }

  tasks.forEach((task, i) => {
    const item = document.createElement("div");
    item.className = "task-item";
    item.style.animationDelay = `${Math.min(i, 10) * 0.03}s`;

    const emojiEl = document.createElement("span");
    emojiEl.className = "task-emoji";
    emojiEl.textContent = task.emoji !== "-" ? task.emoji : "·";

    const titleEl = document.createElement("span");
    titleEl.className = "task-title";
    titleEl.textContent = task.title;

    item.appendChild(emojiEl);
    item.appendChild(titleEl);

    if (task.epic) {
      const epicEl = document.createElement("span");
      epicEl.className = "task-epic";
      const colours = EPIC_COLOURS[task.epic.toUpperCase()] || {
        bg: "rgba(255,255,255,0.08)", border: "#3a3a3a", text: "#aaa"
      };
      epicEl.style.cssText = `
        background: ${colours.bg};
        border: 1px solid ${colours.border};
        color: ${colours.text};
      `;
      epicEl.textContent = task.epic;
      item.appendChild(epicEl);
    }

    taskList.appendChild(item);
  });
}

function showError(msg) {
  taskList.innerHTML = "";
  const el = document.createElement("div");
  el.className = "error-state";
  el.textContent = `⚠ ${msg}`;
  taskList.appendChild(el);
}

function showNoKey() {
  taskList.innerHTML = "";
  const el = document.createElement("div");
  el.className = "no-key-state";
  el.innerHTML = `
    <span class="nk-icon">🔑</span>
    <span class="nk-title">Connect Notion</span>
    <span class="nk-sub">Add your Notion API key to start viewing your Life tasks.</span>
    <button class="nk-btn" id="nk-open-settings">Open Settings</button>
  `;
  taskList.appendChild(el);
  document.getElementById("nk-open-settings").addEventListener("click", openSettings);
}

// ── Quick-add submit ──────────────────────────────────────────────────
async function submitQuickAdd() {
  const title = qaInput.value.trim();
  if (!title || !apiKey) return;

  qaSubmit.textContent = "…";
  qaSubmit.disabled = true;

  // Build the emoji value — default "-" if none selected
  const emojiVal = (selectedEmoji || "-").replace(/\uFE0F/g, "");

  // Determine property type (optimistic: try select first)
  const body = {
    parent: { database_id: LIFE_DB_ID },
    properties: {
      Name: { title: [{ type: "text", text: { content: title } }] },
      Category: { select: { name: activeCat.catValue } },
      "-": { select: { name: emojiVal } },
    },
  };

  try {
    const resp = await fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: notionHeaders(),
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`Error ${resp.status}`);
    const page = await resp.json();
    const newTask = parseTask(page);
    if (newTask) tasks.unshift(newTask);

    // Reset
    qaInput.value = "";
    selectedEmoji = null;
    buildEmojiRow();
    renderTasks();
    toggleQuickAdd(false);
  } catch (err) {
    showError(err.message);
  } finally {
    qaSubmit.textContent = "Add";
    qaSubmit.disabled = false;
  }
}

qaSubmit.addEventListener("click", submitQuickAdd);
qaInput.addEventListener("keydown", e => {
  if (e.key === "Enter") submitQuickAdd();
  if (e.key === "Escape") toggleQuickAdd(false);
});

// ── Settings ──────────────────────────────────────────────────────────
function openSettings() {
  if (apiKey) notionKeyInput.value = apiKey;
  settingsOverlay.classList.remove("hidden");
  setTimeout(() => notionKeyInput.focus(), 80);
}
function closeSettings() {
  settingsOverlay.classList.add("hidden");
}

settingsOpen.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", e => {
  if (e.target === settingsOverlay) closeSettings();
});

saveKeyBtn.addEventListener("click", async () => {
  const key = notionKeyInput.value.trim();
  if (!key) return;
  await chrome.storage.local.set({ notionKey: key });
  apiKey = key;
  saveMsg.classList.remove("hidden");
  setTimeout(() => {
    saveMsg.classList.add("hidden");
    closeSettings();
    fetchTasks();
  }, 900);
});

notionKeyInput.addEventListener("keydown", e => {
  if (e.key === "Enter") saveKeyBtn.click();
  if (e.key === "Escape") closeSettings();
});

// ── Boot ──────────────────────────────────────────────────────────────
init();
