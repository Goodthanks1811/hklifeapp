import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

const RED  = Colors.primary;
const BG   = "#000000";

const MOCK_ITEMS = [
  { icon: "calendar",    label: "Calendar",    sub: "HK upcoming events"   },
  { icon: "clipboard",   label: "Life Admin",  sub: "Tasks & life admin"   },
  { icon: "search",      label: "Investigate", sub: "Things to look into"  },
  { icon: "shopping-bag",label: "To Buy",      sub: "Shopping list"        },
  { icon: "music",       label: "Music",       sub: "Songs & playlists"    },
  { icon: "book-open",   label: "To Read",     sub: "Reading list"         },
  { icon: "zap",         label: "Development", sub: "Development tasks"    },
];

export default function GradientSpotlightScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={s.root}>

      {/* ── Spotlight header ─────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>

        {/* Black base */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: BG }]} />

        {/* Centre beam — vertical spread from top-centre */}
        <LinearGradient
          colors={[
            "rgba(224,49,49,0.62)",
            "rgba(180,20,20,0.32)",
            "rgba(120,10,10,0.12)",
            "transparent",
          ]}
          locations={[0, 0.28, 0.55, 0.78]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Left beam — emanates from top-left corner */}
        <LinearGradient
          colors={[
            "rgba(224,49,49,0.48)",
            "rgba(160,15,15,0.22)",
            "transparent",
          ]}
          locations={[0, 0.38, 0.68]}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 0.58, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Right beam — mirror of left */}
        <LinearGradient
          colors={[
            "rgba(224,49,49,0.48)",
            "rgba(160,15,15,0.22)",
            "transparent",
          ]}
          locations={[0, 0.38, 0.68]}
          start={{ x: 0.95, y: 0 }}
          end={{ x: 0.42, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Dark ray cut — between left beam and centre */}
        <View style={s.rayCutLeft}>
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.58)", "transparent"]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </View>

        {/* Dark ray cut — between centre and right beam */}
        <View style={s.rayCutRight}>
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.58)", "transparent"]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </View>

        {/* Nav row */}
        <View style={s.navRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.navBtn}>
            <Feather name="chevron-left" size={22} color="rgba(255,255,255,0.85)" />
          </Pressable>
          <Text style={s.navHint}>MOCKUP PREVIEW</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Hero */}
        <View style={s.heroArea}>
          <Text style={s.heroTitle}>Life Admin</Text>
          <Text style={s.heroSub}>Spotlight header style</Text>
        </View>
      </View>

      {/* ── Mock list ────────────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {MOCK_ITEMS.map((item, i) => (
          <View key={i} style={[s.row, i > 0 && s.rowBorder]}>
            <View style={s.iconBox}>
              <Feather name={item.icon as any} size={16} color={RED} />
            </View>
            <View style={s.rowText}>
              <Text style={s.rowLabel}>{item.label}</Text>
              <Text style={s.rowSub}>{item.sub}</Text>
            </View>
            <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.2)" />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    height: 250,
    backgroundColor: BG,
    overflow: "hidden",
  },

  rayCutLeft: {
    position: "absolute",
    top: -60, bottom: -30,
    left: "27%",
    width: 36,
    transform: [{ rotate: "10deg" }],
  },
  rayCutRight: {
    position: "absolute",
    top: -60, bottom: -30,
    right: "27%",
    width: 36,
    transform: [{ rotate: "-10deg" }],
  },

  navRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  navBtn: {
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
  },
  navHint: {
    flex: 1,
    textAlign: "center",
    color: "rgba(224,49,49,0.65)",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2.5,
  },

  heroArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 38,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1.2,
    lineHeight: 44,
    marginBottom: 6,
  },
  heroSub: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.2,
  },

  scroll: { flex: 1 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  iconBox: {
    width: 34, height: 34,
    backgroundColor: "rgba(224,49,49,0.10)",
    borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowLabel: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  rowSub:   { color: "rgba(255,255,255,0.35)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
