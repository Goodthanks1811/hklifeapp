const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>HK Music</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
:root{
  --bg:#0b0b0c;--bg2:#111113;--bg3:#191919;
  --red:#E8230A;--red-dim:rgba(232,35,10,0.15);--red-glow:rgba(232,35,10,0.4);
  --white:#ffffff;--grey:#888;--border:rgba(255,255,255,0.07);
}
html,body{background:var(--bg);color:var(--white);font-family:'DM Sans',sans-serif;height:100%;overflow-x:hidden;}
.screen{max-width:390px;margin:0 auto;min-height:100%;position:relative;overflow:hidden;}

/* ambient */
.ambient{position:fixed;top:-120px;left:50%;transform:translateX(-50%);width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,rgba(232,35,10,0.12) 0%,transparent 70%);pointer-events:none;z-index:0;animation:pulse 4s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:.6;transform:translateX(-50%) scale(1);}50%{opacity:1;transform:translateX(-50%) scale(1.1);}}

/* header */
header{position:relative;z-index:10;padding:56px 20px 0;display:flex;align-items:center;gap:12px;}
.back-btn{width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:var(--white);cursor:pointer;flex-shrink:0;}
.page-title-row{display:flex;align-items:center;gap:10px;}
.icon-badge{width:32px;height:32px;background:var(--red);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;}
.page-title{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1.5px;color:var(--white);}

/* logo */
.music-logo{position:relative;z-index:10;text-align:center;padding:28px 0 6px;}
.music-logo-text{font-family:'Bebas Neue',sans-serif;font-size:52px;letter-spacing:6px;background:linear-gradient(160deg,#fff 30%,var(--red) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1;}
.music-logo-sub{font-size:11px;letter-spacing:4px;color:var(--grey);text-transform:uppercase;margin-top:4px;}

/* eq bars */
.eq-bars{display:flex;align-items:flex-end;gap:3px;height:18px;justify-content:center;margin:10px auto 0;}
.eq-bar{width:3px;background:var(--red);border-radius:2px;animation:eq 1.2s ease-in-out infinite;}
.eq-bar:nth-child(1){animation-delay:0s;}
.eq-bar:nth-child(2){animation-delay:.2s;}
.eq-bar:nth-child(3){animation-delay:.4s;}
.eq-bar:nth-child(4){animation-delay:.1s;}
.eq-bar:nth-child(5){animation-delay:.3s;}
@keyframes eq{0%,100%{height:4px;}50%{height:18px;}}

/* section label */
.section-label{position:relative;z-index:10;padding:24px 20px 10px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--grey);}

/* provider cards */
.cards{position:relative;z-index:10;padding:0 16px;display:flex;flex-direction:column;gap:10px;}
.provider-card{border-radius:16px;overflow:hidden;cursor:pointer;position:relative;height:90px;display:flex;align-items:center;padding:0 20px;gap:16px;border:1px solid var(--border);}
.card-spotify{background:linear-gradient(135deg,#0f1f0f 0%,#111b11 60%,#0b1a0b 100%);box-shadow:0 4px 24px rgba(29,185,84,0.12);}
.card-apple{background:linear-gradient(135deg,#1c0a0a 0%,#1f0e10 60%,#1a0b0d 100%);box-shadow:0 4px 24px rgba(252,60,68,0.12);}
.card-local{background:linear-gradient(135deg,#160606 0%,#1a0808 60%,#120505 100%);box-shadow:0 4px 24px rgba(232,35,10,0.15);}
.provider-card::before{content:'';position:absolute;left:0;top:16px;bottom:16px;width:3px;border-radius:0 2px 2px 0;}
.card-spotify::before{background:#1DB954;}
.card-apple::before{background:#fc3c44;}
.card-local::before{background:var(--red);}
.card-logo{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:26px;}
.card-spotify .card-logo{background:rgba(29,185,84,0.15);}
.card-apple .card-logo{background:rgba(252,60,68,0.15);}
.card-local .card-logo{background:rgba(232,35,10,0.15);}
.spotify-icon{color:#1DB954;}
.apple-icon{color:#fc3c44;}
.local-icon{color:var(--red);}
.card-info{flex:1;min-width:0;}
.card-name{font-size:17px;font-weight:600;color:var(--white);letter-spacing:.2px;}
.card-meta{font-size:12px;color:var(--grey);margin-top:3px;}
.card-meta span{display:inline-block;background:rgba(255,255,255,0.07);border-radius:4px;padding:1px 7px;margin-right:5px;font-size:11px;}
.card-chevron{color:rgba(255,255,255,0.3);flex-shrink:0;}

/* divider */
.divider{position:relative;z-index:10;height:1px;background:var(--border);margin:24px 16px 0;}

/* last played */
.last-played-section{position:relative;z-index:10;padding:0 16px;}
.last-played-card{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:14px;cursor:pointer;}
.track-art{width:46px;height:46px;border-radius:10px;background:linear-gradient(135deg,#2a0a0a,#1a0505);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}
.track-info{flex:1;min-width:0;}
.track-name{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.track-artist{font-size:12px;color:var(--grey);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.progress-wrap{height:2px;background:rgba(255,255,255,0.1);border-radius:1px;margin-top:8px;overflow:hidden;}
.progress-fill{height:100%;width:38%;background:var(--red);border-radius:1px;}
.mini-player{display:flex;align-items:center;gap:10px;}
.play-btn-mini{width:34px;height:34px;background:var(--red);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}

/* entry animations */
.cards .provider-card:nth-child(1){animation:slideUp .4s ease .05s both;}
.cards .provider-card:nth-child(2){animation:slideUp .4s ease .12s both;}
.cards .provider-card:nth-child(3){animation:slideUp .4s ease .19s both;}
.last-played-section{animation:slideUp .4s ease .28s both;}
@keyframes slideUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}

svg{display:block;}
</style>
</head>
<body>
<div class="screen">
  <div class="ambient"></div>

  <header>
    <div class="back-btn">
      <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
        <path d="M9 1L1 9L9 17" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="page-title-row">
      <div class="icon-badge">🎵</div>
      <div class="page-title">Music</div>
    </div>
  </header>

  <div class="music-logo">
    <div class="music-logo-text">HK MUSIC</div>
    <div class="music-logo-sub">Your Listening Hub</div>
    <div class="eq-bars">
      <div class="eq-bar"></div>
      <div class="eq-bar"></div>
      <div class="eq-bar"></div>
      <div class="eq-bar"></div>
      <div class="eq-bar"></div>
    </div>
  </div>

  <div class="section-label">Sources</div>

  <div class="cards">
    <div class="provider-card card-spotify">
      <div class="card-logo">
        <svg class="spotify-icon" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
      </div>
      <div class="card-info">
        <div class="card-name">Spotify</div>
        <div class="card-meta">
          <span>8 playlists</span>
          <span style="color:#1DB954;background:rgba(29,185,84,0.1)">● Connected</span>
        </div>
      </div>
      <div class="card-chevron">
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
          <path d="M1 1L7 7L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>

    <div class="provider-card card-apple">
      <div class="card-logo">
        <svg class="apple-icon" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.048-2.31-2.227-2.99-.593-.344-1.25-.466-1.92-.51-.13-.01-.26-.024-.39-.026C19.043.4 18.87.4 18.698.4H5.302c-.173 0-.345 0-.517.008-.13.002-.26.016-.39.026-.67.044-1.327.166-1.92.51C1.294 1.624.563 2.624.246 3.934A9.23 9.23 0 00.006 6.124C0 6.3 0 6.473 0 6.646v10.708c0 .173 0 .345.006.517.048 1.29.44 2.47 1.286 3.43.855.976 1.94 1.45 3.23 1.59.59.063 1.19.09 1.787.1h11.383c.596-.01 1.194-.037 1.786-.1 1.29-.14 2.376-.614 3.23-1.59.845-.96 1.24-2.14 1.286-3.43C24 17.699 24 17.527 24 17.354V6.646c0-.173 0-.346-.006-.522zm-7.27 7.171c-.068.119-.166.207-.282.262a4.078 4.078 0 01-.313.132 3.258 3.258 0 00-.63.332 1.697 1.697 0 00-.535.683c-.1.228-.144.474-.13.72.015.244.088.48.215.69.127.207.302.38.51.5.21.12.443.186.682.194a1.71 1.71 0 00.705-.128c.1-.046.197-.104.283-.172.085-.068.16-.147.221-.236.063-.09.108-.19.137-.295.029-.105.04-.214.033-.322a1.42 1.42 0 00-.116-.449 1.43 1.43 0 00-.267-.383 1.45 1.45 0 00-.39-.267 1.44 1.44 0 00-.468-.117V9.78a3.85 3.85 0 011.396.353 3.856 3.856 0 011.105.8 3.828 3.828 0 01.735 1.166c.17.431.258.89.259 1.354a3.86 3.86 0 01-.274 1.44 3.856 3.856 0 01-.782 1.204z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <div class="card-info">
        <div class="card-name">Apple Music</div>
        <div class="card-meta">
          <span>5 playlists</span>
          <span style="color:#fc3c44;background:rgba(252,60,68,0.1)">● Connected</span>
        </div>
      </div>
      <div class="card-chevron">
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
          <path d="M1 1L7 7L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>

    <div class="provider-card card-local">
      <div class="card-logo">
        <svg class="local-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
      </div>
      <div class="card-info">
        <div class="card-name">My Music</div>
        <div class="card-meta">
          <span>247 tracks</span>
          <span style="color:#E8230A;background:rgba(232,35,10,0.1)">On Device</span>
        </div>
      </div>
      <div class="card-chevron">
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
          <path d="M1 1L7 7L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
  </div>

  <div class="divider"></div>
  <div class="section-label" style="padding-top:20px">Now Playing</div>

  <div class="last-played-section">
    <div class="last-played-card">
      <div class="track-art">🎧</div>
      <div class="track-info">
        <div class="track-name">Hawái (Remix)</div>
        <div class="track-artist">Maluma, The Weeknd · Spotify</div>
        <div class="progress-wrap"><div class="progress-fill"></div></div>
      </div>
      <div class="mini-player">
        <div class="play-btn-mini">
          <svg width="12" height="14" viewBox="0 0 12 14" fill="white">
            <path d="M1 1L11 7L1 13V1Z"/>
          </svg>
        </div>
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
        background: "#0b0b0c",
      }}
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
