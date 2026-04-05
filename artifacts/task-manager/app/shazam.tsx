import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useNotion } from "@/context/NotionContext";
import { Colors } from "@/constants/colors";

// ── Constants ──────────────────────────────────────────────────────────────────
const SHAZAM_CAT = "\uD83C\uDFB6Shazam";
const BASE_URL   = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

// ── Types ──────────────────────────────────────────────────────────────────────
interface ShazamSong {
  id:      string;
  title:   string;
  created: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtCreated(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mon  = months[d.getMonth()];
  const day  = d.getDate();
  let   hr   = d.getHours();
  const min  = String(d.getMinutes()).padStart(2, "0");
  const ampm = hr >= 12 ? "PM" : "AM";
  hr = hr % 12 || 12;
  return `${mon} ${day}  ${hr}:${min} ${ampm}`;
}

// ── SongRow ────────────────────────────────────────────────────────────────────
function SongRow({ song, onDone }: { song: ShazamSong; onDone: (id: string) => void }) {
  const swipeRef = useRef<Swipeable>(null);

  const renderRight = useCallback((_prog: Animated.AnimatedInterpolation<number>, drag: Animated.AnimatedInterpolation<number>) => {
    const scale = drag.interpolate({ inputRange: [-80, 0], outputRange: [1, 0.85], extrapolate: "clamp" });
    return (
      <Animated.View style={[styles.deleteAction, { transform: [{ scale }] }]}>
        <Feather name="check" size={18} color="#fff" />
        <Text style={styles.deleteActionText}>Done</Text>
      </Animated.View>
    );
  }, []);

  const handleSwipeOpen = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    swipeRef.current?.close();
    onDone(song.id);
  }, [song.id, onDone]);

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRight}
      onSwipeableOpen={handleSwipeOpen}
      rightThreshold={60}
      overshootRight={false}
      friction={2}
    >
      <View style={styles.songRow}>
        <View style={styles.songIcon}>
          <Feather name="music" size={14} color={Colors.primary} />
        </View>
        <View style={styles.songInfo}>
          <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
          {!!song.created && (
            <Text style={styles.songDate}>{fmtCreated(song.created)}</Text>
          )}
        </View>
      </View>
    </Swipeable>
  );
}

// ── ShazamScreen ───────────────────────────────────────────────────────────────
export default function ShazamScreen() {
  const insets = useSafeAreaInsets();
  const { apiKey } = useNotion();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [songs,     setSongs]     = useState<ShazamSong[]>([]);
  const [status,    setStatus]    = useState<"idle" | "loading" | "error" | "done">("idle");
  const [errorMsg,  setErrorMsg]  = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchSongs = useCallback(async (silent = false) => {
    if (!apiKey) { setStatus("error"); setErrorMsg("Notion API key not set in Settings."); return; }
    if (!silent) setStatus("loading");
    try {
      const res = await fetch(
        `${BASE_URL}/api/notion/life-tasks?category=${encodeURIComponent(SHAZAM_CAT)}`,
        { headers: { "x-notion-key": apiKey } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const mapped: ShazamSong[] = (data.tasks || []).map((t: any) => ({
        id:      t.id,
        title:   t.title,
        created: t.created ?? null,
      }));
      mapped.sort((a, b) => {
        if (!a.created && !b.created) return 0;
        if (!a.created) return 1;
        if (!b.created) return -1;
        return new Date(b.created).getTime() - new Date(a.created).getTime();
      });
      setSongs(mapped);
      setStatus("done");
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e?.message || "Failed to load songs");
    }
  }, [apiKey]);

  useEffect(() => { fetchSongs(); }, [fetchSongs]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSongs(true);
    setRefreshing(false);
  }, [fetchSongs]);

  // ── Mark done ──────────────────────────────────────────────────────────────
  const handleDone = useCallback(async (id: string) => {
    setSongs(prev => prev.filter(s => s.id !== id));
    try {
      await fetch(`${BASE_URL}/api/notion/life-tasks/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", "x-notion-key": apiKey ?? "" },
        body:    JSON.stringify({ done: true }),
      });
    } catch {
      fetchSongs(true);
    }
  }, [apiKey, fetchSongs]);

  // ── Header icon ────────────────────────────────────────────────────────────
  const headerRight = (
    <Image
      source={require("../assets/images/shazam-icon.png")}
      style={{ width: 30, height: 30, borderRadius: 8 }}
      resizeMode="contain"
    />
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScreenHeader title="Shazam" right={headerRight} />

      {status === "loading" && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}

      {status === "error" && (
        <View style={styles.center}>
          <Feather name="alert-circle" size={28} color={Colors.primary} />
          <Text style={styles.errText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchSongs()}>
            <Text style={styles.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {(status === "done" || status === "idle") && songs.length === 0 && status === "done" && (
        <View style={styles.center}>
          <Image
            source={require("../assets/images/shazam-icon.png")}
            style={{ width: 56, height: 56, borderRadius: 16, opacity: 0.35, marginBottom: 12 }}
          />
          <Text style={styles.emptyTxt}>No Shazam songs yet</Text>
        </View>
      )}

      {status === "done" && songs.length > 0 && (
        <FlatList
          data={songs}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingTop: 10, paddingHorizontal: 16, paddingBottom: botPad + 24 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          renderItem={({ item }) => (
            <SongRow song={item} onDone={handleDone} />
          )}
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  errText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: 10,
  },
  retryTxt: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  emptyTxt: {
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  sep: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginLeft: 52,
  },
  songRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 4,
    backgroundColor: "#0f0f0f",
    gap: 12,
  },
  songIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(224,49,49,0.12)",
    borderWidth: 1,
    borderColor: "rgba(224,49,49,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  songInfo: {
    flex: 1,
    gap: 3,
  },
  songTitle: {
    color: Colors.textPrimary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    lineHeight: 20,
  },
  songDate: {
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 16,
  },
  deleteAction: {
    backgroundColor: "#27AE60",
    borderRadius: 12,
    marginLeft: 8,
    marginVertical: 2,
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  deleteActionText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
});
