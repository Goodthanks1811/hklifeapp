const PLAYLISTS = [
  "Bone Greatest Hits",
  "2pac Greatest Hits",
  "Snoop Greatest Hits",
  "DMX Greatest Hits",
  "Eminem Greatest Hits",
  "The Repeat List",
  "Old School Rnb",
  "Driving",
  "Pre Gym",
  "2022 New Stuff",
  "Faydee",
  "Carnal Hits",
];

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Apple Music</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
:root{--bg:#111111;--row:#0f0f0f;--red:#E03131;--white:#fff;--grey:#A0A0A0;--muted:#666;--border:#2A2A2A;}
html,body{background:var(--bg);color:var(--white);font-family:'DM Sans',sans-serif;height:100%;overflow:hidden;}
.screen{max-width:390px;margin:0 auto;height:100vh;display:flex;flex-direction:column;}

/* ambient */
.ambient{position:fixed;top:-120px;left:50%;transform:translateX(-50%);width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(224,49,49,0.07) 0%,transparent 70%);pointer-events:none;}

.header{display:flex;align-items:center;padding:56px 20px 14px;gap:14px;flex-shrink:0;border-bottom:1px solid var(--border);position:relative;z-index:10;}
.back{display:flex;align-items:center;gap:5px;color:var(--red);font-size:15px;font-weight:500;flex-shrink:0;}
.header-title{flex:1;text-align:center;font-size:17px;font-weight:600;}
.apple-badge{display:flex;align-items:center;gap:5px;background:rgba(224,49,49,0.08);border:1px solid rgba(224,49,49,0.18);border-radius:20px;padding:4px 10px;}
.apple-badge-text{font-size:12px;color:var(--red);font-weight:500;}

.note{margin:12px 16px 4px;background:rgba(224,49,49,0.05);border:1px solid rgba(224,49,49,0.14);border-radius:10px;padding:9px 13px;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;}
.note strong{color:var(--red);}

.list{flex:1;overflow-y:auto;padding:10px 16px 0;display:flex;flex-direction:column;gap:8px;}
.pl-row{
  display:flex;align-items:center;gap:16px;
  background:var(--row);border:1px solid var(--border);border-radius:14px;
  padding:14px 14px;cursor:pointer;
}
.pl-emoji{font-size:20px;width:32px;text-align:center;flex-shrink:0;}
.pl-name{flex:1;font-size:15px;font-weight:500;}
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
    <div class="header-title">Apple Music</div>
    <div class="apple-badge">
      <span style="font-size:12px;">🍎</span>
      <span class="apple-badge-text">Connected</span>
    </div>
  </div>

  <div class="note"><strong>Tap any playlist</strong> to open it directly in Apple Music.</div>

  <div class="list">
    ${PLAYLISTS.map((name) => `
    <div class="pl-row">
      <div class="pl-emoji">🎤</div>
      <div class="pl-name">${name}</div>
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
