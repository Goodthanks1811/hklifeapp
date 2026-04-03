import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";

// ── Data ──────────────────────────────────────────────────────────────────────
const ALPHABET = [
  { char: "А", sound: "a" },    { char: "Б", sound: "b" },
  { char: "В", sound: "v" },    { char: "Г", sound: "g" },
  { char: "Д", sound: "d" },    { char: "Е", sound: "ye" },
  { char: "Ё", sound: "yo" },   { char: "Ж", sound: "zh" },
  { char: "З", sound: "z" },    { char: "И", sound: "i" },
  { char: "Й", sound: "y" },    { char: "К", sound: "k" },
  { char: "Л", sound: "l" },    { char: "М", sound: "m" },
  { char: "Н", sound: "n" },    { char: "О", sound: "o" },
  { char: "П", sound: "p" },    { char: "Р", sound: "r" },
  { char: "С", sound: "s" },    { char: "Т", sound: "t" },
  { char: "У", sound: "u" },    { char: "Ф", sound: "f" },
  { char: "Х", sound: "kh" },   { char: "Ц", sound: "ts" },
  { char: "Ч", sound: "ch" },   { char: "Ш", sound: "sh" },
  { char: "Щ", sound: "shch" }, { char: "Ъ", sound: "hard sign" },
  { char: "Ы", sound: "y" },    { char: "Ь", sound: "soft sign" },
  { char: "Э", sound: "e" },    { char: "Ю", sound: "yu" },
  { char: "Я", sound: "ya" },
];

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, sans-serif;
    background: #0b0b0c;
    color: #fff;
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    user-select: none;
    -webkit-user-select: none;
  }

  /* ── Progress bar ── */
  .progress-bar-bg {
    position: fixed;
    top: 0; left: 0;
    width: 100%;
    height: 5px;
    background: rgba(255,255,255,0.08);
    z-index: 100;
  }
  .progress-bar-fill {
    height: 5px;
    background: #E03131;
    border-radius: 0 3px 3px 0;
    transition: width 0.4s ease;
  }

  .content {
    width: 100%;
    max-width: min(480px, 92vw);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* ── Start screen ── */
  .start-screen {
    text-align: center;
    width: 100%;
  }
  .start-flag {
    font-size: clamp(48px, 10vw, 72px);
    margin-bottom: 16px;
  }
  .start-title {
    font-size: clamp(22px, 4vw, 28px);
    font-weight: 700;
    margin-bottom: 6px;
    letter-spacing: -0.3px;
  }
  .start-sub {
    font-size: clamp(13px, 2vw, 15px);
    color: rgba(255,255,255,0.4);
    margin-bottom: 36px;
  }
  .session-label {
    font-size: clamp(11px, 1.5vw, 13px);
    text-transform: uppercase;
    letter-spacing: 2px;
    color: rgba(255,255,255,0.35);
    margin-bottom: 14px;
  }
  .session-pills {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 32px;
  }
  .session-pill {
    padding: 10px 20px;
    border-radius: 50px;
    border: 1.5px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.6);
    font-size: clamp(14px, 2vw, 16px);
    font-weight: 600;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition: all 0.15s;
  }
  .session-pill.active {
    background: #E03131;
    border-color: #E03131;
    color: #fff;
  }

  /* ── Card ── */
  .card {
    width: 100%;
    background: #1A1A1A;
    border: 1px solid #2A2A2A;
    border-radius: clamp(16px, 3vw, 24px);
    padding: clamp(32px, 6vw, 60px) clamp(24px, 5vw, 48px);
    text-align: center;
    margin-bottom: clamp(16px, 3vw, 28px);
  }
  .card-label {
    font-size: clamp(11px, 1.5vw, 13px);
    text-transform: uppercase;
    letter-spacing: 2px;
    color: rgba(255,255,255,0.35);
    margin-bottom: 12px;
  }
  .card-char {
    font-size: clamp(96px, 18vw, 160px);
    line-height: 1;
    font-weight: bold;
    color: #fff;
    margin-bottom: 8px;
  }
  .card-counter {
    font-size: clamp(12px, 1.8vw, 15px);
    color: rgba(255,255,255,0.3);
  }

  /* ── Input ── */
  .input-row {
    width: 100%;
    margin-bottom: clamp(10px, 2vw, 16px);
  }
  input[type=text] {
    width: 100%;
    padding: clamp(14px, 2.5vw, 18px) clamp(16px, 3vw, 22px);
    font-size: clamp(16px, 2.5vw, 20px);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    background: transparent;
    color: #fff;
    outline: none;
    -webkit-appearance: none;
  }
  input[type=text]:focus { border-color: rgba(255,255,255,0.35); }
  input[type=text]::placeholder { color: rgba(255,255,255,0.25); }

  /* ── Buttons ── */
  .btn-row {
    display: flex;
    gap: 10px;
    width: 100%;
  }
  .btn {
    display: block;
    padding: clamp(14px, 2.5vw, 18px) 24px;
    font-size: clamp(15px, 2.2vw, 17px);
    font-weight: 700;
    border: none;
    border-radius: 12px;
    background: #E03131;
    color: #fff;
    width: 100%;
    text-align: center;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: opacity 0.15s;
  }
  .btn:active { opacity: 0.75; }

  .btn-hint {
    background: rgba(255,255,255,0.07);
    border: 1.5px solid rgba(255,255,255,0.12);
    flex-shrink: 0;
    width: auto;
    padding-left: clamp(16px, 3vw, 26px);
    padding-right: clamp(16px, 3vw, 26px);
    white-space: nowrap;
  }
  .btn-hint.revealed {
    background: rgba(255, 200, 50, 0.12);
    border-color: rgba(255, 200, 50, 0.35);
    color: #ffc832;
  }

  /* ── Feedback ── */
  .feedback {
    font-size: clamp(13px, 2vw, 15px);
    font-weight: 600;
    text-align: center;
    height: 26px;
    margin-top: clamp(8px, 1.5vw, 12px);
  }
  .feedback.correct   { color: #2cb67d; }
  .feedback.incorrect { color: #ff6b6b; }
  .feedback.hint      { color: #ffc832; }

  /* ── Score screen ── */
  .score-screen { text-align: center; width: 100%; }
  .score-emoji  { font-size: clamp(52px, 10vw, 72px); margin-bottom: 14px; }
  .score-title  { font-size: clamp(22px, 4vw, 28px); font-weight: 700; margin-bottom: 6px; }
  .score-sub    { font-size: clamp(13px, 2vw, 16px); color: rgba(255,255,255,0.45); margin-bottom: 28px; }
  .score-big    { font-size: clamp(64px, 14vw, 96px); font-weight: 800; line-height: 1; margin-bottom: 6px; }
  .score-big.good { color: #2cb67d; }
  .score-big.bad  { color: #E03131; }
  .score-label  { font-size: clamp(12px, 2vw, 15px); color: rgba(255,255,255,0.35); margin-bottom: 28px; }

  /* ── Mistakes list ── */
  .mistakes-list {
    text-align: left;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: clamp(14px, 2.5vw, 20px) clamp(16px, 3vw, 22px);
    margin-bottom: 28px;
    width: 100%;
  }
  .mistakes-list h3 {
    font-size: clamp(10px, 1.5vw, 12px);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: rgba(255,255,255,0.35);
    margin-bottom: 12px;
  }
  .mistake-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: clamp(6px, 1.2vw, 9px) 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    font-size: clamp(13px, 2vw, 15px);
    gap: 8px;
  }
  .mistake-row:last-child { border-bottom: none; }
  .m-char  { font-size: clamp(18px, 3.5vw, 24px); font-weight: bold; min-width: 28px; }
  .m-right { color: #2cb67d; }
  .m-wrong { color: #ff6b6b; }
</style>
</head>
<body>

<div class="progress-bar-bg">
  <div class="progress-bar-fill" id="progress" style="width:0%"></div>
</div>

<!-- Start screen -->
<div class="content" id="start-view">
  <div class="start-screen">
    <div class="start-flag">🇷🇺</div>
    <div class="start-title">Russian Alphabet</div>
    <div class="start-sub">33 letters · type the sound</div>
    <div class="session-label">Cards per session</div>
    <div class="session-pills" id="pills"></div>
    <div class="btn" onclick="startSession()">Start</div>
  </div>
</div>

<!-- Quiz screen -->
<div class="content" id="quiz-view" style="display:none">
  <div class="card">
    <div class="card-label">What sound does this make?</div>
    <div class="card-char" id="char"></div>
    <div class="card-counter" id="counter"></div>
  </div>
  <div class="input-row">
    <input type="text" id="answer" placeholder="Type the sound…"
      autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" />
  </div>
  <div class="btn-row">
    <div class="btn" id="submit-btn" onclick="checkAnswer()">Check</div>
    <div class="btn btn-hint" id="hint-btn" onclick="showHint()">Hint</div>
  </div>
  <div class="feedback" id="feedback"></div>
</div>

<!-- Score screen -->
<div class="content" id="score-view" style="display:none">
  <div class="score-screen">
    <div class="score-emoji">🏆</div>
    <div class="score-title">Session Complete!</div>
    <div class="score-sub" id="score-sub"></div>
    <div class="score-big" id="score-big"></div>
    <div class="score-label" id="score-label"></div>
    <div class="mistakes-list" id="mistakes-list" style="display:none">
      <h3>Review These</h3>
      <div id="mistakes-rows"></div>
    </div>
    <div class="btn" onclick="restart()">Play Again</div>
  </div>
</div>

<script>
const FULL_ALPHABET = ${JSON.stringify(ALPHABET)};
const SESSION_OPTIONS = [5, 10, 15, 20, 33];
let selectedSize = 10;

let SESSION  = [];
let index    = 0;
let score    = 0;
let mistakes = [];
let answered = false;
let hintUsed = false;

function $(id) { return document.getElementById(id); }

// ── Build session-size pills ─────────────────────────────────────────────────
(function buildPills() {
  const container = $('pills');
  SESSION_OPTIONS.forEach(function(n) {
    const pill = document.createElement('div');
    pill.className = 'session-pill' + (n === selectedSize ? ' active' : '');
    pill.textContent = n === 33 ? 'All' : String(n);
    function selectPill() {
      selectedSize = n;
      document.querySelectorAll('.session-pill').forEach(function(p) { p.classList.remove('active'); });
      pill.classList.add('active');
    }
    pill.addEventListener('touchend', function(e) { e.preventDefault(); selectPill(); });
    pill.addEventListener('click', selectPill);
    container.appendChild(pill);
  });
})();

function startSession() {
  $('start-view').style.display = 'none';
  $('quiz-view').style.display  = 'flex';
  initSession();
  showCard();
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function initSession() {
  SESSION  = shuffleArr(FULL_ALPHABET).slice(0, selectedSize);
  index    = 0;
  score    = 0;
  mistakes = [];
  answered = false;
  hintUsed = false;
}

function focusInput() {
  setTimeout(function() { $('answer').focus(); }, 150);
}

function showCard() {
  const card = SESSION[index];
  $('char').textContent       = card.char;
  $('counter').textContent    = (index + 1) + ' / ' + SESSION.length;
  $('progress').style.width   = (index / SESSION.length * 100) + '%';
  $('answer').value           = '';
  $('feedback').textContent   = '';
  $('feedback').className     = 'feedback';
  $('submit-btn').textContent = 'Check';
  const hb = $('hint-btn');
  hb.textContent         = 'Hint';
  hb.className           = 'btn btn-hint';
  hb.style.pointerEvents = '';
  answered = false;
  hintUsed = false;
  focusInput();
}

function showHint() {
  if (answered) return;
  const card = SESSION[index];
  hintUsed = true;
  $('feedback').textContent = '💡 "' + card.sound + '"';
  $('feedback').className   = 'feedback hint';
  const hb = $('hint-btn');
  hb.textContent         = '✓ Shown';
  hb.className           = 'btn btn-hint revealed';
  hb.style.pointerEvents = 'none';
}

function normalise(s) {
  return s.trim().toLowerCase().replace(/[^a-z ]/g, '');
}

function checkAnswer() {
  if (answered) {
    index++;
    if (index >= SESSION.length) { showScore(); } else { showCard(); }
    return;
  }
  const userRaw = $('answer').value;
  const user    = normalise(userRaw);
  if (!user) return;
  const card    = SESSION[index];
  const correct = normalise(card.sound);
  answered = true;
  $('submit-btn').textContent = 'Next →';
  $('hint-btn').style.pointerEvents = 'none';

  if (user === correct) {
    if (!hintUsed) {
      score++;
      $('feedback').textContent = '✓ Correct! "' + card.sound + '"';
      $('feedback').className   = 'feedback correct';
    } else {
      $('feedback').textContent = '✓ Correct — but hint was used';
      $('feedback').className   = 'feedback hint';
      mistakes.push({ char: card.char, correct: card.sound, given: '(hint used)' });
    }
  } else {
    $('feedback').textContent = '✗ It\'s "' + card.sound + '"';
    $('feedback').className   = 'feedback incorrect';
    mistakes.push({ char: card.char, correct: card.sound, given: userRaw.trim() });
  }
}

function showScore() {
  $('quiz-view').style.display  = 'none';
  $('score-view').style.display = 'flex';
  $('progress').style.width     = '100%';
  const pct = score / SESSION.length;
  $('score-big').textContent = score;
  $('score-big').className   = 'score-big ' + (pct >= 0.8 ? 'good' : 'bad');
  $('score-sub').textContent = pct >= 0.8 ? 'Great work! Хорошо!' : 'Keep practising!';
  $('score-label').textContent = 'out of ' + SESSION.length + ' correct';
  const ml = $('mistakes-list');
  if (mistakes.length > 0) {
    ml.style.display = 'block';
    $('mistakes-rows').innerHTML = mistakes.map(function(m) {
      return '<div class="mistake-row">' +
        '<span class="m-char">' + m.char + '</span>' +
        '<span class="m-right">✓ ' + m.correct + '</span>' +
        '<span class="m-wrong">✗ ' + m.given + '</span>' +
      '</div>';
    }).join('');
  } else {
    ml.style.display = 'none';
  }
}

function restart() {
  $('score-view').style.display    = 'none';
  $('quiz-view').style.display     = 'flex';
  $('mistakes-list').style.display = 'none';
  $('mistakes-rows').innerHTML     = '';
  initSession();
  showCard();
}

$('answer').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') checkAnswer();
});
</script>
</body>
</html>`;

// ── Screen ────────────────────────────────────────────────────────────────────
export default function RussianFlashcardsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScreenHeader title="Russian Flashcards" />
      <WebView
        source={{ html: HTML }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        originWhitelist={["*"]}
        javaScriptEnabled
        keyboardDisplayRequiresUserAction={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#0b0b0c" },
  webview: { flex: 1, backgroundColor: "#0b0b0c" },
});
