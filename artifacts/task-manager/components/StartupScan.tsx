import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width: W, height: H } = Dimensions.get("window");
const isTablet = W >= 768;
// Scale factor: elements designed for ~390pt phone, scaled down on iPad
const SF = isTablet ? 0.72 : 1;

const PHOTO = "https://i.postimg.cc/gc3sgzzV/IMG-5286.jpg";

const PHASES = [
  ["Reading facial geometry",    "Contour depth analysis"      ],
  ["Tracking profile structure", "Passive biometric pass"      ],
  ["Resolving facial topology",  "Landmark stability check"    ],
  ["Refining identity model",    "Surface map alignment"       ],
  ["Verification complete",      "Profile lock confirmed"      ],
] as const;

function phaseFor(p: number) {
  if (p >= 92) return 4;
  if (p >= 70) return 3;
  if (p >= 45) return 2;
  if (p >= 20) return 1;
  return 0;
}

interface Props {
  onDone: () => void;
}

export function StartupScan({ onDone }: Props) {
  const fadeOut  = useRef(new Animated.Value(1)).current;
  const scanY    = useRef(new Animated.Value(-H * 0.12)).current;
  const blinkAnim = useRef(new Animated.Value(0.35)).current;

  const [percent, setPercent]   = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);

  // ── Scan line loops ─────────────────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(scanY, {
        toValue: H,
        duration: 3200,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Blinking dot ─────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 1,    duration: 600, useNativeDriver: false }),
        Animated.timing(blinkAnim, { toValue: 0.35, duration: 600, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Percent counter ──────────────────────────────────────────────────────
  useEffect(() => {
    let p = 0;
    const id = setInterval(() => {
      p += 1;
      setPercent(p);
      setPhaseIdx(phaseFor(p));
      if (p >= 100) {
        clearInterval(id);
        // brief pause then fade out
        setTimeout(() => {
          Animated.timing(fadeOut, {
            toValue: 0,
            duration: 600,
            useNativeDriver: false,
          }).start(onDone);
        }, 600);
      }
    }, 36);
    return () => clearInterval(id);
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0") + "%";

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeOut, zIndex: 9999 }]}>

      {/* ── Background photo ── */}
      <Image
        source={{ uri: PHOTO }}
        style={s.photo}
        resizeMode="cover"
      />

      {/* ── Dark/red tint ── */}
      <LinearGradient
        colors={[
          "rgba(0,0,0,0.20)",
          "rgba(80,0,0,0.18)",
          "rgba(0,0,0,0.52)",
        ]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── Bottom darkening gradient ── */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.55)"]}
        locations={[0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── Grid ── */}
      <View style={s.grid} pointerEvents="none">
        {Array.from({ length: Math.ceil(H / 44) + 1 }).map((_, i) => (
          <View key={`h${i}`} style={[s.gridLineH, { top: i * 44 }]} />
        ))}
        {Array.from({ length: Math.ceil(W / 44) + 1 }).map((_, i) => (
          <View key={`v${i}`} style={[s.gridLineV, { left: i * 44 }]} />
        ))}
      </View>

      {/* ── Scan band (wide soft glow) ── */}
      <Animated.View
        pointerEvents="none"
        style={[s.scanBand, { top: scanY }]}
      >
        <LinearGradient
          colors={[
            "rgba(255,0,0,0)",
            "rgba(255,90,90,0.06)",
            "rgba(255,255,255,0.11)",
            "rgba(255,90,90,0.07)",
            "rgba(255,0,0,0)",
          ]}
          style={{ flex: 1 }}
        />
      </Animated.View>

      {/* ── Scan line (sharp) ── */}
      <Animated.View
        pointerEvents="none"
        style={[s.scanLine, { top: scanY }]}
      >
        <LinearGradient
          colors={[
            "transparent",
            "rgba(255,160,160,0.80)",
            "rgba(255,70,70,1)",
            "rgba(255,160,160,0.80)",
            "transparent",
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      {/* ── Corner brackets ── */}
      <View style={[s.corner, s.tl]} />
      <View style={[s.corner, s.tr]} />
      <View style={[s.corner, s.bl]} />
      <View style={[s.corner, s.br]} />

      {/* ── Top bar ── */}
      <View style={s.topbar}>
        <Text style={s.topbarText}>BIOMETRIC SCAN</Text>
        <View style={s.liveWrap}>
          <Animated.View style={[s.dot, { opacity: blinkAnim }]} />
          <Text style={s.topbarText}>LIVE</Text>
        </View>
      </View>

      {/* ── Center status ── */}
      <View style={s.centerStatus}>
        <Text style={s.statusMain}>{PHASES[phaseIdx][0]}</Text>
        <Text style={s.statusSub}>{PHASES[phaseIdx][1]}</Text>
        <Text style={s.percentNum}>{pad(percent)}</Text>
        <Text style={s.percentLabel}>SCAN COMPLETE</Text>
      </View>

    </Animated.View>
  );
}

const CORNER       = Math.round(40 * SF);
const CORNER_INSET = Math.round(18 * SF);
const BORDER       = 2;
const BORDER_COLOR = "rgba(255,92,92,0.92)";
const DOT_SIZE     = Math.round(8 * SF);

const s = StyleSheet.create({
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  gridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,80,80,0.055)",
  },
  gridLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,80,80,0.055)",
  },
  scanBand: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 104,
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    shadowColor: "rgba(255,80,80,1)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 6,
  },
  // corners
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: BORDER_COLOR,
    borderWidth: BORDER,
  },
  tl: { top: CORNER_INSET, left: CORNER_INSET, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: CORNER_INSET, right: CORNER_INSET, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: CORNER_INSET, left: CORNER_INSET, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: CORNER_INSET, right: CORNER_INSET, borderLeftWidth: 0, borderTopWidth: 0 },
  // top bar
  topbar: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topbarText: {
    color: "rgba(255,232,232,0.96)",
    fontSize: Math.round(11 * SF),
    letterSpacing: 3,
    fontFamily: "Inter_500Medium",
  },
  liveWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: "#ff5757",
    shadowColor: "#ff5757",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  // center status
  centerStatus: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 90,
    alignItems: "center",
    gap: 6,
  },
  statusMain: {
    color: "rgba(255,234,234,0.95)",
    fontSize: Math.round(12 * SF),
    letterSpacing: 3,
    textTransform: "uppercase",
    fontFamily: "Inter_500Medium",
    textShadowColor: "rgba(255,80,80,0.22)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  statusSub: {
    color: "rgba(255,234,234,0.75)",
    fontSize: Math.round(10 * SF),
    letterSpacing: 1.6,
    textTransform: "uppercase",
    fontFamily: "Inter_400Regular",
    marginBottom: 6,
  },
  percentNum: {
    color: "#fff",
    fontSize: Math.round(36 * SF),
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    textShadowColor: "rgba(255,80,80,0.65)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  percentLabel: {
    color: "rgba(255,234,234,0.75)",
    fontSize: Math.round(10 * SF),
    letterSpacing: 1.7,
    textTransform: "uppercase",
    fontFamily: "Inter_400Regular",
  },
});
