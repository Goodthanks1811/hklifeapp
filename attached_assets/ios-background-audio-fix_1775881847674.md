# iOS Background Audio Fix — React Native Expo

## The Problem

When an iPhone locks, iOS suspends apps that haven't declared they need background execution. This causes music to stop roughly 30 seconds after the screen turns off.

Two things are required to fix this:

1. A **background audio mode** declared in your app config
2. An **audio session configured** to stay active when the screen locks

---

## Fix 1 — Declare Background Mode in `app.json`

Add the `UIBackgroundModes` key to your iOS config:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["audio"]
      }
    }
  }
}
```

This tells iOS at the OS level that your app is allowed to run audio in the background.

---

## Fix 2 — Configure the Audio Session

Install `expo-av` if you haven't already:

```bash
npx expo install expo-av
```

Then call `Audio.setAudioModeAsync()` **once on app load, before any playback begins**:

```javascript
import { Audio } from 'expo-av';

async function setupAudioSession() {
  await Audio.setAudioModeAsync({
    staysActiveInBackground: true,   // KEY — keeps audio alive when locked
    playsInSilentModeIOS: true,      // plays even when silent switch is on
    allowsRecordingIOS: false,
    interruptionModeIOS: 1,          // DO_NOT_MIX
    shouldDuckAndroid: true,
    interruptionModeAndroid: 1,
  });
}
```

> `staysActiveInBackground: true` is almost always the missing piece. The `UIBackgroundModes` declaration in `app.json` is what permits it at the OS level — both are required.

---

## Important — Expo Go Won't Work

If you're running the app through **Expo Go**, background audio will **not work** even with the config correctly set. Expo Go doesn't support custom `UIBackgroundModes`.

You need a **development build**:

```bash
npx expo install expo-dev-client
npx eas build --profile development --platform ios
```

Or if you're not using EAS:

```bash
npx expo run:ios
```

---

## Checklist

| Step | Done? |
|---|---|
| `UIBackgroundModes: ["audio"]` added to `app.json` | ✅ |
| `staysActiveInBackground: true` set in `Audio.setAudioModeAsync` | ✅ |
| `setupAudioSession()` called before first playback | ✅ |
| Using a dev build (not Expo Go) | ✅ |
