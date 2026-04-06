import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const RED    = "#E03131";
const BG     = "#0b0b0c";
const ROW    = "#0f0f0f";
const BORDER = "#2A2A2A";

const BAR_COUNT   = 7;
const BAR_DELAYS  = [0, 180, 360, 80, 270, 140, 420];
const BAR_HEIGHTS = [0.72, 0.55, 0.88, 0.45, 0.78, 0.60, 0.82];
const MAX_H = 42;
const MIN_H = 5;

type ApplePlaylist = { id: string; name: string; count: number };
type AuthStatus = "authorized" | "denied" | "restricted" | "notDetermined" | "unavailable" | "loading";

let AppleMusicKit: any = null;
try {
  AppleMusicKit = require("apple-musickit");
} catch {
  AppleMusicKit = null;
}

function EqBar({ index }: { index: number }) {
  const height = useRef(new Animated.Value(MIN_H)).current;
  useEffect(() => {
    const dur = 900 + index * 120;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(height, { toValue: MAX_H * BAR_HEIGHTS[index], duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(height, { toValue: MIN_H, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    const tid = setTimeout(() => anim.start(), BAR_DELAYS[index]);
    return () => { clearTimeout(tid); anim.stop(); };
  }, []);
  return <Animated.View style={[s.eqBar, { height }]} />;
}

export default function MusicAppleScreen() {
  const goBack = () => router.back();

  const insets   = useSafeAreaInsets();
  const isTablet = Dimensions.get("window").width >= 768;

  const [authStatus, setAuthStatus]   = useState<AuthStatus>("loading");
  const [playlists, setPlaylists]     = useState<ApplePlaylist[]>([]);
  const [playingId, setPlayingId]     = useState<string | null>(null);
  const [loadingId, setLoadingId]     = useState<string | null>(null);

  const fetchPlaylists = useCallback(async () => {
    if (!AppleMusicKit) { setAuthStatus("unavailable"); return; }
    try {
      const status: string = await AppleMusicKit.requestAuthorization();
      setAuthStatus(status as AuthStatus);
      if (status === "authorized") {
        const list: ApplePlaylist[] = await AppleMusicKit.getPlaylists();
        setPlaylists(list);
      }
    } catch {
      setAuthStatus("denied");
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchPlaylists(); }, [fetchPlaylists]));

  const handlePlay = async (pl: ApplePlaylist) => {
    if (!AppleMusicKit || loadingId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingId(pl.id);
    try {
      await AppleMusicKit.playPlaylist(pl.id);
      setPlayingId(pl.id);
    } catch {
      setPlayingId(null);
    } finally {
      setLoadingId(null);
    }
  };

  const renderBody = () => {
    if (authStatus === "loading") {
      return (
        <View style={s.centred}>
          <ActivityIndicator color={RED} size="large" />
        </View>
      );
    }

    if (authStatus === "unavailable") {
      return (
        <View style={s.centred}>
          <Feather name="smartphone" size={44} color={RED} style={{ marginBottom: 16 }} />
          <Text style={s.stateTitle}>Install Required</Text>
          <Text style={s.stateBody}>Apple Music access is only available{"\n"}in the installed build, not Expo Go.</Text>
        </View>
      );
    }

    if (authStatus === "denied" || authStatus === "restricted") {
      return (
        <View style={s.centred}>
          <Feather name="lock" size={44} color={RED} style={{ marginBottom: 16 }} />
          <Text style={s.stateTitle}>Access Denied</Text>
          <Text style={s.stateBody}>Go to Settings → HK Life App{"\n"}and enable Media & Apple Music.</Text>
        </View>
      );
    }

    if (authStatus === "notDetermined") {
      return (
        <View style={s.centred}>
          <Pressable style={s.grantBtn} onPress={fetchPlaylists}>
            <Feather name="music" size={20} color="#fff" />
            <Text style={s.grantBtnText}>Grant Apple Music Access</Text>
          </Pressable>
        </View>
      );
    }

    if (playlists.length === 0) {
      return (
        <View style={s.centred}>
          <Text style={s.stateBody}>No playlists found in your library.</Text>
        </View>
      );
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32, paddingHorizontal: 16 }}
      >
        {playlists.map((pl) => {
          const isPlaying = playingId === pl.id;
          const isLoading = loadingId === pl.id;
          return (
            <Pressable
              key={pl.id}
              style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }, isPlaying && s.rowPlaying]}
              onPress={() => handlePlay(pl)}
            >
              <View style={[s.iconCell, isPlaying && s.iconCellPlaying]}>
                {isLoading ? (
                  <ActivityIndicator color={RED} size="small" />
                ) : isPlaying ? (
                  <Feather name="volume-2" size={18} color={RED} />
                ) : (
                  <Feather name="headphones" size={18} color={RED} />
                )}
              </View>
              <View style={s.rowTextWrap}>
                <Text style={[s.rowName, isPlaying && s.rowNamePlaying]}>{pl.name}</Text>
                {pl.count > 0 && (
                  <Text style={s.rowCount}>{pl.count} song{pl.count !== 1 ? "s" : ""}</Text>
                )}
              </View>
              <Feather
                name={isPlaying ? "pause-circle" : "play-circle"}
                size={22}
                color={isPlaying ? RED : "rgba(255,255,255,0.2)"}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={[s.inner, isTablet && s.innerTablet]}>
        <View style={s.headerArea}>
          <Pressable style={s.eqWrap} onPress={goBack}>
            {Array.from({ length: BAR_COUNT }).map((_, i) => <EqBar key={i} index={i} />)}
          </Pressable>
          <Text style={s.pageTitle}>Apple Music</Text>
          <Pressable style={s.backZone} onPress={goBack} />
        </View>
        {renderBody()}
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

  centred: {
    flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32,
  },
  stateTitle: {
    color: "#fff", fontSize: 17, fontWeight: "600",
    fontFamily: "Inter_600SemiBold", marginBottom: 10, textAlign: "center",
  },
  stateBody: {
    color: "rgba(255,255,255,0.45)", fontSize: 14,
    fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22,
  },

  grantBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: RED, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24,
  },
  grantBtnText: {
    color: "#fff", fontSize: 15, fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },

  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: ROW, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
    marginBottom: 8,
  },
  rowPlaying: {
    borderColor: "rgba(224,49,49,0.35)",
    backgroundColor: "rgba(224,49,49,0.06)",
  },
  iconCell: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "#141414", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  iconCellPlaying: {
    borderColor: "rgba(224,49,49,0.3)",
    backgroundColor: "rgba(224,49,49,0.1)",
  },
  rowTextWrap: { flex: 1 },
  rowName: {
    fontSize: 15, fontWeight: "500", color: "#fff",
    fontFamily: "Inter_500Medium",
  },
  rowNamePlaying: { color: RED },
  rowCount: {
    fontSize: 12, color: "rgba(255,255,255,0.35)",
    fontFamily: "Inter_400Regular", marginTop: 2,
  },
});
