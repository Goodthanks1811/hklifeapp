import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import { useNotion } from "@/context/NotionContext";
import { Colors } from "@/constants/colors";

// ── Constants ──────────────────────────────────────────────────────────────────
const SHAZAM_CAT = "\uD83C\uDFB6Shazam";
const BASE_URL   = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";
const ITEM_H     = 48;

// ── Types ──────────────────────────────────────────────────────────────────────
interface Song { id: string; title: string; }

// ── SongRow ────────────────────────────────────────────────────────────────────
function SongRow({ song, onChecked, onDelete, onStartDelete, onPress }: {
  song:          Song;
  onChecked:     () => void;
  onDelete:      () => void;
  onStartDelete: (collapseDuration: number) => void;
  onPress:       () => void;
}) {
  const swipeableRef = useRef<Swipeable>(null);
  const checkScale   = useRef(new Animated.Value(0)).current;
  const opacityAnim  = useRef(new Animated.Value(1)).current;
  const rowHeight    = useRef(new Animated.Value(ITEM_H)).current;
  const pressOverlay = useRef(new Animated.Value(0)).current;
  const deletingRef  = useRef(false);
  const revealedRef  = useRef(false);
  const [checked, setChecked] = useState(false);

  const onPressIn  = useCallback(() => {
    Animated.timing(pressOverlay, { toValue: 0.28, duration: 60,  useNativeDriver: true }).start();
  }, [pressOverlay]);
  const onPressOut = useCallback(() => {
    Animated.timing(pressOverlay, { toValue: 0,    duration: 130, useNativeDriver: true }).start();
  }, [pressOverlay]);

  const triggerDelete = useCallback(() => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    swipeableRef.current?.close();
    onStartDelete(260);
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 220, useNativeDriver: false }),
      Animated.timing(rowHeight,   { toValue: 0, duration: 260, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
    ]).start(() => onDelete());
  }, [onDelete, onStartDelete, opacityAnim, rowHeight]);

  const handleCheck = useCallback(() => {
    if (checked) return;
    setChecked(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.spring(checkScale, { toValue: 1, useNativeDriver: false, tension: 240, friction: 8 }).start();
    setTimeout(() => {
      onStartDelete(340);
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 0, duration: 380, useNativeDriver: false }),
        Animated.timing(rowHeight,   { toValue: 0, duration: 340, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
      ]).start(() => onChecked());
    }, 320);
  }, [checked, checkScale, opacityAnim, rowHeight, onChecked, onStartDelete]);

  const handleRowTap = useCallback((action: () => void) => {
    if (revealedRef.current) { swipeableRef.current?.close(); } else { action(); }
  }, []);

  const renderRightActions = useCallback(() => (
    <Pressable style={styles.deleteAction} onPress={triggerDelete}>
      <Feather name="trash-2" size={16} color="#fff" />
      <Text style={styles.deletePillTx}>Delete</Text>
    </Pressable>
  ), [triggerDelete]);

  return (
    <Animated.View style={[styles.rowOuter, { height: rowHeight, opacity: opacityAnim }]}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootLeft={false}
        overshootRight={false}
        rightThreshold={40}
        friction={3}
        onSwipeableWillOpen={() => { pressOverlay.setValue(0); }}
        onSwipeableOpen={() => { revealedRef.current = true; }}
        onSwipeableClose={() => { revealedRef.current = false; }}
        containerStyle={{ borderRadius: 14, overflow: "hidden" }}
      >
        <Animated.View style={styles.rowWrap}>
          {/* Spotify icon slot */}
          <View style={styles.emojiBtn}>
            <Image
              source={require("../assets/images/spotify-icon.png")}
              style={styles.spotifyIcon}
              resizeMode="contain"
            />
          </View>

          {/* Title */}
          <Pressable
            style={{ flex: 1, alignSelf: "stretch", justifyContent: "center" }}
            onPress={() => handleRowTap(onPress)}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
          >
            <Text style={styles.rowTitle} numberOfLines={2}>{song.title}</Text>
          </Pressable>

          {/* Checkbox */}
          <Pressable onPress={() => handleRowTap(handleCheck)} hitSlop={8} style={styles.checkBtn}>
            <Animated.View style={[styles.checkBox, checked && styles.checkBoxDone]}>
              <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                <Feather name="check" size={12} color="#fff" />
              </Animated.View>
            </Animated.View>
          </Pressable>

          {/* Press feedback overlay */}
          <Animated.View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: "#000",
              borderRadius: 14,
              opacity: pressOverlay,
            }}
          />
        </Animated.View>
      </Swipeable>
    </Animated.View>
  );
}

// ── Header component (inside list body, like IR Quick Add) ────────────────────
function ListHeader() {
  return (
    <View style={styles.logoWrap}>
      <Image
        source={require("../assets/images/shazam-icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

// ── ShazamScreen ───────────────────────────────────────────────────────────────
export default function ShazamScreen() {
  const insets = useSafeAreaInsets();
  const { apiKey } = useNotion();

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const [songs,      setSongs]      = useState<Song[]>([]);
  const [status,     setStatus]     = useState<"idle"|"loading"|"error"|"done">("idle");
  const [errorMsg,   setErrorMsg]   = useState("");
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
      setSongs((data.tasks || []).map((t: any) => ({ id: t.id, title: t.title })));
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

  // ── Open Spotify search ────────────────────────────────────────────────────
  const openSpotify = useCallback((title: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const q        = encodeURIComponent(title);
    const deepLink = `spotify:search:${q}`;
    const webUrl   = `https://open.spotify.com/search/${q}`;
    Linking.openURL(deepLink).catch(() => Linking.openURL(webUrl));
  }, []);

  // ── Mark done ──────────────────────────────────────────────────────────────
  const handleChecked = useCallback(async (id: string) => {
    setSongs(prev => prev.filter(s => s.id !== id));
    try {
      await fetch(`${BASE_URL}/api/notion/life-tasks/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", "x-notion-key": apiKey ?? "" },
        body:    JSON.stringify({ done: true }),
      });
    } catch { fetchSongs(true); }
  }, [apiKey, fetchSongs]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    setSongs(prev => prev.filter(s => s.id !== id));
    try {
      await fetch(`${BASE_URL}/api/notion/life-tasks/${id}`, {
        method:  "DELETE",
        headers: { "x-notion-key": apiKey ?? "" },
      });
    } catch { fetchSongs(true); }
  }, [apiKey, fetchSongs]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: topPad }]}>

      {status === "loading" && (
        <>
          <ListHeader />
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        </>
      )}

      {status === "error" && (
        <>
          <ListHeader />
          <View style={styles.center}>
            <Feather name="alert-circle" size={28} color={Colors.primary} />
            <Text style={styles.errText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => fetchSongs()}>
              <Text style={styles.retryTxt}>Retry</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {status === "done" && songs.length === 0 && (
        <>
          <ListHeader />
          <View style={styles.center}>
            <Text style={styles.emptyTxt}>No Shazam songs yet</Text>
          </View>
        </>
      )}

      {status === "done" && songs.length > 0 && (
        <FlatList
          data={songs}
          keyExtractor={item => item.id}
          ListHeaderComponent={<ListHeader />}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: botPad + 24,
            gap: 8,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          renderItem={({ item }) => (
            <SongRow
              song={item}
              onPress={() => openSpotify(item.title)}
              onChecked={() => handleChecked(item.id)}
              onDelete={() => handleDelete(item.id)}
              onStartDelete={() => {}}
            />
          )}
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: "#0f0f0f" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },

  // ── Logo header (in body, like IR Quick Add)
  logoWrap: { alignItems: "center", paddingTop: 24, paddingBottom: 28 },
  logo:     { width: 90, height: 90, borderRadius: 22 },

  // ── States
  errText:  { color: Colors.textSecondary, fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  emptyTxt: { color: Colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 15 },
  retryBtn: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: Colors.primary, borderRadius: 10 },
  retryTxt: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },

  // ── Life-identical row styles
  rowOuter: { height: ITEM_H },
  deleteAction: {
    width: 110, height: ITEM_H,
    backgroundColor: Colors.primary,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
  },
  deletePillTx: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  rowWrap: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0f0f0f", borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14, height: ITEM_H,
  },
  emojiBtn:    { minWidth: 36, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  spotifyIcon: { width: 36, height: 36, borderRadius: 18 },
  rowTitle:    { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_600SemiBold", lineHeight: 21, paddingBottom: 4 },
  checkBtn:    { padding: 10, margin: -6 },
  checkBox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: "#5a5a5a",
    alignItems: "center", justifyContent: "center", backgroundColor: "transparent",
  },
  checkBoxDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
});
