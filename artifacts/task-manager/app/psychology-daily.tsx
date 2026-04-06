import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import { Feather } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PageLoader } from "@/components/PageLoader";
import { useAnthropic } from "@/context/AnthropicContext";
import { Colors } from "@/constants/colors";

// ── Animation timing ─────────────────────────────────────────────────────────
const T_FADE_IN  = 200;
const T_SPIN_IN  = 250;
const T_POP      = 420;
const T_TICK     = 400;
const T_HOLD     = 700;
const T_FADE_OUT = 450;
const SPINNER_SIZE   = 72;
const SPINNER_STROKE = 8;
const CIRCLE_SIZE    = 74;

// ── Storage ──────────────────────────────────────────────────────────────────

const SEEN_KEY = "psych_seen_v1";
const MAX_SEEN = 60;

type SeenEntry = { concept: string; date: string };

async function loadSeen(): Promise<SeenEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

async function addSeen(name: string): Promise<number> {
  let list = await loadSeen();
  list.push({ concept: name, date: new Date().toISOString() });
  if (list.length > MAX_SEEN) list = list.slice(-MAX_SEEN);
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(list));
  return list.length;
}

function recentNames(list: SeenEntry[], days = 30): string[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return list.filter((s) => new Date(s.date) > cutoff).map((s) => s.concept);
}

// ── Claude fetch ─────────────────────────────────────────────────────────────

interface Concept {
  concept:    string;
  category:   string;
  description: string;
  example:    string;
  didYouKnow: string;
  keyFigure:  string;
}

async function fetchConcept(apiKey: string, excluded: string[]): Promise<Concept> {
  const excludeStr = excluded.length
    ? `Do NOT use any of these (recently shown): ${excluded.join(", ")}.`
    : "";

  const prompt = `You are a psychology educator. Generate ONE interesting psychology concept for a daily learning app.
${excludeStr}

Choose from any area: cognitive, social, clinical, developmental, behavioural, neuropsychology, positive psychology, personality, etc. Favour lesser-known gems over overused classics like Dunning-Kruger or Cognitive Dissonance.

Respond with ONLY a valid JSON object — no markdown, no code fences, no extra text:
{
  "concept": "Name of the concept",
  "category": "Branch of psychology",
  "description": "Clear 1-2 sentence explanation",
  "example": "Concrete real-world example",
  "didYouKnow": "Surprising historical or research fact",
  "keyFigure": "Key researcher or psychologist associated with this"
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content[0].text.trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  return JSON.parse(text) as Concept;
}

// ── HTML builder ─────────────────────────────────────────────────────────────

function buildHTML(concept: Concept, seenCount: number, maxW: number): string {
  const dateStr = new Date().toLocaleDateString("en-AU", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const pct = Math.min((seenCount / 100) * 100, 100);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Psychology Daily</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Serif+Display&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
<style>
:root {
  --bg:      #080808;
  --surface: #101010;
  --sur2:    #161616;
  --border:  #202020;
  --accent:  #c0392b;
  --accent2: #922b21;
  --text:    #e8e8e8;
  --muted:   #888;
  --dim:     #555;
}
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: 'DM Sans', -apple-system, sans-serif;
  background: var(--bg);
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 16px 48px;
  color: var(--text);
}
.wrap {
  width: 100%;
  max-width: ${maxW}px;
  animation: up .5s ease both;
}
@keyframes up {
  from { opacity:0; transform:translateY(14px); }
  to   { opacity:1; transform:translateY(0); }
}
.hdr {
  text-align: center;
  padding-bottom: 24px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border);
}
.hdr-date {
  font-size: .7rem;
  letter-spacing: 2.5px;
  text-transform: uppercase;
  color: var(--dim);
  margin-bottom: 10px;
}
.hdr-title {
  font-family: 'DM Serif Display', serif;
  font-size: 2rem;
  color: var(--text);
  letter-spacing: -.5px;
  line-height: 1;
}
.hdr-sub { margin-top:8px; font-size:.78rem; color:var(--dim); font-weight:300; }
.red { color: var(--accent); }
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 24px;
  margin-bottom: 10px;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--sur2);
  border: 1px solid var(--border);
  color: var(--accent);
  font-size: .7rem;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  padding: 4px 12px;
  border-radius: 30px;
  margin-bottom: 14px;
}
.concept-name {
  font-family: 'DM Serif Display', serif;
  font-size: 1.85rem;
  color: #fff;
  line-height: 1.1;
  margin-bottom: 12px;
  letter-spacing: -.3px;
}
.desc {
  font-size: 1rem;
  line-height: 1.65;
  color: #ccc;
  font-weight: 300;
  margin-bottom: 18px;
}
.sub {
  background: var(--sur2);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 8px;
}
.sub:last-of-type { margin-bottom: 0; }
.sub-label {
  font-size: .68rem;
  letter-spacing: 1.8px;
  text-transform: uppercase;
  color: var(--accent);
  font-weight: 500;
  margin-bottom: 6px;
}
.sub-body { font-size:.92rem; line-height:1.55; color:#b8b8b8; font-weight:300; }
.key-figure {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--sur2);
  border: 1px solid var(--border);
  border-radius: 14px;
  margin-bottom: 8px;
}
.kf-icon {
  width:34px; height:34px;
  background:#1a0a0a;
  border:1px solid var(--accent2);
  border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-size:.9rem; flex-shrink:0;
}
.kf-text { font-size:.85rem; color:#aaa; font-weight:300; }
.kf-text strong { color:var(--text); font-weight:500; }
.progress-row {
  display:flex; align-items:center; gap:10px;
  margin-top:18px; padding-top:14px;
  border-top:1px solid var(--border);
}
.progress-bar { flex:1; height:3px; background:var(--border); border-radius:2px; overflow:hidden; }
.progress-fill { height:100%; background:var(--accent); border-radius:2px; width:${pct}%; }
.progress-label { font-size:.72rem; color:var(--dim); white-space:nowrap; }
.footer {
  text-align:center;
  margin-top:18px;
  font-size:.68rem;
  color:var(--dim);
  letter-spacing:1px;
  text-transform:uppercase;
}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <div class="hdr-date">${dateStr}</div>
    <div class="hdr-title"><span class="red">Psychology</span> Daily</div>
    <div class="hdr-sub">${seenCount} concept${seenCount !== 1 ? "s" : ""} explored</div>
  </div>
  <div class="card">
    <div class="tag">📚 ${concept.category}</div>
    <div class="concept-name">${concept.concept}</div>
    <div class="desc">${concept.description}</div>
    <div class="key-figure">
      <div class="kf-icon">🎓</div>
      <div class="kf-text"><strong>Key Figure</strong> — ${concept.keyFigure}</div>
    </div>
    <div class="sub">
      <div class="sub-label">💬 Example</div>
      <div class="sub-body">${concept.example}</div>
    </div>
    <div class="sub">
      <div class="sub-label">💡 Did You Know?</div>
      <div class="sub-body">${concept.didYouKnow}</div>
    </div>
    <div class="progress-row">
      <div class="progress-bar"><div class="progress-fill"></div></div>
      <div class="progress-label">${seenCount} / 100</div>
    </div>
  </div>
  <div class="footer">psychology daily · ai-generated · dark edition</div>
</div>
</body>
</html>`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

// Two root fixes vs the original approach:
// 1. animation:none stops the .wrap opacity:0 "from" keyframe darkening the capture
// 2. system font override prevents cross-origin DM font taint making text transparent
// 3. Capturing .wrap (not documentElement) gives full card height, not just viewport
const CAPTURE_JS = `(function(){
  if(window.__cap)return;window.__cap=true;
  var s=document.createElement('style');s.id='__nocap';
  s.textContent='*,*::before,*::after{animation:none!important;transition:none!important;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif!important;}';
  document.head.appendChild(s);
  var el=document.querySelector('.wrap')||document.body;
  html2canvas(el,{backgroundColor:'#080808',scale:2,useCORS:false,allowTaint:false,logging:false})
    .then(function(c){var st=document.getElementById('__nocap');if(st&&st.parentNode)st.parentNode.removeChild(st);window.__cap=false;window.ReactNativeWebView.postMessage(JSON.stringify({type:'capture',data:c.toDataURL('image/jpeg',0.93)}));})
    .catch(function(e){var st=document.getElementById('__nocap');if(st&&st.parentNode)st.parentNode.removeChild(st);window.__cap=false;window.ReactNativeWebView.postMessage(JSON.stringify({type:'captureError',error:e.message}));});
})();true;`;

export default function PsychologyDailyScreen() {
  const insets        = useSafeAreaInsets();
  const { width }     = useWindowDimensions();
  const { apiKey }    = useAnthropic();
  const isTablet      = width >= 768;
  const maxW          = isTablet ? Math.min(Math.round(width * 0.72), 720) : 520;

  const [html,          setHtml]         = useState<string | null>(null);
  const [loading,       setLoading]      = useState(false);
  const [error,         setError]        = useState<string | null>(null);
  const [saving,        setSaving]       = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(false);
  const conceptRef  = useRef<Concept | null>(null);
  const webViewRef  = useRef<any>(null);

  const overlayOpacity  = useRef(new Animated.Value(0)).current;
  const spinnerOpacity  = useRef(new Animated.Value(0)).current;
  const spinnerRotation = useRef(new Animated.Value(0)).current;
  const circleScale     = useRef(new Animated.Value(0)).current;
  const circleOpacity   = useRef(new Animated.Value(0)).current;
  const tickScale       = useRef(new Animated.Value(0)).current;
  const spinLoopRef     = useRef<Animated.CompositeAnimation | null>(null);

  const resetLoaderValues = useCallback(() => {
    overlayOpacity.setValue(0); spinnerOpacity.setValue(0);
    spinnerRotation.setValue(0); circleScale.setValue(0);
    circleOpacity.setValue(0); tickScale.setValue(0);
  }, [overlayOpacity, spinnerOpacity, spinnerRotation, circleScale, circleOpacity, tickScale]);

  const startSaveLoader = useCallback(() => {
    resetLoaderValues();
    setLoaderVisible(true);
    spinLoopRef.current = Animated.loop(
      Animated.timing(spinnerRotation, { toValue: 1, duration: 600, easing: Easing.linear, useNativeDriver: true })
    );
    spinLoopRef.current.start();
    Animated.timing(overlayOpacity, { toValue: 1, duration: T_FADE_IN, useNativeDriver: true }).start(() => {
      Animated.timing(spinnerOpacity, { toValue: 1, duration: T_SPIN_IN, useNativeDriver: true }).start();
    });
  }, [overlayOpacity, spinnerOpacity, spinnerRotation, resetLoaderValues]);

  const resolveSaveLoader = useCallback((success: boolean) => {
    spinLoopRef.current?.stop();
    if (success) {
      Animated.parallel([
        Animated.timing(spinnerOpacity, { toValue: 0, duration: T_POP, useNativeDriver: true }),
        Animated.timing(circleOpacity,  { toValue: 1, duration: T_POP * 0.4, useNativeDriver: true }),
        Animated.timing(circleScale, { toValue: 1, duration: T_POP, easing: Easing.out(Easing.back(1.7)), useNativeDriver: true }),
      ]).start(() => {
        Animated.timing(tickScale, { toValue: 1, duration: T_TICK, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }).start(() => {
          setTimeout(() => {
            Animated.timing(overlayOpacity, { toValue: 0, duration: T_FADE_OUT, useNativeDriver: true }).start(() => {
              setLoaderVisible(false); resetLoaderValues(); setSaving(false);
            });
          }, T_HOLD);
        });
      });
    } else {
      Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setLoaderVisible(false); resetLoaderValues(); setSaving(false);
      });
    }
  }, [overlayOpacity, spinnerOpacity, circleScale, circleOpacity, tickScale, resetLoaderValues]);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const seen     = await loadSeen();
        const excluded = recentNames(seen);
        const concept  = await fetchConcept(apiKey, excluded);
        if (cancelled) return;
        conceptRef.current = concept;
        const count = await addSeen(concept.concept);
        setHtml(buildHTML(concept, count, maxW));
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [apiKey]);

  const handleSaveImage = async () => {
    if (saving) return;
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo library access to save images.");
      return;
    }
    setSaving(true);
    startSaveLoader();
    webViewRef.current?.injectJavaScript(CAPTURE_JS);
  };

  const handleMessage = async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type !== "capture") { resolveSaveLoader(false); return; }
      const base64 = (msg.data as string).replace(/^data:image\/\w+;base64,/, "");
      const uri = FileSystem.cacheDirectory + `psych_${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      await MediaLibrary.saveToLibraryAsync(uri);
      await FileSystem.deleteAsync(uri, { idempotent: true });
      resolveSaveLoader(true);
    } catch {
      resolveSaveLoader(false);
      Alert.alert("Error", "Couldn't save image. Please try again.");
    }
  };

  const spinDeg = spinnerRotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Psychology Daily" />

      {!apiKey && (
        <View style={styles.center}>
          <Feather name="key" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Anthropic API key needed</Text>
          <Text style={styles.emptyBody}>
            Add your Claude API key in Settings → Anthropic API to get started.
          </Text>
        </View>
      )}

      {apiKey && loading && (
        <PageLoader />
      )}

      {apiKey && !loading && error && (
        <View style={styles.center}>
          <Feather name="alert-circle" size={32} color={Colors.primary} />
          <Text style={styles.emptyTitle}>Couldn't fetch concept</Text>
          <Text style={styles.emptyBody}>{error}</Text>
        </View>
      )}

      {html && !loading && (
        <>
          <WebView
            ref={webViewRef}
            source={{ html, baseUrl: "https://fonts.googleapis.com" }}
            style={styles.web}
            originWhitelist={["*"]}
            scrollEnabled
            showsVerticalScrollIndicator={false}
            javaScriptEnabled
            onMessage={handleMessage}
          />
          <View style={[styles.toolbar, { paddingBottom: insets.bottom + 8 }]}>
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} activeOpacity={0.8} onPress={handleSaveImage} disabled={saving}>
              <Feather name="download" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Save to Photos</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {loaderVisible && (
        <Animated.View style={[styles.loaderOverlay, { opacity: overlayOpacity }]} pointerEvents="auto">
          <Animated.View style={[styles.spinnerWrap, { opacity: spinnerOpacity, transform: [{ rotate: spinDeg }] }]}>
            <View style={styles.spinnerRing} />
          </Animated.View>
          <Animated.View style={[styles.circleWrap, { opacity: circleOpacity, transform: [{ scale: circleScale }] }]}>
            <Animated.View style={{ transform: [{ scale: tickScale }] }}>
              <Feather name="check" size={40} color="#fff" />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: "#080808" },
  web:        { flex: 1, backgroundColor: "#080808" },
  center:     { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  emptyTitle: { color: "#e8e8e8", fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptyBody:  { color: "#888", fontSize: 13, textAlign: "center", lineHeight: 20 },
  toolbar:    { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4, backgroundColor: "#080808", borderTopWidth: 1, borderTopColor: "#202020" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 30,
    paddingVertical: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center", justifyContent: "center", zIndex: 999,
  },
  spinnerWrap: {
    width: SPINNER_SIZE, height: SPINNER_SIZE,
    alignItems: "center", justifyContent: "center",
    position: "absolute",
  },
  spinnerRing: {
    width: SPINNER_SIZE, height: SPINNER_SIZE, borderRadius: SPINNER_SIZE / 2,
    borderWidth: SPINNER_STROKE,
    borderColor: "rgba(255,255,255,0.85)",
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  circleWrap: {
    width: CIRCLE_SIZE, height: CIRCLE_SIZE, borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    position: "absolute",
  },
});
