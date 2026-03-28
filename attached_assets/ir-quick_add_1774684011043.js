// ── IR Automation — Add Item ─────────────────────────────────────────────────
const IR_TOKEN   = Keychain.get("notion_token");
const IR_DB_ID   = "2c9b7eba35238084a6decf83993961e4";
const IR_TIMEOUT = 15;

const IR_HEADER_LOGO  = "https://i.postimg.cc/rwCNn1YJ/4375900A_530F_472F_8D00_3C573594C990.png";
const IR_PRIORITY_NOW = " ".repeat(23) + "\u2757\uFE0F Now";

// ── Loader config ─────────────────────────────────────────────────────────────
var IR_SPINNER_SIZE   = 75;
var IR_SPINNER_STROKE = 7.7;
var IR_SPINNER_SPEED  = 600;
var IR_CIRCLE_SIZE    = 68;
var IR_TICK_STROKE    = 7.1;
var IR_CIRCLE_FILL    = '#ffffff';
var IR_TICK_COLOR     = '#0C1846';
var IR_RING_COLOR     = null;
var IR_RING_WIDTH     = 0;
var IR_T_FADE_IN      = 200;
var IR_T_SPINNER_IN   = 250;
var IR_T_SPIN         = 1300;
var IR_T_POP          = 420;
var IR_T_TICK         = 400;
var IR_T_HOLD         = 700;
var IR_T_FADE_OUT     = 450;

const EPIC_PALETTE = {
  "Admin":     { bg:"rgba(40,160,40,0.24)",   glow:"rgba(40,160,40,0.22)",   bgA:"rgba(40,160,40,0.44)",   glowA:"rgba(40,160,40,0.54)",   text:"#FFFFFF", shadow:"rgba(40,160,40,0.65)"   },
  "Testing":   { bg:"rgba(255,50,50,0.22)",   glow:"rgba(255,50,50,0.45)",   bgA:"rgba(220,20,20,0.48)",   glowA:"rgba(220,20,20,0.75)",   text:"#FFFFFF", shadow:"rgba(255,60,60,0.8)"    },
  "Release":   { bg:"rgba(255,255,255,0.1)",  glow:"rgba(255,255,255,0.14)", bgA:"rgba(255,255,255,0.22)", glowA:"rgba(255,255,255,0.38)", text:"#FFFFFF", shadow:"rgba(255,255,255,0.55)" },
  "Review":    { bg:"rgba(255,200,0,0.2)",    glow:"rgba(255,200,0,0.22)",   bgA:"rgba(255,200,0,0.38)",   glowA:"rgba(255,200,0,0.52)",   text:"#FFFFFF", shadow:"rgba(255,200,0,0.6)"    },
  "Project":   { bg:"rgba(255,200,0,0.2)",    glow:"rgba(255,200,0,0.22)",   bgA:"rgba(255,200,0,0.38)",   glowA:"rgba(255,200,0,0.52)",   text:"#FFFFFF", shadow:"rgba(255,200,0,0.6)"    },
  "Tool":      { bg:"rgba(255,255,255,0.1)",  glow:"rgba(255,255,255,0.14)", bgA:"rgba(255,255,255,0.22)", glowA:"rgba(255,255,255,0.38)", text:"#FFFFFF", shadow:"rgba(255,255,255,0.55)" },
  "Reporting": { bg:"rgba(255,50,50,0.22)",   glow:"rgba(255,50,50,0.45)",   bgA:"rgba(220,20,20,0.48)",   glowA:"rgba(220,20,20,0.75)",   text:"#FFFFFF", shadow:"rgba(255,60,60,0.8)"    },
  "Knowledge": { bg:"rgba(40,160,40,0.24)",   glow:"rgba(40,160,40,0.22)",   bgA:"rgba(40,160,40,0.44)",   glowA:"rgba(40,160,40,0.54)",   text:"#FFFFFF", shadow:"rgba(40,160,40,0.65)"   },
};

const EPICS_ORDER   = ["Admin","Testing","Release","Review","Project","Tool","Reporting","Knowledge"];
const PICKER_EMOJIS = ["\uD83D\uDD25","\uD83D\uDEA9","\uD83D\uDCC8","\uD83E\uDE9B","\uD83D\uDC40","\uD83E\uDDE0","\uD83D\uDCCC"];

// ── Loader builders ───────────────────────────────────────────────────────────
function irLoaderCSS() {
  var SP  = IR_SPINNER_SIZE;
  var CIR = IR_CIRCLE_SIZE;
  var css = '';
  css += '.ir-anim{position:fixed;inset:0;background:rgba(12,24,70,0.7);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;z-index:999;}';
  css += '.ir-spw{position:absolute;width:'+SP+'px;height:'+SP+'px;opacity:0;}';
  css += '.ir-spsvg{width:'+SP+'px;height:'+SP+'px;animation:ir-spin '+IR_SPINNER_SPEED+'ms linear infinite;transform-origin:center;display:block;}';
  css += '@keyframes ir-spin{to{transform:rotate(360deg);}}';
  css += '.ir-scw{position:absolute;width:'+CIR+'px;height:'+CIR+'px;display:flex;align-items:center;justify-content:center;opacity:0;}';
  return css;
}

function irLoaderSpinnerSVG() {
  var SP      = IR_SPINNER_SIZE;
  var SPK     = IR_SPINNER_STROKE;
  var spinR   = (SP - SPK * 2) / 2;
  var arcFull = Math.round(Math.PI * spinR * 2);
  var arcDash = Math.round(arcFull * 0.25);
  var arcGap  = arcFull - arcDash;
  var cx      = SP / 2;
  var svg = '<svg class="ir-spsvg" viewBox="0 0 '+SP+' '+SP+'">';
  svg += '<circle cx="'+cx+'" cy="'+cx+'" r="'+spinR+'" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="'+SPK+'"/>';
  svg += '<circle cx="'+cx+'" cy="'+cx+'" r="'+spinR+'" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="'+SPK+'" stroke-linecap="round" stroke-dasharray="'+arcDash+' '+arcGap+'"/>';
  svg += '</svg>';
  return svg;
}

function irLoaderSuccessSVG() {
  var CIR = IR_CIRCLE_SIZE;
  var h   = CIR / 2;
  var sc  = CIR / 72;
  function s(n){ return Math.round(n * sc * 10) / 10; }
  var d = 'M'+s(18)+' '+s(38)+' L'+s(28)+' '+s(50)+' L'+s(51)+' '+s(23);
  var out = '';
  out += '<circle cx="'+h+'" cy="'+h+'" r="'+(h-1)+'" fill="'+IR_CIRCLE_FILL+'"/>';
  if(IR_RING_COLOR){
    var rr = h - 1 - IR_RING_WIDTH / 2;
    out += '<circle cx="'+h+'" cy="'+h+'" r="'+rr+'" fill="none" stroke="'+IR_RING_COLOR+'" stroke-width="'+IR_RING_WIDTH+'"/>';
  }
  out += '<path id="ir-tkp" fill="none" stroke="'+IR_TICK_COLOR+'" stroke-width="'+IR_TICK_STROKE+'" stroke-linecap="round" stroke-linejoin="round" d="'+d+'"/>';
  return '<svg id="ir-tick-svg" width="'+CIR+'" height="'+CIR+'" viewBox="0 0 '+CIR+' '+CIR+'">'+out+'</svg>';
}

function irLoaderJS() {
  var js = '';
  js += 'function irEob(t){var c=1.70158,c3=c+1;return 1+c3*Math.pow(t-1,3)+c*Math.pow(t-1,2);}';
  js += 'function irEio(t){return t<0.5?2*t*t:-1+(4-2*t)*t;}';
  js += 'function irEo(t){return 1-Math.pow(1-t,3);}';
  js += 'function irAn(dur,fn,done,ease){ease=ease||irEo;var s=performance.now();(function f(now){var raw=Math.min((now-s)/dur,1);fn(ease(raw));if(raw<1)requestAnimationFrame(f);else if(done)done();})(performance.now());}';
  js += 'var irRunning=false;';
  js += 'function irShowLoader(onDone){';
  js += '  if(irRunning)return;irRunning=true;';
  js += '  var am=document.getElementById("ir-anim");';
  js += '  var spw=document.getElementById("ir-spw");';
  js += '  var scw=document.getElementById("ir-scw");';
  js += '  var tkp=document.getElementById("ir-tkp");';
  js += '  var len=tkp.getTotalLength();';
  js += '  tkp.style.strokeDasharray=len;tkp.style.strokeDashoffset=len;';
  js += '  scw.style.transform="scale(0)";scw.style.opacity="0";';
  js += '  spw.style.opacity="0";am.style.opacity="0";';
  js += '  am.style.pointerEvents="all";';
  js += '  irAn('+IR_T_FADE_IN+',function(t){am.style.opacity=t;},function(){';
  js += '    irAn('+IR_T_SPINNER_IN+',function(t){spw.style.opacity=t;},function(){';
  js += '      setTimeout(function(){';
  js += '        irAn('+IR_T_POP+',function(t){spw.style.opacity=1-t;scw.style.opacity=t;scw.style.transform="scale("+irEob(t)+")";},function(){';
  js += '          spw.style.opacity=0;';
  js += '          irAn('+IR_T_TICK+',function(t){var p=document.getElementById("ir-tkp");if(p){var l=p.getTotalLength();p.style.strokeDashoffset=l*(1-t);}},function(){';
  js += '            setTimeout(function(){';
  js += '              irAn('+IR_T_FADE_OUT+',function(t){am.style.opacity=1-t;},function(){';
  js += '                am.style.opacity="0";am.style.pointerEvents="none";';
  js += '                scw.style.transform="scale(0)";';
  js += '                irRunning=false;';
  js += '                if(onDone)onDone();';
  js += '              });';
  js += '            },'+IR_T_HOLD+');';
  js += '          },irEio);';
  js += '        },irEo);';
  js += '      },'+IR_T_SPIN+');';
  js += '    });';
  js += '  });';
  js += '}';
  return js;
}

// ── Notion helpers ────────────────────────────────────────────────────────────
function parseQuery(u){
  const out={};
  const qi=u.indexOf("?");
  if(qi===-1) return out;
  for(const p of u.slice(qi+1).split("&")){
    if(!p) continue;
    const eq=p.indexOf("=");
    const k=eq===-1?p:p.slice(0,eq);
    const v=eq===-1?"":p.slice(eq+1);
    try{ out[decodeURIComponent(k)]=decodeURIComponent(v); }catch{ out[k]=v; }
  }
  return out;
}

function sleep(ms){ return new Promise(r=>Timer.schedule(ms,false,r)); }

async function fetchSchema(){
  const req=new Request("https://api.notion.com/v1/databases/"+IR_DB_ID);
  req.method="GET";
  req.headers={"Authorization":"Bearer "+IR_TOKEN,"Notion-Version":"2022-06-28"};
  req.timeoutInterval=IR_TIMEOUT;
  const db=await req.loadJSON();
  if(db&&db.object==="error") throw new Error(db.message);
  const props=(db&&db.properties)||{};
  const priProp=props["-"];
  const priType=(priProp&&priProp.type)||"select";
  const priOptions=priType==="select"
    ?(priProp.select.options||[]).map(function(o){ return o.name.replace(/\uFE0F/g,""); })
    :priType==="status"
    ?(priProp.status.options||[]).map(function(o){ return o.name.replace(/\uFE0F/g,""); })
    :null;
  return {props:props,priType:priType,priOptions:priOptions};
}

function findBest(wanted,options){
  const w=wanted.toLowerCase().trim();
  for(let i=0;i<(options||[]).length;i++){
    if(options[i].toLowerCase().trim()===w) return options[i];
  }
  return wanted;
}

async function createItem(title,epic,emoji,schema){
  const props=schema.props;
  const priType=schema.priType;
  const priOptions=schema.priOptions;
  const body={parent:{database_id:IR_DB_ID},properties:{}};
  body.properties["Task"]={title:[{type:"text",text:{content:title}}]};
  body.properties["Done"]={checkbox:false};
  const priorityProp=props["Priority"];
  if(priorityProp&&priorityProp.type==="select")
    body.properties["Priority"]={select:{name:IR_PRIORITY_NOW}};
  else if(priorityProp&&priorityProp.type==="status")
    body.properties["Priority"]={status:{name:IR_PRIORITY_NOW}};
  if(epic){
    const epicProp=props["Epic"];
    if(epicProp&&epicProp.type==="select")
      body.properties["Epic"]={select:{name:epic}};
    else if(epicProp&&epicProp.type==="status")
      body.properties["Epic"]={status:{name:epic}};
  }
  const emojiVal=String(emoji||"\uD83D\uDD25").replace(/\uFE0F/g,"");
  if(priType==="select")      body.properties["-"]={select:   {name:findBest(emojiVal,priOptions)}};
  else if(priType==="status") body.properties["-"]={status:   {name:findBest(emojiVal,priOptions)}};
  else                        body.properties["-"]={rich_text:[{type:"text",text:{content:emojiVal}}]};
  const req=new Request("https://api.notion.com/v1/pages");
  req.method="POST";
  req.headers={"Authorization":"Bearer "+IR_TOKEN,"Notion-Version":"2022-06-28","Content-Type":"application/json"};
  req.timeoutInterval=IR_TIMEOUT;
  req.body=JSON.stringify(body);
  const res=await req.loadJSON();
  if(res&&res.object==="error") throw new Error(res.message);
  return res;
}

// ── HTML ──────────────────────────────────────────────────────────────────────
function buildHTML(){
  const paletteJSON=JSON.stringify(EPIC_PALETTE).replace(/</g,"\\u003c");
  const epicsJSON=JSON.stringify(EPICS_ORDER);
  const pickersJSON=JSON.stringify(PICKER_EMOJIS);

  const html='<!DOCTYPE html>'+
'<html>'+
'<head>'+
'<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">'+
'<style>'+
'*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}'+
'html,body{height:100%;background:#0C1846;font-family:-apple-system,sans-serif;color:#f2f2f7;}'+
'body{position:fixed;inset:0;display:flex;flex-direction:column;overflow:hidden;}'+

'.page-logo{flex:1 1 auto;min-height:0;max-height:140px;display:flex;align-items:center;justify-content:center;padding:0 20px;}'+
'.page-logo img{max-height:100%;max-width:280px;width:auto;object-fit:contain;}'+

'.form-wrap{flex:0 0 auto;display:flex;flex-direction:column;}'+
'.form-inner{flex:0 0 auto;padding:0 14px;}'+
'.footer{flex:0 0 auto;display:flex;gap:10px;padding:8px 14px;padding-bottom:max(env(safe-area-inset-bottom),8px);border-top:1px solid rgba(255,255,255,.12);background:#0C1846;}'+

'@media(min-width:768px){'+
'  html{height:100%;overflow:auto;}'+
'  body{position:static;min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:40px 20px 20px;overflow:visible;}'+
'  .page-logo{flex:0 0 auto;max-height:unset;width:100%;max-width:580px;padding:0 0 16px;justify-content:center;}'+
'  .page-logo img{max-height:unset;height:220px;max-width:unset;}'+
'  .form-wrap{flex:0 0 auto;width:100%;max-width:580px;background:#0E1C4E;border-radius:24px;border:1px solid rgba(255,255,255,0.1);box-shadow:0 24px 60px rgba(0,0,0,0.5);overflow:visible;}'+
'  .form-inner{padding:24px 28px 0;}'+
'  .footer{background:transparent;padding:16px 28px 24px;border-top:1px solid rgba(255,255,255,0.08);}'+
'}'+

'/* Summary label — tight above input */'+
'.label-summary{font-size:10px;font-weight:700;letter-spacing:.08em;color:#ffffff;text-transform:uppercase;margin:8px 0 4px;}'+
'/* Epic and Priority labels — extra top margin to breathe after the element above */'+
'.label-section{font-size:10px;font-weight:700;letter-spacing:.08em;color:#ffffff;text-transform:uppercase;margin:14px 0 4px;}'+
'@media(min-width:768px){'+
'  .label-summary{font-size:12px;margin:16px 0 10px;}'+
'  .label-section{font-size:12px;margin:16px 0 10px;}'+
'}'+

'@keyframes ir-shake{0%,100%{transform:translateX(0);}20%{transform:translateX(-8px);}40%{transform:translateX(8px);}60%{transform:translateX(-6px);}80%{transform:translateX(6px);}}'+
'.shake{animation:ir-shake 0.4s ease;}'+

'.text-input{width:100%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.25);border-radius:16px;color:#f2f2f7;font-size:17px;padding:11px 14px;outline:none;font-family:-apple-system,sans-serif;-webkit-appearance:none;}'+
'.text-input::placeholder{color:#7a8aaa;}'+
'.text-input:focus{border-color:rgba(255,255,255,.75);box-shadow:0 0 0 1px rgba(255,255,255,.25);}'+
'@media(min-width:768px){.text-input{font-size:18px;padding:16px;border-radius:18px;}}'+

'.epic-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;}'+
'@media(min-width:768px){.epic-grid{gap:8px;}}'+
'.epic-btn{border-radius:12px;border:none;padding:0;height:42px;font-size:13px;font-weight:700;text-align:center;cursor:pointer;line-height:1;color:#fff;transition:opacity .2s,box-shadow .2s,background .2s,text-shadow .2s,transform .15s;}'+
'@media(min-width:768px){.epic-btn{font-size:13px;height:unset;padding:12px 6px;border-radius:14px;}}'+
'.epic-btn:active{transform:scale(0.97);}'+
'.epic-btn.dimmed{opacity:0.18;transform:scale(0.96);}'+

'.emoji-section{flex:0 0 auto;padding-bottom:8px;}'+
'@media(min-width:768px){.emoji-section{padding-bottom:20px;}}'+
'.emoji-row{display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:2px 0;}'+
'@media(min-width:768px){.emoji-row{gap:10px;}}'+
'.emoji-row::-webkit-scrollbar{display:none;}'+
'.emoji-btn{width:46px;height:46px;flex:0 0 46px;border-radius:12px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;transition:opacity .15s;}'+
'@media(min-width:768px){.emoji-btn{width:54px;height:54px;flex:0 0 54px;border-radius:14px;font-size:24px;}}'+
'.emoji-btn.selected{background:rgba(254,154,1,.25);border-color:rgba(254,154,1,.65);}'+
'.emoji-row.has-active .emoji-btn:not(.selected){opacity:.45;}'+

'.btn-cancel{flex:1;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:14px;color:#f2f2f7;font-size:16px;font-weight:800;padding:13px 0;cursor:pointer;font-family:-apple-system,sans-serif;}'+
'.btn-save{flex:2;background:linear-gradient(180deg,#FE9A01,#d97f00);border:1px solid rgba(255,255,255,.14);border-radius:14px;color:#0C1846;font-size:16px;font-weight:800;padding:13px 0;cursor:pointer;font-family:-apple-system,sans-serif;box-shadow:0 10px 24px rgba(254,154,1,.28);}'+
'@media(min-width:768px){.btn-cancel{padding:16px 0;border-radius:16px;}.btn-save{padding:16px 0;border-radius:16px;}}'+
'.btn-save:disabled{opacity:.35;box-shadow:none;}'+

irLoaderCSS()+
'</style>'+
'</head>'+
'<body id="body">'+

'<div class="ir-anim" id="ir-anim">'+
'  <div class="ir-spw" id="ir-spw">'+irLoaderSpinnerSVG()+'</div>'+
'  <div class="ir-scw" id="ir-scw">'+irLoaderSuccessSVG()+'</div>'+
'</div>'+

'<div class="page-logo"><img src="'+IR_HEADER_LOGO+'" alt="IR"/></div>'+

'<div class="form-wrap">'+
'  <div class="form-inner">'+
'    <div class="label-summary">Summary</div>'+
'    <input id="inp" class="text-input" type="text" placeholder="Enter title"'+
'      enterkeyhint="done" autocomplete="off" autocorrect="on" spellcheck="false"/>'+
'    <div class="label-section">Epic</div>'+
'    <div class="epic-grid" id="eGrid"></div>'+
'    <div class="label-section">Priority</div>'+
'    <div class="emoji-section">'+
'      <div class="emoji-row" id="emRow"></div>'+
'    </div>'+
'  </div>'+
'  <div class="footer">'+
'    <button class="btn-cancel" onmousedown="event.preventDefault()" onclick="cancel()">Cancel</button>'+
'    <button class="btn-save" id="sBtn" onmousedown="event.preventDefault()" onclick="save()">Save</button>'+
'  </div>'+
'</div>'+

'<script>'+
irLoaderJS()+
'var PALETTE='+paletteJSON+';'+
'var EPICS_ORDER='+epicsJSON+';'+
'var EMOJIS='+pickersJSON+';'+
'var selE=null,selM=null;'+

'function onVP(){'+
'  if(window.innerWidth>=768) return;'+
'  var vp=window.visualViewport;'+
'  var b=document.getElementById("body");'+
'  b.style.top=vp.offsetTop+"px";'+
'  b.style.height=vp.height+"px";'+
'}'+
'if(window.visualViewport){'+
'  window.visualViewport.addEventListener("resize",onVP);'+
'  window.visualViewport.addEventListener("scroll",onVP);'+
'  onVP();'+
'}'+

'function inactiveStyle(label){'+
'  var p=PALETTE[label]; if(!p) return "";'+
'  return "background:"+p.bg+";color:"+p.text+";box-shadow:0 0 6px "+p.glow+",inset 0 0 0 1px "+p.glow+";text-shadow:0 0 6px "+p.shadow+";";'+
'}'+
'function activeStyle(label){'+
'  var p=PALETTE[label]; if(!p) return "";'+
'  return "background:"+p.bgA+";color:"+p.text+";box-shadow:0 0 14px "+p.glowA+",0 0 5px "+p.glowA+",inset 0 0 0 1px "+p.glowA+";text-shadow:0 0 10px "+p.shadow+",0 0 4px "+p.shadow+";";'+
'}'+

'function rEpics(){'+
'  var g=document.getElementById("eGrid");'+
'  g.innerHTML=EPICS_ORDER.map(function(label){'+
'    var isActive=label===selE;'+
'    var isDimmed=selE!==null&&!isActive;'+
'    var cls="epic-btn"+(isDimmed?" dimmed":"");'+
'    var style=isActive?activeStyle(label):inactiveStyle(label);'+
'    return "<button class=\\""+cls+"\\" style=\\""+style+"\\""+'+
'      " onmousedown=\\"event.preventDefault()\\""+'+
'      " onclick=\\"pickE(\'"+label.replace(/\'/g,"\\\\\'")+"\')\\""+'+
'      ">"+label+"<\\/button>";'+
'  }).join("");'+
'}'+

'function rEmojis(){'+
'  var r=document.getElementById("emRow");'+
'  r.className="emoji-row"+(selM!==null?" has-active":"");'+
'  r.innerHTML=EMOJIS.map(function(em){'+
'    return "<div class=\\"emoji-btn"+(em===selM?" selected":"")+"\\""+'+
'      " onmousedown=\\"event.preventDefault()\\""+'+
'      " onclick=\\"pickM(\'"+em+"\')\\">"'+
'      +em+"<\\/div>";'+
'  }).join("");'+
'}'+

'function pickE(v){ selE=(selE===v)?null:v; rEpics(); }'+
'function pickM(v){ selM=v; rEmojis(); }'+
'function cancel(){ window.__msgs=window.__msgs||[]; window.__msgs.push("native://cancel"); }'+

'function shake(){'+
'  var inp=document.getElementById("inp");'+
'  inp.classList.remove("shake");'+
'  void inp.offsetWidth;'+
'  inp.classList.add("shake");'+
'  inp.addEventListener("animationend",function(){ inp.classList.remove("shake"); },{once:true});'+
'}'+

'function save(){'+
'  var t=document.getElementById("inp").value.trim();'+
'  if(!t){ shake(); return; }'+
'  document.getElementById("inp").blur();'+
'  document.getElementById("sBtn").disabled=true;'+
'  irShowLoader(function(){ resetForm(); });'+
'  window.__msgs=window.__msgs||[];'+
'  window.__msgs.push("native://create?title="+encodeURIComponent(t)+'+
'    "&epic="+encodeURIComponent(selE||"Admin")+'+
'    "&emoji="+encodeURIComponent(selM||"\uD83D\uDD25"));'+
'}'+

'function resetForm(){'+
'  document.getElementById("inp").value="";'+
'  document.getElementById("sBtn").disabled=false;'+
'  selE=null; selM=null;'+
'  rEpics(); rEmojis();'+
'  setTimeout(function(){ document.getElementById("inp").focus(); },100);'+
'}'+

'function showSuccess(){ }'+

'function showError(msg){'+
'  var am=document.getElementById("ir-anim");'+
'  am.style.opacity="0";am.style.pointerEvents="none";'+
'  irRunning=false;'+
'  var ov=document.createElement("div");'+
'  ov.style.cssText="position:fixed;inset:0;background:rgba(12,24,70,0.85);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;z-index:999;";'+
'  ov.innerHTML="<div style=\\"font-size:32px\\">\u2715<\\/div><div style=\\"color:#FE9A01;font-size:13px;font-weight:600;text-align:center;padding:0 24px\\">"+msg+"<\\/div>";'+
'  document.body.appendChild(ov);'+
'  setTimeout(function(){ document.body.removeChild(ov); document.getElementById("sBtn").disabled=false; resetForm(); },2500);'+
'}'+

'rEpics(); rEmojis();'+
'setTimeout(function(){ document.getElementById("inp").focus(); },300);'+
'<\/script>'+
'</body>'+
'</html>';

  return html;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const schema = await fetchSchema();
const wv = new WebView();
await wv.loadHTML(buildHTML());
wv.present(true);

while(true){
  await sleep(300);
  const raw=await wv.evaluateJavaScript(
    "(function(){ var m=window.__msgs||[]; window.__msgs=[]; return JSON.stringify(m); })()"
  );
  const queue=JSON.parse(raw||"[]");
  for(const url of queue){
    if(url.startsWith("native://cancel")){
      Script.complete(); return;
    }
    if(url.startsWith("native://create")){
      const q=parseQuery(url);
      try{
        await createItem(q.title,q.epic,q.emoji,schema);
        await wv.evaluateJavaScript("showSuccess()");
      }catch(e){
        const msg=String(e.message||e).replace(/'/g,"\\'");
        await wv.evaluateJavaScript("showError('"+msg+"')");
      }
    }
  }
}