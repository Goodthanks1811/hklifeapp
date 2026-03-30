import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useDrawer } from "@/context/DrawerContext";
import React, {
  useCallback, useEffect, useRef, useState,
} from "react";
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Defs, Line, Pattern, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Theme ──────────────────────────────────────────────────────────────────────
const T = {
  bg:      "#04060a",
  panel:   "#080d15",
  border:  "#0f2040",
  accent:  "#ff3c3c",
  accent2: "#ff7b00",
  dim:     "#1a2a3a",
  text:    "#ffffff",
  sub:     "#7a9dbc",
  muted:   "#4a6580",
  green:   "#00e87a",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function colorCls(pct: number): "good" | "warn" | "danger" {
  if (pct > 0.85) return "danger";
  if (pct > 0.50) return "warn";
  return "good";
}
const COLOR_MAP = { good: T.green, warn: T.accent2, danger: T.accent };
const GLOW_MAP  = {
  good:   "rgba(0,232,122,0.35)",
  warn:   "rgba(255,123,0,0.35)",
  danger: "rgba(255,60,60,0.6)",
};

function fmt(n: number, budget: number): string {
  const d = budget < 100 ? 4 : 2;
  return n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fmtTSmooth(s: number): string {
  s = Math.max(0, s);
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sf = s % 60;
  const si = Math.floor(sf);
  const sd = Math.floor((sf - si) * 10);
  const pm = String(m).padStart(2, "0");
  const ps = String(si).padStart(2, "0");
  const ph = String(h).padStart(2, "0");
  return (h > 0 ? `${ph}:${pm}:${ps}` : `${pm}:${ps}`) + `.${sd}`;
}

function fmtT(s: number): string {
  s = Math.max(0, s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const pm = String(m).padStart(2, "0");
  const ps = String(sec).padStart(2, "0");
  const ph = String(h).padStart(2, "0");
  return h > 0 ? `${ph}:${pm}:${ps}` : `${pm}:${ps}`;
}

// ── Duration presets ───────────────────────────────────────────────────────────
const DURATION_PRESETS = [
  { label: "1 minute",   value: 60 },
  { label: "5 minutes",  value: 300 },
  { label: "10 minutes", value: 600 },
  { label: "30 minutes", value: 1800 },
  { label: "1 hour",     value: 3600 },
  { label: "8 hours",    value: 28800 },
  { label: "Custom...",  value: -1 },
];
const CURRENCY_OPTS = [
  { label: "$ Dollar", value: "$" },
  { label: "€ Euro",   value: "€" },
  { label: "£ Pound",  value: "£" },
  { label: "¥ Yen",    value: "¥" },
];

// ── Grid background ────────────────────────────────────────────────────────────
function GridBackground({ w, h }: { w: number; h: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }]}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="grid" x="0" y="0" width="44" height="44" patternUnits="userSpaceOnUse">
            <Line x1="0" y1="0" x2="44" y2="0" stroke="rgba(255,60,60,0.04)" strokeWidth="1" />
            <Line x1="0" y1="0" x2="0" y2="44" stroke="rgba(255,60,60,0.04)" strokeWidth="1" />
          </Pattern>
        </Defs>
        <Rect width={w} height={h} fill="url(#grid)" />
      </Svg>
    </Animated.View>
  );
}

// ── Blinking dot ───────────────────────────────────────────────────────────────
function BlinkDot({ active }: { active: boolean }) {
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(blink, { toValue: 0, duration: 500, useNativeDriver: true }),
          Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      blink.stopAnimation();
      blink.setValue(1);
    }
  }, [active]);
  return (
    <Animated.View style={[bd.dot, { opacity: active ? blink : 1, backgroundColor: active ? T.accent : T.muted }]} />
  );
}
const bd = StyleSheet.create({
  dot: { width: 7, height: 7, borderRadius: 4 },
});

// ── Particle ───────────────────────────────────────────────────────────────────
interface Particle { id: number; x: number; size: number; color: string; animY: Animated.Value; animO: Animated.Value }
let _pid = 0;
function spawnParticle(pct: number): Particle {
  const color = pct > 0.85 ? T.accent : pct > 0.5 ? T.accent2 : T.green;
  const size  = 2 + Math.random() * 3.5;
  const dur   = Math.max(0.9, 3 - pct * 2.2) * 1000;
  const animY = new Animated.Value(0);
  const animO = new Animated.Value(0.4 + pct * 0.6);
  const id    = ++_pid;
  Animated.parallel([
    Animated.timing(animY, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true }),
    Animated.timing(animO, { toValue: 0,  duration: dur, easing: Easing.linear, useNativeDriver: true }),
  ]).start();
  return { id, x: 8 + Math.random() * 84, size, color, animY, animO };
}

// ── Custom option picker ───────────────────────────────────────────────────────
function PickerSheet<T extends { label: string; value: any }>({
  visible, options, selected, onSelect, onClose,
}: { visible: boolean; options: T[]; selected: any; onSelect: (v: any) => void; onClose: () => void }) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={ps.backdrop} onPress={onClose}>
        <View style={ps.sheet}>
          {options.map(o => (
            <Pressable key={String(o.value)} style={[ps.row, o.value === selected && ps.rowSel]} onPress={() => { onSelect(o.value); onClose(); }}>
              <Text style={[ps.lbl, o.value === selected && ps.lblSel]}>{o.label}</Text>
              {o.value === selected && <Feather name="check" size={14} color={T.accent} />}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}
const ps = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  sheet:    { backgroundColor: T.panel, borderWidth: 1, borderColor: T.border, borderRadius: 14, width: "80%", maxWidth: 340, overflow: "hidden" },
  row:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: T.border },
  rowSel:   { backgroundColor: "rgba(255,60,60,0.06)" },
  lbl:      { color: T.sub, fontSize: 14, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  lblSel:   { color: T.text, fontWeight: "700" },
});

// ── Main screen ────────────────────────────────────────────────────────────────
export default function TimeBurnScreen() {
  const { openDrawer } = useDrawer();
  const insets             = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const isTablet           = screenW >= 768;

  // ── Config state ─────────────────────────────────────────────────────────────
  const [cfg, setCfg] = useState({ label: "Meeting Cost", budget: 1000, duration: 1800, currency: "$" });

  // ── Timer state ───────────────────────────────────────────────────────────────
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef  = useRef({ running: false, elapsed: 0, lastTs: 0, dispRem: cfg.budget, dispBurned: 0 });

  type Status = "READY" | "LIVE" | "PAUSED" | "DEPLETED";
  const [status,   setStatus]   = useState<Status>("READY");
  const [dispRem,  setDispRem]  = useState(cfg.budget);
  const [dispBurned, setDispBurned] = useState(0);
  const [elapsed,  setElapsed]  = useState(0);

  // ── Particles ─────────────────────────────────────────────────────────────────
  const [particles, setParticles] = useState<Particle[]>([]);
  const ptTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Config modal ──────────────────────────────────────────────────────────────
  const [cfgOpen,  setCfgOpen]  = useState(false);
  const [cfgLabel, setCfgLabel] = useState(cfg.label);
  const [cfgBudget, setCfgBudget] = useState(String(cfg.budget));
  const [cfgDurVal, setCfgDurVal] = useState(cfg.duration);
  const [cfgCust,  setCfgCust]  = useState("120");
  const [cfgCurr,  setCfgCurr]  = useState(cfg.currency);
  const [durPickerOpen, setDurPickerOpen]   = useState(false);
  const [currPickerOpen, setCurrPickerOpen] = useState(false);
  const kbOffset = useRef(new Animated.Value(0)).current;

  // ── Keyboard offset for cfg modal ─────────────────────────────────────────────
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", (e: KeyboardEvent) => {
      Animated.timing(kbOffset, { toValue: e.endCoordinates.height / 2, duration: e.duration, useNativeDriver: true }).start();
    });
    const hide = Keyboard.addListener("keyboardWillHide", (e: KeyboardEvent) => {
      Animated.timing(kbOffset, { toValue: 0, duration: e.duration, useNativeDriver: true }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Timer tick ────────────────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (ptTimerRef.current) { clearInterval(ptTimerRef.current); ptTimerRef.current = null; }
  }, []);

  const stopParticles = useCallback(() => {
    if (ptTimerRef.current) { clearInterval(ptTimerRef.current); ptTimerRef.current = null; }
    setParticles([]);
  }, []);

  const spawnParticles = useCallback(() => {
    stopParticles();
    const sr = stateRef.current;
    const cfgSnap = { budget: cfg.budget, duration: cfg.duration };
    ptTimerRef.current = setInterval(() => {
      if (!sr.running) return;
      const pct = cfgSnap.duration > 0 ? sr.elapsed / cfgSnap.duration : 0;
      const p   = spawnParticle(pct);
      setParticles(prev => [...prev.slice(-18), p]);
      setTimeout(() => {
        setParticles(prev => prev.filter(x => x.id !== p.id));
      }, Math.max(900, (3 - pct * 2.2) * 1000) + 400);
    }, 700);
  }, [cfg.budget, cfg.duration, stopParticles]);

  const startTimer = useCallback((budget: number, duration: number) => {
    const sr = stateRef.current;
    sr.running = true;
    sr.lastTs  = Date.now();
    setStatus("LIVE");

    timerRef.current = setInterval(() => {
      if (!sr.running) return;
      const now   = Date.now();
      const delta = (now - sr.lastTs) / 1000;
      sr.lastTs   = now;
      sr.elapsed += delta;

      if (sr.elapsed >= duration) {
        sr.elapsed    = duration;
        sr.dispRem    = 0;
        sr.dispBurned = budget;
        setDispRem(0);
        setDispBurned(budget);
        setElapsed(duration);
        setStatus("DEPLETED");
        sr.running = false;
        stopTimer();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      const pct      = sr.elapsed / duration;
      const trueRem  = budget * (1 - pct);
      const trueBurned = budget * pct;
      const k        = 1 - Math.pow(0.985, delta * 60);
      sr.dispRem    += (trueRem    - sr.dispRem)    * k;
      sr.dispBurned += (trueBurned - sr.dispBurned) * k;

      setDispRem(sr.dispRem);
      setDispBurned(sr.dispBurned);
      setElapsed(sr.elapsed);
    }, 50);
  }, [stopTimer]);

  const play = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const sr = stateRef.current;
    sr.running = true;
    sr.lastTs  = Date.now();
    startTimer(cfg.budget, cfg.duration);
    spawnParticles();
  }, [cfg.budget, cfg.duration, startTimer, spawnParticles]);

  const pause = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const sr = stateRef.current;
    sr.running = false;
    setStatus("PAUSED");
    stopTimer();
    stopParticles();
  }, [stopTimer, stopParticles]);

  const resetTimer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const sr   = stateRef.current;
    sr.running = false;
    sr.elapsed = 0;
    sr.dispRem = cfg.budget;
    sr.dispBurned = 0;
    stopTimer();
    stopParticles();
    setStatus("READY");
    setDispRem(cfg.budget);
    setDispBurned(0);
    setElapsed(0);
  }, [cfg.budget, stopTimer, stopParticles]);

  const togglePlay = useCallback(() => {
    if (stateRef.current.running) pause(); else play();
  }, [pause, play]);

  // cleanup on unmount
  useEffect(() => () => { stopTimer(); stopParticles(); }, [stopTimer, stopParticles]);

  // ── Config modal ──────────────────────────────────────────────────────────────
  const openCfg = useCallback(() => {
    if (stateRef.current.running) pause();
    setCfgLabel(cfg.label);
    setCfgBudget(String(cfg.budget));
    setCfgDurVal(cfg.duration);
    const known = DURATION_PRESETS.filter(p => p.value !== -1).map(p => p.value);
    if (!known.includes(cfg.duration)) { setCfgDurVal(-1); setCfgCust(String(cfg.duration)); }
    setCfgCurr(cfg.currency);
    setCfgOpen(true);
  }, [cfg, pause]);

  const closeCfg = useCallback(() => { Keyboard.dismiss(); setCfgOpen(false); }, []);

  const applyCfg = useCallback(() => {
    Keyboard.dismiss();
    const budget   = parseFloat(cfgBudget) || 1000;
    const duration = cfgDurVal === -1 ? (parseInt(cfgCust) || 60) : cfgDurVal;
    const newCfg   = { label: cfgLabel || "Burn Rate", budget, duration, currency: cfgCurr };
    setCfg(newCfg);
    const sr = stateRef.current;
    sr.dispRem    = budget;
    sr.dispBurned = 0;
    sr.elapsed    = 0;
    sr.running    = false;
    stopTimer();
    stopParticles();
    setStatus("READY");
    setDispRem(budget);
    setDispBurned(0);
    setElapsed(0);
    setCfgOpen(false);
  }, [cfgLabel, cfgBudget, cfgDurVal, cfgCust, cfgCurr, stopTimer, stopParticles]);

  // ── Derived display values ────────────────────────────────────────────────────
  const pct      = cfg.duration > 0 ? elapsed / cfg.duration : 0;
  const cls      = colorCls(pct);
  const moneyColor = COLOR_MAP[cls];
  const moneyGlow  = GLOW_MAP[cls];
  const rate     = cfg.duration > 0 ? cfg.budget / cfg.duration : 0;
  const secsLeft = rate > 0 && dispRem > 0.005 ? dispRem / rate : null;
  const drainPct = Math.min(100, pct * 100);
  const moneyStr = `${cfg.currency}${fmt(dispRem, cfg.budget)}`;
  const burnedStr = `${cfg.currency}${fmt(dispBurned, cfg.budget)}`;
  const elapsedStr = fmtTSmooth(elapsed);

  const statusColor = status === "LIVE" ? T.accent : status === "DEPLETED" ? T.accent : T.muted;

  const topPad   = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad   = insets.bottom;
  const moneyFontSize = isTablet
    ? Math.min(100, screenW * 0.095)
    : Math.min(72, screenW * 0.13);
  const elapsedFontSize = isTablet ? 46 : Math.min(36, screenW * 0.075);

  return (
    <View style={[s.root, { backgroundColor: T.bg }]}>
      {/* Grid background */}
      <GridBackground w={screenW} h={screenH} />

      {/* Scanline overlay */}
      <View style={s.scanlines} pointerEvents="none" />

      {/* Vignette overlay */}
      <View style={s.vignetteWrap} pointerEvents="none">
        <LinearGradient
          colors={["transparent", "transparent", "rgba(0,0,0,0.65)"]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      {/* Particles */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {particles.map(p => {
          const translateY = p.animY.interpolate({ inputRange: [0, 1], outputRange: [-8, screenH + 20] });
          return (
            <Animated.View
              key={p.id}
              style={{
                position: "absolute",
                left:   `${p.x}%` as any,
                top:    0,
                width:  p.size, height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: p.color,
                opacity: p.animO,
                transform: [{ translateY }],
                shadowColor: p.color, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
              }}
            />
          );
        })}
      </View>

      {/* ── App content ─────────────────────────────────────────────────── */}
      <View style={[s.app, { paddingTop: topPad }]}>
        {/* Header */}
        <View style={s.hdr}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openDrawer(); }}
            style={s.hamburger}
            hitSlop={12}
          >
            <Feather name="menu" size={18} color={T.sub} />
          </Pressable>
          <Text style={s.hdrTitle}>◆  Burn Rate</Text>
          <View style={s.hdrRight}>
            <BlinkDot active={status === "LIVE"} />
            <Text style={[s.statusLbl, { color: statusColor }]}>{status}</Text>
          </View>
        </View>

        {/* Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, { paddingBottom: 16 }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        >
          {/* Label */}
          <Text style={s.ctxLbl}>{cfg.label}</Text>

          {/* Big money */}
          <View style={s.moneyWrap}>
            <Text style={[s.money, { fontSize: moneyFontSize, color: moneyColor, textShadowColor: moneyGlow, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 30 }]}>
              {moneyStr}
            </Text>
            <Text style={s.moneySub}>Remaining Budget</Text>
          </View>

          {/* Elapsed */}
          <View style={s.elapsedRow}>
            <Text style={[s.elapsedTime, { fontSize: elapsedFontSize, color: T.text }]}>{elapsedStr}</Text>
            <View style={s.elapsedMeta}>
              <Text style={s.elapsedLbl}>Elapsed</Text>
              <Text style={[s.elapsedPct, { color: moneyColor }]}>{(pct * 100).toFixed(1)}% burned</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={[s.statRow, { gap: isTablet ? 14 : 10 }]}>
            <View style={s.stat}>
              <Text style={[s.statV, { fontSize: isTablet ? 22 : 17 }]}>{burnedStr}</Text>
              <Text style={s.statL}>Burned</Text>
            </View>
            <View style={s.stat}>
              <Text style={[s.statV, { fontSize: isTablet ? 22 : 17 }]}>{secsLeft !== null ? fmtT(secsLeft) : "--"}</Text>
              <Text style={s.statL}>Until Empty</Text>
            </View>
            <View style={s.stat}>
              <Text style={[s.statV, { fontSize: isTablet ? 22 : 17 }]}>{(pct * 100).toFixed(1)}%</Text>
              <Text style={s.statL}>Depleted</Text>
            </View>
          </View>

          {/* Drain bar */}
          <View style={s.drain}>
            <View style={s.drainHdr}>
              <Text style={s.drainLbl}>Budget Drain</Text>
              <Text style={[s.drainPct, { color: T.accent }]}>{drainPct.toFixed(1)}%</Text>
            </View>
            <View style={s.drainBg}>
              <LinearGradient
                colors={[T.accent2, T.accent]}
                start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                style={[s.drainFill, { width: `${Math.max(0, drainPct)}%` as any }]}
              />
            </View>
          </View>
        </ScrollView>

        {/* Controls */}
        <View style={[s.ctrl, { paddingBottom: Math.max(botPad, 10) }]}>
          <Pressable style={[s.btn, s.btnAccent]} onPress={togglePlay}>
            <Feather name={status === "LIVE" ? "pause" : "play"} size={14} color={T.accent} />
            <Text style={[s.btnTx, { color: T.accent }]}>{status === "LIVE" ? "PAUSE" : status === "PAUSED" ? "RESUME" : "START"}</Text>
          </Pressable>
          <Pressable style={s.btn} onPress={resetTimer}>
            <Feather name="rotate-ccw" size={14} color={T.sub} />
            <Text style={s.btnTx}>RESET</Text>
          </Pressable>
          <Pressable style={s.btn} onPress={openCfg}>
            <Feather name="settings" size={14} color={T.sub} />
            <Text style={s.btnTx}>CONFIG</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Config overlay ─────────────────────────────────────────────── */}
      <Modal transparent visible={cfgOpen} animationType="fade" onRequestClose={closeCfg}>
        <Pressable style={s.cfgBackdrop} onPress={closeCfg}>
          <Animated.View style={{ transform: [{ translateY: Animated.multiply(kbOffset, -1) }] }}>
            <Pressable onPress={() => {}} style={s.cfgPanel}>
              <Text style={s.cfgTitle}>◆  Configure</Text>

              {/* Label */}
              <View style={s.cfgField}>
                <Text style={s.cfgFieldLabel}>Label</Text>
                <TextInput
                  style={s.cfgInput}
                  value={cfgLabel}
                  onChangeText={setCfgLabel}
                  placeholderTextColor={T.muted}
                  selectionColor={T.accent}
                />
              </View>

              {/* Budget + Duration row */}
              <View style={s.cfgRow}>
                <View style={[s.cfgField, { flex: 1 }]}>
                  <Text style={s.cfgFieldLabel}>Budget</Text>
                  <TextInput
                    style={s.cfgInput}
                    value={cfgBudget}
                    onChangeText={setCfgBudget}
                    keyboardType="decimal-pad"
                    placeholderTextColor={T.muted}
                    selectionColor={T.accent}
                  />
                </View>
                <View style={[s.cfgField, { flex: 1, marginLeft: 10 }]}>
                  <Text style={s.cfgFieldLabel}>Duration</Text>
                  <Pressable style={s.cfgSelect} onPress={() => setDurPickerOpen(true)}>
                    <Text style={s.cfgSelectTx} numberOfLines={1}>
                      {cfgDurVal === -1 ? "Custom..." : (DURATION_PRESETS.find(p => p.value === cfgDurVal)?.label ?? "?")}
                    </Text>
                    <Feather name="chevron-down" size={13} color={T.muted} />
                  </Pressable>
                </View>
              </View>

              {/* Custom seconds input */}
              {cfgDurVal === -1 && (
                <View style={s.cfgField}>
                  <Text style={s.cfgFieldLabel}>Custom (seconds)</Text>
                  <TextInput
                    style={s.cfgInput}
                    value={cfgCust}
                    onChangeText={setCfgCust}
                    keyboardType="number-pad"
                    placeholderTextColor={T.muted}
                    selectionColor={T.accent}
                  />
                </View>
              )}

              {/* Currency */}
              <View style={s.cfgField}>
                <Text style={s.cfgFieldLabel}>Currency</Text>
                <Pressable style={s.cfgSelect} onPress={() => setCurrPickerOpen(true)}>
                  <Text style={s.cfgSelectTx}>{CURRENCY_OPTS.find(o => o.value === cfgCurr)?.label ?? cfgCurr}</Text>
                  <Feather name="chevron-down" size={13} color={T.muted} />
                </Pressable>
              </View>

              {/* Actions */}
              <View style={s.cfgActs}>
                <Pressable style={s.cbtnSec} onPress={closeCfg}>
                  <Text style={s.cbtnSecTx}>Cancel</Text>
                </Pressable>
                <Pressable style={s.cbtnPri} onPress={applyCfg}>
                  <Text style={s.cbtnPriTx}>Apply</Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Duration picker */}
      <PickerSheet
        visible={durPickerOpen}
        options={DURATION_PRESETS}
        selected={cfgDurVal}
        onSelect={v => { setCfgDurVal(v); if (v !== -1) setCfgCust("120"); }}
        onClose={() => setDurPickerOpen(false)}
      />

      {/* Currency picker */}
      <PickerSheet
        visible={currPickerOpen}
        options={CURRENCY_OPTS}
        selected={cfgCurr}
        onSelect={setCfgCurr}
        onClose={() => setCurrPickerOpen(false)}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const MONO = Platform.OS === "ios" ? "Menlo" : "monospace";

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: T.bg, overflow: "hidden" },
  app:        { flex: 1, zIndex: 2 },
  scanlines:  { ...StyleSheet.absoluteFillObject, zIndex: 1, opacity: 0.05,
                backgroundColor: "transparent" },
  vignetteWrap: { ...StyleSheet.absoluteFillObject, zIndex: 1 },

  // Header
  hdr:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                paddingHorizontal: 16, paddingVertical: 12,
                borderBottomWidth: 1, borderBottomColor: T.border },
  hamburger:  { width: 34, height: 34, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.06)",
                alignItems: "center", justifyContent: "center" },
  hdrTitle:   { fontSize: 11, letterSpacing: 5, textTransform: "uppercase", color: T.accent,
                fontFamily: MONO, fontWeight: "700" },
  hdrRight:   { flexDirection: "row", alignItems: "center", gap: 8 },
  statusLbl:  { fontSize: 9, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO },

  // Content
  content:    { flex: 1, alignItems: "center", justifyContent: "center",
                paddingHorizontal: 24, gap: 0 },
  ctxLbl:     { fontSize: 20, fontWeight: "700", letterSpacing: 1, color: T.text,
                textAlign: "center", marginBottom: 18, fontFamily: MONO },

  // Money
  moneyWrap:  { alignItems: "center", marginBottom: 0 },
  money:      { fontWeight: "800", letterSpacing: 1, fontFamily: MONO,
                fontVariant: ["tabular-nums"] },
  moneySub:   { fontSize: 10, letterSpacing: 4, color: T.sub, textTransform: "uppercase",
                textAlign: "center", marginTop: 8, marginBottom: 18, fontFamily: MONO },

  // Elapsed
  elapsedRow: { alignItems: "center", gap: 4, marginBottom: 20 },
  elapsedTime:{ fontWeight: "700", letterSpacing: 2, fontFamily: MONO,
                fontVariant: ["tabular-nums"] },
  elapsedMeta:{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2 },
  elapsedLbl: { fontSize: 10, letterSpacing: 3, color: T.sub, textTransform: "uppercase", fontFamily: MONO },
  elapsedPct: { fontSize: 12, fontWeight: "700", letterSpacing: 1, fontFamily: MONO,
                fontVariant: ["tabular-nums"] },

  // Stats
  statRow:    { flexDirection: "row", width: "100%", maxWidth: 680, marginBottom: 10 },
  stat:       { flex: 1, backgroundColor: T.panel, borderWidth: 1, borderColor: T.border,
                borderRadius: 12, padding: 16, paddingBottom: 14 },
  statV:      { fontWeight: "700", color: T.text, fontFamily: MONO, fontVariant: ["tabular-nums"],
                letterSpacing: 0.5 },
  statL:      { fontSize: 9, letterSpacing: 2, color: T.sub, textTransform: "uppercase",
                marginTop: 6, fontFamily: MONO },

  // Drain
  drain:      { width: "100%", maxWidth: 680, backgroundColor: T.panel,
                borderWidth: 1, borderColor: T.border, borderRadius: 12,
                padding: 16, paddingBottom: 14 },
  drainHdr:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  drainLbl:   { fontSize: 9, letterSpacing: 2, color: T.sub, textTransform: "uppercase",
                fontWeight: "600", fontFamily: MONO },
  drainPct:   { fontSize: 11, fontWeight: "700", fontFamily: MONO, fontVariant: ["tabular-nums"] },
  drainBg:    { height: 6, backgroundColor: T.dim, borderRadius: 3, overflow: "hidden" },
  drainFill:  { height: "100%", borderRadius: 3, minWidth: 4 },

  // Controls
  ctrl:       { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 10,
                borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.bg },
  btn:        { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: T.border,
                backgroundColor: T.panel, flexDirection: "row", alignItems: "center",
                justifyContent: "center", gap: 7 },
  btnAccent:  { backgroundColor: "rgba(255,60,60,0.08)", borderColor: "rgba(255,60,60,0.3)" },
  btnTx:      { fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: T.sub,
                fontFamily: MONO, fontWeight: "700" },

  // Config overlay
  cfgBackdrop:{ flex: 1, backgroundColor: "rgba(4,6,10,0.93)", alignItems: "center",
                justifyContent: "center" },
  cfgPanel:   { backgroundColor: T.panel, borderWidth: 1, borderColor: T.border,
                borderRadius: 14, padding: 26, width: "88%", maxWidth: 480 },
  cfgTitle:   { fontSize: 11, letterSpacing: 5, color: T.accent, textTransform: "uppercase",
                fontWeight: "700", marginBottom: 20, fontFamily: MONO },
  cfgField:   { marginBottom: 16 },
  cfgFieldLabel: { fontSize: 8, letterSpacing: 3, color: T.muted, textTransform: "uppercase",
                   marginBottom: 7, fontFamily: MONO },
  cfgInput:   { backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
                borderRadius: 7, paddingHorizontal: 13, paddingVertical: 11,
                color: T.text, fontFamily: MONO, fontSize: 15 },
  cfgSelect:  { backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
                borderRadius: 7, paddingHorizontal: 13, paddingVertical: 13,
                flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cfgSelectTx:{ color: T.text, fontFamily: MONO, fontSize: 14, flex: 1 },
  cfgRow:     { flexDirection: "row" },
  cfgActs:    { flexDirection: "row", gap: 8, marginTop: 20 },
  cbtnPri:    { flex: 1, paddingVertical: 12, borderRadius: 7, backgroundColor: T.accent, alignItems: "center" },
  cbtnPriTx:  { fontSize: 10, fontWeight: "700", letterSpacing: 3, textTransform: "uppercase",
                color: "#000", fontFamily: MONO },
  cbtnSec:    { flex: 1, paddingVertical: 12, borderRadius: 7, borderWidth: 1,
                borderColor: T.border, alignItems: "center" },
  cbtnSecTx:  { fontSize: 10, fontWeight: "700", letterSpacing: 3, textTransform: "uppercase",
                color: T.muted, fontFamily: MONO },
});
