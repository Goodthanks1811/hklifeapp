import React from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";

const RED    = "#E03131";
const BG     = "#111111";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";

const PLAYLISTS = [
  "Bone Greatest Hits",
  "2pac Greatest Hits",
  "Snoop Greatest Hits",
  "DMX Greatest Hits",
  "Eminem Greatest Hits",
  "The Repeat List",
  "Old School Rnb",
  "Driving",
  "Pre Gym",
  "2022 New Stuff",
  "Faydee",
  "Carnal Hits",
];

function MusicNoteSingle({ size = 18, color = RED }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 3v10.55A4 4 0 1 0 14 17V5h4V3h-6z" />
    </Svg>
  );
}

export default function MusicAppleScreen() {
  const insets = useSafeAreaInsets();

  const openPlaylist = (name: string) => {
    Linking.openURL("music://").catch(() =>
      Linking.openURL("https://music.apple.com")
    );
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.back} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color={RED} />
          <Text style={s.backText}>Music</Text>
        </Pressable>
        <Text style={s.title}>Apple Music</Text>
        <View style={s.badge}>
          <Text style={{ fontSize: 11 }}>🍎</Text>
          <Text style={s.badgeText}>Connected</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        {PLAYLISTS.map((name, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [s.row, pressed && s.rowPressed]}
            onPress={() => openPlaylist(name)}
          >
            <View style={s.iconCell}>
              <MusicNoteSingle size={18} color={RED} />
            </View>
            <Text style={s.rowName}>{name}</Text>
            <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.2)" />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 20, paddingBottom: 14, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  back: { flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 0 },
  backText: { color: RED, fontSize: 15, fontWeight: "500", fontFamily: "Inter_500Medium" },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "600", color: "#fff", fontFamily: "Inter_600SemiBold" },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(224,49,49,0.08)", borderWidth: 1,
    borderColor: "rgba(224,49,49,0.18)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  badgeText: { fontSize: 12, color: RED, fontWeight: "500", fontFamily: "Inter_500Medium" },

  listContent: { padding: 16, gap: 8 },

  row: {
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, padding: 14,
  },
  rowPressed: { opacity: 0.7 },
  iconCell: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  rowName: { flex: 1, fontSize: 15, fontWeight: "500", color: "#fff", fontFamily: "Inter_500Medium" },
});
