# Music Fixes — Apple Playlists, Spotify Connection & My Music Dropout

## Apple Music — Playlists

### Filtering Which Playlists Show Up

You can filter the Apple Music screen to only show specific playlists rather than your entire library.

**How to use it:**
1. Open the Apple Music screen
2. **Long-press** the EQ icon in the top-left header (hold for ~0.4 seconds)
3. A dialog will appear showing your current filters
4. Tap **Add Filter** — type any part of a playlist name (e.g. "Gym" or "Chill") and tap OK
5. Only playlists whose names contain that word will be shown
6. You can add multiple filters — any playlist matching at least one will appear
7. To go back to seeing everything, long-press again and tap **Clear All Filters**

Filters are saved and will persist the next time you open the app.

---

### Apple Music Song Tap — No Response / Getting Stuck

Previously, tapping a song in Apple Music would sometimes appear to do nothing — no audio would start, and tapping other songs also did nothing. The screen was frozen.

**What was happening:** Apple Music's native player occasionally gets stuck during startup (DRM check, player state). The app was waiting indefinitely for it to respond, which locked out all other taps.

**What's fixed:** The app now waits a maximum of 8 seconds for Apple Music to respond. If it doesn't, you'll see a clear error message and the screen unlocks so you can try again.

---

## Spotify — Connection & 403 Errors

### What a 403 Error Means

A 403 (Forbidden) error from Spotify means your current access token doesn't have permission to read that playlist. This usually happens when:
- Your Spotify token is old and was issued before certain permissions were added
- You connected Spotify a long time ago and the token has degraded

### What to Do

When you open a playlist and see the **Access Restricted** screen:
1. Tap **Reconnect Spotify**
2. Log in to Spotify and approve the permissions
3. Come back and try the playlist again — it should load normally

Previously this also showed a confusing raw error popup before the Reconnect screen appeared. That extra popup has been removed — you now go straight to the Reconnect screen.

---

## My Music — Audio Dropping Out After Locking Phone

### The Problem

My Music (your local audio files) was stopping approximately 53 seconds after you locked your phone screen.

### Why It Was Happening

When a track finishes and the next one starts, the audio system briefly goes idle during the changeover. iOS gives the app a 30-second window to recover before it shuts down the audio. The code that was supposed to keep the audio alive during this window was running for Spotify but had never been switched on for My Music — so iOS would kill the audio every time a track transition happened while the phone was locked.

The 53-second pattern: roughly 23 seconds of playing before the first track transition, then 30 seconds for iOS's kill clock = ~53 seconds total.

### What's Fixed

The keep-alive system now starts immediately when you play any My Music track, not just Spotify. It fires every 2 seconds at the native level — independently of the app's main process — so iOS's kill clock gets reset well before it runs out, regardless of what the app is doing.
