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
:root{--bg:#0b0b0c;--bg2:#111113;--red:#E8230A;--white:#fff;--grey:#777;--border:rgba(255,255,255,0.07);}
html,body{background:var(--bg);color:var(--white);font-family:'DM Sans',sans-serif;height:100%;overflow:hidden;}
.screen{max-width:390px;margin:0 auto;height:100vh;display:flex;flex-direction:column;}

.header{display:flex;align-items:center;padding:56px 20px 14px;gap:14px;flex-shrink:0;border-bottom:1px solid var(--border);}
.back{display:flex;align-items:center;gap:5px;color:var(--red);font-size:15px;font-weight:500;cursor:pointer;flex-shrink:0;}
.header-title{flex:1;text-align:center;font-size:17px;font-weight:600;}
.apple-badge{display:flex;align-items:center;gap:5px;background:rgba(232,35,10,0.1);border:1px solid rgba(232,35,10,0.2);border-radius:20px;padding:4px 10px;}
.apple-badge-text{font-size:12px;color:var(--red);font-weight:500;}

.note{margin:14px 20px 6px;background:rgba(232,35,10,0.06);border:1px solid rgba(232,35,10,0.15);border-radius:10px;padding:10px 14px;font-size:12px;color:rgba(255,255,255,0.5);line-height:1.5;}
.note strong{color:var(--red);}

.list{flex:1;overflow-y:auto;padding:4px 0;}
.pl-row{display:flex;align-items:center;gap:16px;padding:16px 20px;cursor:pointer;transition:background .12s;}
.pl-row:active{background:rgba(255,255,255,0.04);}
.pl-emoji{font-size:22px;width:36px;text-align:center;flex-shrink:0;}
.pl-name{flex:1;font-size:16px;font-weight:500;}
.pl-chevron{color:rgba(255,255,255,0.2);}
.separator{height:1px;background:var(--border);margin:0 20px 0 72px;}

svg{display:block;}
::-webkit-scrollbar{display:none;}
</style>
</head>
<body>
<div class="screen">

  <div class="header">
    <div class="back">
      <svg width="9" height="16" viewBox="0 0 9 16" fill="none">
        <path d="M8 1L1 8L8 15" stroke="#E8230A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Music
    </div>
    <div class="header-title">Apple Music</div>
    <div class="apple-badge">
      <span style="font-size:13px;">🍎</span>
      <span class="apple-badge-text">Connected</span>
    </div>
  </div>

  <div class="note">
    <strong>Tap any playlist</strong> to open it directly in Apple Music.
  </div>

  <div class="list">
    ${PLAYLISTS.map((name, i) => `
    <div class="pl-row">
      <div class="pl-emoji">🎤</div>
      <div class="pl-name">${name}</div>
      <div class="pl-chevron">
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
          <path d="M1 1L7 7L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
    ${i < PLAYLISTS.length - 1 ? '<div class="separator"></div>' : ''}
    `).join('')}
  </div>

</div>
</body>
</html>`;

export default function Preview() {
  return (
    <iframe
      srcDoc={HTML}
      style={{ width: "390px", height: "100vh", border: "none", display: "block", margin: "0 auto", background: "#0b0b0c" }}
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
