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
.team-logo{width:64px;height:64px;object-fit:contain;margin-top:6px;display:block}
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
