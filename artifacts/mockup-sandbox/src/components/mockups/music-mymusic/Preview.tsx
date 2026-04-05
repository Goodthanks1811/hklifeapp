const TRACKS = [
  { name: "Zack Knight - Impossible", size: "3.4 MB" },
  { name: "Tyga Feat Saweetie & G-Eazy - Big Booty Bitch", size: "8 MB" },
  { name: "Ryan Leslie Feat Jermaine Dupri - The Way That You Move Girl Remix", size: "12.7 MB" },
  { name: "Warren G Feat Nate Dogg - Regulate Remix", size: "4.6 MB" },
  { name: "Reik Feat Ozuna - Me Niego (New)", size: "4.4 MB" },
  { name: "Krayzie Bone - Clash Of The Titans", size: "11 MB" },
  { name: "Krayzie Bone & Bizzy Bone - Warriors 3", size: "6.4 MB" },
  { name: "Plot Twist Accapella Slowed", size: "3 MB" },
  { name: "Jagged Edge - So Amazing", size: "7.1 MB" },
  { name: "Carnal - Amor Reencarnado", size: "5.2 MB" },
  { name: "The Weeknd - Blinding Lights", size: "6.8 MB" },
  { name: "Drake - God's Plan", size: "4.9 MB" },
];

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>My Music</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
:root{--bg:#111111;--row:#0f0f0f;--red:#E03131;--white:#fff;--grey:#A0A0A0;--muted:#666;--border:#2A2A2A;}
html,body{background:var(--bg);color:var(--white);font-family:'DM Sans',sans-serif;height:100%;overflow:hidden;}
.screen{max-width:390px;margin:0 auto;height:100vh;display:flex;flex-direction:column;position:relative;}

/* ambient */
.ambient{position:fixed;top:-120px;left:50%;transform:translateX(-50%);width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(224,49,49,0.08) 0%,transparent 70%);pointer-events:none;z-index:0;}

/* header */
.header{display:flex;align-items:center;padding:56px 20px 14px;gap:14px;flex-shrink:0;border-bottom:1px solid var(--border);position:relative;z-index:10;}
.back{display:flex;align-items:center;gap:5px;color:var(--red);font-size:15px;font-weight:500;cursor:pointer;flex-shrink:0;}
.header-title{flex:1;text-align:center;font-size:17px;font-weight:600;}
.add-btn{width:32px;height:32px;background:var(--red);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}

/* track list */
.track-list{flex:1;overflow-y:auto;padding:10px 16px 0;display:flex;flex-direction:column;gap:8px;position:relative;z-index:10;}
.track-row{
  display:flex;align-items:center;gap:14px;
  background:var(--row);border:1px solid var(--border);border-radius:14px;
  padding:10px 14px;cursor:pointer;
  position:relative;overflow:hidden;
}
.track-row::before{content:'';position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 2px 2px 0;background:var(--border);}
.track-row.playing::before{background:var(--red);}
.track-icon{width:42px;height:42px;border-radius:10px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.track-info{flex:1;min-width:0;}
.track-name{font-size:13.5px;font-weight:500;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
.track-row.playing .track-name{color:var(--red);}
.track-meta{font-size:11px;color:var(--muted);margin-top:2px;}
.track-dots{color:rgba(255,255,255,0.2);flex-shrink:0;}

/* player bar */
.player{flex-shrink:0;background:var(--row);border-top:1px solid var(--border);padding:12px 20px 28px;position:relative;z-index:10;}
.player-track{display:flex;align-items:center;gap:12px;margin-bottom:10px;}
.player-art{width:42px;height:42px;border-radius:9px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.player-info{flex:1;min-width:0;}
.player-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.player-artist{font-size:11px;color:var(--grey);margin-top:1px;}
.progress{height:2px;background:rgba(255,255,255,0.08);border-radius:1px;margin-bottom:12px;}
.progress-fill{height:100%;width:32%;background:var(--red);border-radius:1px;}
.controls{display:flex;align-items:center;justify-content:center;gap:32px;}
.ctrl{color:rgba(255,255,255,0.55);}
.play-main{width:46px;height:46px;background:var(--red);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 18px rgba(224,49,49,0.35);}

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
    <div class="header-title">My Music</div>
    <div class="add-btn">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1v12M1 7h12" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </div>
  </div>

  <div class="track-list">
    ${TRACKS.map((t, i) => `
    <div class="track-row${i === 3 ? ' playing' : ''}">
      <div class="track-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${i === 3 ? '#E03131' : 'rgba(255,255,255,0.35)'}">
          <path d="M12 3v10.55A4 4 0 1 0 14 17V5h4V3h-6z"/>
        </svg>
      </div>
      <div class="track-info">
        <div class="track-name">${t.name}</div>
        <div class="track-meta">MP3 · ${t.size} · 3/10/2024</div>
      </div>
      <div class="track-dots">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="8" cy="13" r="1.3"/>
        </svg>
      </div>
    </div>
    `).join('')}
  </div>

  <div class="player">
    <div class="player-track">
      <div class="player-art">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#E03131">
          <path d="M12 3v10.55A4 4 0 1 0 14 17V5h4V3h-6z"/>
        </svg>
      </div>
      <div class="player-info">
        <div class="player-name">Warren G - Regulate Remix</div>
        <div class="player-artist">Warren G Feat Nate Dogg</div>
      </div>
    </div>
    <div class="progress"><div class="progress-fill"></div></div>
    <div class="controls">
      <div class="ctrl">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
      </div>
      <div class="play-main">
        <svg width="16" height="18" viewBox="0 0 12 14" fill="white"><path d="M1 1L11 7L1 13V1Z"/></svg>
      </div>
      <div class="ctrl">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm8.5-6v6h2V6h-2v6z"/></svg>
      </div>
    </div>
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
