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

const GREEN  = "#1DB954";
const RED    = "#E03131";
const BG     = "#111111";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";

const PLAYLISTS: { name: string; color: string }[] = [
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

const LETTERS = ["H", "M", "S", "C", "K", "O", "J", "U", "T", "R"];

export default function MusicSpotifyScreen() {
  const insets = useSafeAreaInsets();

  const openSpotify = () => {
    Linking.openURL("spotify://").catch(() => Linking.openURL("https://open.spotify.com"));
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
          <Feather name="headphones" size={12} color={GREEN} />
          <Text style={s.badgeText}>Spotify</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        {PLAYLISTS.map((p, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [s.row, pressed && s.rowPressed]}
            onPress={openSpotify}
          >
            <View style={[s.artwork, { backgroundColor: p.color }]}>
              {i === 0
                ? <Feather name="heart" size={18} color="#fff" />
                : <Text style={s.artworkLetter}>{LETTERS[i]}</Text>
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
  back:     { flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 0 },
  backText: { color: RED, fontSize: 15, fontWeight: "500", fontFamily: "Inter_500Medium" },
  title:    { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "600", color: "#fff", fontFamily: "Inter_600SemiBold" },
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
  rowPressed:    { opacity: 0.7 },
  artwork: {
    width: 44, height: 44, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  artworkLetter: { fontSize: 17, fontWeight: "700", color: "rgba(255,255,255,0.7)" },
  rowName:       { flex: 1, fontSize: 15, fontWeight: "500", color: "#fff", fontFamily: "Inter_500Medium" },
});
