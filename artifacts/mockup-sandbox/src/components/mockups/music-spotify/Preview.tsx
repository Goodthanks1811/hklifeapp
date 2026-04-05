const PLAYLISTS = [
  { name: "Liked Songs", sub: "Playlist · 1,330 songs", dot: true },
  { name: "March 2026", sub: "Playlist · HK", dot: true },
  { name: "Sept 2022", sub: "Playlist · HK", dot: true },
  { name: "Carnal Favourites", sub: "Playlist · HK", dot: false },
  { name: "Krayzie Bone", sub: "Playlist · HK", dot: true },
  { name: "October 2025", sub: "Playlist · HK", dot: true },
  { name: "Jony", sub: "Playlist · HK", dot: false },
  { name: "UB40", sub: "Playlist · HK", dot: false },
  { name: "Tyga Mix", sub: "Playlist · HK", dot: false },
  { name: "Old School RnB", sub: "Playlist · HK", dot: false },
];

const ART_COLORS = ["#4B3B9E","#1a3a2a","#2a1a3a","#3a1a1a","#1a2a3a","#2a3a1a","#3a2a1a","#1a3a3a","#3a1a2a","#2a2a3a"];
const ICONS = ["♥","M","S","C","K","O","J","U","T","R"];

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Spotify</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
:root{--bg:#111111;--row:#0f0f0f;--green:#1DB954;--white:#fff;--grey:#A0A0A0;--muted:#666;--border:#2A2A2A;}
html,body{background:var(--bg);color:var(--white);font-family:'DM Sans',sans-serif;height:100%;overflow:hidden;}
.screen{max-width:390px;margin:0 auto;height:100vh;display:flex;flex-direction:column;}

/* ambient */
.ambient{position:fixed;top:-120px;left:50%;transform:translateX(-50%);width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(29,185,84,0.06) 0%,transparent 70%);pointer-events:none;}

.header{display:flex;align-items:center;padding:56px 20px 14px;gap:14px;flex-shrink:0;border-bottom:1px solid var(--border);position:relative;z-index:10;}
.back{display:flex;align-items:center;gap:5px;color:#E03131;font-size:15px;font-weight:500;flex-shrink:0;}
.header-title{flex:1;text-align:center;font-size:17px;font-weight:600;}
.spotify-badge{display:flex;align-items:center;gap:5px;background:rgba(29,185,84,0.1);border:1px solid rgba(29,185,84,0.2);border-radius:20px;padding:4px 10px;}
.spotify-badge-text{font-size:12px;color:var(--green);font-weight:500;}

.note{margin:12px 16px 4px;background:rgba(29,185,84,0.06);border:1px solid rgba(29,185,84,0.15);border-radius:10px;padding:9px 13px;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;}
.note strong{color:var(--green);}

.list{flex:1;overflow-y:auto;padding:10px 16px 0;display:flex;flex-direction:column;gap:8px;}
.pl-row{
  display:flex;align-items:center;gap:14px;
  background:var(--row);border:1px solid var(--border);border-radius:14px;
  padding:10px 14px;cursor:pointer;
  position:relative;overflow:hidden;
}
.pl-row::before{content:'';position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 2px 2px 0;background:var(--green);}
.pl-art{width:44px;height:44px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:17px;font-weight:700;color:rgba(255,255,255,0.65);}
.pl-info{flex:1;min-width:0;}
.pl-name{font-size:14px;font-weight:500;}
.pl-sub{font-size:11px;color:var(--muted);margin-top:2px;display:flex;align-items:center;gap:5px;}
.pl-dot{width:5px;height:5px;border-radius:50%;background:var(--green);flex-shrink:0;}
.pl-chevron{color:rgba(255,255,255,0.2);}

svg{display:block;}
::-webkit-scrollbar{display:none;}
</style>
</head>
<body>
<div class="screen">
  <div class="ambient"></div>

  <div class="header">
    <div class="back">
      <svg width="9" height="16" viewBox="0 0 9 16" fill="none">
        <path d="M8 1L1 8L8 15" stroke="#E03131" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Music
    </div>
    <div class="header-title">Spotify</div>
    <div class="spotify-badge">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
      <span class="spotify-badge-text">Connected</span>
    </div>
  </div>

  <div class="note"><strong>Tap any playlist</strong> to open it directly in the Spotify app.</div>

  <div class="list">
    ${PLAYLISTS.map((p, i) => `
    <div class="pl-row">
      <div class="pl-art" style="background:${ART_COLORS[i]};">
        ${i === 0
          ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
          : `<span>${ICONS[i]}</span>`}
      </div>
      <div class="pl-info">
        <div class="pl-name">${p.name}</div>
        <div class="pl-sub">
          ${p.dot ? '<div class="pl-dot"></div>' : ''}
          ${p.sub}
        </div>
      </div>
      <div class="pl-chevron">
        <svg width="8" height="13" viewBox="0 0 8 14" fill="none">
          <path d="M1 1L7 7L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
    `).join('')}
  </div>
</div>
</body>
</html>`;

export default function Preview() {
  return (
    <iframe
      srcDoc={HTML}
      style={{ width: "390px", height: "100vh", border: "none", display: "block", margin: "0 auto", background: "#111111" }}
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
