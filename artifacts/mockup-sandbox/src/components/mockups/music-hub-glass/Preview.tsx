const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>HK Music Glass</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
:root{
  --bg:#111111;
  --row:#0f0f0f;
  --red:#E03131;
  --white:#ffffff;
  --grey:#A0A0A0;
  --muted:#666;
  --border:#2A2A2A;
}
html,body{background:var(--bg);color:var(--white);font-family:'DM Sans',sans-serif;height:100%;overflow-x:hidden;}
.screen{max-width:390px;margin:0 auto;min-height:100%;position:relative;}

/* ambient glow — same as original */
.ambient{position:fixed;top:-120px;left:50%;transform:translateX(-50%);width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,rgba(232,35,10,0.12) 0%,transparent 70%);pointer-events:none;z-index:0;animation:pulse 4s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:.6;transform:translateX(-50%) scale(1);}50%{opacity:1;transform:translateX(-50%) scale(1.1);}}

/* EQ header */
.eq-wrap{position:relative;z-index:10;padding:60px 0 6px;text-align:center;}
.eq-bars{display:inline-flex;align-items:flex-end;gap:5px;height:56px;justify-content:center;}
.eq-bar{width:5px;background:var(--red);border-radius:3px;animation:eq 1.2s ease-in-out infinite;}
.eq-bar:nth-child(1){animation-delay:0s;animation-duration:1.1s;}
.eq-bar:nth-child(2){animation-delay:.18s;animation-duration:1.3s;}
.eq-bar:nth-child(3){animation-delay:.36s;animation-duration:1.0s;}
.eq-bar:nth-child(4){animation-delay:.08s;animation-duration:1.4s;}
.eq-bar:nth-child(5){animation-delay:.27s;animation-duration:1.2s;}
.eq-bar:nth-child(6){animation-delay:.14s;animation-duration:1.05s;}
.eq-bar:nth-child(7){animation-delay:.42s;animation-duration:1.35s;}
@keyframes eq{0%,100%{height:8px;}50%{height:56px;}}

/* section label — matches Life page style */
.section-label{
  padding:24px 16px 8px;
  font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);
}

/* provider rows */
.cards{padding:0 16px;display:flex;flex-direction:column;gap:8px;}
.provider-row{
  display:flex;align-items:center;gap:16px;
  background:var(--row);
  border:1px solid var(--border);
  border-radius:16px;
  padding:0 20px;
  height:84px;
  cursor:pointer;
  animation:slideUp .35s ease both;
  overflow:hidden;
  position:relative;
}
.provider-row:nth-child(1){animation-delay:.05s;}
.provider-row:nth-child(2){animation-delay:.12s;}
.provider-row:nth-child(3){animation-delay:.19s;}
@keyframes slideUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}

/* left accent bar — brand colour only */
.provider-row::before{content:'';position:absolute;left:0;top:16px;bottom:16px;width:3px;border-radius:0 2px 2px 0;}
.row-mymusic::before{background:var(--red);}
.row-spotify::before{background:#1DB954;}
.row-apple::before{background:var(--red);}

/* icon — 48px to match original card size */
.row-icon{
  width:48px;height:48px;border-radius:12px;
  background:#1a1a1a;
  border:1px solid rgba(255,255,255,0.06);
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;
}
.row-name{
  flex:1;
  font-size:17px;font-weight:600;color:var(--white);letter-spacing:.2px;
}
.row-chevron{color:rgba(255,255,255,0.22);}

/* divider */
.divider{height:1px;background:var(--border);margin:22px 16px 0;}

/* now playing — same card pattern as app modals */
.np-label{padding:16px 16px 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);}
.np-card{
  margin:0 16px;
  background:var(--row);
  border:1px solid var(--border);
  border-radius:10px;
  padding:14px 16px 16px;
  animation:slideUp .35s ease .28s both;
}
.np-top{display:flex;align-items:center;gap:12px;margin-bottom:10px;}
.track-art{
  width:42px;height:42px;border-radius:9px;
  background:#1a1a1a;border:1px solid rgba(255,255,255,0.07);
  display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;
}
.track-info{flex:1;min-width:0;}
.track-name{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.track-artist{font-size:12px;color:var(--grey);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.progress-wrap{height:2px;background:rgba(255,255,255,0.08);border-radius:1px;overflow:hidden;margin-bottom:12px;}
.progress-fill{height:100%;width:38%;background:var(--red);border-radius:1px;}
.np-controls{display:flex;align-items:center;justify-content:center;gap:28px;}
.ctrl-btn{width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.65);}
.play-btn{
  width:44px;height:44px;background:var(--red);border-radius:50%;
  display:flex;align-items:center;justify-content:center;
}

svg{display:block;}
</style>
</head>
<body>
<div class="screen">
  <div class="ambient"></div>

  <div class="eq-wrap">
    <div class="eq-bars">
      <div class="eq-bar"></div>
      <div class="eq-bar"></div>
      <div class="eq-bar"></div>
      <div class="eq-bar"></div>
      <div class="eq-bar"></div>
      <div class="eq-bar"></div>
      <div class="eq-bar"></div>
    </div>
  </div>

  <div class="section-label">Sources</div>

  <div class="cards">

    <!-- My Music -->
    <div class="provider-row row-mymusic">
      <div class="row-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#E03131">
          <path d="M21 3.01L9 5v9.73C8.39 14.27 7.72 14 7 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V9.06l10-1.67v5.34c-.61-.46-1.36-.73-2.18-.73-1.78 0-3.22 1.34-3.22 3s1.44 3 3.22 3 3.18-1.34 3.18-3V3.01z"/>
        </svg>
      </div>
      <div class="row-name">My Music</div>
      <div class="row-chevron">
        <svg width="8" height="13" viewBox="0 0 8 14" fill="none">
          <path d="M1 1L7 7L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>

    <!-- Spotify -->
    <div class="provider-row row-spotify">
      <div class="row-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#1DB954">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
      </div>
      <div class="row-name">Spotify</div>
      <div class="row-chevron">
        <svg width="8" height="13" viewBox="0 0 8 14" fill="none">
          <path d="M1 1L7 7L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>

    <!-- Apple Music -->
    <div class="provider-row row-apple">
      <div class="row-icon" style="font-size:20px;border:none;background:transparent;">🍎</div>
      <div class="row-name">Apple Music</div>
      <div class="row-chevron">
        <svg width="8" height="13" viewBox="0 0 8 14" fill="none">
          <path d="M1 1L7 7L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>

  </div>

  <div class="divider"></div>
  <div class="np-label">Now Playing</div>

  <div class="np-card">
    <div class="np-top">
      <div class="track-art">🎧</div>
      <div class="track-info">
        <div class="track-name">Hawái (Remix)</div>
        <div class="track-artist">Maluma, The Weeknd · My Music</div>
      </div>
    </div>
    <div class="progress-wrap"><div class="progress-fill"></div></div>
    <div class="np-controls">
      <div class="ctrl-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
        </svg>
      </div>
      <div class="play-btn">
        <svg width="16" height="18" viewBox="0 0 12 14" fill="white">
          <path d="M1 1L11 7L1 13V1Z"/>
        </svg>
      </div>
      <div class="ctrl-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zm8.5-6v6h2V6h-2v6z"/>
        </svg>
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
      style={{
        width: "390px",
        height: "100vh",
        border: "none",
        display: "block",
        margin: "0 auto",
        background: "#111111",
      }}
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
