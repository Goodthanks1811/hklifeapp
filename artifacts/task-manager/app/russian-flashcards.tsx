import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";

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
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  background: #0b0b0c;
  color: #fff;
  min-height: 100vh;
  padding: 24px 20px;
}

.screen { display: none; }
.screen.active { display: block; }

.progress-bar-bg {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 4px;
  background: rgba(255,255,255,0.08);
  z-index: 100;
}
.progress-bar-fill {
  height: 4px;
  background: #E03131;
  border-radius: 0 2px 2px 0;
  transition: width 0.4s ease;
}

/* ── Start screen ── */
.start-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  text-align: center;
}
.flag { font-size: 64px; margin-bottom: 16px; }
.title { font-size: 26px; font-weight: 700; margin-bottom: 6px; }
.subtitle { font-size: 14px; color: rgba(255,255,255,0.4); margin-bottom: 40px; }

.session-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: rgba(255,255,255,0.35);
  margin-bottom: 14px;
}
.pills {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 36px;
}
.pill {
  padding: 11px 22px;
  border-radius: 100px;
  border: 1.5px solid rgba(255,255,255,0.18);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.65);
  font-size: 16px;
  font-weight: 600;
  font-family: -apple-system, sans-serif;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.pill.active {
  background: #E03131;
  border-color: #E03131;
  color: #fff;
}

/* ── Shared button ── */
.btn {
  display: block;
  width: 100%;
  padding: 17px 24px;
  font-size: 16px;
  font-weight: 700;
  font-family: -apple-system, sans-serif;
  border: none;
  border-radius: 12px;
  background: #E03131;
  color: #fff;
  text-align: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.btn:active { opacity: 0.75; }

/* ── Quiz screen ── */
.quiz-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 80vh;
  justify-content: center;
}
.card {
  width: 100%;
  max-width: 480px;
  background: #1A1A1A;
  border: 1px solid #2A2A2A;
  border-radius: 20px;
  padding: 48px 32px;
  text-align: center;
  margin-bottom: 20px;
}
.card-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: rgba(255,255,255,0.35);
  margin-bottom: 12px;
}
.card-char {
  font-size: 120px;
  line-height: 1;
  font-weight: bold;
  color: #fff;
  margin-bottom: 10px;
}
.card-counter {
  font-size: 13px;
  color: rgba(255,255,255,0.3);
}
.answer-input {
  width: 100%;
  max-width: 480px;
  padding: 16px 18px;
  font-size: 18px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  background: transparent;
  color: #fff;
  outline: none;
  -webkit-appearance: none;
  margin-bottom: 14px;
  font-family: -apple-system, sans-serif;
}
.answer-input:focus { border-color: rgba(255,255,255,0.35); }
.answer-input::placeholder { color: rgba(255,255,255,0.25); }

.btn-row {
  width: 100%;
  max-width: 480px;
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}
.btn-hint {
  background: rgba(255,255,255,0.07);
  border: 1.5px solid rgba(255,255,255,0.12);
  width: auto;
  flex-shrink: 0;
  padding-left: 22px;
  padding-right: 22px;
  white-space: nowrap;
}
.btn-hint.revealed {
  background: rgba(255,200,50,0.12);
  border-color: rgba(255,200,50,0.35);
  color: #ffc832;
}
.feedback {
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  min-height: 22px;
  color: transparent;
}
.feedback.correct   { color: #2cb67d; }
.feedback.incorrect { color: #ff6b6b; }
.feedback.hint      { color: #ffc832; }

/* ── Score screen ── */
.score-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 80vh;
  justify-content: center;
  text-align: center;
}
.score-emoji { font-size: 64px; margin-bottom: 14px; }
.score-title { font-size: 26px; font-weight: 700; margin-bottom: 6px; }
.score-sub   { font-size: 15px; color: rgba(255,255,255,0.45); margin-bottom: 28px; }
.score-big   { font-size: 88px; font-weight: 800; line-height: 1; margin-bottom: 4px; }
.score-big.good { color: #2cb67d; }
.score-big.bad  { color: #E03131; }
.score-label { font-size: 13px; color: rgba(255,255,255,0.35); margin-bottom: 28px; }
.mistakes-box {
  width: 100%;
  max-width: 480px;
  text-align: left;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 28px;
}
.mistakes-box h3 {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: rgba(255,255,255,0.35);
  margin-bottom: 12px;
}
.mistake-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  font-size: 14px;
  gap: 8px;
}
.mistake-row:last-child { border-bottom: none; }
.m-char  { font-size: 22px; font-weight: bold; min-width: 28px; }
.m-right { color: #2cb67d; }
.m-wrong { color: #ff6b6b; }
.score-btn { max-width: 480px; width: 100%; }
</style>
</head>
<body>

<div class="progress-bar-bg">
  <div class="progress-bar-fill" id="progress" style="width:0%"></div>
</div>

<div id="screen-start" class="screen active">
  <div class="start-wrap">
    <div class="flag">🇷🇺</div>
    <div class="title">Russian Alphabet</div>
    <div class="subtitle">33 letters · type the sound</div>
    <div class="session-label">Cards per session</div>
    <div class="pills">
      <button class="pill active" id="pill-5"  onclick="selectPill(5)">5</button>
      <button class="pill"        id="pill-10" onclick="selectPill(10)">10</button>
      <button class="pill"        id="pill-15" onclick="selectPill(15)">15</button>
      <button class="pill"        id="pill-20" onclick="selectPill(20)">20</button>
      <button class="pill"        id="pill-33" onclick="selectPill(33)">All</button>
    </div>
    <button class="btn" onclick="startSession()">Start</button>
  </div>
</div>

<div id="screen-quiz" class="screen">
  <div class="quiz-wrap">
    <div class="card">
      <div class="card-label">What sound does this make?</div>
      <div class="card-char" id="char"></div>
      <div class="card-counter" id="counter"></div>
    </div>
    <input class="answer-input" id="answer" type="text"
      placeholder="Type the sound…"
      autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" />
    <div class="btn-row">
      <button class="btn" id="submit-btn" onclick="checkAnswer()">Check</button>
      <button class="btn btn-hint" id="hint-btn" onclick="showHint()">Hint</button>
    </div>
    <div class="feedback" id="feedback"></div>
  </div>
</div>

<div id="screen-score" class="screen">
  <div class="score-wrap">
    <div class="score-emoji">🏆</div>
    <div class="score-title">Session Complete!</div>
    <div class="score-sub" id="score-sub"></div>
    <div class="score-big" id="score-big"></div>
    <div class="score-label" id="score-label"></div>
    <div class="mistakes-box" id="mistakes-box" style="display:none">
      <h3>Review These</h3>
      <div id="mistakes-rows"></div>
    </div>
    <button class="btn score-btn" onclick="restart()">Play Again</button>
  </div>
</div>

<script>
var ALPHABET = ${JSON.stringify(ALPHABET)};
var selectedSize = 5;
var SESSION = [], idx = 0, score = 0, mistakes = [], answered = false, hintUsed = false;

function g(id) { return document.getElementById(id); }

function show(screenId) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  g(screenId).classList.add('active');
}

function selectPill(n) {
  selectedSize = n;
  document.querySelectorAll('.pill').forEach(function(p) { p.classList.remove('active'); });
  g('pill-' + n).classList.add('active');
}

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function startSession() {
  SESSION  = shuffle(ALPHABET).slice(0, selectedSize);
  idx      = 0; score = 0; mistakes = [];
  answered = false; hintUsed = false;
  show('screen-quiz');
  showCard();
}

function showCard() {
  var card = SESSION[idx];
  g('char').textContent     = card.char;
  g('counter').textContent  = (idx + 1) + ' / ' + SESSION.length;
  g('progress').style.width = (idx / SESSION.length * 100) + '%';
  g('answer').value         = '';
  g('feedback').textContent = '';
  g('feedback').className   = 'feedback';
  g('submit-btn').textContent     = 'Check';
  g('hint-btn').textContent       = 'Hint';
  g('hint-btn').className         = 'btn btn-hint';
  g('hint-btn').style.pointerEvents = '';
  answered = false; hintUsed = false;
  setTimeout(function() { g('answer').focus(); }, 200);
}

function showHint() {
  if (answered) return;
  hintUsed = true;
  g('feedback').textContent = '💡 "' + SESSION[idx].sound + '"';
  g('feedback').className   = 'feedback hint';
  g('hint-btn').textContent = '✓ Shown';
  g('hint-btn').className   = 'btn btn-hint revealed';
  g('hint-btn').style.pointerEvents = 'none';
}

function norm(s) { return s.trim().toLowerCase().replace(/[^a-z ]/g, ''); }

function checkAnswer() {
  if (answered) {
    idx++;
    if (idx >= SESSION.length) { showScore(); } else { showCard(); }
    return;
  }
  var raw = g('answer').value;
  var user = norm(raw);
  if (!user) return;
  var correct = norm(SESSION[idx].sound);
  answered = true;
  g('submit-btn').textContent = 'Next →';
  g('hint-btn').style.pointerEvents = 'none';
  if (user === correct) {
    if (!hintUsed) {
      score++;
      g('feedback').textContent = '✓ Correct! "' + SESSION[idx].sound + '"';
      g('feedback').className   = 'feedback correct';
    } else {
      g('feedback').textContent = '✓ Correct — hint used';
      g('feedback').className   = 'feedback hint';
      mistakes.push({ char: SESSION[idx].char, correct: SESSION[idx].sound, given: '(hint)' });
    }
  } else {
    g('feedback').textContent = '✗ It\'s "' + SESSION[idx].sound + '"';
    g('feedback').className   = 'feedback incorrect';
    mistakes.push({ char: SESSION[idx].char, correct: SESSION[idx].sound, given: raw.trim() });
  }
}

function showScore() {
  show('screen-score');
  g('progress').style.width = '100%';
  var pct = score / SESSION.length;
  g('score-big').textContent   = score;
  g('score-big').className     = 'score-big ' + (pct >= 0.8 ? 'good' : 'bad');
  g('score-sub').textContent   = pct >= 0.8 ? 'Great work! Хорошо!' : 'Keep practising!';
  g('score-label').textContent = 'out of ' + SESSION.length + ' correct';
  if (mistakes.length) {
    g('mistakes-box').style.display = 'block';
    g('mistakes-rows').innerHTML = mistakes.map(function(m) {
      return '<div class="mistake-row"><span class="m-char">' + m.char +
        '</span><span class="m-right">✓ ' + m.correct +
        '</span><span class="m-wrong">✗ ' + m.given + '</span></div>';
    }).join('');
  } else {
    g('mistakes-box').style.display = 'none';
  }
}

function restart() {
  g('mistakes-box').style.display = 'none';
  startSession();
}

g('answer').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') checkAnswer();
});
</script>
</body>
</html>`;

export default function RussianFlashcardsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScreenHeader title="Russian Flashcards" />
      <WebView
        source={{ html: HTML }}
        style={styles.webview}
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
