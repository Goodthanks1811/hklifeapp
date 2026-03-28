import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import { ScreenHeader } from "@/components/ScreenHeader";

// ── Data ─────────────────────────────────────────────────────────────────────
const WEEKS = [
  {
    range: "28th Feb – 6th March", avg: "4:51",
    days: [
      { d: "Sat 28th", bed: "2:36am",  wake: "8:13am",  dur: "5:37" },
      { d: "Sun 1st",  bed: "5:56am",  wake: "10:16am", dur: "4:20" },
      { d: "Mon 2nd",  bed: "12:06am", wake: "3:24am",  dur: "3:18" },
      { d: "Tue 3rd",  bed: "11:47pm", wake: "5:14am",  dur: "5:27" },
      { d: "Wed 4th",  bed: "10:38pm", wake: "3:40am",  dur: "5:02" },
      { d: "Thu 5th",  bed: "12:32am", wake: "5:41am",  dur: "5:09" },
      { d: "Fri 6th",  bed: "10:15pm", wake: "3:19am",  dur: "5:04" },
    ],
  },
  {
    range: "7th March – 13th March", avg: "5:02",
    days: [
      { d: "Sat 7th",  bed: "11:17pm", wake: "5:12am",  dur: "5:55" },
      { d: "Sun 8th",  bed: "10:32pm", wake: "3:52am",  dur: "5:20" },
      { d: "Mon 9th",  bed: "11:04pm", wake: "3:48am",  dur: "4:44" },
      { d: "Tue 10th", bed: "11:14pm", wake: "3:10am",  dur: "3:56" },
      { d: "Wed 11th", bed: "11:14pm", wake: "3:10am",  dur: "3:56" },
      { d: "Thu 12th", bed: "10:59pm", wake: "3:08am",  dur: "4:09" },
      { d: "Fri 13th", bed: "11:30pm", wake: "5:39am",  dur: "6:09" },
    ],
  },
  {
    range: "14th March – 20th March", avg: "4:39",
    days: [
      { d: "Sat 14th", bed: "12:29am", wake: "4:45am",  dur: "4:16" },
      { d: "Sun 15th", bed: "10:52pm", wake: "5:03am",  dur: "6:11" },
      { d: "Mon 16th", bed: "11:30pm", wake: "4:49am",  dur: "5:19" },
      { d: "Tue 17th", bed: "12:16am", wake: "4:27am",  dur: "4:11" },
      { d: "Wed 18th", bed: "10:05pm", wake: "2:41am",  dur: "4:36" },
      { d: "Thu 19th", bed: "10:57pm", wake: "3:09am",  dur: "4:12" },
      { d: "Fri 20th", bed: "11:18pm", wake: "3:09am",  dur: "3:51" },
    ],
  },
  {
    range: "21st March – 27th March", avg: "4:36",
    days: [
      { d: "Sat 21st", bed: "3:09am",  wake: "7:20am",  dur: "4:11" },
      { d: "Sun 22nd", bed: "10:49pm", wake: "4:39am",  dur: "5:50" },
      { d: "Mon 23rd", bed: "12:11am", wake: "4:45am",  dur: "4:34" },
      { d: "Tue 24th", bed: "11:02pm", wake: "4:37am",  dur: "5:35" },
      { d: "Wed 25th", bed: "11:47pm", wake: "4:46am",  dur: "4:59" },
      { d: "Thu 26th", bed: "12:20am", wake: "3:58am",  dur: "3:38" },
      { d: "Fri 27th", bed: "1:41am",  wake: "5:10am",  dur: "3:29" },
    ],
  },
] as const;

const AXIS_LABELS = [
  { label: "8pm",  pct: 0 },
  { label: "10pm", pct: (2 / 14) * 100 },
  { label: "12am", pct: (4 / 14) * 100 },
  { label: "2am",  pct: (6 / 14) * 100 },
  { label: "4am",  pct: (8 / 14) * 100 },
  { label: "6am",  pct: (10 / 14) * 100 },
  { label: "8am",  pct: (12 / 14) * 100 },
  { label: "10am", pct: 100 },
];

// ── HTML builder ──────────────────────────────────────────────────────────────
function buildHtml(): string {
  const BG      = "#0b0b0c";
  const SURFACE = "#111113";
  const CARD    = "#161618";
  const BORDER  = "#1e1e22";
  const ACCENT  = "#FF1E1E";
  const MUTED   = "#888888";
  const DIM     = "#222224";

  const COLS = "clamp(60px,9vw,90px) clamp(58px,8vw,80px) clamp(62px,8.5vw,84px) clamp(56px,7.5vw,74px) 1fr";

  function timeToPos(str: string): number {
    const isPM  = str.endsWith("pm");
    const clean = str.replace("pm", "").replace("am", "");
    const parts = clean.split(":");
    let h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    let totalMins = h * 60 + m;
    if (isPM && h !== 12) totalMins += 720;
    if (!isPM && h === 12) totalMins = m;
    const ref  = 20 * 60;
    const span = 14 * 60;
    const pos  = (totalMins - ref + 1440) % 1440;
    return Math.max(0, Math.min(pos / span, 1));
  }

  function buildAxisHTML(): string {
    const ticks = AXIS_LABELS.map((a, i) => {
      let extra = "";
      if (i === 0) extra = "transform:none;";
      if (i === AXIS_LABELS.length - 1) extra = "transform:translateX(-100%);";
      return `<div class="axis-tick" style="left:${a.pct.toFixed(1)}%;${extra}">${a.label}</div>`;
    }).join("");
    const lines = AXIS_LABELS.map((a) =>
      `<div class="axis-line" style="left:${a.pct.toFixed(1)}%"></div>`
    ).join("");
    return `<div class="axis-row">${ticks}</div><div class="axis-lines">${lines}</div>`;
  }

  function buildDay(d: { d: string; bed: string; wake: string; dur: string }): string {
    const bedPos  = timeToPos(d.bed);
    const wakePos = timeToPos(d.wake);
    const left  = (bedPos * 100).toFixed(1);
    const w     = Math.max((wakePos - bedPos) * 100, 2).toFixed(1);
    const dotS  = (bedPos  * 100).toFixed(1);
    const dotE  = (wakePos * 100).toFixed(1);
    return `
      <div class="day-row">
        <div class="c-day">${d.d}</div>
        <div class="c-bed c-divide">${d.bed}</div>
        <div class="c-wake c-divide">${d.wake}</div>
        <div class="c-dur c-divide">${d.dur}</div>
        <div class="c-chart c-divide">
          <div class="track">
            <div class="bar" style="left:${left}%;width:${w}%"></div>
            <div class="dot-s" style="left:calc(${dotS}% - 4px)"></div>
            <div class="dot-e" style="left:calc(${dotE}% - 4px)"></div>
          </div>
        </div>
      </div>`;
  }

  function buildWeek(week: typeof WEEKS[number]): string {
    const rows = [...week.days].map(buildDay).join("");
    return `
      <div class="week">
        <div class="week-hdr"><div class="week-range">${week.range}</div></div>
        <div class="col-hdr">
          <div class="ch-day"></div>
          <div class="ch-bed">Bed Time</div>
          <div class="ch-wake">Wake Time</div>
          <div class="ch-dur">Hours Slept</div>
          <div class="ch-chart">${buildAxisHTML()}</div>
        </div>
        ${rows}
        <div class="week-footer">
          Average Time In Bed &nbsp;·&nbsp; <span class="wf-val">${week.avg}h</span>
        </div>
      </div>`;
  }

  const css = `
    *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
    html,body{height:100%;background:${BG}}
    html{overflow-y:scroll;-webkit-overflow-scrolling:touch;scrollbar-width:none}
    html::-webkit-scrollbar{display:none;width:0;height:0}
    body{
      color:#fff;
      font-family:-apple-system,sans-serif;
      overflow:visible;
      padding:20px max(14px,env(safe-area-inset-right)) 60px max(14px,env(safe-area-inset-left));
    }
    .page-wrap{max-width:90%;margin:0 auto}

    .header{text-align:center;margin-bottom:24px}
    .emoji{font-size:clamp(36px,6vw,52px);display:block;margin-bottom:6px}
    .title{font-size:clamp(24px,5vw,38px);font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#fff}
    .title span{color:${ACCENT}}
    .subtitle{font-size:clamp(9px,1.5vw,12px);color:${MUTED};letter-spacing:3px;text-transform:uppercase;margin-top:5px}
    .accent-line{width:32px;height:2px;background:${ACCENT};margin:10px auto 0;border-radius:1px}

    .pills{display:grid;grid-template-columns:1fr 1fr 1fr;gap:clamp(6px,1.5vw,12px);margin-bottom:24px}
    .pill{background:${CARD};border:1px solid ${BORDER};border-radius:10px;padding:clamp(10px,2vw,18px) 8px;text-align:center}
    .pill-label{font-size:clamp(8px,1.3vw,11px);font-weight:600;letter-spacing:1px;color:#fff;text-transform:uppercase;margin-bottom:6px;line-height:1.4}
    .pill-row{display:flex;align-items:baseline;justify-content:center;gap:4px}
    .pill-val{font-size:clamp(20px,4vw,32px);font-weight:800;color:#fff;font-variant-numeric:tabular-nums}
    .pill-unit{font-size:clamp(10px,1.8vw,14px);font-weight:600;color:#fff}

    .week{background:${CARD};border:1px solid ${BORDER};border-radius:12px;margin-bottom:16px;overflow:hidden}
    .week-hdr{padding:12px 14px;background:${SURFACE};border-bottom:1px solid ${BORDER};text-align:center}
    .week-range{font-size:clamp(12px,2.2vw,16px);font-weight:700;color:#fff;letter-spacing:.5px}

    .col-hdr{display:grid;grid-template-columns:${COLS};align-items:end;padding:7px 14px 6px;border-bottom:1px solid ${BORDER};background:${SURFACE}}
    .ch-bed,.ch-wake,.ch-dur{font-size:clamp(8px,1.2vw,10px);font-weight:700;letter-spacing:1px;color:#fff;text-transform:uppercase;text-align:center;padding-left:6px}
    .ch-chart{position:relative;height:26px;padding-left:10px}
    .axis-row{position:absolute;bottom:0;left:10px;right:0;height:18px}
    .axis-tick{position:absolute;font-size:clamp(8px,1.3vw,11px);font-weight:700;color:#fff;transform:translateX(-50%);white-space:nowrap;text-align:center}
    .axis-lines{position:absolute;top:0;left:10px;right:0;bottom:0}
    .axis-line{position:absolute;top:0;bottom:0;width:1px;background:${DIM};opacity:.7}

    .day-row{display:grid;grid-template-columns:${COLS};align-items:center;padding:9px 14px;border-bottom:1px solid ${BORDER}}
    .day-row:last-child{border-bottom:none}
    .c-day{font-size:clamp(11px,1.8vw,14px);color:${MUTED};font-variant-numeric:tabular-nums}
    .c-divide{border-left:1px solid ${BORDER}}
    .c-bed,.c-wake{font-size:clamp(11px,1.8vw,15px);color:#fff;text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap;padding:0 4px}
    .c-dur{font-size:clamp(12px,2vw,16px);font-weight:700;color:${ACCENT};text-align:center;font-variant-numeric:tabular-nums;padding:0 4px}
    .c-chart{padding-left:10px;display:flex;align-items:center;height:22px}
    .track{width:100%;height:5px;background:${DIM};border-radius:3px;position:relative}
    .bar{position:absolute;height:100%;border-radius:3px;background:linear-gradient(90deg,rgba(255,30,30,.85),rgba(255,30,30,.3))}
    .dot-s,.dot-e{position:absolute;width:8px;height:8px;border-radius:50%;top:50%;transform:translateY(-50%)}
    .dot-s{background:${ACCENT};border:1.5px solid ${BG}}
    .dot-e{background:#444;border:1.5px solid ${BG}}

    .week-footer{padding:9px 14px;background:${SURFACE};border-top:1px solid ${BORDER};font-size:clamp(8px,1.3vw,10px);font-weight:600;letter-spacing:1.5px;color:#fff;text-transform:uppercase;text-align:right}
    .wf-val{color:${ACCENT};font-size:clamp(12px,2vw,16px);font-weight:700;font-variant-numeric:tabular-nums}

    .footer{text-align:center;margin-top:28px;font-size:9px;color:${DIM};letter-spacing:2px;text-transform:uppercase}
  `;

  const weeksHtml = [...WEEKS].map(buildWeek).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=yes">
  <style>${css}</style>
</head>
<body>
  <div class="page-wrap">
    <div class="header">
      <span class="emoji">😴</span>
      <div class="title">HK <span>Sleep Report</span></div>
      <div class="subtitle">28th February – 27th March, 2026</div>
      <div class="accent-line"></div>
    </div>
    <div class="pills">
      <div class="pill">
        <div class="pill-label">Average Bed Time</div>
        <div class="pill-row"><span class="pill-val">11:43</span><span class="pill-unit">pm</span></div>
      </div>
      <div class="pill">
        <div class="pill-label">Average Wake Time</div>
        <div class="pill-row"><span class="pill-val">4:33</span><span class="pill-unit">am</span></div>
      </div>
      <div class="pill">
        <div class="pill-label">Avg Time In Bed</div>
        <div class="pill-row"><span class="pill-val">4:47</span><span class="pill-unit">hrs</span></div>
      </div>
    </div>
    ${weeksHtml}
    <div class="footer">HK · Sleep · Whoop · Mar 2026</div>
  </div>
</body>
</html>`;
}

// ── Screen ────────────────────────────────────────────────────────────────────
const HTML = buildHtml();

export default function MarchSleepScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScreenHeader title="March Sleep" />
      <WebView
        source={{ html: HTML }}
        style={styles.webview}
        scrollEnabled
        bounces={false}
        overScrollMode="never"
        originWhitelist={["*"]}
        javaScriptEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#0b0b0c" },
  webview: { flex: 1, backgroundColor: "#0b0b0c" },
});
