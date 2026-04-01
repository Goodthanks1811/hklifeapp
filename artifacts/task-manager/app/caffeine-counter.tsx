import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import WebView, { type WebViewNavigation } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { ScreenHeader } from "@/components/ScreenHeader";

// ── Persistence ───────────────────────────────────────────────────────────────
const STORE_KEY = "hk_caffeine_log";

type LogEntry = { k: string; name: string; mg: number; col: string; t: string };
type DayState = { date: string; counts: { coffee: number; c4: number; v: number }; lg: LogEntry[] };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY: DayState = { date: todayStr(), counts: { coffee: 0, c4: 0, v: 0 }, lg: [] };

async function loadDayState(): Promise<DayState> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) return { ...EMPTY, date: todayStr() };
    const s: DayState = JSON.parse(raw);
    if (s.date !== todayStr()) return { ...EMPTY, date: todayStr() };
    return s;
  } catch {
    return { ...EMPTY, date: todayStr() };
  }
}

async function saveDayState(counts: DayState["counts"], lg: LogEntry[]) {
  const s: DayState = { date: todayStr(), counts, lg };
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(s));
}

// ── HTML builder ──────────────────────────────────────────────────────────────
const DRINK_IMGS = {
  coffee: "https://i.postimg.cc/1zg0383z/Photoroom_20260401_052237.png",
  c4:     "https://i.postimg.cc/MKWyjPpY/Photoroom-20260401-051939.png",
  v:      "https://i.postimg.cc/Y0xYsgbg/Photoroom_20260401_052039.png",
};

function buildHTML(state: DayState): string {
  const countsJSON = JSON.stringify(state.counts);
  const lgJSON     = JSON.stringify(state.lg);

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;600&display=swap');
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
:root{--bg:#0b0b0c;--red:rgb(255,30,30);--rg:rgba(255,30,30,0.4);--s1:#141416;--s2:#1c1c1f;--t:#fff;--mu:#555;--br:#222}
html,body{background:var(--bg);color:var(--t);font-family:Inter,sans-serif;overflow:hidden}
body{position:fixed;left:0;right:0;top:0;height:100vh;display:flex;flex-direction:column;overflow:hidden}
.app{display:flex;flex-direction:column;flex:1;overflow:hidden}
.hdr{padding:20px 20px 14px;background:var(--bg);border-bottom:1px solid var(--br);flex-shrink:0}
.hl{font-family:'Bebas Neue',sans-serif;font-size:11px;letter-spacing:3px;color:var(--red);margin-bottom:2px}
.hdr-row{display:flex;align-items:baseline;justify-content:space-between}
.ht{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:1px;line-height:1}
.hpct{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:1px;line-height:1;color:var(--red);visibility:hidden}
.met{padding:14px 20px;flex-shrink:0;background:var(--s1);border-bottom:1px solid var(--br)}
.mr{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
.ml{font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--mu)}
.mv{font-family:'Bebas Neue',sans-serif;font-size:32px;line-height:1;display:flex;align-items:baseline}
.mv-num{font-family:'Bebas Neue',sans-serif;font-size:32px;line-height:1;color:#fff}
.mv-sep{font-family:'Bebas Neue',sans-serif;font-size:32px;line-height:1;color:var(--mu);margin:0 4px}
.mv-lim{font-family:'Bebas Neue',sans-serif;font-size:32px;line-height:1;color:#fff}
.mv-unit{font-size:13px;font-weight:300;color:var(--mu);font-family:Inter,sans-serif;margin-left:3px}
.mt{height:6px;background:var(--s2);border-radius:3px;overflow:hidden}
.mf{height:100%;border-radius:3px;background:var(--red);transition:width 0.5s ease;box-shadow:0 0 8px var(--rg)}
.mf.warn{background:#ff6b00}.mf.danger{background:#ff1e1e}
.mc{margin-top:5px;font-size:10px;color:var(--mu);text-align:right}
.mc.warn{color:#ff6b00}.mc.danger{color:var(--red)}
.body{flex:1;overflow-y:auto;padding:16px}
.tiles{display:flex;gap:8px;margin-bottom:18px}
.tile{flex:1;background:var(--s1);border:1px solid var(--br);border-radius:12px;padding:8px 6px 10px;display:flex;flex-direction:column;align-items:center;cursor:pointer;transition:all 0.15s ease;user-select:none;-webkit-user-select:none;gap:5px;overflow:hidden}
.tile:active{transform:scale(0.96);border-color:var(--red)}
.tile.active{border-color:rgba(255,30,30,0.4)}
.ibox{width:100%;height:140px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.ibox img{width:90px;height:135px;object-fit:contain;display:block}
.coffee-img{transform:scale(1.9)}
.v-img{transform:scale(1.5)}
.tile-name{font-family:'Bebas Neue',sans-serif;font-size:14px;line-height:1;text-align:center}
.tile-row{display:flex;align-items:baseline;justify-content:center;gap:6px}
.tile-mg{font-family:'Bebas Neue',sans-serif;font-size:19px;line-height:1}
.tile-mg span{font-size:9px;color:var(--mu);font-family:Inter,sans-serif;margin-left:1px}
.cnt{font-family:'Bebas Neue',sans-serif;font-size:13px;color:var(--mu);text-align:center}
.cnt.has{color:var(--t)}
.log-label{font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--mu);margin-bottom:10px}
.le{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--br);font-size:12px;color:var(--mu)}
.ld{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.ln{color:var(--t);font-weight:500;flex:1}
.lm{font-family:'Bebas Neue',sans-serif;font-size:14px}
.empty{font-size:12px;color:var(--mu);text-align:center;padding:16px 0}
.rst{margin-top:14px;width:100%;padding:9px;background:transparent;border:1px solid var(--br);border-radius:8px;color:var(--mu);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer}
@keyframes pulse{0%{transform:scale(1)}50%{transform:scale(1.05)}100%{transform:scale(1)}}
.pulse{animation:pulse 0.3s ease}
</style></head><body>
<div class="app">
  <div class="hdr">
    <div class="hl">HK Health</div>
    <div class="hdr-row">
      <div class="ht">Caffeine Tracker</div>
      <div class="hpct" id="hpct">+0%</div>
    </div>
  </div>
  <div class="met">
    <div class="mr">
      <div class="ml">Daily Intake</div>
      <div class="mv">
        <span class="mv-num" id="tot-num">0</span>
        <span class="mv-sep">/</span>
        <span class="mv-lim">400</span>
        <span class="mv-unit">mg</span>
      </div>
    </div>
    <div class="mt"><div class="mf" id="fill" style="width:0%"></div></div>
    <div class="mc" id="cap">400mg remaining</div>
  </div>
  <div class="body">
    <div class="tiles">
      <div class="tile" id="tile-coffee" onclick="tap('coffee')">
        <div class="ibox"><img src="${DRINK_IMGS.coffee}" class="coffee-img" alt="Coffee"></div>
        <div class="tile-name" style="color:#c8a96e">Coffee</div>
        <div class="tile-row">
          <div class="tile-mg" style="color:#c8a96e">95<span>mg</span></div>
          <div class="cnt" id="cnt-coffee"></div>
        </div>
      </div>
      <div class="tile" id="tile-c4" onclick="tap('c4')">
        <div class="ibox"><img src="${DRINK_IMGS.c4}" alt="C4 Energy"></div>
        <div class="tile-name" style="color:#FFD700">C4 Energy</div>
        <div class="tile-row">
          <div class="tile-mg" style="color:#FFD700">200<span>mg</span></div>
          <div class="cnt" id="cnt-c4"></div>
        </div>
      </div>
      <div class="tile" id="tile-v" onclick="tap('v')">
        <div class="ibox"><img src="${DRINK_IMGS.v}" class="v-img" alt="V Energy"></div>
        <div class="tile-name" style="color:#a8e063">V Energy</div>
        <div class="tile-row">
          <div class="tile-mg" style="color:#a8e063">155<span>mg</span></div>
          <div class="cnt" id="cnt-v"></div>
        </div>
      </div>
    </div>
    <div class="log-label">Log</div>
    <div id="ll"><div class="empty">No drinks logged yet</div></div>
    <button class="rst" onclick="rst()">Reset Day</button>
  </div>
</div>
<script>
var D={coffee:{name:"Coffee",mg:95,col:"#c8a96e"},c4:{name:"C4 Energy",mg:200,col:"#FFD700"},v:{name:"V Energy",mg:155,col:"#a8e063"}};
var M=400;
var counts=${countsJSON};
var lg=${lgJSON};
(function(){
  ["coffee","c4","v"].forEach(function(k){
    if(counts[k]>0){
      var el=document.getElementById("cnt-"+k);
      el.textContent=counts[k]+"x";el.classList.add("has");
      document.getElementById("tile-"+k).classList.add("active");
    }
  });
  rl();upd();
})();
function onVP(){
  var vp=window.visualViewport;
  document.body.style.top=vp.offsetTop+"px";
  document.body.style.height=vp.height+"px";
}
if(window.visualViewport){
  window.visualViewport.addEventListener("resize",onVP);
  window.visualViewport.addEventListener("scroll",onVP);
  onVP();
}
function save(){
  window.location.href="native://save?data="+encodeURIComponent(JSON.stringify({counts:counts,lg:lg}));
}
function tap(k){
  counts[k]++;
  var el=document.getElementById("cnt-"+k);
  el.textContent=counts[k]+"x";el.classList.add("has");
  document.getElementById("tile-"+k).classList.add("active");
  lg.push({k:k,name:D[k].name,mg:D[k].mg,col:D[k].col,t:new Date().toISOString()});
  rl();upd();save();
}
function rl(){
  var el=document.getElementById("ll");
  if(!lg.length){el.innerHTML="<div class='empty'>No drinks logged yet</div>";return;}
  el.innerHTML=lg.slice().reverse().map(function(l){
    var t=new Date(l.t).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    return "<div class='le'><div class='ld' style='background:"+l.col+"'></div><div class='ln'>"+l.name+"</div><div class='lm' style='color:"+l.col+"'>+"+l.mg+"mg</div><div>"+t+"</div></div>";
  }).join("");
}
function upd(){
  var tot=lg.reduce(function(s,l){return s+l.mg;},0);
  var pct=(tot/M)*100;
  document.getElementById("tot-num").textContent=tot;
  var f=document.getElementById("fill"),c=document.getElementById("cap"),h=document.getElementById("hpct");
  f.style.width=Math.min(100,pct)+"%";
  f.className="mf";c.className="mc";
  if(tot>M){
    var over=Math.round(pct-100);
    h.textContent="+"+over+"%";h.style.visibility="visible";
    f.classList.add("danger");c.classList.add("danger");c.textContent="Over daily limit!";
  }else if(pct>=75){
    h.style.visibility="hidden";
    f.classList.add("warn");c.classList.add("warn");c.textContent=(M-tot)+"mg remaining - approaching limit";
  }else{
    h.style.visibility="hidden";
    c.textContent=(M-tot)+"mg remaining";
  }
  var tv=document.getElementById("tot-num");tv.classList.remove("pulse");void tv.offsetWidth;tv.classList.add("pulse");
}
function rst(){
  counts={coffee:0,c4:0,v:0};lg=[];
  ["coffee","c4","v"].forEach(function(k){
    document.getElementById("tile-"+k).classList.remove("active");
    var el=document.getElementById("cnt-"+k);el.textContent="";el.classList.remove("has");
  });
  document.getElementById("hpct").style.visibility="hidden";
  rl();upd();save();
}
<\/script></body></html>`;
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function CaffeineCounterScreen() {
  const insets          = useSafeAreaInsets();
  const [html, setHtml] = useState<string | null>(null);
  const wvRef           = useRef<WebView>(null);

  useEffect(() => {
    loadDayState().then(state => setHtml(buildHTML(state)));
  }, []);

  const onShouldStartLoadWithRequest = useCallback((req: WebViewNavigation) => {
    const url = req.url;
    if (url.startsWith("native://save")) {
      const qs = url.split("?data=")[1];
      if (qs) {
        try {
          const data = JSON.parse(decodeURIComponent(qs));
          saveDayState(data.counts, data.lg);
        } catch {}
      }
      return false;
    }
    return true;
  }, []);

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Caffeine Counter" />
      {html ? (
        <WebView
          ref={wvRef}
          source={{ html, baseUrl: "" }}
          style={st.wv}
          originWhitelist={["*"]}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          scrollEnabled={false}
          bounces={false}
          showsVerticalScrollIndicator={false}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0b0c" },
  wv:   { flex: 1, backgroundColor: "#0b0b0c" },
});
