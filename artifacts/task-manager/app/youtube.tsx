import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path as SvgPath } from "react-native-svg";
import { Colors } from "@/constants/colors";

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "youtube_recent_searches_v1";
const MAX_HISTORY = 20;
const ITEM_H = 52;

// ── YouTube Logo SVG ──────────────────────────────────────────────────────────
function YouTubeLogo({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size * (48 / 68)} viewBox="0 0 68 48">
      <SvgPath
        d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C0 13.05 0 24 0 24s0 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C68 34.95 68 24 68 24s0-10.95-1.48-16.26z"
        fill="#ff0000"
      />
      <SvgPath d="M45 24 27 14v20" fill="#ffffff" />
    </Svg>
  );
}

// ── RecentRow ─────────────────────────────────────────────────────────────────
function RecentRow({
  query,
  onPress,
  onDelete,
}: {
  query:    string;
  onPress:  () => void;
  onDelete: () => void;
}) {
  const swipeableRef = useRef<Swipeable>(null);
  const opacityAnim  = useRef(new Animated.Value(1)).current;
  const rowHeight    = useRef(new Animated.Value(ITEM_H + 8)).current;
  const revealedRef  = useRef(false);
  const deletingRef  = useRef(false);

  const collapse = useCallback((done: () => void) => {
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
      Animated.timing(rowHeight,   { toValue: 0, duration: 240, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
    ]).start(() => done());
  }, [opacityAnim, rowHeight]);

  const triggerDelete = useCallback(() => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    swipeableRef.current?.close();
    collapse(onDelete);
  }, [collapse, onDelete]);

  const renderRightActions = useCallback(() => (
    <Pressable style={st.deleteAction} onPress={triggerDelete}>
      <Feather name="trash-2" size={18} color="#fff" />
    </Pressable>
  ), [triggerDelete]);

  return (
    <Animated.View style={{ height: rowHeight, opacity: opacityAnim }}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootLeft={false}
        overshootRight={false}
        rightThreshold={28}
        friction={1.5}
        onSwipeableOpen={() => { revealedRef.current = true; }}
        onSwipeableClose={() => { revealedRef.current = false; }}
        containerStyle={{ borderRadius: 10, overflow: "hidden" }}
      >
        <Pressable
          style={st.rowWrap}
          onPress={() => {
            if (revealedRef.current) { swipeableRef.current?.close(); }
            else { onPress(); }
          }}
        >
          <Feather name="clock" size={15} color={Colors.textMuted} />
          <Text style={st.rowText} numberOfLines={1}>{query}</Text>
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
}

// ── YouTubeScreen ─────────────────────────────────────────────────────────────
export default function YouTubeScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 52) : insets.top;

  const [query,   setQuery]   = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);

  const borderAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const inputRef   = useRef<TextInput>(null);

  // ── Load history + auto-focus ─────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) { try { setHistory(JSON.parse(raw)); } catch {} }
    });
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  const persistHistory = useCallback((next: string[]) => {
    setHistory(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  // ── Animated border on focus ───────────────────────────────────────────────
  const handleFocus = useCallback(() => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  }, [borderAnim]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  }, [borderAnim]);

  const borderColor = borderAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [Colors.border, "#FF0000"],
  });

  const shakeX = shakeAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-8, 0, 8] });

  // ── Shake on empty submit ─────────────────────────────────────────────────
  const shake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // ── Search ─────────────────────────────────────────────────────────────────
  const doSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) { shake(); return; }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Keyboard.dismiss();

      const next = [trimmed, ...history.filter((h) => h !== trimmed)].slice(0, MAX_HISTORY);
      persistHistory(next);

      const encoded    = encodeURIComponent(trimmed);
      const youtubeUrl = `youtube://results?search_query=${encoded}`;
      const webUrl     = `https://www.youtube.com/results?search_query=${encoded}`;

      Linking.openURL(youtubeUrl).catch(() => Linking.openURL(webUrl));
    },
    [history, persistHistory, shake]
  );

  const handleSubmit      = useCallback(() => doSearch(query), [query, doSearch]);
  const handleRecentPress = useCallback((q: string) => { setQuery(q); doSearch(q); }, [doSearch]);
  const handleDeleteItem  = useCallback((q: string) => {
    persistHistory(history.filter((h) => h !== q));
  }, [history, persistHistory]);
  const handleClearAll    = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    persistHistory([]);
  }, [persistHistory]);

  return (
    <View style={[st.root, { paddingTop: topPad }]}>

      {/* Fixed logo header — matches Shazam page structure */}
      <View style={st.logoHeader}>
        <YouTubeLogo size={72} />
      </View>

      <ScrollView
        style={st.scrollArea}
        contentContainerStyle={st.content}
        keyboardShouldPersistTaps="handled"
      >

      {/* Search bar + button */}
      <Animated.View style={[st.searchGroup, { transform: [{ translateX: shakeX }] }]}>
        <Animated.View style={[st.inputWrap, { borderColor }]}>
          <Feather name="search" size={18} color={focused ? "#FF0000" : Colors.textMuted} style={st.searchIcon} />
          <TextInput
            ref={inputRef}
            style={st.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search YouTube..."
            placeholderTextColor={Colors.textMuted}
            selectionColor="#FF0000"
            returnKeyType="search"
            onSubmitEditing={handleSubmit}
            keyboardAppearance="dark"
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8} style={st.clearInputBtn}>
              <Feather name="x" size={16} color={Colors.textMuted} />
            </Pressable>
          )}
        </Animated.View>

        <TouchableOpacity style={st.searchBtn} onPress={handleSubmit} activeOpacity={0.8}>
          <Feather name="search" size={16} color="#fff" />
          <Text style={st.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Recent searches */}
      {history.length > 0 && (
        <View style={st.historySection}>
          <Text style={st.historyTitle}>Recent</Text>
          <View style={st.rowsWrap}>
            {history.map((h) => (
              <RecentRow
                key={h}
                query={h}
                onPress={() => handleRecentPress(h)}
                onDelete={() => handleDeleteItem(h)}
              />
            ))}
          </View>
          <TouchableOpacity onPress={handleClearAll} hitSlop={8} style={st.clearAllWrap}>
            <Text style={st.clearAllText}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root:       { flex: 1, backgroundColor: "#0b0b0c" },
  logoHeader: { alignItems: "center", paddingTop: 78, paddingBottom: 8 },
  scrollArea: { flex: 1 },
  content:    { paddingHorizontal: 16, paddingBottom: 60 },

  searchGroup: {
    width: "90%",
    alignSelf: "center",
    marginBottom: 44,
  },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  searchIcon:    { marginRight: 10 },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    paddingVertical: 14,
  },
  clearInputBtn: { padding: 4 },

  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
    gap: 6,
    backgroundColor: "#FF0000",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    marginTop: 8,
  },
  searchBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },

  historySection: { paddingHorizontal: 2 },
  historyTitle: {
    color: "#ffffff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  rowsWrap: {},
  clearAllWrap: { alignSelf: "flex-end", marginTop: 10 },
  clearAllText: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },

  deleteAction: {
    width: 68,
    height: ITEM_H,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  rowWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: ITEM_H,
    paddingHorizontal: 14,
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    marginBottom: 8,
  },
  rowText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 21,
    paddingBottom: 4,
  },
});
