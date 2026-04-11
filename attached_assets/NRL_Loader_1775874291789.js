// ─── CONFIG ───────────────────────────
const CHEV_WIDTH   = 44;    // chevron width (px)
const CHEV_HEIGHT  = 10;    // chevron height (px)
const CHEV_GAP     = 6;     // gap between chevrons (px)
const CHEV_SKEW    = 20;    // skew angle (deg)
const SPEED        = 1.2;   // seconds per cycle
const STAGGER      = 0.2;   // delay between each chevron (s)
const COLOR        = "#00D85B";
const GLOW         = 6;     // glow radius at peak (px)
const GLOW_OPACITY = 0.7;   // 0–1
const SCALE_MIN    = 0.85;  // scaleX at rest
const OPACITY_MIN  = 0.15;  // opacity at rest
// ──────────────────────────────────────

const glow = "rgba(0,216,91," + GLOW_OPACITY + ")";

const html = '<!DOCTYPE html>' +
'<html><head>' +
'<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">' +
'<style>' +
'* { margin: 0; padding: 0; box-sizing: border-box; }' +
'body { background: #0a0a0a; display: flex; align-items: center; justify-content: center; height: 100vh; }' +
'.chevrons { display: flex; flex-direction: column; align-items: center; gap: ' + CHEV_GAP + 'px; }' +
'.chev {' +
'  width: ' + CHEV_WIDTH + 'px;' +
'  height: ' + CHEV_HEIGHT + 'px;' +
'  position: relative;' +
'  opacity: ' + OPACITY_MIN + ';' +
'  animation: chevPulse ' + SPEED + 's ease-in-out infinite;' +
'}' +
'.chev::before, .chev::after {' +
'  content: "";' +
'  position: absolute;' +
'  top: 0;' +
'  width: 50%;' +
'  height: 100%;' +
'  background: ' + COLOR + ';' +
'  border-radius: 2px;' +
'}' +
'.chev::before { left: 0; transform: skewY(' + CHEV_SKEW + 'deg); transform-origin: top left; }' +
'.chev::after  { right: 0; transform: skewY(-' + CHEV_SKEW + 'deg); transform-origin: top right; }' +
'.chev:nth-child(1) { animation-delay: 0s; }' +
'.chev:nth-child(2) { animation-delay: ' + STAGGER + 's; }' +
'.chev:nth-child(3) { animation-delay: ' + (STAGGER * 2) + 's; }' +
'@keyframes chevPulse {' +
'  0%,100% { opacity: ' + OPACITY_MIN + '; transform: scaleX(' + SCALE_MIN + '); }' +
'  50% { opacity: 1; transform: scaleX(1); filter: drop-shadow(0 0 ' + GLOW + 'px ' + glow + '); }' +
'}' +
'</style></head>' +
'<body>' +
'<div class="chevrons">' +
'<div class="chev"></div>' +
'<div class="chev"></div>' +
'<div class="chev"></div>' +
'</div>' +
'</body></html>';

const wv = new WebView();
await wv.loadHTML(html);
await wv.present(true);
