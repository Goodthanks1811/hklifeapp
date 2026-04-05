const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Heading A</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{background:#0b0b0c;color:#fff;font-family:'Inter',sans-serif;height:100%;overflow-x:hidden;}
.screen{max-width:390px;margin:0 auto;min-height:100%;display:flex;flex-direction:column;}

/* Ambient glow */
.ambient{position:fixed;top:-100px;left:50%;transform:translateX(-50%);width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(232,35,10,0.10) 0%,transparent 70%);pointer-events:none;z-index:0;}

/* Header area */
.header{position:relative;z-index:10;display:flex;flex-direction:column;align-items:center;padding-top:54px;padding-bottom:8px;}

/* HK logo image */
.hk-logo{width:110px;height:56px;object-fit:contain;margin-bottom:4px;}

/* EQ bars */
.eq-bars{display:flex;align-items:flex-end;gap:5px;height:48px;justify-content:center;}
.eq-bar{width:5px;background:#E8230A;border-radius:3px;animation:eq 1.2s ease-in-out infinite;}
.eq-bar:nth-child(1){animation-delay:0s;animation-duration:1.1s;}
.eq-bar:nth-child(2){animation-delay:.18s;animation-duration:1.3s;}
.eq-bar:nth-child(3){animation-delay:.36s;animation-duration:1.0s;}
.eq-bar:nth-child(4){animation-delay:.08s;animation-duration:1.4s;}
.eq-bar:nth-child(5){animation-delay:.27s;animation-duration:1.2s;}
.eq-bar:nth-child(6){animation-delay:.14s;animation-duration:1.05s;}
.eq-bar:nth-child(7){animation-delay:.42s;animation-duration:1.35s;}
@keyframes eq{0%,100%{height:6px;}50%{height:42px;}}

/* Cards */
.cards{position:relative;z-index:10;padding:36px 16px 0;display:flex;flex-direction:column;gap:10px;}
.card{border-radius:16px;height:84px;display:flex;align-items:center;padding:0 20px;gap:16px;background:#0f0f0f;border:1px solid #2A2A2A;position:relative;overflow:hidden;cursor:pointer;}
.card::before{content:'';position:absolute;left:0;top:16px;bottom:16px;width:3px;border-radius:0 2px 2px 0;}
.card-red::before{background:#E8230A;}
.card-green::before{background:#1DB954;}
.icon{width:48px;height:48px;border-radius:12px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.icon svg,.icon span{display:block;}
.card-name{flex:1;font-size:17px;font-weight:600;}
.chevron{color:#2A2A2A;}

/* Player */
.player{margin-top:auto;background:#0f0f0f;padding:16px 20px 28px;box-shadow:0 -8px 24px rgba(0,0,0,0.6);}
.p-top{display:flex;align-items:center;gap:14px;margin-bottom:14px;}
.p-art{width:80px;height:80px;border-radius:14px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:28px;}
.p-name{font-size:18px;font-weight:600;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.p-artist{font-size:14px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.p-ctrl{display:flex;align-items:center;justify-content:center;gap:32px;margin-bottom:14px;}
.p-play{width:62px;height:62px;border-radius:50%;background:#E8230A;display:flex;align-items:center;justify-content:center;box-shadow:0 0 18px rgba(232,35,10,0.45);}
.p-skip{width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.6);}
.prog{height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;}
.prog-fill{height:100%;width:38%;background:#E8230A;border-radius:2px;}
</style>
</head>
<body>
<div class="screen">
  <div class="ambient"></div>

  <div class="header">
    <img class="hk-logo" src="https://814374fd-199d-4ed7-9a1e-8e8568da7f50-00-1sgtb2onftd5g.spock.replit.dev/hk-logo.png" alt="HK" />
    <div class="eq-bars">
      <div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div>
      <div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div>
      <div class="eq-bar"></div>
    </div>
  </div>

  <div class="cards">
    <div class="card card-red">
      <div class="icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="#E8230A"><path d="M21 3.01L9 5v9.73C8.39 14.27 7.72 14 7 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V9.06l10-1.67v5.34c-.61-.46-1.36-.73-2.18-.73-1.78 0-3.22 1.34-3.22 3s1.44 3 3.22 3 3.18-1.34 3.18-3V3.01z"/></svg></div>
      <span class="card-name">My Music</span>
      <svg class="chevron" width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M1 1L7 7L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div class="card card-green">
      <div class="icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg></div>
      <span class="card-name">Spotify</span>
      <svg class="chevron" width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M1 1L7 7L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div class="card card-red">
      <div class="icon"><span style="font-size:30px;line-height:1;">🍎</span></div>
      <span class="card-name">Apple Music</span>
      <svg class="chevron" width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M1 1L7 7L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
  </div>

  <div class="player">
    <div class="p-top">
      <div class="p-art">🎵</div>
      <div style="flex:1;min-width:0;">
        <div class="p-name">Regulate Remix</div>
        <div class="p-artist">Warren G Feat Nate Dogg</div>
      </div>
    </div>
    <div class="p-ctrl">
      <div class="p-skip"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg></div>
      <div class="p-play"><svg width="22" height="22" viewBox="0 0 12 14" fill="white"><path d="M1 1L11 7L1 13V1Z"/></svg></div>
      <div class="p-skip"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm8.5-6v6h2V6h-2v6z"/></svg></div>
    </div>
    <div class="prog"><div class="prog-fill"></div></div>
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
