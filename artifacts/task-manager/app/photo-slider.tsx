import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import { router } from "expo-router";
import React, { useRef } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, { WebViewMessageEvent } from "react-native-webview";
import { useDrawer } from "@/context/DrawerContext";

// ── App theme colours injected into the HTML ──────────────────────────────────
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
  text:      "#ffffff",
  muted:     "#8e8e93",
};

// ── HTML tool (reskinned to match the app) ────────────────────────────────────
const buildHtml = () => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
* { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
html, body { height:100%; background:${C.bg}; font-family:-apple-system,BlinkMacSystemFont,sans-serif; color:${C.text}; overflow:hidden; display:flex; flex-direction:column; }

.bar { display:flex; gap:6px; padding:8px 12px; background:${C.surface}; flex-shrink:0; }
.bar-top { border-bottom:1px solid ${C.border}; padding-bottom:6px; }
.bar-bot { border-bottom:1px solid ${C.border}; padding-top:4px; }
.bar-top .img-btn { flex:1; padding:11px 0; border:none; border-radius:11px; font-size:13px; font-weight:700; cursor:pointer; color:${C.text}; background:${C.card}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:opacity .2s; font-family:inherit; }
.btn-icon { flex:0 0 44px; font-size:16px; padding:11px 0; border:none; border-radius:11px; font-weight:700; cursor:pointer; color:${C.text}; background:${C.card}; font-family:inherit; }
.bar-bot .btn-icon { flex:1; }

.img1-active { background:${C.blue} !important; box-shadow:0 0 0 2px rgba(10,132,255,.45); opacity:1 !important; }
.img2-active { background:${C.primary} !important; box-shadow:0 0 0 2px rgba(224,49,49,.45); opacity:1 !important; }
.img1-loaded { background:${C.blue} !important; }
.img2-loaded { background:${C.primary} !important; }
.img-btn-dim  { opacity:0.35 !important; }
.zoom-active  { background:${C.orange} !important; box-shadow:0 0 0 2px rgba(255,159,10,.45); }
.slider-active{ background:${C.purple} !important; box-shadow:0 0 0 2px rgba(191,90,242,.45); }
.undo-active  { background:#ff453a !important; }

.obar { display:flex; align-items:center; gap:10px; padding:8px 14px; background:${C.surface}; border-bottom:1px solid ${C.border}; flex-shrink:0; }
.obar label { font-size:12px; color:${C.muted}; white-space:nowrap; }
.obar input[type=range] { flex:1; -webkit-appearance:none; height:4px; border-radius:2px; background:${C.border}; outline:none; }
.obar input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:22px; height:22px; border-radius:50%; background:${C.text}; box-shadow:0 1px 6px rgba(0,0,0,.5); }
.oval { font-size:12px; color:${C.muted}; width:36px; text-align:right; }

#stage { flex:1; min-height:0; position:relative; touch-action:none; user-select:none; overflow:hidden; background:${C.bg}; }
canvas { position:absolute; top:0; left:0; display:block; }
#divider { position:absolute; z-index:3; background:rgba(255,255,255,.85); box-shadow:0 0 8px rgba(0,0,0,.6); pointer-events:none; display:none; }

#sheet-bg { position:fixed; inset:0; z-index:40; background:rgba(0,0,0,0); pointer-events:none; transition:background 0.28s; }
#sheet-bg.open { background:rgba(0,0,0,.65); pointer-events:all; }
#sheet { position:fixed; left:0; right:0; bottom:0; z-index:41; background:${C.surface}; border-radius:20px 20px 0 0; padding:0 20px 48px; transform:translateY(100%); transition:transform 0.32s cubic-bezier(0.32,.72,0,1); border-top:1px solid ${C.border}; }
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

#loader { position:absolute; inset:0; z-index:20; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(10,10,14,.85); opacity:0; pointer-events:none; }
#loader-spw { position:absolute; opacity:0; }
#loader-scw { position:absolute; display:flex; align-items:center; justify-content:center; opacity:0; transform:scale(0); }
#loader-word { font-size:20px; font-weight:800; letter-spacing:5px; color:#fff; opacity:0; margin-top:110px; text-transform:uppercase; }
@keyframes spin { to { transform:rotate(360deg); } }
input[type=file] { display:none; }
</style>
</head>
<body>
<div class="bar bar-top">
  <button class="img-btn" id="btn1" onclick="imgBtnTap(1)">Image 1</button>
  <button class="img-btn" id="btn2" onclick="imgBtnTap(2)">Image 2</button>
  <button class="btn-icon" id="btnSlider" onclick="toggleSlider()">&#9135;</button>
  <button class="btn-icon" id="btnZoom"   onclick="toggleZoom()">&#128269;</button>
</div>
<div class="bar bar-bot">
  <button class="btn-icon" id="btnFit"   onclick="fitActive()">&#10697;</button>
  <button class="btn-icon" id="btnUndo"  onclick="undo()">&#8617;</button>
  <button class="btn-icon" id="btnReset" onclick="resetActive()">&#8634;</button>
  <button class="btn-icon" id="btnShare" onclick="shareCanvas()">&#8679;</button>
</div>
<div class="obar" id="obar" style="display:none;">
  <label>Image 2 opacity</label>
  <input type="range" id="osl" min="0" max="100" value="100" oninput="setOpacity(this.value)">
  <span class="oval" id="oval">100%</span>
</div>
<div id="stage">
  <canvas id="cv"></canvas>
  <div id="divider"></div>
  <div id="loader">
    <div id="loader-spw">
      <svg width="79" height="79" viewBox="0 0 79 79" style="animation:spin 600ms linear infinite;display:block;">
        <circle cx="39.5" cy="39.5" r="31" fill="none" stroke="rgba(224,49,49,0.18)" stroke-width="8.5"/>
        <circle cx="39.5" cy="39.5" r="31" fill="none" stroke="${C.primary}" stroke-width="8.5" stroke-linecap="round" stroke-dasharray="49 146"/>
      </svg>
    </div>
    <div id="loader-scw">
      <svg width="73" height="73" viewBox="0 0 73 73">
        <circle cx="36.5" cy="36.5" r="35.5" fill="${C.primary}"/>
        <path id="tkp" fill="none" stroke="#fff" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round" d="M18 38 L28 50 L51 23"/>
      </svg>
    </div>
    <div id="loader-word">saved</div>
  </div>
</div>

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
var img1=null,img2=null,tx1=null,tx2=null;
var name1='Image 1',name2='Image 2';
var active=0,zoomMode=false,sliderMode=false,sliderVert=true,sliderPos=0.5,opacity2=1.0;
var gTx=null;
var tMode='none',panLast={x:0,y:0};
var psScale=1,psDist=0,psMidX=0,psMidY=0,psCx=0,psCy=0,lastTap=0;
var loaderRunning=false;
var undoStack=[];
var MAX_UNDO=30;

var stage=document.getElementById('stage');
var cv=document.getElementById('cv');
var ctx=cv.getContext('2d');
var dividerEl=document.getElementById('divider');
var btnUndo=document.getElementById('btnUndo');
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

function W(){return stage.clientWidth;}
function H(){return stage.clientHeight;}

// ── Sheet ──────────────────────────────────────────────
function showLoadPanel(){panelLoad.style.display='block';panelName.style.display='none';}
function showNamePanel(){panelLoad.style.display='none';panelName.style.display='block';}
function openLoadSheet(){document.getElementById('load-cancel').style.display=(img1||img2)?'block':'none';showLoadPanel();sheetBg.classList.add('open');sheet.classList.add('open');}
function closeSheet(){sheetBg.classList.remove('open');sheet.classList.remove('open');}
function bgTap(){if(img1||img2)closeSheet();}
function triggerPick(){document.getElementById('filePick').click();}

// ── Image button taps ──────────────────────────────────
function imgBtnTap(n){
  var hasImg=(n===1)?img1:img2;
  if(hasImg){if(zoomMode){bakeZoom();zoomMode=false;document.getElementById('btnZoom').className='btn-icon';}active=n;updateActiveUI();}
  else{openLoadSheet();}
}

// ── File loading ───────────────────────────────────────
function loadFile(file,cb){var reader=new FileReader();reader.onload=function(ev){var img=new Image();img.onload=function(){cb(img);};img.src=ev.target.result;};reader.readAsDataURL(file);}

function filesChosen(e){
  var files=e.target.files;
  if(!files||files.length===0){e.target.value='';return;}
  var f1=files[0],f2=files[1]||null;
  loadFile(f1,function(imgA){
    img1=imgA;tx1=defaultTx(img1,W(),H());
    if(f2){
      loadFile(f2,function(imgB){img2=imgB;tx2=defaultTx(img2,W(),H());active=1;draw();snapshot();document.getElementById('nameInput1').value='';document.getElementById('nameInput2').value='';showNamePanel();setTimeout(function(){document.getElementById('nameInput1').focus();},350);});
    } else {
      active=1;draw();snapshot();document.getElementById('nameInput1').value='';document.getElementById('nameInput2').value='';showNamePanel();setTimeout(function(){document.getElementById('nameInput1').focus();},350);
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
function showLoader(onSpinDone){
  var len=tkp.getTotalLength();tkp.style.strokeDasharray=len;tkp.style.strokeDashoffset=len;
  ldrScw.style.transform='scale(0)';ldrScw.style.opacity='0';ldrWord.style.opacity='0';ldrSpw.style.opacity='0';
  ldr.style.opacity='0';ldr.style.pointerEvents='all';
  an(200,function(t){ldr.style.opacity=t;},function(){an(250,function(t){ldrSpw.style.opacity=t;},function(){onSpinDone();});});
}
function resolveLoader(success){
  an(420,function(t){ldrSpw.style.opacity=1-t;ldrScw.style.opacity=t;ldrScw.style.transform='scale('+eob(t)+')';},function(){
    ldrSpw.style.opacity=0;
    if(!success){an(300,function(t){ldr.style.opacity=1-t;},function(){ldr.style.opacity='0';ldr.style.pointerEvents='none';ldrScw.style.transform='scale(0)';loaderRunning=false;});return;}
    an(400,function(t){tkp.style.strokeDashoffset=tkp.getTotalLength()*(1-t);},function(){
      an(280,function(t){ldrWord.style.opacity=t;},function(){
        setTimeout(function(){an(450,function(t){ldr.style.opacity=1-t;},function(){ldr.style.opacity='0';ldr.style.pointerEvents='none';ldrScw.style.transform='scale(0)';ldrWord.style.opacity=0;loaderRunning=false;});},900);
      },eio);
    },eio);
  },eo);
}

// ── Share ──────────────────────────────────────────────
function shareCanvas(){
  if(!img1&&!img2)return;if(loaderRunning)return;
  loaderRunning=true;
  var b64=cv.toDataURL('image/png').split(',')[1];
  showLoader(function(){
    try{window.ReactNativeWebView.postMessage('save:'+b64);}catch(e){resolveLoader(false);}
  });
}
// Called from native after save resolves
window.nativeSaveResult=function(ok){resolveLoader(ok);};

// ── Canvas ────────────────────────────────────────────
function cloneTx(t){return t?{scale:t.scale,cx:t.cx,cy:t.cy}:null;}
function snapshot(){undoStack.push({tx1:cloneTx(tx1),tx2:cloneTx(tx2),gTx:cloneTx(gTx),sliderPos:sliderPos});if(undoStack.length>MAX_UNDO)undoStack.shift();btnUndo.className='btn-icon'+(undoStack.length>0?' undo-active':'');}
function undo(){if(undoStack.length===0)return;var s=undoStack.pop();tx1=cloneTx(s.tx1);tx2=cloneTx(s.tx2);gTx=cloneTx(s.gTx);sliderPos=s.sliderPos;btnUndo.className='btn-icon'+(undoStack.length>0?' undo-active':'');draw();}
function defaultTx(img,w,h){var s=Math.min(w/img.naturalWidth,h/img.naturalHeight);return{scale:s,cx:w/2,cy:h/2};}
function activeTx(){return active===1?tx1:tx2;}
function setActiveTx(t){if(active===1)tx1=t;else tx2=t;}
function applyGTx(tx){if(!gTx||!tx)return tx;return{scale:tx.scale*gTx.scale,cx:gTx.cx+(tx.cx-gTx.cx)*gTx.scale,cy:gTx.cy+(tx.cy-gTx.cy)*gTx.scale};}
function bakeZoom(){if(!gTx)return;if(tx1)tx1=applyGTx(tx1);if(tx2)tx2=applyGTx(tx2);gTx=null;}
function draw(){
  var w=W(),h=H();if(!w||!h)return;
  cv.width=w;cv.height=h;cv.style.width=w+'px';cv.style.height=h+'px';
  ctx.clearRect(0,0,w,h);
  var etx1=gTx?applyGTx(tx1):tx1,etx2=gTx?applyGTx(tx2):tx2;
  if(sliderMode){drawWithSlider(w,h,etx1,etx2);}
  else{if(img1&&etx1)drawImg(img1,etx1,1);if(img2&&etx2)drawImg(img2,etx2,opacity2);}
  updateSliderOverlay(w,h);
}
function drawImg(img,tx,alpha){if(!tx)return;var hw=img.naturalWidth*tx.scale/2,hh=img.naturalHeight*tx.scale/2;ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(img,tx.cx-hw,tx.cy-hh,img.naturalWidth*tx.scale,img.naturalHeight*tx.scale);ctx.restore();}
function drawWithSlider(w,h,etx1,etx2){
  var sp=sliderVert?sliderPos*w:sliderPos*h;
  if(img1&&etx1){ctx.save();ctx.beginPath();if(sliderVert)ctx.rect(0,0,sp,h);else ctx.rect(0,0,w,sp);ctx.clip();drawImg(img1,etx1,1);ctx.restore();}
  if(img2&&etx2){ctx.save();ctx.beginPath();if(sliderVert)ctx.rect(sp,0,w-sp,h);else ctx.rect(0,sp,w,h-sp);ctx.clip();drawImg(img2,etx2,1);ctx.restore();}
}
function updateSliderOverlay(w,h){
  if(!sliderMode||(!img1&&!img2)){dividerEl.style.display='none';return;}
  var sp=sliderVert?sliderPos*w:sliderPos*h;
  if(sliderVert){dividerEl.style.cssText='display:block;left:'+sp+'px;top:0;width:2px;height:100%;transform:translateX(-50%)';}
  else{dividerEl.style.cssText='display:block;top:'+sp+'px;left:0;height:2px;width:100%;transform:translateY(-50%)';}
}

// ── Touch ─────────────────────────────────────────────
function stXY(t){var r=stage.getBoundingClientRect();return{x:t.clientX-r.left,y:t.clientY-r.top};}
function tDist(a,b){return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);}
function tMid(a,b){var r=stage.getBoundingClientRect();return{x:(a.clientX+b.clientX)/2-r.left,y:(a.clientY+b.clientY)/2-r.top};}
function nearSlider(p){if(!sliderMode)return false;return sliderVert?Math.abs(p.x-sliderPos*W())<32:Math.abs(p.y-sliderPos*H())<32;}

stage.addEventListener('touchstart',function(e){
  e.preventDefault();
  var t=e.touches,p=stXY(t[0]);
  if(t.length===1){if(nearSlider(p)){tMode='slider';}else if(zoomMode||active!==0){tMode='pan';panLast=p;}}
  else if(t.length>=2){tMode='pinch';var ax=zoomMode?gTx:activeTx();psDist=tDist(t[0],t[1]);psScale=ax?ax.scale:1;var m=tMid(t[0],t[1]);psMidX=m.x;psMidY=m.y;psCx=ax?ax.cx:W()/2;psCy=ax?ax.cy:H()/2;}
},{passive:false});
stage.addEventListener('touchmove',function(e){
  e.preventDefault();
  var t=e.touches;
  if(tMode==='slider'&&t.length>=1){var p=stXY(t[0]);sliderPos=sliderVert?Math.min(1,Math.max(0,p.x/W())):Math.min(1,Math.max(0,p.y/H()));draw();return;}
  var ax=zoomMode?gTx:activeTx();if(!ax)return;
  if(tMode==='pan'&&t.length===1){var p=stXY(t[0]);ax.cx+=p.x-panLast.x;ax.cy+=p.y-panLast.y;panLast=p;if(zoomMode)gTx=ax;else setActiveTx(ax);draw();}
  else if(tMode==='pinch'&&t.length>=2){var nd=tDist(t[0],t[1]);var ns=Math.min(20,Math.max(0.05,psScale*(nd/psDist)));var cm=tMid(t[0],t[1]);var imgX=(psMidX-psCx)/psScale,imgY=(psMidY-psCy)/psScale;ax.cx=cm.x-imgX*ns;ax.cy=cm.y-imgY*ns;ax.scale=ns;if(zoomMode)gTx=ax;else setActiveTx(ax);draw();}
},{passive:false});
stage.addEventListener('touchend',function(e){
  e.preventDefault();
  var rem=e.touches.length;
  if(rem===0){
    if(tMode==='pan'||tMode==='pinch'||tMode==='slider'){snapshot();}
    if(tMode==='pan'){var now=Date.now();if(now-lastTap<280){if(zoomMode){gTx={scale:1,cx:W()/2,cy:H()/2};}else if(active!==0){var img=active===1?img1:img2;if(img)setActiveTx(defaultTx(img,W(),H()));}draw();snapshot();}lastTap=now;}
    tMode='none';
  }else if(rem===1){tMode='pan';panLast=stXY(e.touches[0]);}
},{passive:false});

// ── Controls ──────────────────────────────────────────
function fitActive(){snapshot();if(zoomMode){gTx={scale:1,cx:W()/2,cy:H()/2};draw();return;}if(active===0)return;var img=active===1?img1:img2;if(img){setActiveTx(defaultTx(img,W(),H()));draw();}}
function toggleZoom(){
  if(zoomMode){bakeZoom();zoomMode=false;document.getElementById('btnZoom').className='btn-icon';updateActiveUI();}
  else{zoomMode=true;active=0;if(!gTx)gTx={scale:1,cx:W()/2,cy:H()/2};document.getElementById('btnZoom').className='btn-icon zoom-active';btn1.className='img-btn'+(img1?' img1-loaded':'');btn2.className='img-btn'+(img2?' img2-loaded':'');btn1.textContent=name1;btn2.textContent=name2;}
  draw();
}
function toggleSlider(){
  if(!sliderMode){sliderMode=true;sliderVert=true;sliderPos=0.5;document.getElementById('btnSlider').className='btn-icon slider-active';}
  else if(sliderVert){sliderVert=false;}
  else{sliderMode=false;document.getElementById('btnSlider').className='btn-icon';dividerEl.style.display='none';}
  draw();
}
function resetActive(){snapshot();if(zoomMode){gTx={scale:1,cx:W()/2,cy:H()/2};draw();return;}if(active===0)return;var img=active===1?img1:img2;if(img){setActiveTx(defaultTx(img,W(),H()));draw();}}
function setOpacity(v){opacity2=v/100;document.getElementById('oval').textContent=v+'%';draw();}
window.addEventListener('resize',function(){var w=W(),h=H();if(img1)tx1=defaultTx(img1,w,h);if(img2)tx2=defaultTx(img2,w,h);gTx=null;draw();});

openLoadSheet();
</script>
</body>
</html>`;

// ── Screen ────────────────────────────────────────────────────────────────────
export default function PhotoSlider() {
  const insets   = useSafeAreaInsets();
  const webRef   = useRef<WebView>(null);
  const { openDrawer } = useDrawer();

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
      // Write to a temp file then save via MediaLibrary
      const FileSystem = require("expo-file-system/legacy");
      const tmp = `${FileSystem.cacheDirectory}photo_slider_export_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(tmp, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
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
      {/* Native header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="chevron-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Photo Slider</Text>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openDrawer(); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="menu" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* WebView tool */}
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

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0a0e",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#111111",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a35",
  },
  backBtn: {
    width: 36,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  menuBtn: {
    width: 36,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  webview: {
    flex: 1,
    backgroundColor: "#0a0a0e",
  },
});
