import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
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
const STORAGE_KEY = "mi_nena_files_v1";
const COLS        = 3;
const GAP         = 2;
const VIDEO_EXTS  = [".mp4", ".mov", ".m4v", ".avi", ".mkv"];

type MediaItem = { uri: string; name: string; isVideo: boolean };

function isVideo(name: string) {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  return VIDEO_EXTS.includes(ext);
}

// ── Full-screen viewer ────────────────────────────────────────────────────────
function Viewer({
  items,
  startIndex,
  onClose,
}: {
  items: MediaItem[];
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
    ({ item, index }: { item: MediaItem; index: number }) => {
      if (item.isVideo) {
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
          data={items}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(item) => item.uri}
          renderItem={renderItem}
          onMomentumScrollEnd={(e) => {
            setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width));
          }}
        />
        <TouchableOpacity style={styles.viewerClose} onPress={onClose} activeOpacity={0.8}>
          <Feather name="x" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.viewerCounter}>
          <Text style={styles.viewerCounterText}>
            {currentIndex + 1} / {items.length}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────
function Thumbnail({ item, size, onPress }: { item: MediaItem; size: number; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.thumb, { width: size, height: size }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {item.isVideo && (
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

  const [items,       setItems]       = useState<MediaItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [picking,     setPicking]     = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Load saved URIs from storage
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved: MediaItem[] = JSON.parse(raw);
          setItems(saved);
        }
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  // Open document picker and append selected files
  const pickFiles = useCallback(async () => {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "video/*"],
        multiple: true,
        copyToCacheDirectory: false,
      });

      if (result.canceled) return;

      const picked: MediaItem[] = result.assets.map((a) => ({
        uri:     a.uri,
        name:    a.name ?? a.uri.split("/").pop() ?? "file",
        isVideo: isVideo(a.name ?? a.uri),
      }));

      // Merge with existing, de-duplicate by URI
      setItems((prev) => {
        const existingUris = new Set(prev.map((x) => x.uri));
        const fresh = picked.filter((p) => !existingUris.has(p.uri));
        const merged = [...prev, ...fresh].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged)).catch(() => {});
        return merged;
      });
    } catch (_) {
    } finally {
      setPicking(false);
    }
  }, []);

  // Clear all saved files
  const clearFiles = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setItems([]);
  }, []);

  const cellSize = (width - GAP * (COLS + 1)) / COLS;

  const renderItem = useCallback(
    ({ item, index }: { item: MediaItem; index: number }) => (
      <Thumbnail
        item={item}
        size={cellSize}
        onPress={() => setViewerIndex(index)}
      />
    ),
    [cellSize]
  );

  return (
    <View style={styles.screen}>
      {/* Hamburger */}
      <Pressable onPress={openDrawer} style={[styles.hamburger, { top: topPad + 10 }]}>
        <Feather name="menu" size={24} color="#fff" />
      </Pressable>

      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color="#E03131" />
        </View>
      ) : items.length === 0 ? (
        /* ── Empty state ── */
        <View style={styles.centred}>
          <View style={styles.emptyIcon}>
            <Feather name="image" size={36} color="#E03131" />
          </View>
          <Text style={styles.emptyTitle}>Mi Nena</Text>
          <Text style={styles.emptySubtitle}>
            Tap below to select your photos and videos from the Files app.
            You only need to do this once — they'll be remembered.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={pickFiles} activeOpacity={0.8} disabled={picking}>
            {picking
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Feather name="folder" size={16} color="#fff" style={{ marginRight: 8 }} /><Text style={styles.primaryBtnText}>Select Files</Text></>
            }
          </TouchableOpacity>
        </View>
      ) : (
        /* ── Grid ── */
        <FlatList
          data={items}
          numColumns={COLS}
          keyExtractor={(item) => item.uri}
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
            <View style={styles.gridHeader}>
              <View>
                <Text style={styles.headerTitle}>Mi Nena</Text>
                <Text style={styles.headerCount}>{items.length} items</Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={pickFiles}
                  activeOpacity={0.8}
                  disabled={picking}
                >
                  {picking
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Feather name="plus" size={18} color="#fff" />
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={clearFiles}
                  activeOpacity={0.8}
                >
                  <Feather name="refresh-cw" size={15} color="#555" />
                </TouchableOpacity>
              </View>
            </View>
          }
        />
      )}

      {viewerIndex !== null && (
        <Viewer
          items={items}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: "#000" },
  hamburger: { position: "absolute", left: 16, zIndex: 10, padding: 8 },

  centred: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    gap: 16,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(224,49,49,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle:    { fontSize: 24, fontWeight: "900", color: "#fff", fontFamily: "Inter_700Bold" },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: "#E03131",
    borderRadius: 14,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  gridHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  headerTitle:   { fontSize: 26, fontWeight: "900", color: "#fff", fontFamily: "Inter_700Bold" },
  headerCount:   { fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "Inter_400Regular", marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 4 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E03131",
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },

  thumb:       { backgroundColor: "#111", overflow: "hidden" },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  playBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.6)",
  },

  viewerBg:    { flex: 1, backgroundColor: "#000" },
  viewerClose: {
    position: "absolute",
    top: 52,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerCounter: {
    position: "absolute",
    bottom: 48,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  viewerCounterText: { color: "#fff", fontSize: 13, fontFamily: "Inter_400Regular" },
});
