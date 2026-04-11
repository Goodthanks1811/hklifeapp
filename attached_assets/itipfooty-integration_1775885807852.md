# iTipFooty Integration — Technical Documentation

## Overview

This document covers the full reverse-engineered API integration for iTipFooty (itipfooty.com.au), including the proxy server architecture, all endpoints, and the planned Expo app integration.

---

## How It Was Built

### Step 1 — Reverse Engineering the API

A custom Chrome extension (`iFooty API Capture`) was built to intercept all network traffic on the iTipFooty site. The extension:

- Injected an interceptor script directly into the page context to override `fetch` and `XMLHttpRequest`
- Captured form submissions (login, tip submission) before they were sent
- Categorised requests as AUTH, SUBMIT_TIP, TIPPING, or XHR
- Displayed results in a persistent floating window with real-time updates
- Exported all captured requests as a structured JSON file

From the captured traffic, the following key endpoints were identified:

---

## API Endpoints (itipfooty.com.au)

### Login
```
POST https://www.itipfooty.com.au/services/login.php
Content-Type: application/x-www-form-urlencoded

todo=weblogmemin
tippingname=<username>
password=<password>
```

**Response:** Sets a `PHPSESSID` cookie on success. The site returns HTTP 200 regardless of success/failure — failure is detected by checking if the response body contains the login form HTML.

**Session:** All subsequent requests must include the `PHPSESSID` cookie. The proxy server handles this automatically via a persistent cookie jar.

---

### Submit Tips
```
POST https://www.itipfooty.com.au/services/SubmitTips.php
Content-Type: application/x-www-form-urlencoded
```

**Form fields:**

| Field | Example | Notes |
|---|---|---|
| `1` through `8` | `H` or `A` | Game tip — H = home team, A = away team |
| `postmemberid` | `558580` | Your member ID — static, comes from tipping page |
| `COMPID` | `132428` | Competition ID — from URL |
| `ROUND` | `6` | Current round number |
| `JOKERCOUNT` | `1` | Total jokers available |
| `CURRENTJOKERCOUNT` | `0` | Jokers used so far |
| `cutoff` | `GAME` | Tip cutoff type |
| `code` | `NRL` | Sport code |
| `margin` | `12` | Margin tip — always applies to game 1 |
| `todo` | `update` | Action type — always `update` |
| `tipref` | `1542957` | Tip reference ID — comes from tipping page |
| `OldTip1–8` | `Panthers` | Previous tip team names — required by server |
| `OldMargin` | `12` | Previous margin value |
| `OldMarginNonSub` | `N` | Previous margin non-sub flag |

**Important:** The `OldTip*` and `OldMargin` fields must match what was previously submitted. These are parsed from the live tipping page HTML before submission.

---

### Tipping Page (Fixture Data)
```
GET https://www.itipfooty.com.au/tipping.php?compid=132428
GET https://www.itipfooty.com.au/tipping.php?compid=132428&round=6
```

This is a standard HTML page — not a JSON API. All fixture data, current tips, hidden form fields, and team names are parsed from the HTML. Requires active session.

---

## Proxy Server

### Purpose

The proxy server sits between the Expo mobile app and itipfooty.com.au. It:

- Keeps API credentials and session cookies server-side (never in the app)
- Handles login and session management automatically
- Parses the iTipFooty HTML into clean JSON for the app to consume
- Provides a simple REST API for the app to call

### Stack

- **Runtime:** Node.js (ESM)
- **Framework:** Express
- **HTTP client:** got v13 with tough-cookie for cookie jar management
- **Port:** 3000 (configurable via `PORT` env var)

### Folder Structure

```
footy-proxy/
├── server.js       — Main proxy server
├── package.json    — Dependencies
└── login.json      — Login credentials template (add your password)
```

### Running Locally

```bash
cd footy-proxy
npm install
npm start
# Server running on http://localhost:3000
```

---

## Proxy API Reference

### `GET /health`
Health check.

**Response:**
```json
{ "ok": true }
```

---

### `GET /session`
Check if the server is currently logged in.

**Response:**
```json
{ "loggedIn": true, "cookieCount": 4 }
```

---

### `POST /login`
Authenticate with iTipFooty. Call this once on app launch — the server holds the session for all subsequent requests.

**Request:**
```json
{
  "username": "YourTippingName",
  "password": "YourPassword"
}
```

**Success response:**
```json
{ "success": true, "message": "Logged in" }
```

**Failure response (401):**
```json
{ "error": "Login failed — invalid credentials" }
```

---

### `GET /fixture?compid=132428`
### `GET /fixture?compid=132428&round=6`

Fetches the fixture and current tips for a round. Parses all data from the HTML tipping page.

**Response:**
```json
{
  "compid": "132428",
  "round": 6,
  "memberid": "558580",
  "tipref": "1542957",
  "jokerCount": "1",
  "currentJokerCount": "0",
  "cutoff": "GAME",
  "code": "NRL",
  "margin": "12",
  "games": [
    {
      "gameNumber": 1,
      "currentTip": "A",
      "locked": true,
      "homeTeam": "BUL",
      "awayTeam": "PAN",
      "previousTip": "Panthers"
    },
    {
      "gameNumber": 4,
      "currentTip": "A",
      "locked": false,
      "homeTeam": "RAB",
      "awayTeam": "RAI",
      "previousTip": "Raiders"
    }
  ],
  "oldFields": {
    "OldTip1": "Panthers",
    "OldMargin": "12",
    "OldMarginNonSub": "N",
    "OldTip2": "Dragons",
    "OldTip3": "Broncos",
    "OldTip4": "Raiders",
    "OldTip5": "Roosters",
    "OldTip6": "Storm",
    "OldTip7": "Eels",
    "OldTip8": "Tigers"
  }
}
```

**Game fields:**

| Field | Description |
|---|---|
| `gameNumber` | Game index (1–8) |
| `currentTip` | Current saved tip — `H`, `A`, or `null` |
| `locked` | `true` if game has started and tip cannot be changed |
| `homeTeam` | Home team abbreviation |
| `awayTeam` | Away team abbreviation |
| `previousTip` | Previous round's tip for this game slot |

---

### `POST /tips`
Submit tips for a round.

**Request:**
```json
{
  "compid": "132428",
  "round": 6,
  "memberid": "558580",
  "tipref": "1542957",
  "margin": "12",
  "jokerCount": "1",
  "currentJokerCount": "0",
  "cutoff": "GAME",
  "code": "NRL",
  "tips": {
    "1": "A",
    "2": "H",
    "3": "H",
    "4": "A",
    "5": "A",
    "6": "H",
    "7": "H",
    "8": "H"
  },
  "oldFields": {
    "OldTip1": "Panthers",
    "OldMargin": "12",
    "OldMarginNonSub": "N",
    "OldTip2": "Dragons",
    "OldTip3": "Broncos",
    "OldTip4": "Raiders",
    "OldTip5": "Roosters",
    "OldTip6": "Storm",
    "OldTip7": "Eels",
    "OldTip8": "Tigers"
  }
}
```

**Notes:**
- `tips` keys are game numbers as strings
- `tips` values are `"H"` (home) or `"A"` (away)
- `oldFields` must come directly from the `/fixture` response — do not hardcode
- `margin` is always a number as a string
- Locked games still need their tip value included

**Success response:**
```json
{
  "success": true,
  "statusCode": 200,
  "response": "<!DOCTYPE html>..."
}
```

---

## Expo App Integration

### Architecture

```
Expo App
    ↓  HTTP calls
Proxy Server (localhost:3000 or deployed URL)
    ↓  HTTP + cookies
itipfooty.com.au
```

The Expo app never talks directly to iTipFooty. All requests go through the proxy.

### Environment Variable

Set the proxy URL in your Expo app via `.env`:

```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

When deployed, change this to your Railway/Render URL — no app code changes needed.

### Client Helper (`lib/itipfooty.js`)

```javascript
const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const iTipFooty = {
  async login(username, password) {
    const res = await fetch(`${BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return res.json();
  },

  async getFixture(compid, round) {
    const url = round
      ? `${BASE}/fixture?compid=${compid}&round=${round}`
      : `${BASE}/fixture?compid=${compid}`;
    const res = await fetch(url);
    return res.json();
  },

  async submitTips(payload) {
    const res = await fetch(`${BASE}/tips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
};

export default iTipFooty;
```

### Session Strategy

Credentials are stored once using `expo-secure-store` and never re-entered:

```javascript
import * as SecureStore from 'expo-secure-store';

// On first launch — save credentials
await SecureStore.setItemAsync('itip_username', username);
await SecureStore.setItemAsync('itip_password', password);

// On every app launch — silent background login
const username = await SecureStore.getItemAsync('itip_username');
const password = await SecureStore.getItemAsync('itip_password');
await iTipFooty.login(username, password);
```

Call login in your root layout's `useEffect` so the session is ready before the user reaches the tipping screen.

---

## Planned UX Flow

### Current app flow (existing)
1. User long presses NRL logo
2. Tipping sheet slides up showing all games
3. User taps a team to select their tip
4. Taps Done

### Updated flow with proxy integration
1. App launches → silent login in background
2. App calls `/fixture` to load current tips
3. User long presses NRL logo
4. Tipping sheet slides up — pre-populated with current saved tips
5. User adjusts tips → taps **Done**
6. Tipping sheet closes → **Margin modal** appears
7. Modal shows: **"[Home Team] vs [Away Team] — Margin?"** with numeric input
8. User enters margin → taps **Submit**
9. App calls `/tips` with all tips + margin + oldFields from fixture
10. Success toast appears

### Margin Modal Notes
- Always appears after Done — cannot be skipped
- Label dynamically shows game 1 teams: e.g. `"Bulldogs vs Panthers — Margin?"`
- Pre-filled with current saved margin from `/fixture` response
- Numeric keyboard input only
- oldFields passed through transparently from the fixture response

---

## Deployment (Next Steps)

When ready to move off localhost:

1. Push `footy-proxy` to GitHub
2. Deploy to **Railway** or **Render** (free tier works fine)
3. Set `EXPO_PUBLIC_API_URL` in your Expo app to the deployed URL
4. The proxy becomes always-on — no laptop required

The proxy is stateful (cookie jar in memory) so it needs a persistent process — Railway and Render both provide this. If the server restarts, it will re-login automatically on the next request.

---

## Competition Details

| Field | Value |
|---|---|
| Site | https://www.itipfooty.com.au |
| Competition ID | 132428 |
| Member ID | 558580 |
| Sport Code | NRL |
| Username | Goodthanks18 |
