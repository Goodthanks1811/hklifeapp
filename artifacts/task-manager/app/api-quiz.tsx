import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ScreenHeader } from '@/components/ScreenHeader';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>API Fundamentals</title>
<style>
:root {
  --bg: #0b0b0c; --surface: #141416; --surface2: #1c1c1f; --border: #2a2a2e;
  --red: rgb(255,30,30); --green: #22c55e; --yellow: #f59e0b; --blue: #3b82f6;
  --text: #f0f0f2; --text2: #8a8a96; --text3: #4a4a56;
}
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
body { font-family: -apple-system, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 24px; }
.screen { display: none; flex-direction: column; align-items: center; width: 100%; max-width: 560px; }
.screen.active { display: flex; }

.home-badge { font-family: monospace; font-size: 10px; letter-spacing: 0.2em; color: var(--red); text-transform: uppercase; margin-bottom: 16px; margin-top: 8px; }
.home-title { font-size: 38px; font-weight: 700; letter-spacing: -1px; line-height: 1.05; text-align: center; margin-bottom: 8px; }
.home-title span { color: var(--red); }
.home-sub { font-size: 14px; color: var(--text2); text-align: center; margin-bottom: 32px; line-height: 1.5; }
.home-cards { width: 100%; display: flex; flex-direction: column; gap: 10px; }
.home-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; display: flex; align-items: center; gap: 16px; cursor: pointer; position: relative; overflow: hidden; }
.home-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
.home-card.learn::before { background: var(--blue); }
.home-card.quiz::before { background: var(--red); }
.home-card:active { opacity: 0.6; }
.home-card-icon { font-size: 28px; flex-shrink: 0; }
.home-card-info { flex: 1; }
.home-card-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
.home-card-desc { font-size: 12px; color: var(--text2); line-height: 1.4; }
.home-card.learn .home-card-title { color: #60a5fa; }
.home-card.quiz .home-card-title { color: var(--red); }
.home-card-arrow { font-size: 18px; color: var(--text3); flex-shrink: 0; }

#learn { padding-top: 8px; }
#lesson { padding-top: 8px; }
#levelSelect { padding-top: 8px; }
#quiz { padding-top: 8px; }
#results { padding-top: 40px; text-align: center; }

.screen-header { width: 100%; display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
.back-btn { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: var(--surface); border: 1px solid var(--border); font-size: 18px; color: var(--text2); cursor: pointer; flex-shrink: 0; }
.back-btn:active { opacity: 0.6; }
.screen-header-title { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }

.topic-list { width: 100%; display: flex; flex-direction: column; gap: 8px; }
.topic-btn { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; cursor: pointer; width: 100%; text-align: left; }
.topic-btn:active { opacity: 0.6; }
.topic-icon { font-size: 20px; flex-shrink: 0; }
.topic-info { flex: 1; }
.topic-title { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
.topic-sub { font-size: 12px; color: var(--text2); }
.topic-arrow { font-size: 14px; color: var(--text3); }

.lesson-title { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; flex: 1; }
.lesson-body { width: 100%; display: flex; flex-direction: column; gap: 20px; padding-bottom: 16px; }
.lesson-section { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px; }
.lesson-section-title { font-family: monospace; font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--red); margin-bottom: 12px; }
.lesson-text { font-size: 14px; line-height: 1.7; color: var(--text2); }
.lesson-text strong { color: var(--text); font-weight: 600; }
.lesson-text code { font-family: monospace; font-size: 12px; background: var(--surface2); padding: 2px 6px; border-radius: 4px; color: #a5d6ff; }

.code-example { font-family: monospace; font-size: 12px; line-height: 1.8; background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; white-space: pre; overflow-x: auto; }
.code-example .cmt { color: var(--text3); font-style: italic; }
.code-example .key { color: #79c0ff; }
.code-example .str { color: #a5d6ff; }
.code-example .num { color: #f97316; }
.code-example .bool { color: #d2a8ff; }
.code-example .good { color: var(--green); }
.code-example .bad { color: var(--red); }

.pill-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.pill { font-family: monospace; font-size: 12px; padding: 5px 12px; border-radius: 20px; font-weight: 500; }
.pill.green { background: rgba(34,197,94,0.15); color: var(--green); }
.pill.red { background: rgba(255,30,30,0.1); color: var(--red); }

.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th { text-align: left; font-family: monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text3); padding: 0 0 10px 0; border-bottom: 1px solid var(--border); }
.tbl td { padding: 10px 0; border-bottom: 1px solid var(--border); vertical-align: top; }
.tbl tr:last-child td { border-bottom: none; }
.tbl td:first-child { font-family: monospace; font-size: 12px; color: #79c0ff; padding-right: 16px; white-space: nowrap; }
.tbl td:last-child { color: var(--text2); line-height: 1.4; }

.callout { border-radius: 10px; padding: 12px 14px; font-size: 13px; line-height: 1.5; display: flex; gap: 10px; align-items: flex-start; }
.callout.tip { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); color: #93c5fd; }
.callout.warn { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2); color: #fcd34d; }
.callout.good { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2); color: #86efac; }
.callout-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }

.lesson-nav { display: flex; gap: 10px; width: 100%; padding-bottom: 8px; }
.lesson-nav-btn { flex: 1; padding: 13px; border-radius: 10px; font-size: 14px; font-weight: 600; border: none; cursor: pointer; text-align: center; }
.lesson-nav-btn:active { opacity: 0.7; }
.lesson-nav-btn.prev { background: var(--surface); border: 1px solid var(--border); color: var(--text); }
.lesson-nav-btn.next { background: var(--red); color: white; }
.lesson-nav-btn.quiz-cta { background: var(--green); color: white; flex: 2; }

.level-cards { width: 100%; display: flex; flex-direction: column; gap: 10px; }
.level-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px 20px; display: flex; align-items: center; gap: 16px; position: relative; overflow: hidden; cursor: pointer; }
.level-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
.level-card.beginner::before { background: var(--green); }
.level-card.intermediate::before { background: var(--yellow); }
.level-card.advanced::before { background: var(--red); }
.level-card:active { opacity: 0.6; }
.level-icon { font-size: 26px; width: 40px; text-align: center; flex-shrink: 0; }
.level-info { flex: 1; }
.level-name { font-size: 15px; font-weight: 600; margin-bottom: 3px; }
.level-desc { font-size: 12px; color: var(--text2); line-height: 1.4; }
.level-count { font-family: monospace; font-size: 11px; color: var(--text3); }
.level-card.beginner .level-name { color: var(--green); }
.level-card.intermediate .level-name { color: var(--yellow); }
.level-card.advanced .level-name { color: var(--red); }

.quiz-header { width: 100%; display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.quiz-meta { flex: 1; }
.quiz-level-badge { font-family: monospace; font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 2px; }
.quiz-progress-text { font-size: 12px; color: var(--text2); }
.quiz-score-badge { font-family: monospace; font-size: 13px; padding: 4px 10px; border-radius: 20px; background: var(--surface); border: 1px solid var(--border); }
.progress-bar-wrap { width: 100%; height: 2px; background: var(--border); margin-bottom: 20px; border-radius: 2px; }
.progress-bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
.q-type-pill { display: inline-flex; font-family: monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; margin-bottom: 14px; }
.q-type-pill.choice { background: rgba(20,184,166,0.15); color: #2dd4bf; }
.q-type-pill.spot { background: rgba(99,102,241,0.15); color: #818cf8; }
.q-text { font-size: 16px; font-weight: 500; line-height: 1.5; margin-bottom: 16px; width: 100%; }
.code-block { font-family: monospace; font-size: 12px; line-height: 1.7; background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; white-space: pre; overflow-x: auto; width: 100%; }
.cmt { color: var(--text3); font-style: italic; } .key { color: #79c0ff; } .str { color: #a5d6ff; } .num { color: #f97316; } .bool { color: #d2a8ff; }
.options-list { width: 100%; display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.option-btn { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 13px 16px; color: var(--text); font-family: -apple-system, sans-serif; font-size: 14px; text-align: left; line-height: 1.4; width: 100%; cursor: pointer; }
.option-btn:active { opacity: 0.6; }
.option-btn.correct { background: rgba(34,197,94,0.15); border-color: var(--green); color: var(--green); }
.option-btn.wrong { background: rgba(255,30,30,0.1); border-color: var(--red); color: var(--red); }
.option-btn.dimmed { opacity: 0.3; }
.feedback-box { width: 100%; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; display: none; gap: 10px; align-items: flex-start; }
.feedback-box.show { display: flex; }
.feedback-box.correct-fb { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); }
.feedback-box.wrong-fb { background: rgba(255,30,30,0.08); border: 1px solid rgba(255,30,30,0.3); }
.fb-icon { font-size: 18px; flex-shrink: 0; }
.fb-text { font-size: 13px; line-height: 1.5; }
.fb-text strong { display: block; margin-bottom: 4px; }
.next-btn { width: 100%; padding: 14px; background: var(--red); border: none; border-radius: 10px; color: white; font-family: -apple-system, sans-serif; font-size: 15px; font-weight: 600; text-align: center; display: none; cursor: pointer; }
.next-btn.show { display: block; }
.next-btn:active { opacity: 0.7; }

.results-grade { font-size: 72px; font-weight: 700; letter-spacing: -3px; line-height: 1; margin-bottom: 4px; }
.results-label { font-family: monospace; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text2); margin-bottom: 20px; }
.streak-bar { display: flex; gap: 4px; margin-bottom: 24px; flex-wrap: wrap; justify-content: center; }
.streak-dot { width: 8px; height: 8px; border-radius: 50%; }
.streak-dot.hit { background: var(--green); } .streak-dot.miss { background: var(--red); }
.results-msg { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
.results-sub { font-size: 13px; color: var(--text2); line-height: 1.5; margin-bottom: 32px; max-width: 280px; }
.results-actions { width: 100%; display: flex; flex-direction: column; gap: 10px; max-width: 320px; }
.res-btn { padding: 14px; border-radius: 10px; font-family: -apple-system, sans-serif; font-size: 15px; font-weight: 600; border: none; text-align: center; cursor: pointer; }
.res-btn:active { opacity: 0.7; }
.res-btn.primary { background: var(--red); color: white; }
.res-btn.secondary { background: var(--surface); border: 1px solid var(--border); color: var(--text); }
.res-btn.tertiary { background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.2); }
</style>
</head>
<body>

<!-- HOME -->
<div id="home" class="screen active">
  <div class="home-badge">// learn &amp; test</div>
  <h1 class="home-title">API<span>.</span><br>Fundamentals</h1>
  <p class="home-sub">Learn the concepts, then test yourself.<br>Start with the guide or jump straight in.</p>
  <div class="home-cards">
    <div class="home-card learn" onclick="show('learn')">
      <div class="home-card-icon">📖</div>
      <div class="home-card-info">
        <div class="home-card-title">Learn</div>
        <div class="home-card-desc">JSON, REST, HTTP methods, status codes, auth — with examples and code</div>
      </div>
      <div class="home-card-arrow">→</div>
    </div>
    <div class="home-card quiz" onclick="show('levelSelect')">
      <div class="home-card-icon">⚡</div>
      <div class="home-card-info">
        <div class="home-card-title">Quiz</div>
        <div class="home-card-desc">Test your knowledge across beginner, intermediate, and advanced levels</div>
      </div>
      <div class="home-card-arrow">→</div>
    </div>
  </div>
</div>

<!-- LEARN -->
<div id="learn" class="screen">
  <div class="screen-header">
    <div class="back-btn" onclick="show('home')">←</div>
    <div class="screen-header-title">Learn</div>
  </div>
  <div class="topic-list">
    <div class="topic-btn" onclick="openLesson(0)"><div class="topic-icon">🧱</div><div class="topic-info"><div class="topic-title">What is an API?</div><div class="topic-sub">The basics — what APIs are and why they exist</div></div><div class="topic-arrow">→</div></div>
    <div class="topic-btn" onclick="openLesson(1)"><div class="topic-icon">📦</div><div class="topic-info"><div class="topic-title">JSON</div><div class="topic-sub">Syntax, data types, valid vs invalid</div></div><div class="topic-arrow">→</div></div>
    <div class="topic-btn" onclick="openLesson(2)"><div class="topic-icon">🌐</div><div class="topic-info"><div class="topic-title">HTTP Methods</div><div class="topic-sub">GET, POST, PUT, PATCH, DELETE</div></div><div class="topic-arrow">→</div></div>
    <div class="topic-btn" onclick="openLesson(3)"><div class="topic-icon">🔢</div><div class="topic-info"><div class="topic-title">Status Codes</div><div class="topic-sub">What 200, 201, 400, 401, 404, 500 mean</div></div><div class="topic-arrow">→</div></div>
    <div class="topic-btn" onclick="openLesson(4)"><div class="topic-icon">🏗️</div><div class="topic-info"><div class="topic-title">REST Principles</div><div class="topic-sub">Endpoints, naming, stateless, nested resources</div></div><div class="topic-arrow">→</div></div>
    <div class="topic-btn" onclick="openLesson(5)"><div class="topic-icon">🔐</div><div class="topic-info"><div class="topic-title">Auth &amp; Headers</div><div class="topic-sub">Bearer tokens, API keys, Content-Type</div></div><div class="topic-arrow">→</div></div>
    <div class="topic-btn" onclick="openLesson(6)"><div class="topic-icon">⚠️</div><div class="topic-info"><div class="topic-title">Errors &amp; Edge Cases</div><div class="topic-sub">Good error design, pagination, rate limiting</div></div><div class="topic-arrow">→</div></div>
  </div>
</div>

<!-- LESSON -->
<div id="lesson" class="screen">
  <div class="screen-header">
    <div class="back-btn" onclick="show('learn')">←</div>
    <div class="lesson-title" id="lessonTitle"></div>
  </div>
  <div class="lesson-body" id="lessonBody"></div>
  <div class="lesson-nav" id="lessonNav"></div>
</div>

<!-- LEVEL SELECT -->
<div id="levelSelect" class="screen">
  <div class="screen-header">
    <div class="back-btn" onclick="show('home')">←</div>
    <div class="screen-header-title">Pick a Level</div>
  </div>
  <div class="level-cards">
    <div class="level-card beginner" onclick="startQuiz('beginner')"><div class="level-icon">🟢</div><div class="level-info"><div class="level-name">Beginner</div><div class="level-desc">JSON basics, valid syntax, data types, arrays vs objects</div></div><div class="level-count">10 of 50</div></div>
    <div class="level-card intermediate" onclick="startQuiz('intermediate')"><div class="level-icon">🟡</div><div class="level-info"><div class="level-name">Intermediate</div><div class="level-desc">HTTP methods, status codes, REST principles, headers</div></div><div class="level-count">10 of 50</div></div>
    <div class="level-card advanced" onclick="startQuiz('advanced')"><div class="level-icon">🔴</div><div class="level-info"><div class="level-name">Advanced</div><div class="level-desc">Auth, pagination, security, API design patterns</div></div><div class="level-count">10 of 50</div></div>
  </div>
</div>

<!-- QUIZ -->
<div id="quiz" class="screen">
  <div class="quiz-header">
    <div class="back-btn" onclick="show('levelSelect')">←</div>
    <div class="quiz-meta">
      <div class="quiz-level-badge" id="qLevelBadge"></div>
      <div class="quiz-progress-text" id="qProgressText"></div>
    </div>
    <div class="quiz-score-badge" id="qScoreBadge">0 / 0</div>
  </div>
  <div class="progress-bar-wrap"><div class="progress-bar-fill" id="qProgressBar" style="width:0%"></div></div>
  <div class="q-type-pill" id="qTypePill"></div>
  <div class="q-text" id="qText"></div>
  <div class="code-block" id="qCode" style="display:none"></div>
  <div class="options-list" id="optionsList"></div>
  <div class="feedback-box" id="feedbackBox"><div class="fb-icon" id="fbIcon"></div><div class="fb-text" id="fbText"></div></div>
  <button class="next-btn" id="nextBtn" onclick="doNext()">Next</button>
</div>

<!-- RESULTS -->
<div id="results" class="screen">
  <div class="results-grade" id="resGrade"></div>
  <div class="results-label" id="resLabel"></div>
  <div class="streak-bar" id="resStreak"></div>
  <div class="results-msg" id="resMsg"></div>
  <div class="results-sub" id="resSub"></div>
  <div class="results-actions">
    <button class="res-btn primary" onclick="startQuiz(currentLevel)">Retry This Level</button>
    <button class="res-btn tertiary" onclick="show('learn')">Back to Learn</button>
    <button class="res-btn secondary" onclick="show('home')">Home</button>
  </div>
</div>

<script>
// ══════════════════════════════════════════
//  LESSONS
// ══════════════════════════════════════════
var LESSONS = [
  {
    title: "What is an API?",
    sections: [
      { h: "The Concept", c: '<p class="lesson-text">An <strong>API (Application Programming Interface)</strong> is a defined way for two pieces of software to talk to each other. Think of it like a waiter in a restaurant — you (the client) tell the waiter what you want, the waiter goes to the kitchen (the server), and brings back what you ordered.</p><br><p class="lesson-text">You never go into the kitchen yourself. You just use the interface — the menu and the waiter.</p>' },
      { h: "Client and Server", c: '<p class="lesson-text">In a web API:<br><br><strong>Client</strong> — the thing making the request (your app, browser, or script)<br><strong>Server</strong> — the thing responding with data<br><strong>Request</strong> — what the client sends<br><strong>Response</strong> — what the server sends back</p>' },
      { h: "A Real Example", c: '<div class="code-example"><span class="cmt">// You ask: give me user 42</span>\\nGET https://api.example.com/users/42\\n\\n<span class="cmt">// Server responds with:</span>\\n{\\n  <span class="key">"id"</span>: <span class="num">42</span>,\\n  <span class="key">"name"</span>: <span class="str">"Harry"</span>,\\n  <span class="key">"email"</span>: <span class="str">"harry@hk.com"</span>\\n}</div>' },
      { h: "Why APIs Exist", c: '<p class="lesson-text">APIs let services share data without sharing their entire codebase. Spotify exposes an API so other apps can search songs. Notion exposes an API so you can read and write your databases from scripts. The whole modern web is built on APIs talking to each other.</p>' }
    ]
  },
  {
    title: "JSON",
    sections: [
      { h: "What is JSON?", c: '<p class="lesson-text"><strong>JSON (JavaScript Object Notation)</strong> is the standard format for sending data through APIs. It is just text, structured as key-value pairs, that both sides can read and parse.</p>' },
      { h: "The 6 Data Types", c: '<div class="code-example">{\\n  <span class="key">"name"</span>:    <span class="str">"Harry"</span>,       <span class="cmt">// string</span>\\n  <span class="key">"age"</span>:     <span class="num">30</span>,            <span class="cmt">// number</span>\\n  <span class="key">"active"</span>:  <span class="bool">true</span>,          <span class="cmt">// boolean</span>\\n  <span class="key">"score"</span>:   <span class="bool">null</span>,          <span class="cmt">// null</span>\\n  <span class="key">"tags"</span>:    [<span class="str">"api"</span>, <span class="str">"js"</span>], <span class="cmt">// array</span>\\n  <span class="key">"address"</span>: {              <span class="cmt">// object</span>\\n    <span class="key">"city"</span>: <span class="str">"Sydney"</span>\\n  }\\n}</div>' },
      { h: "The Rules", c: '<div class="code-example"><span class="bad">{ name: "Harry" }</span>        <span class="cmt">// keys must be quoted</span>\\n<span class="bad">{ "name": \\'Harry\\' }</span>      <span class="cmt">// no single quotes</span>\\n<span class="bad">{ "active": True }</span>       <span class="cmt">// booleans are lowercase</span>\\n<span class="bad">{ "tags": ["a", "b", ] }</span> <span class="cmt">// no trailing commas</span>\\n\\n<span class="good">{ "name": "Harry" }</span>       <span class="cmt">// valid</span>\\n<span class="good">{ "active": true }</span>        <span class="cmt">// valid</span>\\n<span class="good">{ "tags": ["a", "b"] }</span>   <span class="cmt">// valid</span></div>' },
      { h: "Arrays vs Objects", c: '<div class="code-example"><span class="cmt">// Object — key/value pairs in { }</span>\\n{ <span class="key">"name"</span>: <span class="str">"Harry"</span>, <span class="key">"age"</span>: <span class="num">30</span> }\\n\\n<span class="cmt">// Array — ordered list in [ ]</span>\\n[<span class="str">"apple"</span>, <span class="str">"mango"</span>, <span class="str">"banana"</span>]\\n\\n<span class="cmt">// Array of objects — very common in APIs</span>\\n[\\n  { <span class="key">"id"</span>: <span class="num">1</span>, <span class="key">"name"</span>: <span class="str">"Ana"</span> },\\n  { <span class="key">"id"</span>: <span class="num">2</span>, <span class="key">"name"</span>: <span class="str">"Leo"</span> }\\n]</div>' }
    ]
  },
  {
    title: "HTTP Methods",
    sections: [
      { h: "The 5 Core Methods", c: '<p class="lesson-text">Every API request uses an HTTP method that describes <strong>what you want to do</strong> with the resource. The URL says what, the method says how.</p><br><table class="tbl"><tr><th>Method</th><th>What it does</th></tr><tr><td>GET</td><td>Read a resource. Never changes data.</td></tr><tr><td>POST</td><td>Create a new resource.</td></tr><tr><td>PUT</td><td>Replace an entire resource.</td></tr><tr><td>PATCH</td><td>Update specific fields of a resource.</td></tr><tr><td>DELETE</td><td>Remove a resource.</td></tr></table>' },
      { h: "In Practice", c: '<div class="code-example"><span class="cmt">// Read all users</span>\\n<span class="good">GET</span>    /users\\n\\n<span class="cmt">// Read one user</span>\\n<span class="good">GET</span>    /users/42\\n\\n<span class="cmt">// Create a new user</span>\\n<span class="good">POST</span>   /users\\n\\n<span class="cmt">// Update just the email</span>\\n<span class="good">PATCH</span>  /users/42\\n\\n<span class="cmt">// Replace the whole record</span>\\n<span class="good">PUT</span>    /users/42\\n\\n<span class="cmt">// Delete a user</span>\\n<span class="good">DELETE</span> /users/42</div>' },
      { h: "Idempotency", c: '<p class="lesson-text"><strong>Idempotent</strong> means calling it multiple times has the same effect as calling it once.</p><br><div class="pill-row"><span class="pill green">GET ✓</span><span class="pill green">PUT ✓</span><span class="pill green">DELETE ✓</span><span class="pill red">POST ✗</span></div><br><p class="lesson-text" style="margin-top:12px">Calling <code>POST /users</code> 3 times creates 3 users. Calling <code>DELETE /users/42</code> 3 times still just deletes user 42.</p>' },
      { h: "PATCH vs PUT", c: '<div class="code-example"><span class="cmt">// PUT — send the ENTIRE object</span>\\nPUT /users/42\\n{ "name": "Harry", "email": "new@hk.com", "role": "admin" }\\n\\n<span class="cmt">// PATCH — send ONLY what changed</span>\\nPATCH /users/42\\n{ "email": "new@hk.com" }</div><br><div class="callout tip"><div class="callout-icon">💡</div>Use PATCH when you only want to change one or two fields. Use PUT when replacing the whole record.</div>' }
    ]
  },
  {
    title: "Status Codes",
    sections: [
      { h: "The 5 Ranges", c: '<table class="tbl"><tr><th>Range</th><th>Meaning</th></tr><tr><td>1xx</td><td>Informational</td></tr><tr><td>2xx</td><td>Success — it worked</td></tr><tr><td>3xx</td><td>Redirect — go elsewhere</td></tr><tr><td>4xx</td><td>Client error — you did something wrong</td></tr><tr><td>5xx</td><td>Server error — we did something wrong</td></tr></table>' },
      { h: "The Ones You Will Use", c: '<table class="tbl"><tr><th>Code</th><th>Meaning</th></tr><tr><td>200 OK</td><td>Request succeeded.</td></tr><tr><td>201 Created</td><td>Resource was created.</td></tr><tr><td>204 No Content</td><td>Succeeded, nothing to return.</td></tr><tr><td>400 Bad Request</td><td>Your request was malformed.</td></tr><tr><td>401 Unauthorised</td><td>Not authenticated — who are you?</td></tr><tr><td>403 Forbidden</td><td>Authenticated but not allowed.</td></tr><tr><td>404 Not Found</td><td>Resource does not exist at that URL.</td></tr><tr><td>429 Too Many</td><td>Rate limit hit — slow down.</td></tr><tr><td>500 Server Error</td><td>Something broke on the server.</td></tr></table>' },
      { h: "401 vs 403", c: '<div class="code-example"><span class="cmt">// 401 — I don\\'t know who you are</span>\\n<span class="bad">401 Unauthorized</span>\\n<span class="cmt">Send credentials and try again</span>\\n\\n<span class="cmt">// 403 — I know you, but no</span>\\n<span class="bad">403 Forbidden</span>\\n<span class="cmt">Logged in but don\\'t have permission</span></div><br><div class="callout tip"><div class="callout-icon">💡</div>Use 403 when a resource exists but the user cannot access it. This also prevents leaking whether a resource exists at all.</div>' },
      { h: "Correct Codes Matter", c: '<div class="code-example"><span class="cmt">// Wrong — 200 for a creation</span>\\n<span class="bad">POST /users → 200 OK</span>\\n\\n<span class="cmt">// Right</span>\\n<span class="good">POST /users → 201 Created</span>\\n<span class="good">Location: /users/42</span>\\n\\n<span class="cmt">// Wrong — 200 wrapping an error</span>\\n<span class="bad">GET /users/999 → 200 OK { "error": "not found" }</span>\\n\\n<span class="cmt">// Right</span>\\n<span class="good">GET /users/999 → 404 Not Found</span></div>' }
    ]
  },
  {
    title: "REST Principles",
    sections: [
      { h: "What is REST?", c: '<p class="lesson-text"><strong>REST (Representational State Transfer)</strong> is a set of conventions for designing APIs. It is not a strict standard — it is a style. When an API follows these conventions it is called RESTful.</p>' },
      { h: "Nouns Not Verbs", c: '<div class="code-example"><span class="bad">GET /getUsers</span>         <span class="cmt">// redundant verb</span>\\n<span class="bad">POST /createUser</span>      <span class="cmt">// redundant verb</span>\\n<span class="bad">DELETE /deleteUser/42</span> <span class="cmt">// redundant verb</span>\\n\\n<span class="good">GET    /users</span>         <span class="cmt">// clean</span>\\n<span class="good">POST   /users</span>         <span class="cmt">// clean</span>\\n<span class="good">DELETE /users/42</span>      <span class="cmt">// clean</span></div>' },
      { h: "Nested Resources", c: '<div class="code-example"><span class="cmt">// Orders belonging to user 5</span>\\n<span class="good">GET /users/5/orders</span>\\n\\n<span class="cmt">// A specific order</span>\\n<span class="good">GET /users/5/orders/12</span>\\n\\n<span class="cmt">// Comments on post 99</span>\\n<span class="good">GET /posts/99/comments</span></div>' },
      { h: "Stateless", c: '<p class="lesson-text">Every request must contain <strong>all the information needed</strong> to process it. The server stores no session between requests.</p><br><div class="callout tip"><div class="callout-icon">💡</div>This is why you send your auth token on every request — the server does not remember you from last time.</div>' },
      { h: "Versioning", c: '<div class="code-example"><span class="good">https://api.example.com/v1/users</span>  <span class="cmt">// clean</span>\\n<span class="good">https://api.example.com/v2/users</span>  <span class="cmt">// clean</span>\\n\\n<span class="bad">https://v1.api.example.com/users</span>  <span class="cmt">// hard to manage</span>\\n<span class="bad">https://api.example.com/users?v=1</span> <span class="cmt">// messy</span></div>' }
    ]
  },
  {
    title: "Auth & Headers",
    sections: [
      { h: "What are Headers?", c: '<p class="lesson-text">Headers are metadata sent alongside your request. They tell the server about format, identity, and expectations. The actual data goes in the body.</p><br><table class="tbl"><tr><th>Header</th><th>Purpose</th></tr><tr><td>Authorization</td><td>Who you are — your token or key</td></tr><tr><td>Content-Type</td><td>Format of the body you are sending</td></tr><tr><td>Accept</td><td>Format you want back</td></tr><tr><td>X-API-Key</td><td>API key (common custom header)</td></tr></table>' },
      { h: "Bearer Tokens", c: '<div class="code-example"><span class="cmt">// Correct</span>\\n<span class="good">Authorization: Bearer eyJhbGciOiJIUzI1...</span>\\n\\n<span class="cmt">// Wrong</span>\\n<span class="bad">Authorization: token eyJhbGciOiJIUzI1...</span>\\n<span class="bad">Token: eyJhbGciOiJIUzI1...</span>\\n<span class="bad">Auth: eyJhbGciOiJIUzI1...</span></div>' },
      { h: "Content-Type", c: '<div class="code-example"><span class="cmt">// Always set when sending JSON</span>\\n<span class="good">Content-Type: application/json</span>\\n\\n<span class="cmt">// Wrong — server may not parse the body</span>\\nPOST /users\\nContent-Type: <span class="bad">text/plain</span>\\nBody: { "name": "Harry" }</div><br><div class="callout warn"><div class="callout-icon">⚠️</div>One of the most common beginner mistakes. Always set Content-Type: application/json when POSTing or PATCHing.</div>' },
      { h: "API Key Security", c: '<div class="code-example"><span class="cmt">// Never — in URL params or frontend code</span>\\n<span class="bad">https://api.example.com/data?api_key=abc123</span>\\n<span class="bad">const API_KEY = "abc123"; // in frontend JS</span>\\n\\n<span class="cmt">// Correct — server-side env var, sent via header</span>\\n<span class="good">Authorization: Bearer abc123</span></div>' }
    ]
  },
  {
    title: "Errors & Edge Cases",
    sections: [
      { h: "Good Error Responses", c: '<div class="code-example"><span class="cmt">// Useless</span>\\n<span class="bad">{ "ok": false }</span>\\n\\n<span class="cmt">// Good</span>\\n<span class="good">{\\n  "code": 400,\\n  "error": "validation_error",\\n  "message": "Email is required",\\n  "field": "email"\\n}</span></div>' },
      { h: "Pagination", c: '<div class="code-example"><span class="cmt">// Missing total — client is flying blind</span>\\n<span class="bad">{ "data": [...], "page": 1 }</span>\\n\\n<span class="cmt">// Full pagination response</span>\\n<span class="good">{\\n  "data": [...],\\n  "page": 1,\\n  "per_page": 20,\\n  "total_count": 347,\\n  "total_pages": 18\\n}</span></div>' },
      { h: "Rate Limiting", c: '<div class="code-example"><span class="cmt">// Bad — client does not know when to retry</span>\\n<span class="bad">429 { "error": "rate_limit_exceeded" }</span>\\n\\n<span class="cmt">// Good</span>\\n<span class="good">429\\nRetry-After: 30\\n{ "error": "rate_limit_exceeded", "retry_after": 30 }</span></div><br><div class="callout tip"><div class="callout-icon">💡</div>Use exponential backoff on 429 — wait 1s, then 2s, then 4s, then 8s. Add random jitter.</div>' },
      { h: "Never Leak Sensitive Data", c: '<div class="code-example"><span class="cmt">// Raw DB row — leaks everything</span>\\n<span class="bad">{ "password_hash": "$2b$10...", "stripe_id": "cus_ABC" }</span>\\n\\n<span class="cmt">// Serialized — only what client needs</span>\\n<span class="good">{ "id": 5, "name": "Harry", "email": "h@hk.com" }</span></div><br><div class="callout warn"><div class="callout-icon">⚠️</div>Always whitelist fields via a serializer. Never send raw database rows.</div>' }
    ]
  }
];

var currentLesson = 0;

function openLesson(index) {
  currentLesson = index;
  var lesson = LESSONS[index];
  document.getElementById('lessonTitle').textContent = lesson.title;
  var bodyHTML = '';
  for (var i = 0; i < lesson.sections.length; i++) {
    var s = lesson.sections[i];
    bodyHTML += '<div class="lesson-section"><div class="lesson-section-title">' + s.h + '</div>' + s.c + '</div>';
  }
  document.getElementById('lessonBody').innerHTML = bodyHTML;
  var navHTML = '';
  if (index > 0) navHTML += '<button class="lesson-nav-btn prev" onclick="openLesson(' + (index-1) + ')">← Previous</button>';
  if (index < LESSONS.length - 1) navHTML += '<button class="lesson-nav-btn next" onclick="openLesson(' + (index+1) + ')">Next →</button>';
  else navHTML += '<button class="lesson-nav-btn quiz-cta" onclick="show(\\'levelSelect\\')">Take the Quiz →</button>';
  document.getElementById('lessonNav').innerHTML = navHTML;
  show('lesson');
}

// ══════════════════════════════════════════
//  QUESTION BANK — 50 per level
// ══════════════════════════════════════════
var QB = {
  beginner: [
    { type:"choice", q:"Which of these is valid JSON?", options:['{ name: "Harry", age: 30 }','{ "name": "Harry", "age": 30 }','{ "name": \\'Harry\\', "age": 30 }','{ "name": "Harry", age: 30, }'], answer:1, explain:'JSON requires ALL keys to be in double quotes. Single quotes are not allowed and trailing commas are invalid.' },
    { type:"choice", q:"In JSON, arrays use [ ] and objects use { }. True or false?", options:["True","False"], answer:0, explain:'Correct. Arrays use [ ] and objects use { }.' },
    { type:"spot", q:"There is ONE error in this JSON. Which line is wrong?", code:'{\\n  "user": "harry",\\n  "active": true,\\n  "score": 42,\\n  "tags": ["api", "json", "rest"\\n}', options:["Line 1 - missing opening brace","Line 5 - array not closed with ]","Line 4 - numbers need quotes","Line 3 - booleans need quotes"], answer:1, explain:'The array opens with [ but is never closed with ] before the }. This makes the entire JSON invalid.' },
    { type:"choice", q:"Which of these is NOT a valid JSON data type?", options:["String","Number","Undefined","Boolean"], answer:2, explain:'"undefined" does not exist in JSON. Valid types: string, number, boolean, null, array, object.' },
    { type:"choice", q:"Which represents an array of user objects correctly?", options:['{"users": {"name":"Ana"},{"name":"Leo"}}','{"users": [{"name":"Ana"},{"name":"Leo"}]}','{"users": ["name":"Ana","name":"Leo"]}','{"users": [name:"Ana"]}'], answer:1, explain:'An array of objects uses [ ] containing { } items separated by commas.' },
    { type:"choice", q:"What does API stand for?", options:["Application Programming Interface","Automated Protocol Integration","Application Process Input","Async Processing Interface"], answer:0, explain:'API = Application Programming Interface. It defines how two pieces of software communicate.' },
    { type:"spot", q:"Find the syntax error in this JSON:", code:'{\\n  "product": "MacBook",\\n  "price": 2499,\\n  "inStock": True,\\n  "colors": ["silver", "black"]\\n}', options:['price should be "2499"',"inStock: True - booleans must be lowercase","product key needs single quotes","Arrays cannot mix types"], answer:1, explain:'JSON booleans must be lowercase: true or false. True with a capital T throws a parse error.' },
    { type:"choice", q:"What is the correct way to represent null in JSON?", options:['"null"',"NULL","null","Null"], answer:2, explain:'null (lowercase, no quotes) is the empty value. "null" in quotes is just a string.' },
    { type:"choice", q:"Which correctly represents a nested object?", options:['{"address": {"city": "Sydney", "zip": "2000"}}','{"address": {city: "Sydney", zip: "2000"}}','{"address": ("city": "Sydney")}','{"address": ["city": "Sydney"]}'], answer:0, explain:'Nested objects use { } inside { }. Keys must always be quoted strings.' },
    { type:"choice", q:"In a REST API, what does endpoint refer to?", options:["The last line of code in an API","The specific URL path that accepts requests","The closing bracket of a JSON object","The developer who built the API"], answer:1, explain:'An endpoint is a specific URL the API exposes, e.g. /users or /products/42.' },
    { type:"spot", q:"How many errors are in this JSON?", code:'{\\n  "title": "Hello World",\\n  "views": "150",\\n  "published": true,\\n  "tags": ["tutorial", "api",]\\n}', options:["0 - it is valid","1 - trailing comma in the array","2 - trailing comma and views wrong type","3 errors total"], answer:1, explain:'Exactly 1 error: the trailing comma after api. Trailing commas are NOT allowed in JSON.' },
    { type:"choice", q:"Which parses correctly as a JSON number?", options:["42",'"42"',"'42'","42px"], answer:0, explain:'42 with no quotes is a valid JSON number. "42" is a string. Single quotes are invalid. 42px is not valid.' },
    { type:"choice", q:"What does the client send to the server in an API call?", options:["A response","A request","A database query","A render"], answer:1, explain:'The client sends a request. The server sends back a response.' },
    { type:"choice", q:"Which of these is a valid JSON boolean value?", options:['"true"',"True","TRUE","true"], answer:3, explain:'JSON booleans are lowercase: true and false. Quoted "true" is a string, not a boolean.' },
    { type:"spot", q:"What is wrong with this JSON?", code:'{\\n  "name": "Ana",\\n  "scores": [10, 20, 30,]\\n}', options:["Name needs to be a number","Trailing comma after 30 in the array","Scores should be an object not an array","Numbers in arrays need quotes"], answer:1, explain:'Trailing commas are not allowed in JSON arrays or objects.' },
    { type:"choice", q:"JSON stands for:", options:["JavaScript Object Notation","Java Syntax Object Node","JavaScript Online Network","JSON Serialised Object Notation"], answer:0, explain:'JSON = JavaScript Object Notation. Despite the name it is language-agnostic and used across all languages.' },
    { type:"choice", q:"Which is correct for an empty array in JSON?", options:["null","{}","[]","()"], answer:2, explain:'An empty array in JSON is []. An empty object is {}. null means no value at all.' },
    { type:"choice", q:"Which of these JSON strings is valid?", options:['"Hello World"',"'Hello World'","\`Hello World\`","Hello World"], answer:0, explain:'JSON strings must use double quotes. Single quotes, backticks, and bare strings are all invalid.' },
    { type:"choice", q:"What is the correct JSON for a list of three numbers?", options:['{"numbers": 1, 2, 3}','{"numbers": (1, 2, 3)}','{"numbers": [1, 2, 3]}','{"numbers": {1, 2, 3}}'], answer:2, explain:'A list of values in JSON is an array, written with square brackets: [1, 2, 3].' },
    { type:"spot", q:"Spot the issue:", code:'{\\n  "user": {\\n    "name": "Leo",\\n    "age": 25\\n  }\\n  "active": true\\n}', options:["age should be a string","Missing comma after the closing } of user","user should be an array","active needs to be in the user object"], answer:1, explain:'After the closing } of the user object there needs to be a comma before "active" because they are sibling properties.' },
    { type:"choice", q:"What does a REST API primarily use to transfer data?", options:["XML","CSV","JSON","HTML"], answer:2, explain:'JSON is the dominant data format for REST APIs. XML was common in older SOAP APIs but JSON has largely replaced it.' },
    { type:"choice", q:"Which is a valid JSON object with one key?", options:['{"key": value}','{"key": "value"}','{key: "value"}','[{"key": "value"}]'], answer:1, explain:'{"key": "value"} is correct. Keys must be quoted strings. Bare values without quotes are invalid.' },
    { type:"choice", q:"What does HTTP stand for?", options:["HyperText Transfer Protocol","High Transfer Text Protocol","HyperText Transmission Process","Hosted Text Transfer Protocol"], answer:0, explain:'HTTP = HyperText Transfer Protocol. It is the foundation of data communication on the web.' },
    { type:"choice", q:"In JSON, what is the difference between {} and []?", options:["{} is for strings, [] is for numbers","They are interchangeable","{ } is an object with key-value pairs, [ ] is an ordered list","{ } holds more data than [ ]"], answer:2, explain:'{ } creates an object (key-value pairs). [ ] creates an array (ordered list). They serve completely different purposes.' },
    { type:"spot", q:"What is the bug?", code:'[\\n  {"id": 1, "name": "Ana"},\\n  {"id": 2, "name": "Leo"}\\n  {"id": 3, "name": "Sam"}\\n]', options:["Arrays cannot contain objects","Missing comma after the second object","id values need quotes","name values need to be numbers"], answer:1, explain:'Items in a JSON array must be separated by commas. The comma is missing after the second object.' },
    { type:"choice", q:"Which value is falsy in JSON but still valid?", options:["0","false","null","All of the above"], answer:3, explain:'0, false, and null are all valid JSON values. They are all falsy in JavaScript when parsed.' },
    { type:"choice", q:"What is the purpose of an API endpoint?", options:["To store data permanently","To provide a specific URL that handles a specific operation","To connect two databases","To render HTML pages"], answer:1, explain:'An endpoint is a specific URL on the server that handles a specific operation, like GET /users or POST /orders.' },
    { type:"choice", q:"Which of these is a valid JSON number?", options:["3.14","3,14","'3.14'",'"3.14"'], answer:0, explain:'3.14 is a valid JSON number. Commas as decimal separators are invalid. Quoted numbers are strings not numbers.' },
    { type:"spot", q:"Find the error:", code:'{\\n  "item": "coffee",\\n  "price": 4.50,\\n  "available": TRUE\\n}', options:["Price decimals are not allowed","TRUE should be true (lowercase)","item needs to be a number","available should be a string"], answer:1, explain:'JSON booleans must be lowercase. TRUE is invalid — it must be true.' },
    { type:"choice", q:"Which is the correct way to nest an array inside a JSON object?", options:['{"colors": "red, green, blue"}','{"colors": (red, green, blue)}','{"colors": ["red", "green", "blue"]}','{"colors": {red, green, blue}}'], answer:2, explain:'Arrays inside objects use square brackets: {"colors": ["red", "green", "blue"]}.' },
    { type:"choice", q:"What does a server return when an API call succeeds?", options:["An error code","A response with data and a status code","Nothing — the client already has the data","A new request"], answer:1, explain:'A successful API call returns a response containing a status code (like 200) and usually some data (often JSON).' },
    { type:"choice", q:"Which character separates key-value pairs in a JSON object?", options:["Semicolon ;","Period .","Comma ,","Pipe |"], answer:2, explain:'Commas separate key-value pairs in JSON objects: {"a": 1, "b": 2}.' },
    { type:"spot", q:"What is wrong with this JSON?", code:'{\\n  "name": "Harry"\\n  "city": "Sydney"\\n}', options:["city should come before name","Missing comma after the name property","Strings need single quotes","Objects cannot have two properties"], answer:1, explain:'Every property except the last must be followed by a comma.' },
    { type:"choice", q:"An API is best described as:", options:["A type of database","A contract defining how two software systems communicate","A programming language","A web browser feature"], answer:1, explain:'An API is a contract — it defines exactly how systems can interact, what they can request, and what they will get back.' },
    { type:"choice", q:"Which is a correctly structured JSON response from an API?", options:['[users: [{name: "Ana"}]]','{"users": [{"name": "Ana"}]}','{"users": ({name: "Ana"})}','users: [{name: Ana}]'], answer:1, explain:'{"users": [{"name": "Ana"}]} is correctly structured JSON with quoted keys and proper bracket usage.' },
    { type:"choice", q:"What character begins a JSON object?", options:["[","{","(","<"], answer:1, explain:'JSON objects start with { and end with }. Arrays start with [ and end with ].' },
    { type:"choice", q:"What is the maximum depth of nesting allowed in JSON?", options:["3 levels","10 levels","No strict limit","1 level"], answer:2, explain:'There is no formal limit on nesting depth in JSON, though very deep nesting can cause performance issues and is bad practice.' },
    { type:"spot", q:"Find all bugs — how many are there?", code:'{\\n  name: "Harry",\\n  "age": 30,\\n  "active": True\\n}', options:["1 — unquoted key","2 — unquoted key and capital True","3 — unquoted key, capital True, missing quotes on age","0 — it looks valid"], answer:1, explain:'Two bugs: (1) name is not quoted — it must be "name", (2) True must be lowercase true. Age is already correct.' },
    { type:"choice", q:"Which statement about JSON is true?", options:["JSON is only for JavaScript","JSON can be used in any programming language","JSON requires a special parser only available in browsers","JSON files must end in .json"], answer:1, explain:'JSON is language-agnostic. Python, Ruby, Go, Java, Swift — every modern language has a JSON parser.' },
    { type:"choice", q:"What does the server role mean in an API interaction?", options:["It makes the request","It responds to requests with data","It stores the request permanently","It manages the user interface"], answer:1, explain:'The server receives requests from clients and responds with data. The client initiates, the server responds.' },
    { type:"choice", q:"How is a JSON array of strings written?", options:['{"items": "a, b, c"}','{"items": [a, b, c]}','{"items": ["a", "b", "c"]}','{"items": (a, b, c)}'], answer:2, explain:'An array of strings: ["a", "b", "c"]. Each string needs double quotes and items are separated by commas.' },
    { type:"spot", q:"What is wrong here?", code:'{\\n  "status": "active",\\n  "count": "42",\\n  "tags": ["api"]\\n}', options:["Nothing is wrong — this is valid JSON","count should be a number not a string","tags should be an object not an array","status needs to be a boolean"], answer:0, explain:'This is perfectly valid JSON. count being "42" (a string) is a design choice — it may not be ideal but it is syntactically valid.' },
    { type:"choice", q:"What is the JSON representation of an empty object?", options:["null","[]","{}","void"], answer:2, explain:'{} is an empty JSON object. [] is an empty array. null means the absence of a value.' },
    { type:"choice", q:"Which correctly adds a comment to explain JSON? (trick question)", options:['{ "name": "Harry" // the user }','{ "name": "Harry" /* user */ }','{ "_comment": "the user", "name": "Harry" }','Comments cannot exist in JSON'], answer:3, explain:'JSON does NOT support comments. // and /* */ are JavaScript syntax. If you need to document JSON, use a separate "_comment" key as a workaround.' },
    { type:"choice", q:"Which is NOT a valid way to represent a missing value in JSON?", options:["null","Use the key with an empty string","Omit the key entirely","undefined"], answer:3, explain:'"undefined" does not exist in JSON. You can use null, an empty string, or omit the key entirely to represent missing data.' },
    { type:"choice", q:"What does a client mean in the context of an API?", options:["The paying customer of a service","Any software that makes a request to an API","The server that holds the data","The developer who wrote the API"], answer:1, explain:'In API terminology, the client is anything making the request — an app, a browser, a script, another server.' },
    { type:"spot", q:"Is this valid JSON?", code:'{\\n  "name": "Harry",\\n  "scores": []\\n}', options:["No — empty arrays are not allowed","No — scores needs at least one value","Yes — this is valid JSON","No — missing a closing brace"], answer:2, explain:'This is completely valid. An empty array [] is a perfectly legal JSON value.' },
    { type:"choice", q:"How do you represent a decimal number in JSON?", options:["3,14 (comma as decimal)","3.14 (period as decimal)","3:14 (colon as decimal)","\\"3.14\\" (as a string)"], answer:1, explain:'JSON uses a period as the decimal separator: 3.14. Commas are for separating items, not decimals.' },
    { type:"choice", q:"What would JSON.parse('\\"hello\\"') return in JavaScript?", options:['The string "hello" without quotes',"An error — not valid JSON","The object {hello: true}","null"], answer:0, explain:'"hello" (with the quotes) is valid JSON — it is a JSON string. Parsing it returns the JavaScript string hello.' },
    { type:"choice", q:"Which key name is valid in JSON?", options:['"my key"','my-key','my key without quotes','"123"'], answer:0, explain:'Any string can be a JSON key as long as it is in double quotes. "my key" and "123" are both valid keys.' },
    { type:"choice", q:"What is wrong with this JSON value: NaN?", options:["Nothing — NaN is valid","NaN is not a valid JSON value","NaN needs to be quoted","NaN should be written as null"], answer:1, explain:'NaN (Not a Number) is a JavaScript concept and is NOT valid JSON. Use null to represent an invalid or missing number.' }
  ],

  intermediate: [
    { type:"choice", q:"You want to UPDATE a user's email. Which HTTP method?", options:["GET","POST","PATCH","DELETE"], answer:2, explain:'PATCH partially updates an existing resource. PUT replaces the whole thing. POST creates. Use PATCH for specific field changes.' },
    { type:"choice", q:"An API returns status code 404. What does this mean?", options:["Request succeeded","Server crashed","Resource not found","Unauthorised - login required"], answer:2, explain:'404 = Not Found. The resource you requested does not exist at that URL.' },
    { type:"choice", q:"Which endpoint follows REST naming conventions best?", options:["GET /getUsers","GET /users","GET /fetchAllUsers","GET /user/getAll"], answer:1, explain:'REST endpoints should be nouns not verbs. The HTTP method describes the action. /users is clean and correct.' },
    { type:"spot", q:"This API response looks wrong. What is the issue?", code:'// Request: GET /users/42\\n// Response:\\n{\\n  "status": 200,\\n  "data": {\\n    "id": 99,\\n    "name": "Ana Ruiz"\\n  }\\n}', options:["Status field should not be in the body","ID in response (99) does not match requested ID (42)","Email must be included","Data object should be an array"], answer:1, explain:'You requested user 42 but got user 99. Data mismatch — the server is returning the wrong record.' },
    { type:"choice", q:"Which HTTP method is NOT idempotent?", options:["POST - multiple calls create multiple resources","GET - returns same result","DELETE - same result if resource gone","PUT - same result each time"], answer:0, explain:'POST is NOT idempotent — calling POST /users 3 times creates 3 users. GET, PUT, DELETE are idempotent.' },
    { type:"spot", q:"This request is trying to create a user. What is wrong?", code:'// POST /users\\n// Headers: Content-Type: text/plain\\n// Body:\\n{\\n  "name": "Leo Santos",\\n  "email": "leo@example.com"\\n}', options:["POST should be GET","Content-Type should be application/json","Body needs an id field","Emails not allowed in POST"], answer:1, explain:'When sending JSON, Content-Type MUST be application/json. With text/plain the server may not parse the body.' },
    { type:"choice", q:"Which status code after successfully creating a resource?", options:["200 OK","201 Created","204 No Content","202 Accepted"], answer:1, explain:'201 Created is correct for a successful POST. It should include a Location header pointing to the new resource.' },
    { type:"choice", q:"Which URL is best for getting a user's orders?", options:["GET /getOrdersForUser?userId=5","GET /orders?filter=user&id=5","GET /users/5/orders","POST /users/findOrders"], answer:2, explain:'/users/5/orders clearly expresses the relationship. Using POST for a read is also wrong.' },
    { type:"choice", q:"What is the purpose of a request header?", options:["Opening line of the JSON body","Carries metadata like auth tokens and content type","Contains the main data payload","Specifies which database to query"], answer:1, explain:'Headers carry metadata. Common ones: Authorization, Content-Type, Accept, X-API-Key.' },
    { type:"choice", q:"Which error response is better API design?", options:['{ "ok": false }','{ "code": 400, "message": "Email is required", "field": "email" }','{ "status": "bad" }','"Error: validation failed"'], answer:1, explain:'Good errors include a code, a message, and the specific field. A bare ok:false tells the client nothing.' },
    { type:"choice", q:"What does stateless mean in REST APIs?", options:["Server never stores data","Each request contains all info needed - no session between requests","API never returns errors","Responses always the same"], answer:1, explain:'Stateless means the server does not remember previous requests. Every call must include all context like auth tokens.' },
    { type:"spot", q:"What is wrong with this paginated response?", code:'{\\n  "data": [\\n    {"id": 1, "name": "Ana"},\\n    {"id": 2, "name": "Leo"}\\n  ],\\n  "page": 1,\\n  "results": 2\\n}', options:["Data should not be an array","Missing total_pages or total_count - client cannot know how many pages exist","Page should start at 0","Names in a separate array"], answer:1, explain:'Without total_pages or total_count the client cannot know if more pages exist. Good pagination includes page, per_page, total_count, total_pages.' },
    { type:"choice", q:"What is the difference between PUT and PATCH?", options:["PUT is faster than PATCH","PUT replaces the entire resource; PATCH updates only specified fields","PATCH creates a new resource; PUT updates it","They are identical"], answer:1, explain:'PUT replaces the whole resource — you must send the complete object. PATCH only updates the fields you include.' },
    { type:"choice", q:"Which HTTP status code means the request was malformed?", options:["404","500","400","401"], answer:2, explain:'400 Bad Request means the client sent something the server could not understand — missing fields, wrong format, invalid values.' },
    { type:"choice", q:"What does a 500 status code indicate?", options:["Resource not found","Client sent bad data","An error occurred on the server","Too many requests"], answer:2, explain:'500 Internal Server Error means something broke on the server side. It is not the client\\'s fault.' },
    { type:"choice", q:"Which HTTP method should you use to delete a resource?", options:["GET","POST","PUT","DELETE"], answer:3, explain:'DELETE is the HTTP method for removing resources. GET retrieves, POST creates, PUT replaces.' },
    { type:"spot", q:"This DELETE endpoint returns the wrong status. What should it return?", code:'// DELETE /users/42\\n// Current response: 200 OK\\n// Body: {}\\n', options:["200 OK is correct for DELETE","It should return 404","It should return 204 No Content","It should return 201 Created"], answer:2, explain:'204 No Content is the standard for a successful DELETE with nothing to return. 200 is acceptable if you include confirmation data, but 204 is the convention.' },
    { type:"choice", q:"What does the Accept header tell the server?", options:["The format of the request body","What format the client wants back in the response","The client's authentication token","The API version to use"], answer:1, explain:'The Accept header tells the server what format the client can handle in the response, e.g. Accept: application/json.' },
    { type:"choice", q:"What is a query parameter?", options:["A field in the request body","Key-value pairs appended to the URL after a ?","A type of HTTP header","A nested JSON property"], answer:1, explain:'Query parameters are appended to URLs: /users?page=2&limit=10. They filter, sort, or configure the response.' },
    { type:"choice", q:"Which is the correct way to pass a query parameter?", options:["/users/page=2","/users?page=2","/users&page=2","/users[page]=2"], answer:1, explain:'Query parameters follow a ? in the URL: /users?page=2. Multiple params are joined with &: /users?page=2&limit=10.' },
    { type:"spot", q:"This endpoint design breaks REST conventions. Why?", code:'POST /users/search\\nBody: { "name": "Ana" }', options:["POST cannot have a body","Search should be GET with query params","Users cannot be searched","The URL needs a version number"], answer:1, explain:'Searching is a read operation — use GET /users?name=Ana. Using POST for reads breaks REST conventions and idempotency.' },
    { type:"choice", q:"What should an API return when a resource is not found?", options:["200 with an empty body","200 with an error message in the body","404 Not Found","500 Server Error"], answer:2, explain:'404 Not Found is the correct response. Never wrap errors inside a 200 response — the status code should reflect the actual outcome.' },
    { type:"choice", q:"What does CRUD stand for?", options:["Create, Read, Update, Delete","Copy, Retrieve, Upload, Deploy","Connect, Request, Update, Done","Create, Render, Use, Deploy"], answer:0, explain:'CRUD = Create, Read, Update, Delete. These map to POST, GET, PUT/PATCH, DELETE in REST.' },
    { type:"choice", q:"Which HTTP method maps to the Read operation in CRUD?", options:["POST","PUT","GET","PATCH"], answer:2, explain:'GET maps to Read. POST = Create, PUT/PATCH = Update, DELETE = Delete.' },
    { type:"choice", q:"What is the purpose of the Location header in a 201 response?", options:["Tells the client where the server is located","Points to the newly created resource","Redirects to the login page","Specifies the API documentation URL"], answer:1, explain:'The Location header in a 201 response tells the client the URL of the newly created resource, e.g. Location: /users/42.' },
    { type:"spot", q:"Why is this REST design bad?", code:'GET /getAllProductsAndReturnThemInAList', options:["GET cannot return lists","The URL uses a verb and is far too verbose","Products should use POST","Lists should be in the request body"], answer:1, explain:'REST URL paths should be short, lowercase nouns. GET /products is the correct equivalent. Long verby paths like this are a common anti-pattern.' },
    { type:"choice", q:"What does a 302 status code mean?", options:["Resource created","Temporary redirect","Request forbidden","Server error"], answer:1, explain:'302 Found is a temporary redirect — the client should follow the Location header to find the resource.' },
    { type:"choice", q:"Which is the correct Content-Type for sending JSON?", options:["text/json","application/json","json/text","application/javascript"], answer:1, explain:'application/json is the correct MIME type for JSON. text/json is not a standard type.' },
    { type:"choice", q:"What does it mean for an API to be RESTful?", options:["It uses REST libraries","It follows REST architectural conventions — stateless, resource-based, HTTP methods","It only returns JSON","It requires authentication"], answer:1, explain:'RESTful means the API follows REST principles: stateless, resource-identified by URL, uses standard HTTP methods.' },
    { type:"spot", q:"What is the bug in this API design?", code:'// Creating a new comment\\nGET /posts/5/comments\\nBody: { "text": "Great post!" }', options:["Comments cannot belong to posts","GET should be POST to create a resource","The body should use XML","Comments need an id in the body"], answer:1, explain:'Creating a resource requires POST, not GET. GET is read-only and should never have a body with data to persist.' },
    { type:"choice", q:"What is a base URL in an API context?", options:["The homepage of a website","The root URL all endpoints are relative to, e.g. https://api.example.com/v1","The URL of the API documentation","The URL used for authentication only"], answer:1, explain:'The base URL is the root all endpoints extend from. e.g. base: https://api.example.com/v1, endpoint: /users → full URL: https://api.example.com/v1/users.' },
    { type:"choice", q:"What HTTP status should you return for a validation error?", options:["404","500","400","200"], answer:2, explain:'400 Bad Request is correct for validation errors — missing required fields, invalid formats, failed constraints.' },
    { type:"spot", q:"Which endpoint design is most RESTful for updating a single field?", options:["POST /users/42/updateEmail","PATCH /users/42","PUT /users/42/email","GET /users/42?update=email"], answer:1, explain:'PATCH /users/42 with the field in the body is the RESTful way to partially update a resource.' },
    { type:"choice", q:"What is the purpose of API versioning?", options:["To make URLs longer","To allow breaking changes without breaking existing clients","To increase security","To add authentication"], answer:1, explain:'Versioning lets you evolve an API and introduce breaking changes while old clients on v1 continue to work unaffected.' },
    { type:"choice", q:"Which is a safe HTTP method?", options:["POST","DELETE","PATCH","GET"], answer:3, explain:'A safe method does not modify resources. GET, HEAD, OPTIONS are safe. POST, PUT, PATCH, DELETE are not.' },
    { type:"spot", q:"What is wrong with this response structure?", code:'// GET /products\\n200 OK\\n{\\n  "error": null,\\n  "success": true,\\n  "data": [...]\\n}', options:["Nothing — this is fine design","Wrapping all responses in error/success envelopes adds unnecessary noise for success cases","Data should be at the root level always","Arrays cannot be in response bodies"], answer:1, explain:'Over-enveloping adds noise. A successful GET /products should simply return the array or a clean object. Reserve error fields for error responses.' },
    { type:"choice", q:"What does the term payload refer to in an API context?", options:["The authentication token","The actual data in the request or response body","The HTTP method","The URL path"], answer:1, explain:'Payload is the data sent in the request or response body. The headers and URL are separate from the payload.' },
    { type:"choice", q:"What is content negotiation?", options:["Arguing about which API to use","The process where client and server agree on data format via Accept and Content-Type headers","Encrypting API responses","Rate limiting based on content size"], answer:1, explain:'Content negotiation lets clients request a specific format (Accept: application/json) and servers declare what they sent (Content-Type: application/json).' },
    { type:"choice", q:"Which HTTP status means the server understood the request but refuses to authorise it?", options:["401","403","404","400"], answer:1, explain:'403 Forbidden — the server knows who you are but you do not have permission. 401 means the server does not know who you are yet.' },
    { type:"spot", q:"What is the problem with this URL structure?", code:'GET /api/v1/get-all-the-users-from-the-database', options:["api prefix is wrong","The URL is verbose, uses verbs, and is not RESTful — should be GET /api/v1/users","v1 versioning is wrong","GET cannot retrieve multiple items"], answer:1, explain:'URLs should be short, lowercase nouns. GET already implies retrieval. The full database detail is implementation noise the client should not see.' },
    { type:"choice", q:"What is the standard way to filter a collection in REST?", options:["POST /users/filter","GET /users?status=active","PUT /users with filter in body","DELETE /users?keep=inactive"], answer:1, explain:'Filters are query parameters on a GET request: GET /users?status=active. Never use POST just to pass filter criteria.' },
    { type:"choice", q:"Which is true about HTTP headers?", options:["Headers are part of the response body","Headers are case-sensitive","Headers are key-value pairs sent with the request and response","Headers can only be set by the server"], answer:2, explain:'Headers are key-value pairs in the HTTP request and response. HTTP header names are technically case-insensitive though by convention they use title case.' },
    { type:"choice", q:"What does 202 Accepted mean?", options:["Resource was created","Request was received and will be processed asynchronously","Request succeeded with no content","Server is still loading"], answer:1, explain:'202 Accepted means the server received the request but processing will happen later — common for queued jobs or async operations.' },
    { type:"spot", q:"This endpoint returns different things based on the method. What is wrong?", code:'GET /users/42   → returns user data\\nPOST /users/42  → also returns user data', options:["Nothing — this is fine","POST /users/42 makes no sense — POST on an existing ID should fail or update, not return data","GET cannot return user data","Users should use IDs in query params"], answer:1, explain:'POST /users/42 is confusing — POST on a specific ID is not idiomatic REST. Use PUT or PATCH to update an existing resource.' },
    { type:"choice", q:"What is the correct HTTP method for replacing an entire resource?", options:["POST","PATCH","PUT","GET"], answer:2, explain:'PUT replaces the entire resource. You must send all fields. PATCH updates only the fields you include.' },
    { type:"choice", q:"Which status code means the server cannot find a route for the request?", options:["404","405","400","503"], answer:1, explain:'405 Method Not Allowed means the URL exists but does not support that HTTP method. For example, trying to DELETE /login.' },
    { type:"choice", q:"What is the standard place to include a Bearer token in a request?", options:["In the request body","In the URL as a query param","In the Authorization header","In a custom X-Token header"], answer:2, explain:'Authorization: Bearer <token> is the standard. URL params get logged. Body tokens break conventions. Custom headers work but are non-standard.' },
    { type:"choice", q:"What is a resource in REST terminology?", options:["A database table","Any piece of data or object the API exposes and manages","A type of HTTP method","A server-side function"], answer:1, explain:'A resource is any entity the API manages — a user, a product, an order. Resources are identified by URLs.' },
    { type:"spot", q:"Which of these API responses has the best error structure?", options:['{ "error": true }','{ "message": "bad" }','{ "status": 422, "error": "unprocessable_entity", "message": "Age must be a positive number", "field": "age" }','{ "code": "ERR" }'], answer:2, explain:'Good errors include: a numeric status, a machine-readable error code, a human-readable message, and the specific field that caused the issue.' },
    { type:"choice", q:"What does the term idempotent mean in HTTP?", options:["The request completes instantly","Making the same request multiple times has the same result as making it once","The request is cached","The response is always empty"], answer:1, explain:'Idempotent means repeated identical requests produce the same outcome. GET, PUT, DELETE are idempotent. POST is not.' }
  ],

  advanced: [
    { type:"choice", q:"Correct format for a Bearer token?", options:["Authorization: token abc123","Authorization: Bearer abc123","Token: Bearer abc123","Auth: abc123"], answer:1, explain:'Standard is Authorization: Bearer token. Bearer tells the server the scheme. Custom headers break most auth middleware.' },
    { type:"choice", q:"Which API versioning strategy is best practice?", options:["https://api.example.com/users - no version","https://api.example.com/v1/users","https://v1.api.example.com/users","https://api.example.com/users?version=1"], answer:1, explain:'/v1/ in the path is most widely adopted. Explicit, easy to see in logs. Subdomain versioning is complex.' },
    { type:"spot", q:"This rate limit response is missing something critical:", code:'// HTTP 429 Too Many Requests\\n{\\n  "error": "rate_limit_exceeded",\\n  "message": "You have exceeded the rate limit."\\n}', options:["Should return 200 with error in body","Missing Retry-After - client cannot know when to retry","Error code format is wrong","Rate limits should never be exposed"], answer:1, explain:'A 429 must include Retry-After or retry_after. Without it clients guess when to retry, hammering the server.' },
    { type:"choice", q:"What does CORS stand for and when do you hit it?", options:["Cross-Origin Resource Sharing - browser request from different domain than the API","Content Origin Routing - API cannot find resource","Cached Object Response Standard - responses from cache","Cross-Origin Security - POST requests only"], answer:0, explain:'CORS = Cross-Origin Resource Sharing. Browsers block cross-origin requests unless the API allows it via Access-Control-Allow-Origin.' },
    { type:"choice", q:"Which API key approach is most secure?", options:["Hardcode in frontend JavaScript","Pass as URL param: /data?api_key=abc123","Store in env vars server-side, pass via Authorization header","Embed in app bundle and obfuscate"], answer:2, explain:'Env vars keep secrets off disk. Headers keep keys out of server logs. Frontend JS is never safe for secrets.' },
    { type:"spot", q:"This webhook handler has a critical security flaw:", code:"// POST /webhook\\napp.post('/webhook', (req, res) => {\\n  const event = req.body;\\n  if (event.type === 'payment.success') {\\n    fulfillOrder(event.data.orderId);\\n  }\\n  res.sendStatus(200);\\n});", options:["Should use GET not POST","Response should include order details","No signature verification - anyone can send fake payment events","fulfillOrder should be after res.send"], answer:2, explain:'Webhooks must verify the signature using HMAC-SHA256 on the raw body with a shared secret. Without this anyone can fake a payment.' },
    { type:"choice", q:"Key difference between REST and GraphQL?", options:["REST uses JSON, GraphQL uses XML","GraphQL clients specify exactly what data they need; REST has fixed response shapes","GraphQL is faster by default","REST supports auth, GraphQL does not"], answer:1, explain:'GraphQL avoids over-fetching by letting clients request exactly the fields they need. REST has fixed shapes per endpoint.' },
    { type:"choice", q:"Which pagination is better for large real-time datasets?", options:["GET /posts?page=1&limit=20","GET /posts?cursor=eyJpZCI6MTIzfQ&limit=20","GET /posts?skip=0&take=20","GET /posts?offset=0&count=20"], answer:1, explain:'Cursor-based pagination is reliable for real-time data. Offset breaks when items are inserted or deleted mid-browse.' },
    { type:"choice", q:"401 vs 403 - what is the difference?", options:["401 = server error, 403 = client error","401 = not authenticated (who are you?), 403 = not authorised (known but not allowed)","401 = not found, 403 = moved","They mean the same thing"], answer:1, explain:'401 means send credentials. 403 means you are known but do not have permission.' },
    { type:"spot", q:"This API response is leaking data. What is the problem?", code:'// GET /users/5/profile\\n{\\n  "id": 5,\\n  "name": "Harry",\\n  "email": "harry@hk.com",\\n  "password_hash": "$2b$10$xyz...",\\n  "stripe_customer_id": "cus_ABC123",\\n  "last_login_ip": "192.168.1.1"\\n}', options:["Response should be an array","id should be a string","Sensitive internal fields are being leaked to the client","Missing status code in body"], answer:2, explain:'password_hash, stripe_customer_id, and last_login_ip should never be in a public response. Always whitelist fields via a serializer.' },
    { type:"choice", q:"What is exponential backoff?", options:["Sending more requests over time","Waiting progressively longer between retries - 1s, 2s, 4s, 8s","Compressing API responses","Caching responses for longer periods"], answer:1, explain:'Exponential backoff waits longer between retries: 1s, 2s, 4s, 8s. Add jitter to prevent clients all retrying simultaneously.' },
    { type:"choice", q:"What status should DELETE return with no body?", options:["200 OK","201 Created","204 No Content","404 Not Found"], answer:2, explain:'204 No Content is the standard for a successful DELETE with no response body.' },
    { type:"choice", q:"What is a JWT?", options:["A type of HTTP method","JSON Web Token — a self-contained token encoding claims, signed to prevent tampering","A JavaScript testing framework","A JSON validation tool"], answer:1, explain:'JWT (JSON Web Token) is a compact, self-contained token. It encodes claims (user id, roles, expiry) and is signed so the server can verify it without a database lookup.' },
    { type:"choice", q:"What does OAuth 2.0 solve?", options:["Encrypting API responses","Allowing users to grant third-party apps access to their data without sharing their password","Compressing large JSON payloads","Versioning APIs automatically"], answer:1, explain:'OAuth 2.0 is an authorisation framework. It lets users grant limited access to their account to third-party apps without exposing credentials.' },
    { type:"spot", q:"What is wrong with this API key implementation?", code:'// Frontend JavaScript\\nconst API_KEY = "sk-live-abc123xyz";\\n\\nfetch(\`https://api.payments.com/charge?key=\${API_KEY}\`, {\\n  method: "POST",\\n  body: JSON.stringify({ amount: 100 })\\n});', options:["fetch cannot be used for POST","The URL is malformed","The API key is exposed in frontend JS and in the URL — visible to anyone","The amount should be a string"], answer:2, explain:'Two problems: (1) hardcoded in frontend JS — anyone can read it in DevTools, (2) in the URL — logged by servers and proxies. Keys must live server-side.' },
    { type:"choice", q:"What is rate limiting?", options:["Limiting the size of API responses","Restricting how many requests a client can make in a given time period","Limiting which HTTP methods are allowed","Caching responses for a fixed duration"], answer:1, explain:'Rate limiting protects servers from abuse and overload by restricting how many requests a single client can make per second, minute, or day.' },
    { type:"choice", q:"What is the purpose of an API gateway?", options:["To store API keys","A single entry point for all API requests, handling routing, auth, rate limiting, and logging","A type of database","The same as a load balancer"], answer:1, explain:'An API gateway sits in front of your services and handles cross-cutting concerns: authentication, rate limiting, request routing, logging, and SSL termination.' },
    { type:"spot", q:"This error handling code has a critical flaw:", code:'app.get("/users/:id", async (req, res) => {\\n  const user = await db.findUser(req.params.id);\\n  res.json(user);\\n});', options:["The route syntax is wrong","No error handling — if db.findUser throws, the server will crash with a 500","User should be validated before querying","GET cannot use route params"], answer:1, explain:'No try/catch means any database error will be an unhandled promise rejection, crashing the request or returning a garbled 500. Always handle async errors.' },
    { type:"choice", q:"What is the difference between authentication and authorisation?", options:["They mean the same thing","Authentication = who are you; authorisation = what are you allowed to do","Authentication = what you can do; authorisation = who you are","Authentication only applies to admin users"], answer:1, explain:'Authentication verifies identity (login, token). Authorisation decides permissions (can this user read this resource). Auth before authz.' },
    { type:"choice", q:"What is an API contract?", options:["A legal document between API providers and users","The agreed interface — endpoints, request formats, and response shapes that both sides commit to","A type of rate limiting policy","An API versioning strategy"], answer:1, explain:'An API contract defines the agreed interface. Providers commit to it, consumers rely on it. Breaking the contract without versioning breaks clients.' },
    { type:"spot", q:"What security issue does this code have?", code:'// GET /users?search=\\'{}\\'\\n// SQL query:\\nconst query = \`SELECT * FROM users WHERE name = \\'\${req.query.search}\\'\`;', options:["GET cannot have query params","SQL injection vulnerability — user input is interpolated directly into the SQL query","The query syntax is wrong","SELECT * is too slow"], answer:1, explain:'This is a textbook SQL injection vulnerability. User input must never be interpolated directly into SQL. Use parameterised queries or an ORM.' },
    { type:"choice", q:"What is HATEOAS?", options:["A security protocol","Hypermedia As The Engine Of Application State — responses include links to related actions","A type of pagination","A compression algorithm for JSON"], answer:1, explain:'HATEOAS is an advanced REST constraint. Responses include links telling the client what actions it can take next. Rarely fully implemented but important conceptually.' },
    { type:"choice", q:"What is the benefit of using ETags?", options:["Encrypting responses","Cache validation — clients can check if a resource has changed before downloading it again","Compressing responses","Routing requests to different servers"], answer:1, explain:'ETags are cache validators. The server sends ETag: abc123, the client sends If-None-Match: abc123 on the next request. If unchanged, server returns 304 Not Modified — no data transfer.' },
    { type:"spot", q:"What is the problem with this caching strategy?", code:'// Response headers\\nCache-Control: max-age=31536000\\n\\n// Endpoint: GET /user/profile\\n// Returns the authenticated user\\'s private profile', options:["max-age is too short","Private user data is being cached with a 1-year max-age — anyone sharing a device or proxy will see the wrong data","The endpoint path is wrong","Cache-Control is not a valid header"], answer:1, explain:'Private, user-specific data must use Cache-Control: private, no-store or short max-age. A year-long cache on private data is a serious privacy vulnerability.' },
    { type:"choice", q:"What is the purpose of a refresh token?", options:["To refresh the page after an API call","A long-lived token used to obtain a new access token when the short-lived one expires","To re-run a failed API request","To reset a user password"], answer:1, explain:'Access tokens are short-lived (minutes to hours) for security. Refresh tokens are longer-lived and used to get new access tokens without re-authentication.' },
    { type:"choice", q:"What does idempotency key solve in payment APIs?", options:["Prevents duplicate charges if a network failure causes the client to retry a payment request","Encrypts payment data","Verifies the merchant identity","Prevents rate limiting on payment endpoints"], answer:0, explain:'If a payment POST times out, did it go through? Idempotency keys let you safely retry — the server checks if it already processed that key and returns the same result rather than charging twice.' },
    { type:"spot", q:"This pagination implementation has a well-known problem. What is it?", code:'// GET /posts?page=3&limit=10\\n// SQL:\\nSELECT * FROM posts\\nORDER BY created_at DESC\\nLIMIT 10 OFFSET 20', options:["OFFSET is not valid SQL","Offset pagination breaks when new items are added between requests — pages shift and items are skipped or duplicated","The limit is too small","ORDER BY cannot be used with pagination"], answer:1, explain:'Offset pagination is fragile with real-time data. If 3 new posts arrive between page 1 and page 2 requests, page 2 shows posts the user already saw. Use cursor-based pagination for live feeds.' },
    { type:"choice", q:"What is a microservice architecture?", options:["A single large application handling all functionality","An architecture where an application is split into small, independently deployable services each with its own API","A type of API gateway","A frontend framework"], answer:1, explain:'Microservices split an application into small services (users service, orders service, payments service) that communicate via APIs. Each can be deployed and scaled independently.' },
    { type:"choice", q:"What is the purpose of HTTPS vs HTTP in APIs?", options:["HTTPS is faster","HTTPS encrypts data in transit so tokens and payloads cannot be intercepted","HTTPS is only needed for login endpoints","There is no practical difference"], answer:1, explain:'HTTPS uses TLS to encrypt all data in transit. Without it, tokens, API keys, and payloads can be read by anyone on the network. Every API must use HTTPS.' },
    { type:"spot", q:"What is wrong with this auth flow?", code:'// Login endpoint\\nPOST /login\\nBody: { "username": "harry", "password": "secret123" }\\n\\n// Response\\n200 OK\\n{\\n  "token": "abc123",\\n  "password": "secret123"\\n}', options:["POST is wrong for login","The token format is invalid","The response is including the plain text password — never return passwords in any response","Username should be an email"], answer:2, explain:'Never return passwords in API responses. Not even if the user just sent it. Not even hashed. The response should only contain the token (and maybe user info).' },
    { type:"choice", q:"What is API throttling?", options:["Compressing API responses","Deliberately slowing down or limiting API responses to manage load","Caching API responses","Encrypting API responses"], answer:1, explain:'Throttling is the deliberate limiting of request processing speed or rate. It protects backend services from being overwhelmed and ensures fair usage across clients.' },
    { type:"choice", q:"What is a circuit breaker pattern in API design?", options:["A firewall for APIs","Stops cascading failures by detecting when a downstream service is failing and short-circuiting calls to it","A type of authentication","A method of API versioning"], answer:1, explain:'If service B keeps failing, a circuit breaker in service A detects this and stops sending requests to B (returns a fallback instead), preventing cascading failures across the system.' },
    { type:"spot", q:"What is the CORS issue here?", code:'// Browser makes request:\\nfetch("https://api.example.com/data")\\n\\n// Server response headers:\\nContent-Type: application/json\\nAccess-Control-Allow-Origin: *', options:["fetch cannot be used cross-origin","Wildcard * is acceptable for public APIs but dangerous for authenticated APIs — use a specific allowed origin","The Content-Type is wrong","api.example.com is not a valid domain"], answer:1, explain:'Access-Control-Allow-Origin: * allows any origin. For public read-only data this is fine. For APIs that accept cookies or sensitive auth, you must specify exact allowed origins — never use * with credentials.' },
    { type:"choice", q:"What is the difference between synchronous and asynchronous API design?", options:["Synchronous APIs use JSON, asynchronous use XML","Synchronous APIs respond immediately; async APIs accept the request and process it later, often using webhooks or polling","Synchronous APIs are faster always","Async APIs cannot return errors"], answer:1, explain:'Sync APIs respond inline (you wait). Async APIs return 202 Accepted immediately and deliver results later via webhook or a status endpoint — better for long-running operations.' },
    { type:"choice", q:"What is an API sandbox?", options:["A security layer","A test environment with fake data where developers can experiment without affecting production","A type of rate limiting","A caching layer"], answer:1, explain:'API sandboxes let developers test integrations safely — Stripe, Twilio, and most payment/comms providers offer sandboxes so you can test without real money or messages.' },
    { type:"spot", q:"This API design will cause problems at scale. Why?", code:'// Endpoint that returns ALL records\\nGET /orders\\n// Response: array of 2,000,000 orders', options:["GET cannot return large datasets","No pagination — returning millions of records in a single response will time out, crash clients, and destroy server memory","Orders should use POST","Arrays cannot contain more than 1000 items"], answer:1, explain:'Never return unbounded collections. Always paginate. A response of 2 million records will timeout, exhaust server RAM, and likely crash the client. Default to a reasonable page size.' },
    { type:"choice", q:"What is the purpose of API documentation like OpenAPI/Swagger?", options:["To generate the API code automatically","To provide a machine-readable and human-readable specification of all endpoints, parameters, and responses","To authenticate API consumers","To compress API responses"], answer:1, explain:'OpenAPI (formerly Swagger) lets teams document their API in a standard format. Tools can generate interactive docs, mock servers, and client SDKs automatically from the spec.' },
    { type:"choice", q:"What is a webhook?", options:["A type of API endpoint that returns HTML","A way for a server to push real-time notifications to a client URL when events occur","A method of API authentication","A type of API gateway"], answer:1, explain:'Webhooks flip the request model — instead of your app polling for changes, the server calls your endpoint when something happens. Payment processors, GitHub, Stripe all use webhooks.' },
    { type:"choice", q:"What is the N+1 query problem in APIs?", options:["Having more than one version of an API","Making one request to get a list, then N additional requests to get details for each item — very inefficient","An error caused by returning null","A pagination anti-pattern"], answer:1, explain:'N+1 is a classic API and ORM problem. GET /posts returns 100 posts, then you make 100 more requests to GET /posts/:id/author for each. Fix with data embedding or GraphQL.' },
    { type:"spot", q:"What is the security problem with this token validation?", code:'// Server validates JWT\\nconst decoded = jwt.decode(token); // NOT verify\\nif (decoded.role === "admin") {\\n  grantAccess();\\n}', options:["JWTs cannot contain roles","jwt.decode does not verify the signature — anyone can forge a token with admin role","The token should be in the URL","Admin access should use a separate endpoint"], answer:1, explain:'jwt.decode just decodes the payload without verifying the signature. Use jwt.verify with your secret key. An attacker can craft a token claiming admin role and bypass auth entirely.' },
    { type:"choice", q:"What is eventual consistency in distributed APIs?", options:["All servers always have the same data immediately","After a write, different servers may temporarily return different data, but will converge to the same state","APIs that only update once a day","A caching strategy"], answer:1, explain:'In distributed systems, writes propagate across nodes with a delay. A user might write to node A and read from node B which hasn\\'t replicated yet. Systems are eventually consistent but not immediately.' },
    { type:"choice", q:"What is the purpose of an idempotency key in API design?", options:["To encrypt requests","A unique client-generated key sent with a request so the server can detect and ignore duplicate requests","To authenticate the client","To specify the API version"], answer:1, explain:'Idempotency keys let clients safely retry requests. If the server already processed that key, it returns the cached result instead of processing again — critical for payments and order creation.' },
    { type:"spot", q:"What is wrong with this API error response design?", code:'// All errors return HTTP 200\\n200 OK\\n{\\n  "success": false,\\n  "error_code": 404,\\n  "message": "User not found"\\n}', options:["Nothing — this is a valid pattern","Returning 200 for errors breaks HTTP semantics — clients, proxies, and monitoring tools rely on status codes to understand what happened","The error_code format is wrong","error messages should not be exposed to clients"], answer:1, explain:'Wrapping errors in 200 responses breaks HTTP. Monitoring tools show all 200s as success. Load balancers cannot distinguish errors. Clients have to parse every body. Always use the correct 4xx or 5xx status code.' },
    { type:"choice", q:"What is gRPC and how does it compare to REST?", options:["gRPC is a database protocol","gRPC uses Protocol Buffers and HTTP/2 for fast, typed, binary communication — faster than REST/JSON but less human-readable","gRPC is a type of REST","gRPC only works on mobile"], answer:1, explain:'gRPC is an RPC framework using Protocol Buffers (binary) over HTTP/2. It is faster and more efficient than REST/JSON but requires more tooling and is less inspectable in a browser.' },
    { type:"choice", q:"What does SSRF stand for and why is it dangerous in APIs?", options:["Server-Side Request Forgery — attacker tricks the server into making requests to internal services","Single Source Resource Fetching — a caching strategy","Server-Side Response Filtering — a security middleware","Synchronous Server Request Framework"], answer:0, explain:'SSRF tricks your server into making HTTP requests on behalf of the attacker — potentially hitting internal services (Redis, databases, cloud metadata endpoints) that should never be publicly accessible.' },
    { type:"choice", q:"What is the purpose of the Retry-After header?", options:["Tells the client to update its API version","Tells the client how long to wait before making another request after a 429 or 503","Specifies the cache duration","Indicates the API is in maintenance mode"], answer:1, explain:'Retry-After gives clients a concrete wait time. Without it, clients implementing backoff must guess. It can be a number of seconds or an HTTP date.' },
    { type:"spot", q:"What is the design flaw in this versioning approach?", code:'// v1 endpoint\\nGET /api/users\\nReturns: { "name": "Harry", "email": "h@hk.com" }\\n\\n// Six months later, no version bump:\\nGET /api/users\\nReturns: { "full_name": "Harry Smith", "contact_email": "h@hk.com" }', options:["The endpoint path is too short","Renaming fields without a version bump is a breaking change — existing clients using name will silently break","email should always be called email","GET cannot change behaviour"], answer:1, explain:'Renaming response fields is a breaking change. Any client reading .name now gets undefined. This is exactly what versioning (/v2/users) exists to prevent — ship the new shape under v2, keep v1 intact.' },
    { type:"choice", q:"What is the difference between a token expiry and a token revocation?", options:["They mean the same thing","Expiry is time-based and automatic; revocation is explicit invalidation before expiry — harder with stateless JWTs","Revocation is only for refresh tokens","Expiry only applies to API keys"], answer:1, explain:'JWTs expire automatically. But if a user logs out or a token is compromised, you need revocation — typically a token blocklist or switching to short-lived tokens with refresh token rotation.' },
    { type:"choice", q:"What is an API rate limit header best practice?", options:["Never expose rate limit info to clients","Return X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset in every response","Only return rate limit headers after a 429","Rate limits should be in the response body not headers"], answer:1, explain:'Proactively sending rate limit headers (Limit, Remaining, Reset) on every response lets well-behaved clients throttle themselves before hitting 429s — reducing noise and improving the developer experience.' }
  ]
};

var currentLevel = null;
var questions = [];
var qIndex = 0;
var qScore = 0;
var qResults = [];
var answered = false;

function show(id) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function colorCode(code) {
  return esc(code)
    .replace(/(\\/\\/.+)/g,'<span class="cmt">$1</span>')
    .replace(/("([^"]*)")(\\s*:)/g,'<span class="key">$1</span>$3')
    .replace(/:\\s*("([^"]*)")/g,': <span class="str">$1</span>')
    .replace(/:\\s*(\\d+\\.?\\d*)/g,': <span class="num">$1</span>')
    .replace(/:\\s*(true|false|null)/g,': <span class="bool">$1</span>');
}

function startQuiz(level) {
  currentLevel = level;
  var all = QB[level].slice();
  for (var i = all.length - 1; i > 0; i--) { var j = Math.floor(Math.random()*(i+1)); var t=all[i]; all[i]=all[j]; all[j]=t; }
  questions = all.slice(0, 10);
  qIndex = 0; qScore = 0; qResults = []; answered = false;
  var colors = { beginner:'#22c55e', intermediate:'#f59e0b', advanced:'rgb(255,30,30)' };
  document.getElementById('qLevelBadge').style.color = colors[level];
  document.getElementById('qLevelBadge').textContent = '// ' + level;
  document.getElementById('qProgressBar').style.background = colors[level];
  show('quiz');
  renderQ();
}

function renderQ() {
  answered = false;
  var q = questions[qIndex];
  var total = questions.length;
  document.getElementById('qProgressText').textContent = 'Question ' + (qIndex+1) + ' of ' + total;
  document.getElementById('qScoreBadge').textContent = qScore + ' / ' + qIndex;
  document.getElementById('qProgressBar').style.width = ((qIndex/total)*100) + '%';
  var pill = document.getElementById('qTypePill');
  pill.textContent = q.type === 'spot' ? 'spot the bug' : 'multiple choice';
  pill.className = 'q-type-pill ' + q.type;
  document.getElementById('qText').textContent = q.q;
  var codeEl = document.getElementById('qCode');
  if (q.code) { codeEl.style.display='block'; codeEl.innerHTML=colorCode(q.code); }
  else { codeEl.style.display='none'; }
  var list = document.getElementById('optionsList');
  list.innerHTML = '';
  for (var i = 0; i < q.options.length; i++) {
    var btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = q.options[i];
    btn.setAttribute('data-i', i);
    btn.onclick = function() { doAnswer(parseInt(this.getAttribute('data-i'))); };
    list.appendChild(btn);
  }
  var fb = document.getElementById('feedbackBox');
  fb.className = 'feedback-box';
  document.getElementById('nextBtn').className = 'next-btn';
  document.getElementById('nextBtn').textContent = (qIndex+1 < total) ? 'Next Question' : 'See Results';
}

function doAnswer(chosen) {
  if (answered) return;
  answered = true;
  var q = questions[qIndex];
  var isRight = chosen === q.answer;
  if (isRight) qScore++;
  qResults.push(isRight);
  var opts = document.querySelectorAll('.option-btn');
  opts.forEach(function(btn, i) {
    if (i === q.answer) btn.classList.add('correct');
    else if (i === chosen && !isRight) btn.classList.add('wrong');
    else btn.classList.add('dimmed');
  });
  var fb = document.getElementById('feedbackBox');
  fb.className = 'feedback-box show ' + (isRight ? 'correct-fb' : 'wrong-fb');
  document.getElementById('fbIcon').textContent = isRight ? '✓' : '✗';
  document.getElementById('fbText').innerHTML = '<strong>' + (isRight ? 'Correct!' : 'Not quite.') + '</strong> ' + esc(q.explain);
  document.getElementById('nextBtn').classList.add('show');
}

function doNext() {
  qIndex++;
  if (qIndex >= questions.length) showResults();
  else renderQ();
}

function showResults() {
  var pct = Math.round((qScore/questions.length)*100);
  var colors = { beginner:'#22c55e', intermediate:'#f59e0b', advanced:'rgb(255,30,30)' };
  document.getElementById('resGrade').textContent = pct + '%';
  document.getElementById('resGrade').style.color = colors[currentLevel];
  document.getElementById('resLabel').textContent = '// ' + currentLevel;
  var dots = '';
  for (var i = 0; i < qResults.length; i++) dots += '<div class="streak-dot ' + (qResults[i]?'hit':'miss') + '"></div>';
  document.getElementById('resStreak').innerHTML = dots;
  var msg, sub;
  if (pct===100)    { msg='Perfect score.';  sub='Flawless. You have mastered this level.'; }
  else if (pct>=80) { msg='Strong work.';    sub='Solid grasp. Review the ones you missed.'; }
  else if (pct>=60) { msg='Getting there.';  sub='Run it again and the gaps will close.'; }
  else              { msg='Keep going.';     sub='Retry this level and watch it click.'; }
  document.getElementById('resMsg').textContent = qScore+'/'+questions.length+' - '+msg;
  document.getElementById('resSub').textContent = sub;
  show('results');
}
</script>
</body>
</html>
`;

export default function ApiQuizScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const maxW = isTablet ? Math.min(Math.round(width * 0.82), 900) : 560;
  const overrides = `<style>
body { justify-content: center; }
.screen { max-width: ${maxW}px !important; }
</style></head>`;
  const src = HTML.replace('</head>', overrides);
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="API Fundamentals" />
      <WebView
        source={{ html: src, baseUrl: '' }}
        style={styles.web}
        originWhitelist={['*']}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0c' },
  web:  { flex: 1, backgroundColor: '#0b0b0c' },
});
