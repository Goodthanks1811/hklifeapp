import React, { useEffect, useRef, useState } from "react";
import {
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PageLoader } from "@/components/PageLoader";
import { useAnthropic } from "@/context/AnthropicContext";
import { Colors } from "@/constants/colors";

// ── Storage ──────────────────────────────────────────────────────────────────

const SEEN_KEY = "phil_seen_v1";
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
  concept:          string;
  branch:           string;
  tradition:        string;
  description:      string;
  thoughtExperiment: string;
  modernRelevance:  string;
  keyThinker:       string;
  keyWork:          string;
}

async function fetchConcept(apiKey: string, excluded: string[]): Promise<Concept> {
  const excludeStr = excluded.length
    ? `Do NOT use any of these (recently shown): ${excluded.join(", ")}.`
    : "";

  const prompt = `You are a philosophy professor crafting a daily concept card for curious, intelligent non-specialists.
${excludeStr}

Pick ONE interesting philosophical concept, thought experiment, logical concept, ethical dilemma, or idea from any tradition — Western, Eastern, African, Islamic, analytic, continental, ancient, modern. Favour lesser-known treasures over overused clichés like Trolley Problem or Cogito.

Respond with ONLY a valid JSON object — no markdown, no code fences, no extra text:
{
  "concept": "Name of the concept or idea",
  "branch": "Branch of philosophy (e.g. Ethics, Metaphysics, Epistemology, Logic, Political Philosophy, Aesthetics, Philosophy of Mind, etc.)",
  "tradition": "e.g. Ancient Greek, Stoic, Buddhist, Analytic, Continental, Islamic, African, etc.",
  "description": "Clear 2-sentence explanation accessible to a smart non-philosopher",
  "thoughtExperiment": "A brief thought experiment or scenario that illustrates the concept vividly",
  "modernRelevance": "How this idea applies to life, technology, politics, or human experience today",
  "keyThinker": "Primary philosopher or thinker associated with this concept",
  "keyWork": "The key text or work where this idea appears"
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
      max_tokens: 600,
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

// ── Branch numerals ───────────────────────────────────────────────────────────

const GLYPHS: Record<string, string> = {
  "Ethics":                  "I",
  "Metaphysics":             "II",
  "Epistemology":            "III",
  "Logic":                   "IV",
  "Political Philosophy":    "V",
  "Aesthetics":              "VI",
  "Philosophy of Mind":      "VII",
  "Philosophy of Language":  "VIII",
};

// ── HTML builder ─────────────────────────────────────────────────────────────

function buildHTML(concept: Concept, seenCount: number, maxW: number): string {
  const dateStr = new Date().toLocaleDateString("en-AU", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const numeral = GLYPHS[concept.branch] ?? "∞";
  const pct = Math.min((seenCount / 100) * 100, 100);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Philosophy Daily</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<style>
:root {
  --bg:      #09090b;
  --surface: #111113;
  --sur2:    #171719;
  --border:  #252527;
  --gold:    #c9a84c;
  --gold2:   #8a6e2f;
  --text:    #e2e2e0;
  --muted:   #888;
  --dim:     #4a4a4a;
}
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: 'Jost', -apple-system, sans-serif;
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
  animation: up .6s cubic-bezier(.16,1,.3,1) both;
}
@keyframes up {
  from { opacity:0; transform:translateY(18px); }
  to   { opacity:1; transform:translateY(0); }
}
.hdr {
  text-align: center;
  padding-bottom: 26px;
  margin-bottom: 26px;
  position: relative;
}
.hdr::after {
  content: '';
  position: absolute;
  bottom: 0; left: 15%; right: 15%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold2), transparent);
}
.hdr-date {
  font-size: .68rem;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--dim);
  margin-bottom: 12px;
}
.hdr-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 2.6rem;
  font-weight: 300;
  color: var(--text);
  letter-spacing: .5px;
  line-height: 1;
}
.hdr-title em { font-style: italic; color: var(--gold); }
.hdr-sub { margin-top:10px; font-size:.72rem; color:var(--dim); font-weight:300; letter-spacing:1px; }
.concept-meta {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 20px;
}
.numeral {
  font-family: 'Cormorant Garamond', serif;
  font-size: 3.2rem;
  font-weight: 300;
  color: var(--gold2);
  line-height: .9;
  flex-shrink: 0;
  min-width: 42px;
}
.meta-right { flex: 1; }
.tags { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px; }
.tag {
  display: inline-flex;
  align-items: center;
  background: var(--sur2);
  border: 1px solid var(--border);
  color: var(--gold);
  font-size: .63rem;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 20px;
  font-weight: 400;
}
.tag.tradition { color: var(--muted); border-color: #1e1e20; }
.concept-name {
  font-family: 'Cormorant Garamond', serif;
  font-size: 2.2rem;
  font-weight: 400;
  color: #fff;
  line-height: 1.1;
  letter-spacing: -.2px;
}
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 22px;
  margin-bottom: 10px;
}
.desc {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.2rem;
  font-weight: 300;
  line-height: 1.7;
  color: #d0d0ce;
  font-style: italic;
  margin-bottom: 18px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
}
.thinker-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: var(--sur2);
  border: 1px solid var(--border);
  border-radius: 14px;
  margin-bottom: 8px;
}
.thinker-icon {
  width:36px; height:36px;
  background:#0f0f0a;
  border:1px solid var(--gold2);
  border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-size:.95rem; flex-shrink:0; margin-top:2px;
}
.thinker-name { font-size:.9rem; color:var(--text); font-weight:500; margin-bottom:3px; }
.thinker-work { font-size:.82rem; color:var(--muted); font-style:italic; font-family:'Cormorant Garamond',serif; }
.sub {
  background: var(--sur2);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 8px;
}
.sub:last-of-type { margin-bottom:0; }
.sub-label {
  font-size: .63rem;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--gold);
  font-weight: 500;
  margin-bottom: 7px;
}
.sub-body { font-size:.92rem; line-height:1.6; color:#adadab; font-weight:300; }
.sub-body.thought {
  font-family:'Cormorant Garamond',serif;
  font-style:italic;
  font-size:1.05rem;
  color:#c0c0be;
}
.progress-row {
  display:flex; align-items:center; gap:10px;
  margin-top:18px; padding-top:14px;
  border-top:1px solid var(--border);
}
.progress-bar { flex:1; height:2px; background:var(--border); border-radius:2px; overflow:hidden; }
.progress-fill {
  height:100%;
  background:linear-gradient(90deg, var(--gold2), var(--gold));
  border-radius:2px;
  width:${pct}%;
}
.progress-label { font-size:.7rem; color:var(--dim); white-space:nowrap; }
.footer {
  text-align:center;
  margin-top:18px;
  font-size:.63rem;
  color:var(--dim);
  letter-spacing:1.5px;
  text-transform:uppercase;
}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <div class="hdr-date">${dateStr}</div>
    <div class="hdr-title"><em>Philosophy</em> Daily</div>
    <div class="hdr-sub">${seenCount} idea${seenCount !== 1 ? "s" : ""} contemplated</div>
  </div>
  <div class="concept-meta">
    <div class="numeral">${numeral}</div>
    <div class="meta-right">
      <div class="tags">
        <span class="tag">${concept.branch}</span>
        <span class="tag tradition">${concept.tradition}</span>
      </div>
      <div class="concept-name">${concept.concept}</div>
    </div>
  </div>
  <div class="card">
    <div class="desc">${concept.description}</div>
    <div class="thinker-row">
      <div class="thinker-icon">🏛</div>
      <div>
        <div class="thinker-name">${concept.keyThinker}</div>
        <div class="thinker-work">${concept.keyWork}</div>
      </div>
    </div>
    <div class="sub" style="margin-top:8px">
      <div class="sub-label">🪬 Thought Experiment</div>
      <div class="sub-body thought">${concept.thoughtExperiment}</div>
    </div>
    <div class="sub">
      <div class="sub-label">⚡ Modern Relevance</div>
      <div class="sub-body">${concept.modernRelevance}</div>
    </div>
    <div class="progress-row">
      <div class="progress-bar"><div class="progress-fill"></div></div>
      <div class="progress-label">${seenCount} / 100</div>
    </div>
  </div>
  <div class="footer">philosophy daily · ai-generated · dark edition</div>
</div>
</body>
</html>`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PhilosophyDailyScreen() {
  const insets     = useSafeAreaInsets();
  const { width }  = useWindowDimensions();
  const { apiKey } = useAnthropic();
  const isTablet   = width >= 768;
  const maxW       = isTablet ? Math.min(Math.round(width * 0.72), 720) : 520;

  const [html,    setHtml]    = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const conceptRef = useRef<Concept | null>(null);

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

  const handleShare = async () => {
    const c = conceptRef.current;
    if (!c) return;
    try {
      await Share.share({
        message: `📜 Philosophy Daily\n\n${c.concept} (${c.branch} · ${c.tradition})\n\n${c.description}\n\n🪬 ${c.thoughtExperiment}\n\n⚡ ${c.modernRelevance}\n\n🏛 ${c.keyThinker} — ${c.keyWork}`,
        title: `Philosophy Daily — ${c.concept}`,
      });
    } catch {}
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Philosophy Daily" />

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
            source={{ html, baseUrl: "https://fonts.googleapis.com" }}
            style={styles.web}
            originWhitelist={["*"]}
            scrollEnabled
            showsVerticalScrollIndicator={false}
            javaScriptEnabled
          />
          <View style={[styles.toolbar, { paddingBottom: insets.bottom + 8 }]}>
            <TouchableOpacity style={styles.shareBtn} activeOpacity={0.8} onPress={handleShare}>
              <Feather name="share" size={16} color="#fff" />
              <Text style={styles.shareBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: "#09090b" },
  web:         { flex: 1, backgroundColor: "#09090b" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  emptyTitle:  { color: "#e2e2e0", fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptyBody:   { color: "#888", fontSize: 13, textAlign: "center", lineHeight: 20 },
  toolbar:     { paddingHorizontal: 20, paddingTop: 10, backgroundColor: "#09090b", borderTopWidth: 1, borderTopColor: "#252527" },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#111113",
    borderWidth: 1,
    borderColor: "#252527",
    borderRadius: 30,
    paddingVertical: 12,
  },
  shareBtnText: { color: "#e2e2e0", fontSize: 14, fontFamily: "Inter_500Medium" },
});
