import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import React, { useRef } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, { WebViewMessageEvent } from "react-native-webview";
import { ScreenHeader } from "@/components/ScreenHeader";

const C = {
  bg:        "#0a0a0e",
  surface:   "#111111",
  card:      "#1a1a22",
  border:    "#2a2a35",
  primary:   "#E03131",
  primaryLo: "rgba(224,49,49,0.22)",
  blue:      "#0a84ff",
  purple:    "#bf5af2",
  orange:    "#ff9f0a",
  green:     "#30a830",
  text:      "#ffffff",
  muted:     "#8e8e93",
};

const buildHtml = () => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
* { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
html, body { height:100%; background:${C.bg}; font-family:-apple-system,BlinkMacSystemFont,sans-serif; color:${C.text}; overflow:hidden; display:flex; flex-direction:column; }

/* ── Toolbar — horizontally scrollable single row ─── */
.bar { display:flex; gap:5px; padding:7px 10px; background:${C.surface}; flex-shrink:0; border-bottom:1px solid ${C.border}; align-items:center; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
.bar::-webkit-scrollbar { display:none; }
.img-btn { flex:0 0 72px; padding:10px 4px; border:none; border-radius:11px; font-size:12px; font-weight:700; cursor:pointer; color:${C.text}; background:${C.card}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:opacity .2s; font-family:inherit; }
.btn-icon { flex:0 0 38px; width:38px; font-size:15px; padding:10px 0; border:none; border-radius:10px; font-weight:700; cursor:pointer; color:${C.text}; background:${C.card}; font-family:inherit; text-align:center; display:flex; align-items:center; justify-content:center; }

/* Active states */
.img1-active { background:${C.blue} !important; box-shadow:0 0 0 2px rgba(10,132,255,.45); opacity:1 !important; }
.img2-active { background:${C.primary} !important; box-shadow:0 0 0 2px rgba(224,49,49,.45); opacity:1 !important; }
.img1-loaded { background:${C.blue} !important; }
.img2-loaded { background:${C.primary} !important; }
.img-btn-dim  { opacity:0.35 !important; }
.zoom-active  { background:${C.orange} !important; box-shadow:0 0 0 2px rgba(255,159,10,.45); }
.slider-active{ background:${C.purple} !important; box-shadow:0 0 0 2px rgba(191,90,242,.45); }
.eye-active   { background:${C.orange} !important; box-shadow:0 0 0 2px rgba(255,159,10,.45); }
.brush-active-btn { background:${C.green} !important; box-shadow:0 0 8px rgba(48,168,48,.45) !important; }
.erase-on  { background:${C.primary} !important; box-shadow:0 0 8px rgba(224,49,49,.45) !important; }
.restore-on{ background:${C.green} !important; box-shadow:0 0 8px rgba(48,168,48,.45) !important; }
.draw-on   { box-shadow:0 0 8px rgba(224,49,49,.35) !important; }


/* Colour swatch in main bar — hidden until a colour is picked */
#colorSwatch { flex:0 0 28px; width:28px; height:28px; border-radius:8px; border:2px solid #555; cursor:pointer; background:rgb(224,49,49); transition:border-color .2s, box-shadow .2s; display:none; }
#colorSwatch.picking { border-color:${C.orange}; box-shadow:0 0 0 2px rgba(255,159,10,.5); animation:pulse .7s ease-in-out infinite alternate; }
#colorSwatch.swatch-active { border-color:${C.orange}; box-shadow:0 0 8px rgba(255,159,10,.65); }
@keyframes pulse { from{opacity:1} to{opacity:.55} }

/* Inline brush tools + picker — hidden until brush mode on */
.brush-inline { display:none !important; }
.brush-inline.bi-on { display:flex !important; }

/* Bigger colour-picker pencil */
.picker-btn { font-size:21px !important; }

/* Opacity bar */
.obar { display:flex; align-items:center; gap:10px; padding:8px 14px; background:${C.surface}; border-bottom:1px solid ${C.border}; flex-shrink:0; }
.obar label { font-size:12px; color:${C.muted}; white-space:nowrap; }
.obar input[type=range] { flex:1; -webkit-appearance:none; height:4px; border-radius:2px; background:${C.border}; outline:none; }
.obar input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:22px; height:22px; border-radius:50%; background:${C.text}; box-shadow:0 1px 6px rgba(0,0,0,.5); }
.oval { font-size:12px; color:${C.muted}; width:36px; text-align:right; }

#stage { flex:1; min-height:0; position:relative; touch-action:none; user-select:none; overflow:hidden; background:${C.bg}; cursor:none; }
#stage.eye-cursor { cursor:crosshair; }
canvas { position:absolute; top:0; left:0; display:block; }
#divider { position:absolute; z-index:3; background:rgba(255,255,255,.85); box-shadow:0 0 8px rgba(0,0,0,.6); pointer-events:none; display:none; }

/* ── Sheet ───────────────────────────────────────────── */
#sheet-bg { position:fixed; inset:0; z-index:40; background:rgba(0,0,0,0); pointer-events:none; transition:background 0.28s; }
#sheet-bg.open { background:rgba(0,0,0,.65); pointer-events:all; }
#sheet { position:fixed; left:0; right:0; bottom:0; z-index:41; background:${C.surface}; border-radius:20px 20px 0 0; padding:0 20px 48px; transform:translateY(100%); transition:transform 0.32s cubic-bezier(0.32,.72,0,1), bottom 0.22s ease; border-top:1px solid ${C.border}; }
#sheet.open { transform:translateY(0); }
.sheet-handle { width:36px; height:5px; border-radius:3px; background:${C.border}; margin:12px auto 22px; }
.sheet-title { font-size:17px; font-weight:800; text-align:center; margin-bottom:4px; }
.sheet-desc { font-size:13px; color:${C.muted}; text-align:center; margin-bottom:24px; line-height:1.45; }

#panel-load { text-align:center; }
.load-btn { display:inline-block; padding:14px 36px; border:none; border-radius:13px; font-size:15px; font-weight:700; cursor:pointer; background:${C.primary}; color:#fff; margin-bottom:12px; font-family:inherit; box-shadow:0 0 18px rgba(224,49,49,.4); }
.load-cancel { display:block; width:100%; padding:14px; border:none; border-radius:13px; font-size:15px; font-weight:600; cursor:pointer; background:${C.card}; color:${C.text}; font-family:inherit; }

#panel-name { display:none; }
.name-row { margin-bottom:14px; }
.name-label { font-size:12px; font-weight:700; color:${C.muted}; margin-bottom:7px; letter-spacing:.4px; text-transform:uppercase; }
.name-label span { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:6px; vertical-align:middle; position:relative; top:-1px; }
.sheet-input { width:100%; padding:14px; border:none; border-radius:13px; font-size:16px; background:${C.card}; color:${C.text}; outline:none; border:1px solid ${C.border}; font-family:inherit; }
.sheet-row { display:flex; gap:10px; margin-top:20px; }
.sheet-btn { flex:1; padding:15px; border:none; border-radius:13px; font-size:15px; font-weight:700; cursor:pointer; font-family:inherit; }
.sheet-btn.primary { background:${C.primary}; color:#fff; box-shadow:0 0 14px rgba(224,49,49,.35); }
.sheet-btn.secondary { background:${C.card}; color:${C.text}; }

/* ── Loader ──────────────────────────────────────────── */
#loader { position:absolute; inset:0; z-index:20; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(10,10,14,.85); opacity:0; pointer-events:none; }
#loader-spw { position:absolute; opacity:0; }
#loader-scw { position:absolute; display:flex; align-items:center; justify-content:center; opacity:0; transform:scale(0); }
#loader-word { display:none; }
@keyframes spin { to { transform:rotate(360deg); } }
input[type=file] { display:none; }
</style>
</head>
<body>

<!-- ── Single scrollable toolbar ─────────────────── -->
<div class="bar">
  <button class="img-btn" id="btn1" onclick="imgBtnTap(1)">Image 1</button>
  <button class="img-btn" id="btn2" onclick="imgBtnTap(2)">Image 2</button>
  <button class="btn-icon" id="btnSlider"  onclick="toggleSlider()">&#9474;</button>
  <!-- fit: plus with 4 arrowheads -->
  <button class="btn-icon" id="btnFit"     onclick="fitActive()"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6.5" y1="1.5" x2="6.5" y2="11.5"/><polyline points="4,4 6.5,1.5 9,4"/><polyline points="4,9 6.5,11.5 9,9"/><line x1="1.5" y1="6.5" x2="11.5" y2="6.5"/><polyline points="4,4 1.5,6.5 4,9"/><polyline points="9,4 11.5,6.5 9,9"/></svg></button>
  <button class="btn-icon" id="btnUndo"    onclick="undo()"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12,3 A9,9 0 1 0 9,3.5"/><polyline points="11,1.5 9,3.5 11,5.5"/></svg></button>
  <!-- colour swatch: hidden until a colour is picked; tap activates colour-draw mode -->
  <div id="colorSwatch" onclick="swatchTap()"></div>
  <!-- inline brush tools: only visible when brush mode is on -->
  <button class="btn-icon brush-inline" id="btnErase"   onclick="setBrushMode('erase')"  >&#9675;</button>
  <button class="btn-icon brush-inline" id="btnRestore" onclick="setBrushMode('restore')" >&#9679;</button>
  <button class="btn-icon brush-inline" id="btnDraw"    onclick="setBrushMode('color')"  >&#9998;</button>
  <!-- colour picker pencil: only visible in brush mode; bigger via .picker-btn -->
  <button class="btn-icon brush-inline picker-btn" id="btnEye" onclick="toggleEyedrop()">&#9998;</button>
  <!-- brush toggle: circle (no fill) -->
  <button class="btn-icon" id="btnBrush"  onclick="toggleBrush()">&#9675;</button>
  <!-- download + reset + zoom: pushed to far right together -->
  <button class="btn-icon" id="btnShare" onclick="shareCanvas()" style="margin-left:auto"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="15"/><polyline points="7,10 12,15 17,10"/><path d="M5,18 L5,20 Q5,22 7,22 L17,22 Q19,22 19,20 L19,18"/></svg></button>
  <button class="btn-icon" id="btnReset" onclick="resetActive()"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12,3 A9,9 0 1 1 15,3.5"/><polyline points="13,1.5 15,3.5 13,5.5"/></svg></button>
  <button class="btn-icon" id="btnZoom"  onclick="toggleZoom()">&#128269;</button>
</div>

<!-- ── Opacity bar ───────────────────────────────── -->
<div class="obar" id="obar" style="display:none;">
  <label>Image 2 opacity</label>
  <input type="range" id="osl" min="0" max="100" value="100" oninput="setOpacity(this.value)">
  <span class="oval" id="oval">100%</span>
</div>

<!-- ── Stage ─────────────────────────────────────── -->
<div id="stage">
  <canvas id="cv"></canvas>
  <div id="divider"></div>
  <div id="loader">
    <div id="loader-spw">
      <svg width="75" height="75" viewBox="0 0 75 75" style="animation:spin 600ms linear infinite;display:block;">
        <circle cx="37.5" cy="37.5" r="29.5" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="8"/>
        <circle cx="37.5" cy="37.5" r="29.5" fill="none" stroke="rgba(255,255,255,0.88)" stroke-width="8" stroke-linecap="round" stroke-dasharray="46 139"/>
      </svg>
    </div>
    <div id="loader-scw">
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r="33" fill="${C.primary}"/>
        <path id="tkp" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" d="M17 35.9 L26.4 47.2 L48.2 21.7"/>
      </svg>
    </div>
    <div id="loader-word">SAVED</div>
  </div>
</div>

<!-- ── Sheets ─────────────────────────────────────── -->
<div id="sheet-bg" onclick="bgTap()"></div>
<div id="sheet">
  <div class="sheet-handle"></div>
  <div id="panel-load">
    <div class="sheet-title">Load Images</div>
    <div class="sheet-desc">Select up to 2 photos to compare.</div>
    <div style="text-align:center;margin-bottom:12px;">
      <button class="load-btn" onclick="triggerPick()">&#128247; Choose Photos</button>
    </div>
    <button class="load-cancel" id="load-cancel" onclick="closeSheet()" style="display:none;">Cancel</button>
  </div>
  <div id="panel-name">
    <div class="sheet-title">Name Your Images</div>
    <div class="sheet-desc">Optional — tap Skip to start comparing.</div>
    <div class="name-row">
      <div class="name-label"><span style="background:${C.blue};"></span>Image 1</div>
      <input class="sheet-input" id="nameInput1" type="text" maxlength="20" placeholder="e.g. Before">
    </div>
    <div class="name-row">
      <div class="name-label"><span style="background:${C.primary};"></span>Image 2</div>
      <input class="sheet-input" id="nameInput2" type="text" maxlength="20" placeholder="e.g. After">
    </div>
    <div class="sheet-row">
      <button class="sheet-btn secondary" onclick="skipNames()">Skip</button>
      <button class="sheet-btn primary"   onclick="confirmNames()">Done</button>
    </div>
  </div>
</div>

<input type="file" id="filePick" accept="image/*" multiple onchange="filesChosen(event)">

<script>
// ── State ──────────────────────────────────────────────
var img1=null,img2=null,tx1=null,tx2=null;
var di1=null,di2=null;
var DISP_MAX=2048;
var name1='Image 1',name2='Image 2';
var active=0,zoomMode=false,sliderMode=false,sliderVert=true,sliderPos=0.5,opacity2=1.0;
var gTx=null;
var tMode='none',panLast={x:0,y:0};
var psScale=1,psDist=0,psMidX=0,psMidY=0,psCx=0,psCy=0,lastTap=0;
var loaderRunning=false;
var undoStack=[];
var MAX_UNDO=30;
var gestureStart=null;
var brushDirty=false;

// ── Brush state ────────────────────────────────────────
var brushMode=false;
var brushPaintMode='erase'; // 'erase' | 'restore' | 'color'
var brushSize=20,brushSoft=0,brushOpacity=1.0;
var maskCanvas=null,offCanvas=null,offCtx=null;
var colorCanvas=null;
var pickedR=224,pickedG=49,pickedB=49; // default: brand red
var eyedropMode=false;
var hadPinch=false;  // guards against pinch-end triggering double-tap reset

var rafPending=false;
function drawRaf(){if(rafPending)return;rafPending=true;requestAnimationFrame(function(){rafPending=false;draw();});}

// ── Prescale ───────────────────────────────────────────
function prescale(img){
  var s=Math.min(1,DISP_MAX/Math.max(img.naturalWidth,img.naturalHeight));
  if(s>=0.98)return img;
  var w=Math.round(img.naturalWidth*s),h=Math.round(img.naturalHeight*s);
  var c=document.createElement('canvas');c.width=w;c.height=h;
  c.getContext('2d').drawImage(img,0,0,w,h);return c;
}

var stage=document.getElementById('stage');
var cv=document.getElementById('cv');
var ctx=cv.getContext('2d');
var dividerEl=document.getElementById('divider');
var ldr=document.getElementById('loader');
var ldrSpw=document.getElementById('loader-spw');
var ldrScw=document.getElementById('loader-scw');
var ldrWord=document.getElementById('loader-word');
var tkp=document.getElementById('tkp');
var sheetBg=document.getElementById('sheet-bg');
var sheet=document.getElementById('sheet');
var panelLoad=document.getElementById('panel-load');
var panelName=document.getElementById('panel-name');
var btn1=document.getElementById('btn1');
var btn2=document.getElementById('btn2');
var colorSwatch=document.getElementById('colorSwatch');

function W(){return stage.clientWidth;}
function H(){return stage.clientHeight;}

// ── Sheet ──────────────────────────────────────────────
function showLoadPanel(){panelLoad.style.display='block';panelName.style.display='none';}
function showNamePanel(){panelLoad.style.display='none';panelName.style.display='block';}
function openLoadSheet(){document.getElementById('load-cancel').style.display=(img1||img2)?'block':'none';showLoadPanel();sheetBg.classList.add('open');sheet.classList.add('open');}
function closeSheet(){sheetBg.classList.remove('open');sheet.classList.remove('open');sheet.style.bottom='';}
function bgTap(){if(img1||img2)closeSheet();}
function triggerPick(){document.getElementById('filePick').click();}

if(window.visualViewport){
  function _onVV(){var kb=Math.max(0,window.innerHeight-window.visualViewport.height);sheet.style.bottom=kb>50?kb+'px':'';}
  window.visualViewport.addEventListener('resize',_onVV);
  window.visualViewport.addEventListener('scroll',_onVV);
}

// ── Image button taps ──────────────────────────────────
function imgBtnTap(n){
  var hasImg=(n===1)?img1:img2;
  if(hasImg){if(zoomMode){bakeZoom();zoomMode=false;document.getElementById('btnZoom').className='btn-icon';}active=n;updateActiveUI();}
  else{openLoadSheet();}
}

// ── File loading ───────────────────────────────────────
function loadFile(file,cb){var reader=new FileReader();reader.onload=function(ev){var img=new Image();img.onload=function(){cb(img);};img.src=ev.target.result;};reader.readAsDataURL(file);}

function filesChosen(e){
  var files=e.target.files;if(!files||files.length===0){e.target.value='';return;}
  var f1=files[0],f2=files[1]||null;
  loadFile(f1,function(imgA){
    img1=imgA;di1=prescale(imgA);tx1=defaultTx(img1,W(),H());
    if(f2){
      loadFile(f2,function(imgB){
        img2=imgB;di2=prescale(imgB);tx2=defaultTx(img2,W(),H());
        initMask();active=2;draw();snapshot();
        document.getElementById('nameInput1').value='';document.getElementById('nameInput2').value='';
        showNamePanel();setTimeout(function(){document.getElementById('nameInput1').focus();},350);
      });
    }else{
      active=1;draw();snapshot();
      document.getElementById('nameInput1').value='';document.getElementById('nameInput2').value='';
      showNamePanel();setTimeout(function(){document.getElementById('nameInput1').focus();},350);
    }
  });
  e.target.value='';
}

function confirmNames(){var v1=document.getElementById('nameInput1').value.trim();var v2=document.getElementById('nameInput2').value.trim();if(v1)name1=v1;if(v2)name2=v2;closeSheet();updateActiveUI();}
function skipNames(){closeSheet();updateActiveUI();}

// ── Active UI ──────────────────────────────────────────
function updateActiveUI(){
  btn1.className='img-btn'+(img1?' img1-loaded':'');
  btn2.className='img-btn'+(img2?' img2-loaded':'');
  btn1.textContent=name1;btn2.textContent=name2;
  if(active===1){btn1.className='img-btn img1-active';btn2.classList.add('img-btn-dim');}
  else if(active===2){btn2.className='img-btn img2-active';btn1.classList.add('img-btn-dim');}
  if(img1&&img2)document.getElementById('obar').style.display='flex';
}

// ── Easing ────────────────────────────────────────────
function eo(t){return 1-Math.pow(1-t,3);}
function eob(t){var c=1.70158,c3=c+1;return 1+c3*Math.pow(t-1,3)+c*Math.pow(t-1,2);}
function eio(t){return t<0.5?2*t*t:-1+(4-2*t)*t;}
function an(dur,fn,done,ease){ease=ease||eo;var s=performance.now();(function f(now){var raw=Math.min((now-s)/dur,1);fn(ease(raw));if(raw<1)requestAnimationFrame(f);else if(done)done();})(performance.now());}

// ── Loader ────────────────────────────────────────────
var T_FI=200,T_SI=250,T_SPIN=1300,T_POP=420,T_TICK=400,T_WORD=280,T_HOLD=900,T_FO=450;
var _spinDone=false,_saveOk=null;
function _tryResolve(){if(_spinDone&&_saveOk!==null)resolveLoader(_saveOk);}
function showLoader(onSpinVisible){
  _spinDone=false;_saveOk=null;
  var len=tkp.getTotalLength();tkp.style.strokeDasharray=len;tkp.style.strokeDashoffset=len;
  ldrScw.style.transform='scale(0)';ldrScw.style.opacity='0';ldrWord.style.opacity='0';ldrSpw.style.opacity='0';
  ldr.style.opacity='0';ldr.style.pointerEvents='all';
  an(T_FI,function(t){ldr.style.opacity=t;},function(){
    an(T_SI,function(t){ldrSpw.style.opacity=t;},function(){onSpinVisible();setTimeout(function(){_spinDone=true;_tryResolve();},T_SPIN);});
  });
}
function resolveLoader(success){
  an(T_POP,function(t){ldrSpw.style.opacity=1-t;ldrScw.style.opacity=t;ldrScw.style.transform='scale('+eob(t)+')';},function(){
    ldrSpw.style.opacity=0;
    if(!success){an(300,function(t){ldr.style.opacity=1-t;},function(){ldr.style.opacity='0';ldr.style.pointerEvents='none';ldrScw.style.transform='scale(0)';loaderRunning=false;});return;}
    an(T_TICK,function(t){tkp.style.strokeDashoffset=tkp.getTotalLength()*(1-t);},function(){
      an(T_WORD,function(t){ldrWord.style.opacity=t;},function(){
        setTimeout(function(){an(T_FO,function(t){ldr.style.opacity=1-t;},function(){ldr.style.opacity='0';ldr.style.pointerEvents='none';ldrScw.style.transform='scale(0)';ldrWord.style.opacity=0;loaderRunning=false;});},T_HOLD);
      },eio);
    },eio);
  },eo);
}

// ── Share ──────────────────────────────────────────────
function shareCanvas(){
  if(!img1&&!img2)return;if(loaderRunning)return;loaderRunning=true;
  var b64=cv.toDataURL('image/png').split(',')[1];
  showLoader(function(){try{window.ReactNativeWebView.postMessage('save:'+b64);}catch(e){_saveOk=false;_tryResolve();}});
}
window.nativeSaveResult=function(ok){_saveOk=ok;_tryResolve();};

// ── Canvas helpers ────────────────────────────────────
function cloneTx(t){return t?{scale:t.scale,cx:t.cx,cy:t.cy}:null;}
function cloneMask(){
  if(!maskCanvas)return null;
  var c=document.createElement('canvas');c.width=maskCanvas.width;c.height=maskCanvas.height;
  c.getContext('2d').drawImage(maskCanvas,0,0);return c;
}
function cloneColor(){
  if(!colorCanvas)return null;
  var c=document.createElement('canvas');c.width=colorCanvas.width;c.height=colorCanvas.height;
  c.getContext('2d').drawImage(colorCanvas,0,0);return c;
}
function snapshot(){
  undoStack.push({tx1:cloneTx(tx1),tx2:cloneTx(tx2),gTx:cloneTx(gTx),sliderPos:sliderPos,mask:cloneMask(),color:cloneColor()});
  if(undoStack.length>MAX_UNDO)undoStack.shift();
}
function undo(){
  if(undoStack.length===0)return;
  var s=undoStack.pop();tx1=cloneTx(s.tx1);tx2=cloneTx(s.tx2);gTx=cloneTx(s.gTx);sliderPos=s.sliderPos;
  if(s.mask){maskCanvas=s.mask;offCanvas=null;}
  if(s.color!==undefined)colorCanvas=s.color;
  draw();
}
function captureState(){return{tx1:cloneTx(tx1),tx2:cloneTx(tx2),gTx:cloneTx(gTx),sliderPos:sliderPos,mask:cloneMask(),color:cloneColor()};}
function txDiff(a,b){if(!a&&!b)return false;if(!a||!b)return true;return a.scale!==b.scale||a.cx!==b.cx||a.cy!==b.cy;}
function gestureChanged(){if(!gestureStart)return false;if(gestureStart.sliderPos!==sliderPos||brushDirty)return true;return txDiff(gestureStart.tx1,tx1)||txDiff(gestureStart.tx2,tx2)||txDiff(gestureStart.gTx,gTx);}
function commitGesture(){if(gestureChanged()){undoStack.push(gestureStart);if(undoStack.length>MAX_UNDO)undoStack.shift();}gestureStart=null;brushDirty=false;}
function defaultTx(img,w,h){var s=Math.min(w/img.naturalWidth,h/img.naturalHeight);return{scale:s,cx:w/2,cy:h/2};}
function activeTx(){return active===1?tx1:tx2;}
function setActiveTx(t){if(active===1)tx1=t;else tx2=t;}
function applyGTx(tx){if(!gTx||!tx)return tx;return{scale:tx.scale*gTx.scale,cx:gTx.cx+(tx.cx-gTx.cx)*gTx.scale,cy:gTx.cy+(tx.cy-gTx.cy)*gTx.scale};}
function bakeZoom(){if(!gTx)return;if(tx1)tx1=applyGTx(tx1);if(tx2)tx2=applyGTx(tx2);gTx=null;}

// Cached offscreen for img2+mask compositing
function getOff(w,h){
  if(!offCanvas||offCanvas.width!==w||offCanvas.height!==h){
    offCanvas=document.createElement('canvas');offCanvas.width=w;offCanvas.height=h;offCtx=offCanvas.getContext('2d');
  }return{c:offCanvas,x:offCtx};
}

function drawImg(img,disp,tx,alpha,useMask){
  if(!tx)return;
  var nw=img.naturalWidth,nh=img.naturalHeight;
  var hw=nw*tx.scale/2,hh=nh*tx.scale/2;
  var dx=tx.cx-hw,dy=tx.cy-hh,dw=nw*tx.scale,dh=nh*tx.scale;
  ctx.save();ctx.globalAlpha=alpha;
  if(useMask&&maskCanvas){
    var sw=W(),sh=H();
    var off=getOff(sw,sh);
    off.x.clearRect(0,0,sw,sh);
    off.x.globalCompositeOperation='source-over';
    off.x.drawImage(disp,dx,dy,dw,dh);
    off.x.globalCompositeOperation='destination-in';
    off.x.drawImage(maskCanvas,dx,dy,dw,dh);
    off.x.globalCompositeOperation='source-over';
    ctx.drawImage(off.c,0,0);
  }else{
    ctx.drawImage(disp,dx,dy,dw,dh);
  }
  ctx.restore();
}

// Draw colorCanvas overlay at img2's transform
function drawColorOverlay(etx2){
  if(!colorCanvas||!img2||!etx2)return;
  var nw=img2.naturalWidth,nh=img2.naturalHeight;
  ctx.drawImage(colorCanvas,etx2.cx-nw*etx2.scale/2,etx2.cy-nh*etx2.scale/2,nw*etx2.scale,nh*etx2.scale);
}

function draw(){
  var w=W(),h=H();if(!w||!h)return;
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;cv.style.width=w+'px';cv.style.height=h+'px';}
  ctx.clearRect(0,0,w,h);
  var etx1=gTx?applyGTx(tx1):tx1,etx2=gTx?applyGTx(tx2):tx2;
  if(sliderMode){drawWithSlider(w,h,etx1,etx2);}
  else{
    if(img1&&etx1)drawImg(img1,di1||img1,etx1,1,false);
    if(img2&&etx2){drawImg(img2,di2||img2,etx2,opacity2,!!maskCanvas);drawColorOverlay(etx2);}
  }
  updateSliderOverlay(w,h);
}

function drawWithSlider(w,h,etx1,etx2){
  var sp=sliderVert?sliderPos*w:sliderPos*h;
  if(img1&&etx1){ctx.save();ctx.beginPath();if(sliderVert)ctx.rect(0,0,sp,h);else ctx.rect(0,0,w,sp);ctx.clip();drawImg(img1,di1||img1,etx1,1,false);ctx.restore();}
  if(img2&&etx2){
    ctx.save();ctx.beginPath();if(sliderVert)ctx.rect(sp,0,w-sp,h);else ctx.rect(0,sp,w,h-sp);ctx.clip();
    drawImg(img2,di2||img2,etx2,1,!!maskCanvas);
    drawColorOverlay(etx2);
    ctx.restore();
  }
}

function updateSliderOverlay(w,h){
  if(!sliderMode||(!img1&&!img2)){dividerEl.style.display='none';return;}
  var sp=sliderVert?sliderPos*w:sliderPos*h;
  if(sliderVert){dividerEl.style.cssText='display:block;left:'+sp+'px;top:0;width:2px;height:100%;transform:translateX(-50%)';}
  else{dividerEl.style.cssText='display:block;top:'+sp+'px;left:0;height:2px;width:100%;transform:translateY(-50%)';}
}

// ── Touch helpers ──────────────────────────────────────
function stXY(t){var r=stage.getBoundingClientRect();return{x:t.clientX-r.left,y:t.clientY-r.top};}
function tDist(a,b){return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);}
function tMid(a,b){var r=stage.getBoundingClientRect();return{x:(a.clientX+b.clientX)/2-r.left,y:(a.clientY+b.clientY)/2-r.top};}
function nearSlider(p){if(!sliderMode)return false;return sliderVert?Math.abs(p.x-sliderPos*W())<32:Math.abs(p.y-sliderPos*H())<32;}

stage.addEventListener('touchstart',function(e){
  e.preventDefault();
  var t=e.touches,p=stXY(t[0]);

  // ── Eyedropper: sample pixel on tap ────────────────
  if(eyedropMode){
    if(t.length===1){
      var px=ctx.getImageData(Math.round(p.x),Math.round(p.y),1,1).data;
      pickedR=px[0];pickedG=px[1];pickedB=px[2];
      eyedropMode=false;
      applyPickedColor(); // shows swatch, clears eye-active + eye-cursor
    }
    return;
  }

  // Reset hadPinch on fresh single-touch start
  if(t.length===1)hadPinch=false;

  // ── Capture pre-gesture state for undo ─────────────
  gestureStart=captureState();brushDirty=false;

  // ── Brush mode ─────────────────────────────────────
  if(brushMode&&img2){
    if(t.length===1){
      tMode='brush';panLast=p;
      paintAt(p.x,p.y);draw();
    }else if(t.length>=2){
      // Two-finger pinch zooms even in brush mode
      tMode='pinch';hadPinch=true;
      var ax=tx2||activeTx();
      psDist=tDist(t[0],t[1]);psScale=ax?ax.scale:1;
      var m=tMid(t[0],t[1]);psMidX=m.x;psMidY=m.y;psCx=ax?ax.cx:W()/2;psCy=ax?ax.cy:H()/2;
    }
    return;
  }

  if(t.length===1){
    if(nearSlider(p)){tMode='slider';}
    else if(zoomMode||active!==0){tMode='pan';panLast=p;}
  }else if(t.length>=2){
    tMode='pinch';hadPinch=true;
    var ax=zoomMode?gTx:activeTx();
    psDist=tDist(t[0],t[1]);psScale=ax?ax.scale:1;
    var m=tMid(t[0],t[1]);psMidX=m.x;psMidY=m.y;psCx=ax?ax.cx:W()/2;psCy=ax?ax.cy:H()/2;
  }
},{passive:false});

stage.addEventListener('touchmove',function(e){
  e.preventDefault();
  var t=e.touches;
  if(tMode==='brush'&&t.length===1){
    var p=stXY(t[0]);paintLine(panLast.x,panLast.y,p.x,p.y);panLast=p;drawRaf();return;
  }
  if(tMode==='slider'&&t.length>=1){
    var p=stXY(t[0]);
    sliderPos=sliderVert?Math.min(1,Math.max(0,p.x/W())):Math.min(1,Math.max(0,p.y/H()));
    drawRaf();return;
  }
  var ax=zoomMode?gTx:(brushMode?tx2:activeTx());if(!ax)return;
  if(tMode==='pan'&&t.length===1){
    var p=stXY(t[0]);var dx=p.x-panLast.x,dy=p.y-panLast.y;
    ax.cx+=dx;ax.cy+=dy;
    panLast=p;if(zoomMode)gTx=ax;else setActiveTx(ax);drawRaf();
  }else if(tMode==='pinch'&&t.length>=2){
    var nd=tDist(t[0],t[1]);var ns=Math.min(20,Math.max(0.05,psScale*(nd/psDist)));
    var cm=tMid(t[0],t[1]);var imgX=(psMidX-psCx)/psScale,imgY=(psMidY-psCy)/psScale;
    ax.cx=cm.x-imgX*ns;ax.cy=cm.y-imgY*ns;ax.scale=ns;
    if(zoomMode)gTx=ax;else if(brushMode){tx2=ax;}else setActiveTx(ax);
    drawRaf();
  }
},{passive:false});

stage.addEventListener('touchend',function(e){
  e.preventDefault();
  var rem=e.touches.length;
  if(rem===0){
    if(tMode==='brush'){commitGesture();tMode='none';draw();return;}
    if(tMode==='pan'){
      var now=Date.now();
      // Only trigger double-tap reset if this was a genuine single-touch (not pinch release)
      if(now-lastTap<280&&!hadPinch){
        if(zoomMode){gTx={scale:1,cx:W()/2,cy:H()/2};}
        else if(active!==0){var img=active===1?img1:img2;if(img)setActiveTx(defaultTx(img,W(),H()));}
        draw();
      }
      commitGesture();
      lastTap=now;hadPinch=false;
    } else if(tMode==='pinch'||tMode==='slider'){
      commitGesture();
    }
    tMode='none';
  }else if(rem===1){
    // Going from 2→1 finger: in brush mode go back to brushing, otherwise pan
    tMode=brushMode?'brush':'pan';
    panLast=stXY(e.touches[0]);
  }
},{passive:false});

// ── Controls ──────────────────────────────────────────
function fitActive(){
  snapshot();
  if(zoomMode){gTx={scale:1,cx:W()/2,cy:H()/2};draw();return;}
  if(active===0)return;
  var img=active===1?img1:img2;if(img){setActiveTx(defaultTx(img,W(),H()));draw();}
}
function toggleZoom(){
  if(zoomMode){bakeZoom();zoomMode=false;document.getElementById('btnZoom').className='btn-icon';updateActiveUI();}
  else{
    zoomMode=true;active=0;if(!gTx)gTx={scale:1,cx:W()/2,cy:H()/2};
    document.getElementById('btnZoom').className='btn-icon zoom-active';
    btn1.className='img-btn'+(img1?' img1-loaded':'');btn2.className='img-btn'+(img2?' img2-loaded':'');
    btn1.textContent=name1;btn2.textContent=name2;
  }
  draw();
}
function toggleSlider(){
  if(!sliderMode){sliderMode=true;sliderVert=true;sliderPos=0.5;document.getElementById('btnSlider').className='btn-icon slider-active';}
  else if(sliderVert){sliderVert=false;}
  else{sliderMode=false;document.getElementById('btnSlider').className='btn-icon';dividerEl.style.display='none';}
  draw();
}
function resetActive(){
  snapshot();
  if(zoomMode){gTx={scale:1,cx:W()/2,cy:H()/2};draw();return;}
  if(active===0)return;
  var img=active===1?img1:img2;if(img){setActiveTx(defaultTx(img,W(),H()));draw();}
}
function setOpacity(v){opacity2=v/100;document.getElementById('oval').textContent=v+'%';drawRaf();}
window.addEventListener('resize',function(){var w=W(),h=H();if(img1)tx1=defaultTx(img1,w,h);if(img2)tx2=defaultTx(img2,w,h);gTx=null;draw();});

// ── Brush controls ─────────────────────────────────────
function initMask(){
  if(!img2)return;
  maskCanvas=document.createElement('canvas');
  maskCanvas.width=img2.naturalWidth;maskCanvas.height=img2.naturalHeight;
  var m=maskCanvas.getContext('2d');m.fillStyle='#fff';m.fillRect(0,0,maskCanvas.width,maskCanvas.height);
  colorCanvas=document.createElement('canvas');
  colorCanvas.width=img2.naturalWidth;colorCanvas.height=img2.naturalHeight;
  offCanvas=null;
}

function _setBrushInline(show){
  var els=document.querySelectorAll('.brush-inline');
  for(var i=0;i<els.length;i++){if(show)els[i].classList.add('bi-on');else els[i].classList.remove('bi-on');}
}

function toggleBrush(){
  if(!img2)return;
  if(!maskCanvas)initMask();
  brushMode=!brushMode;
  var bb=document.getElementById('btnBrush');
  if(brushMode){
    bb.classList.add('brush-active-btn');
    _setBrushInline(true);
    setBrushMode('erase'); // default to erase when opening
  }else{
    bb.classList.remove('brush-active-btn');
    _setBrushInline(false);
    // turn off eyedrop if on
    if(eyedropMode){eyedropMode=false;stage.classList.remove('eye-cursor');colorSwatch.classList.remove('picking');}
  }
  draw();
}

function setBrushMode(m){
  brushPaintMode=m;
  var eBtn=document.getElementById('btnErase');
  var rBtn=document.getElementById('btnRestore');
  var dBtn=document.getElementById('btnDraw');
  // reset all
  eBtn.className='btn-icon brush-inline bi-on';
  rBtn.className='btn-icon brush-inline bi-on';
  dBtn.className='btn-icon brush-inline bi-on';
  dBtn.style.background='';
  if(m==='erase'){eBtn.classList.add('erase-on');colorSwatch.classList.remove('swatch-active');}
  else if(m==='restore'){rBtn.classList.add('restore-on');colorSwatch.classList.remove('swatch-active');}
  else if(m==='color'){
    dBtn.classList.add('draw-on');
    dBtn.style.background='rgb('+pickedR+','+pickedG+','+pickedB+')';
    colorSwatch.classList.add('swatch-active');
  }
}

// ── Eyedropper ─────────────────────────────────────────
function toggleEyedrop(){
  if(!img1&&!img2)return;
  eyedropMode=!eyedropMode;
  var eBtn=document.getElementById('btnEye');
  if(eyedropMode){eBtn.classList.add('eye-active');stage.classList.add('eye-cursor');colorSwatch.classList.add('picking');}
  else{eBtn.classList.remove('eye-active');stage.classList.remove('eye-cursor');colorSwatch.classList.remove('picking');}
}

function applyPickedColor(){
  // Show and update swatch in main toolbar
  colorSwatch.style.background='rgb('+pickedR+','+pickedG+','+pickedB+')';
  colorSwatch.style.display='block';
  colorSwatch.classList.remove('picking');
  colorSwatch.classList.remove('swatch-active');
  // turn off eyedrop state
  var eBtn=document.getElementById('btnEye');
  if(eBtn)eBtn.classList.remove('eye-active');
  stage.classList.remove('eye-cursor');
}

// ── Colour swatch tap — activate colour draw mode ──────
function swatchTap(){
  if(!img2)return;
  // activate brush if not on
  if(!brushMode){
    if(!maskCanvas)initMask();
    brushMode=true;
    document.getElementById('btnBrush').classList.add('brush-active-btn');
    _setBrushInline(true);
  }
  setBrushMode('color');
}

// ── Painting ───────────────────────────────────────────
function paintAt(sx,sy){
  brushDirty=true;
  if(brushPaintMode==='color')paintColorAt(sx,sy);
  else paintMask(sx,sy);
}
function paintLine(sx1,sy1,sx2,sy2){
  if(brushPaintMode==='color')paintColorLine(sx1,sy1,sx2,sy2);
  else paintMaskLine(sx1,sy1,sx2,sy2);
}

function paintMask(sx,sy){
  if(!maskCanvas||!img2||!tx2)return;
  var etx=gTx?applyGTx(tx2):tx2;
  var ix=(sx-etx.cx)/etx.scale+img2.naturalWidth/2;
  var iy=(sy-etx.cy)/etx.scale+img2.naturalHeight/2;
  var ir=Math.max(2,brushSize/etx.scale);
  var m=maskCanvas.getContext('2d');
  if(brushSoft>0){
    var hardR=ir*(1-brushSoft);
    var grad=m.createRadialGradient(ix,iy,hardR,ix,iy,ir);
    if(brushPaintMode==='erase'){
      m.globalCompositeOperation='destination-out';
      grad.addColorStop(0,'rgba(0,0,0,'+brushOpacity+')');grad.addColorStop(1,'rgba(0,0,0,0)');
    }else{
      m.globalCompositeOperation='source-over';
      grad.addColorStop(0,'rgba(255,255,255,'+brushOpacity+')');grad.addColorStop(1,'rgba(255,255,255,0)');
    }
    m.fillStyle=grad;m.beginPath();m.arc(ix,iy,ir,0,Math.PI*2);m.fill();
  }else{
    m.globalCompositeOperation=brushPaintMode==='erase'?'destination-out':'source-over';
    m.fillStyle=brushPaintMode==='erase'?'rgba(0,0,0,'+brushOpacity+')':'rgba(255,255,255,'+brushOpacity+')';
    m.beginPath();m.arc(ix,iy,ir,0,Math.PI*2);m.fill();
  }
  m.globalCompositeOperation='source-over';
}
function paintMaskLine(sx1,sy1,sx2,sy2){
  var dist=Math.hypot(sx2-sx1,sy2-sy1);
  var steps=Math.max(1,Math.floor(dist/(brushSize*0.35)));
  for(var i=1;i<=steps;i++){var t=i/steps;paintMask(sx1+(sx2-sx1)*t,sy1+(sy2-sy1)*t);}
}

function paintColorAt(sx,sy){
  if(!colorCanvas||!img2||!tx2)return;
  var etx=gTx?applyGTx(tx2):tx2;
  var ix=(sx-etx.cx)/etx.scale+img2.naturalWidth/2;
  var iy=(sy-etx.cy)/etx.scale+img2.naturalHeight/2;
  var ir=Math.max(2,brushSize/etx.scale);
  var c=colorCanvas.getContext('2d');
  var colStr='rgba('+pickedR+','+pickedG+','+pickedB+','+brushOpacity+')';
  if(brushSoft>0){
    var hardR=ir*(1-brushSoft);
    var grad=c.createRadialGradient(ix,iy,hardR,ix,iy,ir);
    grad.addColorStop(0,colStr);
    grad.addColorStop(1,'rgba('+pickedR+','+pickedG+','+pickedB+',0)');
    c.fillStyle=grad;
  }else{
    c.fillStyle=colStr;
  }
  c.beginPath();c.arc(ix,iy,ir,0,Math.PI*2);c.fill();
}
function paintColorLine(sx1,sy1,sx2,sy2){
  var dist=Math.hypot(sx2-sx1,sy2-sy1);
  var steps=Math.max(1,Math.floor(dist/(brushSize*0.35)));
  for(var i=1;i<=steps;i++){var t=i/steps;paintColorAt(sx1+(sx2-sx1)*t,sy1+(sy2-sy1)*t);}
}

function clearEffects(){snapshot();initMask();draw();}

openLoadSheet();
</script>
</body>
</html>`;

export default function PhotoSlider() {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const onMessage = async (e: WebViewMessageEvent) => {
    const msg = e.nativeEvent.data as string;
    if (!msg.startsWith("save:")) return;
    const b64 = msg.slice(5);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Allow photo access to save images.");
        webRef.current?.injectJavaScript("window.nativeSaveResult(false);true;");
        return;
      }
      const FileSystem = require("expo-file-system/legacy");
      const tmp = `${FileSystem.cacheDirectory}photo_slider_export_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(tmp, b64, { encoding: FileSystem.EncodingType.Base64 });
      await MediaLibrary.saveToLibraryAsync(tmp);
      webRef.current?.injectJavaScript("window.nativeSaveResult(true);true;");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.warn("[PhotoSlider] save error:", err);
      webRef.current?.injectJavaScript("window.nativeSaveResult(false);true;");
    }
  };

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScreenHeader title="Photo Slider" />
      <WebView
        ref={webRef}
        source={{ html: buildHtml() }}
        style={styles.webview}
        onMessage={onMessage}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        originWhitelist={["*"]}
        allowsFullscreenVideo={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#0a0a0e" },
  webview: { flex: 1, backgroundColor: "#0a0a0e" },
});
