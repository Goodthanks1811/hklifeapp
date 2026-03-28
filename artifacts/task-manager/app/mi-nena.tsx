import { Feather } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import * as MediaLibrary from "expo-media-library";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/context/DrawerContext";

// ── Constants ─────────────────────────────────────────────────────────────────
const ALBUM_NAME = "Mi Nena";
const COLS       = 3;
const GAP        = 2;

// ── Types ─────────────────────────────────────────────────────────────────────
type Asset = MediaLibrary.Asset;

// ── Full-screen viewer ────────────────────────────────────────────────────────
function Viewer({
  assets,
  startIndex,
  onClose,
}: {
  assets: Asset[];
  startIndex: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index: startIndex, animated: false });
    }, 50);
  }, [startIndex]);

  const renderItem = useCallback(
    ({ item, index }: { item: Asset; index: number }) => {
      if (item.mediaType === MediaLibrary.MediaType.video) {
        return (
          <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
            <Video
              source={{ uri: item.uri }}
              style={{ width, height }}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={index === currentIndex}
              isLooping
            />
          </View>
        );
      }
      return (
        <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
          <Image
            source={{ uri: item.uri }}
            style={{ width, height }}
            resizeMode="contain"
          />
        </View>
      );
    },
    [width, height, currentIndex]
  );

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <StatusBar hidden />
      <View style={styles.viewerBg}>
        <FlatList
          ref={listRef}
          data={assets}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onMomentumScrollEnd={(e) => {
            setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width));
          }}
        />
        <TouchableOpacity style={styles.viewerClose} onPress={onClose} activeOpacity={0.8}>
          <Feather name="x" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.viewerCounter}>
          <Text style={styles.viewerCounterText}>{currentIndex + 1} / {assets.length}</Text>
        </View>
      </View>
    </Modal>
  );
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────
function Thumbnail({ item, size, onPress }: { item: Asset; size: number; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.thumb, { width: size, height: size }]} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {item.mediaType === MediaLibrary.MediaType.video && (
        <View style={styles.playOverlay}>
          <View style={styles.playBadge}>
            <Feather name="play" size={14} color="#fff" />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function MiNenaScreen() {
  const { openDrawer } = useDrawer();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const [assets,      setAssets]      = useState<Asset[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [permStatus,  setPermStatus]  = useState<MediaLibrary.PermissionStatus | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { status } = await MediaLibrary.requestPermissionsAsync();
    setPermStatus(status);
    if (status !== "granted") {
      setError("Photos access is required.\n\nTap below to grant access in Settings.");
      setLoading(false);
      return;
    }

    // Find the album
    const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: false });
    const album  = albums.find((a) => a.title === ALBUM_NAME);

    if (!album) {
      setError(
        `No album called "${ALBUM_NAME}" found in the Photos app.\n\n` +
        `Create a "${ALBUM_NAME}" album in Photos and add your images/videos to it.`
      );
      setLoading(false);
      return;
    }

    const result = await MediaLibrary.getAssetsAsync({
      album,
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      first: 500,
      sortBy: [MediaLibrary.SortBy.creationTime],
    });

    setAssets(result.assets);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const cellSize = (width - GAP * (COLS + 1)) / COLS;

  const renderItem = useCallback(
    ({ item, index }: { item: Asset; index: number }) => (
      <Thumbnail item={item} size={cellSize} onPress={() => setViewerIndex(index)} />
    ),
    [cellSize]
  );

  return (
    <View style={styles.screen}>
      <Pressable onPress={openDrawer} style={[styles.hamburger, { top: topPad + 10 }]}>
        <Feather name="menu" size={24} color="#fff" />
      </Pressable>

      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color="#ff6b9d" />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : error ? (
        <View style={styles.centred}>
          <Feather name="alert-circle" size={40} color="#333" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : assets.length === 0 ? (
        <View style={styles.centred}>
          <Feather name="image" size={40} color="#333" />
          <Text style={styles.errorText}>No photos or videos in the "{ALBUM_NAME}" album yet.</Text>
        </View>
      ) : (
        <FlatList
          data={assets}
          numColumns={COLS}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingTop: topPad + 56,
            paddingBottom: insets.bottom + 16,
            paddingHorizontal: GAP,
            gap: GAP,
          }}
          columnWrapperStyle={{ gap: GAP }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Mi Nena</Text>
              <Text style={styles.headerCount}>{assets.length} items</Text>
            </View>
          }
        />
      )}

      {viewerIndex !== null && (
        <Viewer assets={assets} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: "#000" },
  hamburger:   { position: "absolute", left: 16, zIndex: 10, padding: 8 },
  centred:     { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  loadingText: { color: "#555", fontSize: 14, fontFamily: "Inter_400Regular" },
  errorText:   { color: "#555", fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  retryBtn:    { marginTop: 4, paddingVertical: 10, paddingHorizontal: 28, backgroundColor: "#1a1a1a", borderRadius: 12, borderWidth: 1, borderColor: "#333" },
  retryBtnText:{ color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  header:      { paddingHorizontal: 4, paddingBottom: 12 },
  headerTitle: { fontSize: 26, fontWeight: "900", color: "#fff", fontFamily: "Inter_700Bold" },
  headerCount: { fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "Inter_400Regular", marginTop: 2 },
  thumb:       { backgroundColor: "#111", overflow: "hidden" },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  playBadge:   { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" },
  viewerBg:    { flex: 1, backgroundColor: "#000" },
  viewerClose: { position: "absolute", top: 52, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  viewerCounter: { position: "absolute", bottom: 48, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  viewerCounterText: { color: "#fff", fontSize: 13, fontFamily: "Inter_400Regular" },
});
