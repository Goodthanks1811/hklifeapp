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
  --bg:#0b0b0c;--bg2:#111113;--bg3:#1a1a1a;
  --red:#E8230A;--white:#ffffff;--grey:#888;--border:rgba(255,255,255,0.07);
}
html,body{background:var(--bg);color:var(--white);font-family:'DM Sans',sans-serif;height:100%;overflow-x:hidden;}
.screen{max-width:390px;margin:0 auto;min-height:100%;position:relative;overflow:hidden;}

/* ambient */
.ambient{position:fixed;top:-120px;left:50%;transform:translateX(-50%);width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,rgba(232,35,10,0.12) 0%,transparent 70%);pointer-events:none;z-index:0;animation:pulse 4s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:.6;transform:translateX(-50%) scale(1);}50%{opacity:1;transform:translateX(-50%) scale(1.1);}}

/* logo — takes over top padding since no header */
.music-logo{position:relative;z-index:10;text-align:center;padding:60px 0 6px;}
.music-logo-text{font-family:'DM Sans',sans-serif;font-size:44px;font-weight:600;letter-spacing:2px;color:#fff;line-height:1;}
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
.provider-card{border-radius:16px;overflow:hidden;cursor:pointer;position:relative;height:84px;display:flex;align-items:center;padding:0 20px;gap:16px;border:1px solid var(--border);}

/* all cards: neutral dark base */
.card-spotify{background:#0f0f0f;box-shadow:0 2px 12px rgba(0,0,0,0.4);}
.card-apple{background:#0f0f0f;box-shadow:0 2px 12px rgba(0,0,0,0.4);}
.card-local{background:#0f0f0f;box-shadow:0 2px 12px rgba(0,0,0,0.4);}

/* left accent bar only carries the brand colour */
.provider-card::before{content:'';position:absolute;left:0;top:16px;bottom:16px;width:3px;border-radius:0 2px 2px 0;}
.card-spotify::before{background:#1DB954;}
.card-apple::before{background:var(--red);}
.card-local::before{background:var(--red);}

/* icon base — all black */
.card-logo{width:48px;height:48px;border-radius:12px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:26px;}

.spotify-icon{color:#1DB954;}
.local-icon{color:var(--red);}

.card-info{flex:1;min-width:0;}
.card-name{font-size:17px;font-weight:600;color:var(--white);letter-spacing:.2px;}
.card-sub{font-size:12px;color:var(--grey);margin-top:3px;}

.card-chevron{color:rgba(255,255,255,0.25);flex-shrink:0;}

/* divider */
.divider{position:relative;z-index:10;height:1px;background:var(--border);margin:24px 16px 0;}

/* now playing card */
.last-played-section{position:relative;z-index:10;padding:0 16px;}
.np-card{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:14px 16px 16px;cursor:pointer;}
.np-top{display:flex;align-items:center;gap:14px;margin-bottom:12px;}
.track-art{width:46px;height:46px;border-radius:10px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}
.track-info{flex:1;min-width:0;}
.track-name{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.track-artist{font-size:12px;color:var(--grey);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.progress-wrap{height:2px;background:rgba(255,255,255,0.1);border-radius:1px;overflow:hidden;margin-bottom:14px;}
.progress-fill{height:100%;width:38%;background:var(--red);border-radius:1px;}
.np-controls{display:flex;align-items:center;justify-content:center;gap:28px;}
.ctrl-btn{width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.7);cursor:pointer;border-radius:50%;}
.ctrl-btn:active{background:rgba(255,255,255,0.06);}
.play-btn-main{width:44px;height:44px;background:var(--red);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;box-shadow:0 0 16px rgba(232,35,10,0.4);}

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

  <div class="music-logo">
    <div class="music-logo-text">My Music</div>

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

    <!-- My Music -->
    <div class="provider-card card-local">
      <div class="card-logo">
        <svg class="local-icon" width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 3.01L9 5v9.73C8.39 14.27 7.72 14 7 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V9.06l10-1.67v5.34c-.61-.46-1.36-.73-2.18-.73-1.78 0-3.22 1.34-3.22 3s1.44 3 3.22 3 3.18-1.34 3.18-3V3.01z"/>
        </svg>
      </div>
      <div class="card-info">
        <div class="card-name">My Music</div>
      </div>
      <div class="card-chevron">
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
          <path d="M1 1L7 7L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>

    <!-- Spotify -->
    <div class="provider-card card-spotify">
      <div class="card-logo">
        <svg class="spotify-icon" width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
      </div>
      <div class="card-info">
        <div class="card-name">Spotify</div>
      </div>
      <div class="card-chevron">
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
          <path d="M1 1L7 7L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>

    <!-- Apple Music -->
    <div class="provider-card card-apple">
      <div class="card-logo" style="font-size:28px;">🍎</div>
      <div class="card-info">
        <div class="card-name">Apple Music</div>
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
        <!-- Previous -->
        <div class="ctrl-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
          </svg>
        </div>
        <!-- Play/Pause -->
        <div class="play-btn-main">
          <svg width="16" height="18" viewBox="0 0 12 14" fill="white">
            <path d="M1 1L11 7L1 13V1Z"/>
          </svg>
        </div>
        <!-- Next -->
        <div class="ctrl-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zm8.5-6v6h2V6h-2v6z"/>
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
