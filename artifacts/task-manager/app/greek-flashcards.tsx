import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Animated,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const greekFlag = require("../assets/images/greek-flag.png");
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Colors } from "@/constants/colors";

// ── Data ──────────────────────────────────────────────────────────────────────
const ALPHABET = [
  { char: "Α α", sound: "a" },
  { char: "Β β", sound: "v" },
  { char: "Γ γ", sound: "g" },
  { char: "Δ δ", sound: "th" },
  { char: "Ε ε", sound: "e" },
  { char: "Ζ ζ", sound: "z" },
  { char: "Η η", sound: "i" },
  { char: "Θ θ", sound: "th" },
  { char: "Ι ι", sound: "i" },
  { char: "Κ κ", sound: "k" },
  { char: "Λ λ", sound: "l" },
  { char: "Μ μ", sound: "m" },
  { char: "Ν ν", sound: "n" },
  { char: "Ξ ξ", sound: "ks" },
  { char: "Ο ο", sound: "o" },
  { char: "Π π", sound: "p" },
  { char: "Ρ ρ", sound: "r" },
  { char: "Σ σ", sound: "s" },
  { char: "Τ τ", sound: "t" },
  { char: "Υ υ", sound: "i" },
  { char: "Φ φ", sound: "f" },
  { char: "Χ χ", sound: "kh" },
  { char: "Ψ ψ", sound: "ps" },
  { char: "Ω ω", sound: "o" },
];

const SIZES = [5, 10, 15, 20, 24] as const;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function norm(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z ]/g, "");
}

type Mistake = { char: string; correct: string; given: string };
type Screen  = "start" | "quiz" | "score";

function PillBar({ selected, onSelect }: { selected: number; onSelect: (n: number) => void }) {
  return (
    <View style={pill.row}>
      {SIZES.map((n) => (
        <Pressable
          key={n}
          style={[pill.base, selected === n && pill.active]}
          onPress={() => onSelect(n)}
        >
          <Text style={[pill.label, selected === n && pill.labelActive]}>
            {n === 24 ? "All" : String(n)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const pill = StyleSheet.create({
  row:         { flexDirection: "row", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 },
  base:        { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 100, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.06)" },
  active:      { backgroundColor: Colors.primary, borderColor: Colors.primary },
  label:       { fontSize: 16, fontWeight: "600", color: "rgba(255,255,255,0.65)", fontFamily: "Inter_600SemiBold" },
  labelActive: { color: "#fff" },
});

export default function GreekFlashcardsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const [screen,      setScreen]      = useState<Screen>("start");
  const [sessionSize, setSessionSize] = useState(5);
  const [session,     setSession]     = useState<typeof ALPHABET>([]);
  const [idx,         setIdx]         = useState(0);
  const [answer,      setAnswer]      = useState("");
  const [answered,    setAnswered]    = useState(false);
  const [hintUsed,    setHintUsed]    = useState(false);
  const [hintShown,   setHintShown]   = useState(false);
  const [feedback,    setFeedback]    = useState<{ kind: "correct" | "incorrect" | "hint" | ""; char: string; sound: string }>({ kind: "", char: "", sound: "" });
  const [score,       setScore]       = useState(0);
  const [mistakes,    setMistakes]    = useState<Mistake[]>([]);

  const inputRef     = useRef<TextInput>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const kbOffset     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", (e) => {
      Animated.timing(kbOffset, { toValue: e.endCoordinates.height / 2, duration: e.duration ?? 250, useNativeDriver: true }).start();
    });
    const hide = Keyboard.addListener("keyboardWillHide", (e) => {
      Animated.timing(kbOffset, { toValue: 0, duration: e.duration ?? 250, useNativeDriver: true }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, [kbOffset]);

  const animateProgress = useCallback((to: number) => {
    Animated.timing(progressAnim, { toValue: to, duration: 400, useNativeDriver: false }).start();
  }, [progressAnim]);

  const startSession = useCallback(() => {
    const s = shuffle(ALPHABET).slice(0, sessionSize);
    setSession(s);
    setIdx(0);
    setScore(0);
    setMistakes([]);
    setAnswer("");
    setAnswered(false);
    setHintUsed(false);
    setHintShown(false);
    setFeedback({ kind: "", char: "", sound: "" });
    animateProgress(0);
    setScreen("quiz");
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [sessionSize, animateProgress]);

  const showHint = useCallback(() => {
    if (answered) return;
    setHintUsed(true);
    setHintShown(true);
    setFeedback({ kind: "hint", char: session[idx].char, sound: session[idx].sound });
  }, [answered, session, idx]);

  const checkAnswer = useCallback(() => {
    if (answered) {
      const next = idx + 1;
      if (next >= session.length) {
        animateProgress(1);
        setScreen("score");
      } else {
        setIdx(next);
        animateProgress(next / session.length);
        setAnswer("");
        setAnswered(false);
        setHintUsed(false);
        setHintShown(false);
        setFeedback({ kind: "", char: "", sound: "" });
        setTimeout(() => inputRef.current?.focus(), 200);
      }
      return;
    }
    const user    = norm(answer);
    if (!user) return;
    const correct = norm(session[idx].sound);
    setAnswered(true);
    if (user === correct) {
      if (!hintUsed) {
        setScore(s => s + 1);
        setFeedback({ kind: "correct", char: session[idx].char, sound: session[idx].sound });
      } else {
        setFeedback({ kind: "hint", char: session[idx].char, sound: session[idx].sound });
        setMistakes(m => [...m, { char: session[idx].char, correct: session[idx].sound, given: "(hint)" }]);
      }
    } else {
      setFeedback({ kind: "incorrect", char: session[idx].char, sound: session[idx].sound });
      setMistakes(m => [...m, { char: session[idx].char, correct: session[idx].sound, given: answer.trim() }]);
    }
  }, [answered, answer, session, idx, hintUsed, animateProgress]);

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  // ── Start screen ─────────────────────────────────────────────────────────────
  if (screen === "start") {
    return (
      <View style={[s.root, { paddingTop: topPad }]}>
        <ScreenHeader title="Greek Flashcards" />
        <ScrollView contentContainerStyle={s.centerContainer} keyboardShouldPersistTaps="handled">
          <Image source={greekFlag} style={s.flagImg} resizeMode="contain" />
          <Text style={s.bigTitle}>Greek Alphabet</Text>
          <Text style={s.subtitle}>24 letters · type the sound</Text>
          <Text style={s.sectionLabel}>CARDS PER SESSION</Text>
          <PillBar selected={sessionSize} onSelect={setSessionSize} />
          <Pressable style={s.btnPrimary} onPress={startSession}>
            <Text style={s.btnPrimaryText}>Start</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── Score screen ─────────────────────────────────────────────────────────────
  if (screen === "score") {
    const pct  = score / session.length;
    const good = pct >= 0.8;
    return (
      <View style={[s.root, { paddingTop: topPad }]}>
        <ScreenHeader title="Greek Flashcards" />
        <ScrollView contentContainerStyle={s.centerContainer}>
          <Text style={s.flag}>🏆</Text>
          <Text style={s.bigTitle}>Session Complete!</Text>
          <Text style={s.subtitle}>{good ? "Great work! Μπράβο!" : "Keep practising!"}</Text>
          <Text style={[s.scoreBig, { color: good ? "#2cb67d" : Colors.primary }]}>{score}</Text>
          <Text style={s.scoreLabel}>out of {session.length} correct</Text>
          {mistakes.length > 0 && (
            <View style={s.mistakesBox}>
              <Text style={s.mistakesTitle}>REVIEW THESE</Text>
              {mistakes.map((m, i) => (
                <View key={i} style={[s.mistakeRow, i === mistakes.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={s.mChar}>{m.char}</Text>
                  <Text style={s.mRight}>✓ {m.correct}</Text>
                  <Text style={s.mWrong}>✗ {m.given}</Text>
                </View>
              ))}
            </View>
          )}
          <Pressable style={s.btnPrimary} onPress={startSession}>
            <Text style={s.btnPrimaryText}>Play Again</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── Quiz screen ───────────────────────────────────────────────────────────────
  const card = session[idx];

  const fbAccent = feedback.kind === "correct" ? "#2f9e44"
    : feedback.kind === "hint" ? "#1971c2"
    : "#e03131";
  const fbBg = feedback.kind === "correct" ? "rgba(47,158,68,0.15)"
    : feedback.kind === "hint" ? "rgba(25,113,194,0.15)"
    : "rgba(224,49,49,0.15)";
  const fbTitle  = feedback.kind === "correct" ? "Correct"
    : feedback.kind === "hint" ? "Hint"
    : "Incorrect";
  const fbIcon = feedback.kind === "correct" ? "✓"
    : feedback.kind === "hint" ? "i"
    : "✗";
  const capSound = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <ScreenHeader title="Greek Flashcards" />

      <View style={s.progressBg}>
        <Animated.View style={[s.progressFill, { width: progressWidth }]} />
      </View>

      <Animated.View style={[{ flex: 1 }, { transform: [{ translateY: Animated.multiply(kbOffset, -1) }] }]}>
        <ScrollView contentContainerStyle={s.quizContainer} keyboardShouldPersistTaps="handled" scrollEnabled={false}>
          <View style={s.card}>
            <Text style={s.cardLabel}>WHAT SOUND DOES THIS MAKE?</Text>
            <Text style={s.cardChar}>{card.char}</Text>
            <Text style={s.cardCounter}>{idx + 1} / {session.length}</Text>
          </View>

          <TextInput
            ref={inputRef}
            style={s.input}
            value={answer}
            onChangeText={setAnswer}
            placeholder="Type the sound…"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            returnKeyType="done"
            onSubmitEditing={checkAnswer}
            editable={!answered}
          />

          <View style={s.btnRow}>
            <Pressable style={[s.btnPrimary, { flex: 1 }]} onPress={checkAnswer}>
              <Text style={s.btnPrimaryText}>{answered ? "Next →" : "Check"}</Text>
            </Pressable>
            <Pressable
              style={[s.btnHint, hintShown && s.btnHintRevealed]}
              onPress={showHint}
              disabled={answered || hintShown}
            >
              <Text style={[s.btnHintText, hintShown && s.btnHintTextRevealed]}>
                {hintShown ? "✓ Shown" : "Hint"}
              </Text>
            </Pressable>
          </View>

          {feedback.kind ? (
            <View style={[s.alertCard, { backgroundColor: fbBg, borderColor: fbAccent }]}>
              <View style={s.alertRow}>
                {feedback.kind === "hint" ? (
                  <View style={[s.alertIconCircle, { borderColor: fbAccent }]}>
                    <Text style={[s.alertIconCircleText, { color: fbAccent }]}>i</Text>
                  </View>
                ) : (
                  <Text style={[s.alertIcon, { color: fbAccent }]}>{fbIcon}</Text>
                )}
                <Text style={[s.alertTitle, { color: fbAccent }]}>{fbTitle}</Text>
                {feedback.kind === "incorrect" && (
                  <Text style={s.alertSub}>{"  "}The sound is {capSound(feedback.sound)}</Text>
                )}
                {feedback.kind === "hint" && (
                  <Text style={s.alertSub}>{"  "}{capSound(feedback.sound)}</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={s.alertPlaceholder} />
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: "#0b0b0c" },
  progressBg:      { height: 4, backgroundColor: "rgba(255,255,255,0.08)" },
  progressFill:    { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  centerContainer: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  quizContainer:   { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  flag:            { fontSize: 64, marginBottom: 16 },
  flagImg:         { width: 240, height: 160, marginBottom: 20, borderRadius: 8 },
  bigTitle:        { fontSize: 26, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 6 },
  subtitle:        { fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 36 },
  sectionLabel:    { fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.35)", marginBottom: 14 },
  card:            { width: "100%", maxWidth: 480, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#2A2A2A", borderRadius: 20, padding: 48, alignItems: "center", marginBottom: 20 },
  cardLabel:       { fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.35)", marginBottom: 12 },
  cardChar:        { fontSize: 80, lineHeight: 96, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 10 },
  cardCounter:     { fontSize: 13, color: "rgba(255,255,255,0.3)" },
  input:           { width: "100%", maxWidth: 480, padding: 16, fontSize: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 10, backgroundColor: "transparent", color: "#fff", marginBottom: 14, fontFamily: "Inter_400Regular" },
  btnRow:          { flexDirection: "row", gap: 10, width: "100%", maxWidth: 480, marginBottom: 14 },
  btnPrimary:      { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 17, paddingHorizontal: 24, alignItems: "center", justifyContent: "center" },
  btnPrimaryText:  { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  btnHint:         { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)", borderRadius: 12, paddingVertical: 17, paddingHorizontal: 22, alignItems: "center", justifyContent: "center" },
  btnHintRevealed: { backgroundColor: "rgba(255,200,50,0.12)", borderColor: "rgba(255,200,50,0.35)" },
  btnHintText:     { color: "rgba(255,255,255,0.65)", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  btnHintTextRevealed: { color: "#ffc832" },
  alertCard:       { width: "100%", maxWidth: 480, borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 12 },
  alertRow:        { flexDirection: "row", alignItems: "center" },
  alertIcon:       { fontSize: 16, fontWeight: "700", marginRight: 8 },
  alertIconCircle:     { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginRight: 8 },
  alertIconCircleText: { fontSize: 11, fontFamily: "Inter_700Bold", lineHeight: 14 },
  alertTitle:      { fontSize: 15, fontFamily: "Inter_700Bold" },
  alertSub:        { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  alertPlaceholder:{ height: 56, marginTop: 12 },
  scoreBig:        { fontSize: 88, fontFamily: "Inter_700Bold", lineHeight: 96, marginBottom: 4 },
  scoreLabel:      { fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 28 },
  mistakesBox:     { width: "100%", maxWidth: 480, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 14, padding: 18, marginBottom: 28 },
  mistakesTitle:   { fontSize: 11, letterSpacing: 1.5, color: "rgba(255,255,255,0.35)", marginBottom: 12 },
  mistakeRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", gap: 8 },
  mChar:           { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff", minWidth: 56 },
  mRight:          { fontSize: 14, color: "#2cb67d", flex: 1 },
  mWrong:          { fontSize: 14, color: "#ff6b6b", flex: 1, textAlign: "right" },
});
