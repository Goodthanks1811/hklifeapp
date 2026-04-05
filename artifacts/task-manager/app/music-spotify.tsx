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

const GREEN  = "#1DB954";
const RED    = "#E03131";
const BG     = "#111111";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";

const PLAYLISTS = [
  { name: "Liked Songs",       color: "#4B3B9E" },
  { name: "March 2026",        color: "#1a3a2a" },
  { name: "Sept 2022",         color: "#2a1a3a" },
  { name: "Carnal Favourites", color: "#3a1a1a" },
  { name: "Krayzie Bone",      color: "#1a2a3a" },
  { name: "October 2025",      color: "#2a3a1a" },
  { name: "Jony",              color: "#3a2a1a" },
  { name: "UB40",              color: "#1a3a3a" },
  { name: "Tyga Mix",          color: "#3a1a2a" },
  { name: "Old School RnB",    color: "#2a2a3a" },
];

const ICONS = ["♥","M","S","C","K","O","J","U","T","R"];

function SpotifyIcon({ size = 22, color = GREEN }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </Svg>
  );
}

export default function MusicSpotifyScreen() {
  const insets = useSafeAreaInsets();

  const openPlaylist = (name: string) => {
    Linking.openURL("spotify://").catch(() =>
      Linking.openURL("https://open.spotify.com")
    );
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.back} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color={RED} />
          <Text style={s.backText}>Music</Text>
        </Pressable>
        <Text style={s.title}>Spotify</Text>
        <View style={s.badge}>
          <SpotifyIcon size={12} color={GREEN} />
          <Text style={s.badgeText}>Connected</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        {PLAYLISTS.map((p, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [s.row, pressed && s.rowPressed]}
            onPress={() => openPlaylist(p.name)}
          >
            <View style={[s.artwork, { backgroundColor: p.color }]}>
              {i === 0
                ? <Feather name="heart" size={18} color="#fff" />
                : <Text style={s.artworkLetter}>{ICONS[i]}</Text>
              }
            </View>
            <Text style={s.rowName}>{p.name}</Text>
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
    backgroundColor: "rgba(29,185,84,0.10)", borderWidth: 1,
    borderColor: "rgba(29,185,84,0.22)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  badgeText: { fontSize: 12, color: GREEN, fontWeight: "500", fontFamily: "Inter_500Medium" },

  listContent: { padding: 16, gap: 8 },

  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, padding: 10,
  },
  rowPressed: { opacity: 0.7 },
  artwork: {
    width: 44, height: 44, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  artworkLetter: { fontSize: 17, fontWeight: "700", color: "rgba(255,255,255,0.7)" },
  rowName: { flex: 1, fontSize: 15, fontWeight: "500", color: "#fff", fontFamily: "Inter_500Medium" },
});
