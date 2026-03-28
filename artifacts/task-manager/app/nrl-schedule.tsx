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
    </div>
    ${scoreArea}
    <div class="team-block" style="align-items:flex-end">
      <div class="team-colour-bar" style="background:${m.awayColour};margin-left:auto"></div>
      <div class="team-name" style="text-align:right">${m.awayTeam}</div>
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
