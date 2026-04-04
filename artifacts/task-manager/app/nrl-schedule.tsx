import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, { WebViewMessageEvent } from "react-native-webview";
import { ScreenHeader } from "@/components/ScreenHeader";

// ── NRL theme ──────────────────────────────────────────────────────────────────
const NRL_GREEN  = "#00A550";
const NRL_DARK   = "#0a0a0a";
const NRL_CARD   = "#141414";
const NRL_BORDER = "#1f1f1f";
const NRL_TEXT   = "#f0f0f0";
const NRL_MUTED  = "#666666";
const NRL_ACCENT = "#00C960";
const DRG_RED    = "#E8202A";
const DRG_ACCENT = "#ff4d55";

const COMPETITION_ID      = 111;
const MAX_ROUNDS          = 27;
const SPOILER_WINDOW_MS   = 24 * 60 * 60 * 1000;
const MAX_CONTENT_WIDTH   = 640;
const YEAR                = new Date().getFullYear();
const BASE_URL            = `https://www.nrl.com`;

// ── Types ──────────────────────────────────────────────────────────────────────
interface Match {
  id:          string;
  homeTeam:    string;
  awayTeam:    string;
  homeScore:   number | null;
  awayScore:   number | null;
  homeColour:  string;
  awayColour:  string;
  venue:       string;
  kickoff:     Date;
  roundNumber: number | null;
  state:       string;
  isComplete:  boolean;
  spoiler:     boolean;
  isBye:       boolean;
}

interface DayGroup {
  dateKey: string;
  day:     string;
  dateStr: string;
  matches: Match[];
}

interface LadderRow {
  pos:    number;
  name:   string;
  colour: string;
  p: number; w: number; l: number; d: number;
  pts:  number;
  diff: number;
}

// ── Fetch ──────────────────────────────────────────────────────────────────────
async function nrlFetch(url: string): Promise<any> {
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    return await r.json();
  } catch { return null; }
}

// ── Parse helpers ──────────────────────────────────────────────────────────────
function detectCurrentRound(data: any): number {
  if (data?.selectedRoundId) return data.selectedRoundId;
  if (data?.currentRound)   return data.currentRound.roundNumber;
  return 1;
}

function extractVenue(f: any): string {
  if (typeof f.venue === "string" && f.venue) return f.venue;
  if (f.venue && typeof f.venue === "object") {
    return [f.venue.name || f.venue.venueName || "", f.venue.city || f.venue.suburb || ""]
      .filter(Boolean).join(", ");
  }
  return f.venueName || f.groundName || f.ground || "";
}

function parseMatches(rawData: any): Match[] {
  if (!rawData?.fixtures) return [];
  return rawData.fixtures.map((f: any) => {
    const kickoff    = new Date(f.clock?.kickOffTimeLong || f.kickOffTime || f.matchMode || "");
    const ageMs      = Date.now() - kickoff.getTime();
    const isComplete = f.matchState === "FullTime" || f.matchState === "PostMatch";
    return {
      id:          String(f.matchId || Math.random()),
      homeTeam:    f.homeTeam?.nickName || f.homeTeam?.teamName || "TBA",
      awayTeam:    f.awayTeam?.nickName || f.awayTeam?.teamName || "TBA",
      homeScore:   f.homeTeam?.score ?? null,
      awayScore:   f.awayTeam?.score ?? null,
      homeColour:  "#" + (f.homeTeam?.teamColour || "444444"),
      awayColour:  "#" + (f.awayTeam?.teamColour || "444444"),
      venue:       extractVenue(f),
      kickoff,
      roundNumber: f.roundNumber || rawData.roundNumber || null,
      state:       f.matchState || "Upcoming",
      isComplete,
      spoiler:     isComplete && ageMs > 0 && ageMs < SPOILER_WINDOW_MS,
      isBye:       false,
    };
  });
}

function formatKickoff(date: Date) {
  if (!date || isNaN(date.getTime())) return { day: "TBA", dateStr: "", time: "", dateKey: "unknown" };
  const days   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return {
    day:     days[date.getDay()],
    dateStr: `${date.getDate()} ${months[date.getMonth()]}`,
    time:    date.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true }),
    dateKey: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
  };
}

function groupByDay(matches: Match[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const seen: Record<string, boolean> = {};
  for (const m of matches) {
    const { dateKey, day, dateStr } = formatKickoff(m.kickoff);
    if (!seen[dateKey]) {
      seen[dateKey] = true;
      groups.push({ dateKey, day, dateStr, matches: [] });
    }
    groups[groups.length - 1].matches.push(m);
  }
  return groups;
}

const TEAM_COLOURS: Record<string, string> = {
  "broncos": "F7882F", "raiders": "6DBE45", "bulldogs": "005BAC",
  "sharks": "00B7CD", "titans": "009FDF", "roosters": "002B5C",
  "sea-eagles": "6E2B8B", "storm": "5B2D8E", "knights": "003B6F",
  "cowboys": "005BAC", "eels": "FFD100", "panthers": "2D2D2D",
  "rabbitohs": "006B3F", "dragons": "E8202A", "warriors": "808080",
  "wests-tigers": "FF7F00", "dolphins": "DC143C",
};


// ── Team logos (base64 data URIs) ──────────────────────────────────────────────
const TEAM_LOGOS: Record<string, string> = {
  Cowboys: 'data:image/png;base64,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',
  Dragons: 'data:image/png;base64,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',
};
function getTeamLogo(name: string): string {
  for (const key of Object.keys(TEAM_LOGOS)) {
    if (name.includes(key)) return TEAM_LOGOS[key];
  }
  return '';
}
function parseLadder(data: any): LadderRow[] {
  const raw = data?.positions;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((t: any, i: number) => {
    const stats    = t.stats || {};
    const themeKey = (t.theme?.key || "").toLowerCase();
    const colour   = "#" + (TEAM_COLOURS[themeKey] || "555555");
    return {
      pos:  i + 1,
      name: t.teamNickname || "Unknown",
      colour,
      p:    stats["played"]              ?? 0,
      w:    stats["wins"]                ?? 0,
      l:    stats["lost"]                ?? 0,
      d:    stats["drawn"]               ?? 0,
      pts:  stats["points"]              ?? 0,
      diff: stats["points difference"]   ?? 0,
    };
  });
}

async function fetchAllDragonsMatches(maxRound: number): Promise<Match[]> {
  const allMatches: Match[] = [];
  const BATCH = 5;
  for (let start = 1; start <= maxRound; start += BATCH) {
    const end     = Math.min(start + BATCH - 1, maxRound);
    const fetches: Promise<{ round: number; data: any }>[] = [];
    for (let r = start; r <= end; r++) {
      fetches.push(
        nrlFetch(`${BASE_URL}/draw/data?competition=${COMPETITION_ID}&season=${YEAR}&round=${r}`)
          .then((data: any) => ({ round: r, data }))
      );
    }
    const results = await Promise.all(fetches);
    for (const { round, data } of results) {
      if (!data?.fixtures) continue;
      const parsed = parseMatches(data);
      for (const m of parsed) {
        m.roundNumber = m.roundNumber ?? round;
        if (m.homeTeam.includes("Dragons") || m.awayTeam.includes("Dragons")) {
          allMatches.push(m);
        }
      }
    }
  }
  allMatches.sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
  return allMatches;
}

// ── HTML builders ──────────────────────────────────────────────────────────────
function matchCard(m: Match, isDrgTab: boolean): string {
  const { day, dateStr, time } = formatKickoff(m.kickoff);
  const isLive     = m.state === "InProgress";
  const isFinished = m.isComplete || isLive;
  const venueStr   = m.venue ? `\uD83D\uDCCD ${m.venue}` : "";
  const dateLabel  = dateStr ? `${day}, ${dateStr}` : "";
  const revClass   = isDrgTab ? "reveal-btn reveal-btn-drg" : "reveal-btn";

  if (m.isBye) {
    return `
<div class="match-card">
  <div class="match-body" style="justify-content:center;padding:20px 14px">
    <div style="text-align:center">
      <div style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:26px;color:${NRL_MUTED};letter-spacing:1px">BYE</div>
      <div style="font-family:'Barlow',sans-serif;font-size:13px;color:#444;margin-top:4px">No game this round</div>
    </div>
  </div>
</div>`;
  }

  const centreFinished = `
    <div class="score-display">${m.homeScore ?? 0} \u2013 ${m.awayScore ?? 0}</div>
    <div class="score-label${isLive ? " live-label" : ""}">${isLive ? "LIVE" : "Full Time"}</div>
    ${dateLabel ? `<div class="centre-date">${dateLabel}</div>` : ""}
    ${venueStr  ? `<div class="centre-loc">${venueStr}</div>`   : ""}`;

  const centreUpcoming = `
    <div class="score-vs">vs</div>
    ${dateLabel ? `<div class="centre-date">${dateLabel}</div>` : ""}
    <div class="score-time">${time}</div>
    ${venueStr  ? `<div class="centre-loc">${venueStr}</div>`   : ""}`;

  let scoreArea: string;
  if (m.spoiler) {
    scoreArea = `
<div class="score-area">
  <div id="spoiler-${m.id}" class="spoiler-block">
    <button class="${revClass}" onclick="revealScore('${m.id}')">Reveal</button>
    ${dateLabel ? `<div class="centre-date" style="margin-top:6px">${dateLabel}</div>` : ""}
    ${venueStr  ? `<div class="centre-loc"  style="margin-top:4px">${venueStr}</div>`  : ""}
  </div>
  <div id="score-${m.id}" class="score-inner" style="display:none">${centreFinished}</div>
</div>`;
  } else if (isFinished) {
    scoreArea = `<div class="score-area"><div class="score-inner">${centreFinished}</div></div>`;
  } else {
    scoreArea = `<div class="score-area"><div class="score-inner">${centreUpcoming}</div></div>`;
  }

  return `
<div class="match-card">
  <div class="match-body">
    <div class="team-block">
      <div class="team-colour-bar" style="background:${m.homeColour}"></div>
      <div class="team-name">${m.homeTeam}</div>
      ${getTeamLogo(m.homeTeam) ? '<img class="team-logo" src="' + getTeamLogo(m.homeTeam) + '" alt="">' : ''}
    </div>
    ${scoreArea}
    <div class="team-block" style="align-items:flex-end">
      <div class="team-colour-bar" style="background:${m.awayColour};margin-left:auto"></div>
      <div class="team-name" style="text-align:right">${m.awayTeam}</div>
      ${getTeamLogo(m.awayTeam) ? '<img class="team-logo" src="' + getTeamLogo(m.awayTeam) + '" alt="" style="margin-left:auto">' : ''}
    </div>
  </div>
</div>`;
}

function buildDayGroups(groups: DayGroup[]): string {
  if (groups.length === 0) return `<div class="empty">No fixtures found for this round.</div>`;
  return groups.map((g, i) => `
    ${i > 0 ? '<div class="day-divider"></div>' : ""}
    <div class="day-header">${g.day}, ${g.dateStr}</div>
    <div class="cards-col">${g.matches.map((m) => matchCard(m, false)).join("")}</div>`
  ).join("");
}

function buildDragonsContent(allDragonsMatches: Match[], maxRound: number): string {
  if (allDragonsMatches.length === 0) return `<div class="empty">No Dragons fixtures found.</div>`;
  const roundMap: Record<number, Match[]> = {};
  for (const m of allDragonsMatches) {
    const rn = m.roundNumber;
    if (rn == null) continue;
    if (!roundMap[rn]) roundMap[rn] = [];
    roundMap[rn].push(m);
  }
  for (let r = 1; r <= maxRound; r++) {
    if (!roundMap[r]) {
      roundMap[r] = [{
        isBye: true, id: `bye-${r}`, roundNumber: r,
        homeTeam: "", awayTeam: "", homeScore: null, awayScore: null,
        homeColour: "#444", awayColour: "#444", venue: "",
        kickoff: new Date(NaN), state: "Bye", isComplete: false, spoiler: false,
      }];
    }
  }
  const sortedRounds = Object.keys(roundMap).sort((a, b) => Number(a) - Number(b));
  return sortedRounds.map((rn, i) => {
    const cards = roundMap[Number(rn)].map((m) => matchCard(m, true)).join("");
    return `
      ${i > 0 ? '<div class="drg-divider"></div>' : ""}
      <div class="drg-round-header">Round ${rn}</div>
      <div class="cards-col">${cards}</div>`;
  }).join("");
}

function buildLadderHTML(ladderData: LadderRow[]): string {
  if (!ladderData || ladderData.length === 0) return `<div class="empty">Ladder unavailable.</div>`;
  const rows = ladderData.map((t, i) => {
    const isDrg    = t.name.includes("Dragons");
    const isTop8   = t.pos <= 8;
    const diffStr  = t.diff > 0 ? `+${t.diff}` : String(t.diff);
    const sepAfter = t.pos === 8 && ladderData.length > 8
      ? `<tr class="ladder-sep"><td colspan="8"></td></tr>` : "";
    return `
<tr class="${isDrg ? "ladder-drg" : i % 2 === 0 ? "ladder-even" : ""}">
  <td class="lpos${isTop8 ? " top8" : ""}">${t.pos}</td>
  <td class="lteam"><span class="tdot" style="background:${t.colour}"></span><span class="tname">${t.name}</span></td>
  <td class="lstat">${t.p}</td><td class="lstat">${t.w}</td>
  <td class="lstat">${t.l}</td><td class="lstat">${t.d}</td>
  <td class="lstat lpts">${t.pts}</td>
  <td class="lstat ldiff${t.diff > 0 ? " dpos" : t.diff < 0 ? " dneg" : ""}">${diffStr}</td>
</tr>${sepAfter}`;
  }).join("");
  return `
<table class="ladder-table">
  <thead><tr>
    <th class="lpos">#</th><th class="lteam-h">Team</th>
    <th class="lstat-h">P</th><th class="lstat-h">W</th>
    <th class="lstat-h">L</th><th class="lstat-h">D</th>
    <th class="lstat-h">Pts</th><th class="lstat-h">+/-</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

function buildMainHtml(
  matches:     Match[],
  rounds:      number[],
  selRound:    number,
  dragonsHtml: string,
  ladderHtml:  string,
  bottomPad:   number,
): string {
  const groups  = groupByDay(matches);
  const content = buildDayGroups(groups);
  const pills   = rounds.map((r) =>
    `<button class="round-pill${r === selRound ? " active" : ""}" id="pill-${r}" onclick="handleRound(${r})">${r}</button>`
  ).join("");

  const tabBarH  = 52 + bottomPad;
  const contentPb = 68 + bottomPad;

  const css = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{background:${NRL_DARK};color:${NRL_TEXT};font-family:'Barlow',sans-serif;font-size:15px;min-height:100vh;overscroll-behavior:none;}
.tab-bar{position:fixed;bottom:0;left:0;right:0;z-index:200;display:flex;background:#000;border-top:2px solid #1a1a1a;height:${tabBarH}px;}
.tab-btn{flex:1;display:flex;align-items:center;justify-content:center;padding-bottom:${bottomPad}px;background:none;border:none;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:17px;color:${NRL_MUTED};-webkit-tap-highlight-color:transparent;touch-action:manipulation;letter-spacing:.5px;border-bottom:3px solid transparent;}
.tab-btn.active-nrl{color:${NRL_GREEN};border-bottom-color:${NRL_GREEN};}
.tab-btn.active-drg{color:${DRG_RED};border-bottom-color:${DRG_RED};}
.tab-btn.active-ladder{color:#cccccc;border-bottom-color:#cccccc;}
.tab-panel{display:none;}.tab-panel.visible{display:block;}
.header{position:sticky;top:0;z-index:100;background:#000;border-bottom:2px solid ${NRL_GREEN};}
.header-logo-row{display:flex;justify-content:center;align-items:center;padding:10px 0 8px;background:#000;}
.header-banner{height:110px;width:auto;display:block;object-fit:contain;}
.rounds-scroll{display:flex;gap:7px;overflow-x:auto;padding:8px 14px 10px;-webkit-overflow-scrolling:touch;scrollbar-width:none;background:linear-gradient(160deg,#0d1f0d 0%,#0a0a0a 60%);max-width:${MAX_CONTENT_WIDTH}px;margin:0 auto;}
.rounds-scroll::-webkit-scrollbar{display:none}
.round-pill{flex-shrink:0;background:#1a1a1a;border:1px solid #2a2a2a;color:${NRL_MUTED};font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;padding:5px 14px;border-radius:20px;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
.round-pill.active{background:${NRL_GREEN};border-color:${NRL_GREEN};color:#fff}
.ladder-pill-spacer{height:44px;max-width:${MAX_CONTENT_WIDTH}px;margin:0 auto;background:#000;}
.drg-header{position:sticky;top:0;z-index:100;background:${NRL_DARK};border-bottom:2px solid ${DRG_RED};}
.drg-header-logo-row{display:flex;justify-content:center;align-items:center;padding:10px 0 8px;}
.drg-header-banner{height:121px;width:auto;display:block;object-fit:contain;mix-blend-mode:screen;}
.drg-header-spacer{height:44px;max-width:${MAX_CONTENT_WIDTH}px;margin:0 auto;}
.drg-round-header{font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:700;color:${DRG_RED};text-align:center;padding:6px 0 8px;letter-spacing:.3px;}
.drg-divider{height:1px;background:linear-gradient(to right,transparent,#3a1414 30%,#3a1414 70%,transparent);margin:10px 20px 14px;}
.content{width:min(92vw,${MAX_CONTENT_WIDTH}px);margin:0 auto;padding:12px 0 ${contentPb}px;}
.empty{text-align:center;color:${NRL_MUTED};padding:60px 20px}
.day-header{font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:700;color:#bbb;text-align:center;padding:6px 0 8px;letter-spacing:.3px}
.day-divider{height:1px;background:linear-gradient(to right,transparent,#2a3a2a 30%,#2a3a2a 70%,transparent);margin:10px 20px 14px}
.cards-col{display:flex;flex-direction:column;gap:8px;margin-bottom:8px}
.match-card{background:${NRL_CARD};border:1px solid ${NRL_BORDER};border-radius:12px;overflow:hidden}
.match-body{padding:14px;display:flex;align-items:center;gap:8px}
.team-block{flex:1;display:flex;flex-direction:column;gap:5px;min-width:0}
.team-colour-bar{height:3px;width:32px;border-radius:2px}
.team-name{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:22px;line-height:1.1}
.team-logo{width:56px;height:56px;object-fit:contain;margin-top:6px;display:block}
.score-area{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:110px;flex-shrink:0}
.score-inner{display:flex;flex-direction:column;align-items:center;gap:2px}
.score-display{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:30px;color:#fff;letter-spacing:1px;line-height:1;text-align:center}
.score-label{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:600;color:#888;letter-spacing:.5px;text-align:center;margin-top:2px}
.live-label{color:#ff4444}
.score-vs{font-family:'Barlow Condensed',sans-serif;font-size:18px;color:${NRL_MUTED};font-weight:600;text-align:center}
.centre-date{font-size:12px;color:#777;font-family:'Barlow Condensed',sans-serif;text-align:center;margin-top:5px;letter-spacing:.2px}
.score-time{font-size:13px;color:${NRL_MUTED};font-family:'Barlow Condensed',sans-serif;text-align:center;margin-top:1px}
.centre-loc{font-size:12px;color:#555;font-family:'Barlow',sans-serif;text-align:center;margin-top:3px;max-width:140px;line-height:1.4;word-break:break-word}
.spoiler-block{display:flex;flex-direction:column;align-items:center;min-width:110px}
.reveal-btn{background:#1a2a1a;border:1px solid ${NRL_GREEN};color:${NRL_ACCENT};font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;padding:7px 16px;border-radius:8px;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
.reveal-btn-drg{background:#2a1010 !important;border-color:${DRG_RED} !important;color:${DRG_ACCENT} !important;}
.ladder-table{width:100%;border-collapse:collapse;font-family:'Barlow Condensed',sans-serif;font-size:15px;table-layout:fixed;}
.ladder-table thead tr{border-bottom:1px solid #2a2a2a;}
.ladder-table th{font-size:11px;font-weight:700;color:${NRL_MUTED};letter-spacing:.6px;text-transform:uppercase;padding:8px 4px;overflow:hidden;}
.lpos{width:30px;text-align:center;}.lteam-h{text-align:left;padding-left:8px !important;}.lstat-h{width:36px;text-align:center;}
.ladder-table tbody tr{border-bottom:1px solid #191919;}
.ladder-even{background:#0e0e0e;}.ladder-drg{background:rgba(232,32,42,0.10);}
.ladder-table td{padding:9px 4px;overflow:hidden;}
td.lpos{text-align:center;font-weight:700;font-size:15px;color:${NRL_MUTED};width:30px;}
td.lpos.top8{color:#ddd;}
td.lteam{text-align:left;padding-left:8px;font-size:16px;font-weight:700;color:${NRL_TEXT};white-space:nowrap;overflow:hidden;}
.tdot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;vertical-align:middle;position:relative;top:-1px;}
.tname{vertical-align:middle;}
td.lstat{text-align:center;color:#aaa;font-size:14px;width:36px;}
td.lpts{color:#fff;font-weight:700;font-size:15px;}
td.ldiff{font-size:13px;}.dpos{color:#5a9;}.dneg{color:#a55;}
.ladder-sep td{padding:0;height:2px;background:linear-gradient(to right,transparent,#333 20%,#333 80%,transparent);border:none;}
.loading{text-align:center;padding:80px 20px;color:${NRL_MUTED};font-family:'Barlow Condensed',sans-serif;font-size:16px}
.loader{width:28px;height:28px;border:2px solid #1a3a1a;border-top-color:${NRL_GREEN};border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px}
@keyframes spin{to{transform:rotate(360deg)}}`;

  const js = `
var currentTab='nrl';
var dragonsLoaded=false;
var ladderLoaded=false;
function postMsg(o){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(o));}
function switchTab(tab){
  currentTab=tab;
  window.scrollTo(0,0);
  ['nrl','drg','ladder'].forEach(function(t){
    document.getElementById('panel-'+t).classList.toggle('visible',t===tab);
    var b=document.getElementById('tab-'+t);
    b.classList.remove('active-nrl','active-drg','active-ladder');
  });
  if(tab==='nrl') document.getElementById('tab-nrl').classList.add('active-nrl');
  else if(tab==='drg'){document.getElementById('tab-drg').classList.add('active-drg');if(!dragonsLoaded)postMsg({type:'needDragons'});}
  else if(tab==='ladder'){document.getElementById('tab-ladder').classList.add('active-ladder');if(!ladderLoaded)postMsg({type:'needLadder'});}
}
function handleRound(round){
  document.querySelectorAll('.round-pill').forEach(function(p){p.classList.remove('active');});
  var pill=document.getElementById('pill-'+round);
  if(pill){pill.classList.add('active');pill.scrollIntoView({inline:'center',block:'nearest'});}
  document.getElementById('content').innerHTML='<div class="loading"><div class="loader"></div>Loading Round '+round+'\u2026</div>';
  postMsg({type:'changeRound',round:round});
}
function updateFixtures(html){document.getElementById('content').innerHTML=html;}
function updateDragons(html){dragonsLoaded=true;document.getElementById('drg-content').innerHTML=html;}
function updateLadder(html){ladderLoaded=true;document.getElementById('ladder-content').innerHTML=html;}
function revealScore(id){
  var s=document.getElementById('spoiler-'+id);
  var r=document.getElementById('score-'+id);
  if(s)s.style.display='none';
  if(r)r.style.display='flex';
}
(function(){
  var a=document.querySelector('.round-pill.active');
  if(a)a.scrollIntoView({inline:'center',block:'nearest'});
})();`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>${css}</style>
</head>
<body>
<!-- NRL Tab -->
<div class="tab-panel visible" id="panel-nrl">
  <div class="header">
    <div class="header-logo-row">
      <img class="header-banner" src="https://i.postimg.cc/8CFL755P/IMG-4791.png" onerror="this.style.display='none'" alt="NRL">
    </div>
    <div class="rounds-scroll" id="roundsScroll">${pills}</div>
  </div>
  <div class="content" id="content">${content}</div>
</div>
<!-- Dragons Tab -->
<div class="tab-panel" id="panel-drg">
  <div class="drg-header">
    <div class="drg-header-logo-row">
      <img class="drg-header-banner" src="https://i.postimg.cc/XJsYH7Yg/st-george-illawarra-transparent-with-glow.png" onerror="this.style.display='none'" alt="Dragons">
    </div>
    <div class="drg-header-spacer"></div>
  </div>
  <div class="content" id="drg-content">${dragonsHtml}</div>
</div>
<!-- Ladder Tab -->
<div class="tab-panel" id="panel-ladder">
  <div class="header">
    <div class="header-logo-row">
      <img class="header-banner" src="https://i.postimg.cc/8CFL755P/IMG-4791.png" onerror="this.style.display='none'" alt="NRL">
    </div>
    <div class="ladder-pill-spacer"></div>
  </div>
  <div class="content" id="ladder-content">${ladderHtml}</div>
</div>
<!-- Tab bar -->
<div class="tab-bar">
  <button class="tab-btn active-nrl" id="tab-nrl"    onclick="switchTab('nrl')">NRL</button>
  <button class="tab-btn"            id="tab-drg"    onclick="switchTab('drg')">Dragons</button>
  <button class="tab-btn"            id="tab-ladder" onclick="switchTab('ladder')">Ladder</button>
</div>
<script>${js}</script>
</body>
</html>`;
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function NRLScheduleScreen() {
  const insets    = useSafeAreaInsets();
  const topPad    = Platform.OS === "web" ? Math.max(insets.top, 67)  : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [html,    setHtml]    = useState("");
  const [loading, setLoading] = useState(true);
  const maxRoundRef           = useRef(MAX_ROUNDS);
  const webViewRef            = useRef<WebView>(null);

  useEffect(() => { loadInitial(); }, []);

  const loadInitial = async () => {
    const data = await nrlFetch(
      `${BASE_URL}/draw/data?competition=${COMPETITION_ID}&season=${YEAR}`
    );

    if (!data) {
      setLoading(false);
      const errHtml = buildMainHtml([], [], 1,
        `<div class="empty">Could not load Dragons data.</div>`,
        `<div class="empty">Could not load ladder.</div>`,
        bottomPad,
      );
      setHtml(errHtml);
      return;
    }

    const currentRound = detectCurrentRound(data);
    const maxRound     = data.totalRounds || MAX_ROUNDS;
    maxRoundRef.current = maxRound;
    const rounds       = Array.from({ length: maxRound }, (_, i) => i + 1);

    const roundData = await nrlFetch(
      `${BASE_URL}/draw/data?competition=${COMPETITION_ID}&season=${YEAR}&round=${currentRound}`
    );
    const matches = parseMatches(roundData || data);

    const drgLoading = `<div class="loading"><div class="loader" style="border-top-color:${DRG_RED}"></div>Loading Dragons schedule\u2026</div>`;
    const ldrLoading = `<div class="loading"><div class="loader"></div>Loading ladder\u2026</div>`;

    setHtml(buildMainHtml(matches, rounds, currentRound, drgLoading, ldrLoading, bottomPad));
    setLoading(false);
  };

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    let msg: any;
    try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }

    if (msg.type === "changeRound") {
      const roundData = await nrlFetch(
        `${BASE_URL}/draw/data?competition=${COMPETITION_ID}&season=${YEAR}&round=${msg.round}`
      );
      const matches = parseMatches(roundData || {});
      const groups  = groupByDay(matches);
      const content = buildDayGroups(groups);
      webViewRef.current?.injectJavaScript(`updateFixtures(${JSON.stringify(content)}); true;`);
    }

    if (msg.type === "needDragons") {
      const allDragons  = await fetchAllDragonsMatches(maxRoundRef.current);
      const drgHtml     = buildDragonsContent(allDragons, maxRoundRef.current);
      webViewRef.current?.injectJavaScript(`updateDragons(${JSON.stringify(drgHtml)}); true;`);
    }

    if (msg.type === "needLadder") {
      const ladderData  = await nrlFetch(
        `${BASE_URL}/ladder/data?competition=${COMPETITION_ID}&season=${YEAR}`
      );
      const ladder     = parseLadder(ladderData || {});
      const ladderHtml = buildLadderHTML(ladder);
      webViewRef.current?.injectJavaScript(`updateLadder(${JSON.stringify(ladderHtml)}); true;`);
    }
  }, []);

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScreenHeader title="Schedule" />

      {loading && (
        <View style={styles.loadingCover}>
          <ActivityIndicator size="large" color={NRL_GREEN} />
        </View>
      )}

      {html !== "" && (
        <WebView
          ref={webViewRef}
          source={{ html }}
          style={styles.webview}
          onMessage={onMessage}
          javaScriptEnabled
          scrollEnabled
          bounces={false}
          overScrollMode="never"
          originWhitelist={["*"]}
          domStorageEnabled
          allowsInlineMediaPlayback={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: NRL_DARK },
  webview:      { flex: 1, backgroundColor: NRL_DARK },
  loadingCover: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center",
    backgroundColor: NRL_DARK, zIndex: 10,
  },
});
