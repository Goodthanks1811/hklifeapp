import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

const RED    = "#E03131";
const BG     = "#0b0b0c";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";

const ITEM_H   = 66;
const ITEM_GAP = 8;
const SLOT_H   = ITEM_H + ITEM_GAP;

const BAR_COUNT   = 7;
const BAR_DELAYS  = [0, 180, 360, 80, 270, 140, 420];
const BAR_HEIGHTS = [0.72, 0.55, 0.88, 0.45, 0.78, 0.60, 0.82];
const MAX_H = 42;
const MIN_H = 5;

const STORAGE_KEY = "music_apple_playlists";

// Static zero — passed as dimValue to the dragging row so it never dims itself
const ZERO_ANIM = new Animated.Value(0);
const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));

function EqBar({ index }: { index: number }) {
  const height = useRef(new Animated.Value(MIN_H)).current;

  useEffect(() => {
    const dur = 900 + index * 120;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(height, {
          toValue: MAX_H * BAR_HEIGHTS[index],
          duration: dur,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(height, {
          toValue: MIN_H,
          duration: dur,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    const tid = setTimeout(() => anim.start(), BAR_DELAYS[index]);
    return () => {
      clearTimeout(tid);
      anim.stop();
    };
  }, []);

  return <Animated.View style={[s.eqBar, { height }]} />;
}

type ApplePL = { name: string; url: string };

const DEFAULT_PLAYLISTS: ApplePL[] = [
  { name: "Bone Greatest Hits",   url: "" },
  { name: "2pac Greatest Hits",   url: "" },
  { name: "Snoop Greatest Hits",  url: "" },
  { name: "DMX Greatest Hits",    url: "" },
  { name: "Eminem Greatest Hits", url: "" },
  { name: "The Repeat List",      url: "" },
  { name: "Old School Rnb",       url: "" },
  { name: "Driving",              url: "" },
  { name: "Pre Gym",              url: "" },
  { name: "2022 New Stuff",       url: "" },
  { name: "Faydee",               url: "" },
  { name: "Carnal Hits",          url: "" },
];

// ── Playlist row — identical drag wiring to Life Admin ────────────────────────
function PlaylistRow({
  pl, isDragging, dimValue, onPress, onLongPress,
}: {
  pl: ApplePL; isDragging: boolean; dimValue: Animated.Value;
  onPress: () => void; onLongPress: () => void;
}) {
  // Combined opacity: drag dim (identical to Life Admin pattern)
  const combinedOpacity = dimValue.interpolate({ inputRange: [0, 1], outputRange: [1, 0.22] });

  return (
    <Animated.View style={{ height: ITEM_H, opacity: combinedOpacity }}>
      <Pressable
        style={[s.row, isDragging && s.rowDragging]}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={200}
      >
        <View style={s.iconCell}>
          <Feather name="headphones" size={18} color={RED} />
        </View>
        <Text style={s.rowName}>{pl.name}</Text>
        <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.2)" />
      </Pressable>
    </Animated.View>
  );
}

export default function MusicAppleScreen() {
  const [playlists, setPlaylists] = useState<ApplePL[]>(DEFAULT_PLAYLISTS);
  const playlistsRef = useRef<ApplePL[]>(DEFAULT_PLAYLISTS);
  useEffect(() => { playlistsRef.current = playlists; }, [playlists]);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(v => {
      if (v) {
        const parsed = JSON.parse(v) as ApplePL[];
        setPlaylists(parsed);
        playlistsRef.current = parsed;
      }
    });
  }, []));

  const insets   = useSafeAreaInsets();
  const isTablet = Dimensions.get("window").width >= 768;

  const openPlaylist = (pl: ApplePL) => {
    const target = pl.url.trim();
    if (target) {
      Linking.openURL(target).catch(() =>
        Linking.openURL("https://music.apple.com")
      );
    } else {
      Linking.openURL("music://").catch(() =>
        Linking.openURL("https://music.apple.com")
      );
    }
  };

  // ── Drag & drop — identical to Life Admin ────────────────────────────────────
  const posAnims        = useRef<Record<number, Animated.Value>>({});
  const addedAnims      = useRef<Record<number, ReturnType<typeof Animated.add>>>({});
  const containerRef    = useRef<View>(null);
  const containerTopRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const startScrollRef  = useRef(0);
  const isDraggingRef   = useRef(false);
  const draggingIdxRef  = useRef(-1);
  const hoverIdxRef     = useRef(-1);
  const dragOccurredRef = useRef(false);
  const panY            = useRef(new Animated.Value(0)).current;
  const dimAnim         = useRef(new Animated.Value(0)).current;
  const [dragActiveIdx, setDragActiveIdx] = useState(-1);
  const [listScrollEnabled, setListScrollEnabled] = useState(true);

  // Initialise position anim for each playlist slot
  playlists.forEach((_, i) => {
    if (!posAnims.current[i]) {
      posAnims.current[i] = new Animated.Value(i * SLOT_H);
      addedAnims.current[i] = Animated.add(posAnims.current[i], panY);
    }
  });

  // Snap positions whenever playlists list changes
  useEffect(() => {
    if (!isDraggingRef.current) {
      playlistsRef.current.forEach((_, i) => {
        posAnims.current[i]?.setValue(i * SLOT_H);
      });
    }
  }, [playlists]);

  const animatePositions = useCallback((dragIdx: number, hoverIdx: number) => {
    const len = playlistsRef.current.length;
    for (let i = 0; i < len; i++) {
      if (i === dragIdx) continue;
      let target = i;
      if (dragIdx < hoverIdx && i > dragIdx && i <= hoverIdx) target = i - 1;
      else if (dragIdx > hoverIdx && i >= hoverIdx && i < dragIdx) target = i + 1;
      posAnims.current[i]?.stopAnimation();
      Animated.timing(posAnims.current[i], {
        toValue: target * SLOT_H, duration: 110, useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }).start();
    }
  }, []);

  const startDrag = useCallback((idx: number) => {
    isDraggingRef.current  = true;
    draggingIdxRef.current = idx;
    hoverIdxRef.current    = idx;
    dragOccurredRef.current = true;
    setDragActiveIdx(idx);
    setListScrollEnabled(false);
    panY.setValue(0);
    Animated.timing(dimAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startScrollRef.current = scrollOffsetRef.current;
    containerRef.current?.measure((_x, _y, _w, _h, _px, py) => {
      containerTopRef.current = py;
    });
  }, [dimAnim]);

  const endDrag = useCallback(() => {
    const di = draggingIdxRef.current;
    const hi = hoverIdxRef.current;
    isDraggingRef.current  = false;
    draggingIdxRef.current = -1;
    hoverIdxRef.current    = -1;
    panY.setValue(0);
    setListScrollEnabled(true);
    Animated.timing(dimAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();

    if (di >= 0 && hi >= 0 && di !== hi) {
      setPlaylists(prev => {
        const next = [...prev];
        const [moved] = next.splice(di, 1);
        next.splice(hi, 0, moved);
        next.forEach((_, i) => posAnims.current[i]?.setValue(i * SLOT_H));
        playlistsRef.current = next;
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    } else {
      playlistsRef.current.forEach((_, i) => posAnims.current[i]?.setValue(i * SLOT_H));
    }
    setDragActiveIdx(-1);
    setTimeout(() => { dragOccurredRef.current = false; }, 80);
  }, []);

  const dragResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => isDraggingRef.current,
    onPanResponderMove: (_, gs) => {
      if (!isDraggingRef.current) return;
      const di  = draggingIdxRef.current;
      const len = playlistsRef.current.length;
      panY.setValue(gs.dy);
      const relY     = gs.moveY - containerTopRef.current + (scrollOffsetRef.current - startScrollRef.current);
      const newHover = clamp(0, len - 1, Math.floor(relY / SLOT_H));
      if (newHover !== hoverIdxRef.current) {
        hoverIdxRef.current = newHover;
        animatePositions(di, newHover);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    onPanResponderEnd:       () => endDrag(),
    onPanResponderTerminate: () => endDrag(),
  }), [animatePositions, endDrag]);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={[s.inner, isTablet && s.innerTablet]}>
        <View style={s.headerArea}>
          <Pressable style={s.eqWrap} onPress={() => router.back()}>
            {Array.from({ length: BAR_COUNT }).map((_, i) => (
              <EqBar key={i} index={i} />
            ))}
          </Pressable>
          <Text style={s.pageTitle}>Apple Music</Text>
          <Pressable style={s.backZone} onPress={() => router.back()} />
        </View>

        <ScrollView
          scrollEnabled={listScrollEnabled}
          showsVerticalScrollIndicator={false}
          onScroll={e => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
        >
          {/* Absolute-position container — enables live drag animation (Life Admin pattern) */}
          <View
            ref={containerRef}
            {...dragResponder.panHandlers}
            style={{ height: Math.max(playlists.length, 1) * SLOT_H + 16, marginHorizontal: 16 }}
          >
            {/* Tap-anywhere-to-cancel overlay */}
            {dragActiveIdx !== -1 && (
              <Pressable
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
                onPress={() => endDrag()}
              />
            )}
            {playlists.map((pl, idx) => {
              const isDragging = dragActiveIdx === idx;
              const posAnim    = posAnims.current[idx] ?? new Animated.Value(idx * SLOT_H);
              const translateY = isDragging
                ? (addedAnims.current[idx] ?? posAnim)
                : posAnim;
              return (
                <Animated.View
                  key={idx}
                  style={[
                    s.absItem,
                    { top: 0, zIndex: isDragging ? 100 : 1, transform: [{ translateY }] },
                  ]}
                >
                  <PlaylistRow
                    pl={pl}
                    isDragging={isDragging}
                    dimValue={isDragging ? ZERO_ANIM : dimAnim}
                    onPress={() => { if (!dragOccurredRef.current) openPlaylist(pl); }}
                    onLongPress={() => startDrag(idx)}
                  />
                </Animated.View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG },
  inner:       { flex: 1 },
  innerTablet: { maxWidth: 900, alignSelf: "center", width: "100%" },

  headerArea: {
    backgroundColor: BG,
    paddingTop: 28, paddingBottom: 10,
    position: "relative",
  },
  backZone: { position: "absolute", left: 0, top: 0, bottom: 0, width: 80 },

  eqWrap: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "center",
    gap: 5, height: 62, paddingBottom: 4,
  },
  eqBar: { width: 5, borderRadius: 3, backgroundColor: RED },

  pageTitle: {
    textAlign: "center", color: "#fff",
    fontSize: 17, fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    paddingTop: 8,
  },

  // Absolute-position item container
  absItem: { position: "absolute", left: 0, right: 0, height: ITEM_H },

  row: {
    height: ITEM_H,
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, paddingHorizontal: 14,
  },
  rowDragging: {
    backgroundColor: "#1c1c1e",
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 18, elevation: 18,
  },
  iconCell: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  rowName: { flex: 1, fontSize: 15, fontWeight: "500", color: "#fff", fontFamily: "Inter_500Medium" },
});
