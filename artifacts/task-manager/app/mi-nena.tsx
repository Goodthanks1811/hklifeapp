import { Feather } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface MediaAsset {
  uri: string;
  name: string;
  isVideo: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const IMAGE_EXT  = /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|tiff)$/i;
const VIDEO_EXT  = /\.(mp4|mov|m4v|avi|mkv|wmv|3gp)$/i;
const FOLDER     = "Mi Nena";
const FOLDER_ENC = encodeURIComponent(FOLDER); // "Mi%20Nena"
const COLS       = 3;
const GAP        = 2;

// ── Viewer (full-screen modal) ────────────────────────────────────────────────
function Viewer({
  assets,
  startIndex,
  onClose,
}: {
  assets: MediaAsset[];
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
    ({ item, index }: { item: MediaAsset; index: number }) => {
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
          data={assets}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          keyExtractor={(item) => item.uri}
          renderItem={renderItem}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / width);
            setCurrentIndex(idx);
          }}
        />

        {/* Close button */}
        <TouchableOpacity style={styles.viewerClose} onPress={onClose} activeOpacity={0.8}>
          <Feather name="x" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Counter */}
        <View style={styles.viewerCounter}>
          <Text style={styles.viewerCounterText}>{currentIndex + 1} / {assets.length}</Text>
        </View>
      </View>
    </Modal>
  );
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────
function Thumbnail({ item, size, onPress }: { item: MediaAsset; size: number; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.thumb, { width: size, height: size }]} onPress={onPress} activeOpacity={0.85}>
      <Image
        source={{ uri: item.uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
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

  const [assets,  setAssets]  = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const base = FileSystem.documentDirectory ?? "";

        // In Expo Go, documentDirectory is deep inside .../Documents/ExponentExperienceData/...
        // The Files app "On My iPhone → Expo" folder is the top-level .../Documents/ folder.
        // We extract the Documents root by splitting on "/Documents/".
        const docRoot = base.includes("/Documents/")
          ? base.split("/Documents/")[0] + "/Documents/"
          : base;

        // Try several path variants for the folder
        const candidates = [
          docRoot + "Mi Nena/",
          docRoot + "Mi%20Nena/",
          base + "Mi Nena/",
          base + "Mi%20Nena/",
        ];

        let workingFolder: string | null = null;
        for (const c of candidates) {
          try {
            const contents = await FileSystem.readDirectoryAsync(c);
            workingFolder = c;
            break;
          } catch {}
        }

        if (!workingFolder) {
          // Show what IS in documentDirectory to help diagnose
          let rootContents: string[] = [];
          try { rootContents = await FileSystem.readDirectoryAsync(base); } catch {}
          setError(
            `Folder "${FOLDER}" not found.\n\ndocumentDirectory root contains:\n${rootContents.length ? rootContents.join(", ") : "(empty)"}\n\nBase: ${base}`
          );
          setLoading(false);
          return;
        }

        const files = await FileSystem.readDirectoryAsync(workingFolder);
        const media: MediaAsset[] = files
          .filter((f) => IMAGE_EXT.test(f) || VIDEO_EXT.test(f))
          .sort()
          .map((f) => ({
            uri:     workingFolder! + encodeURIComponent(f),
            name:    f,
            isVideo: VIDEO_EXT.test(f),
          }));
        setAssets(media);
      } catch (e: any) {
        setError(e.message ?? "Failed to load media");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const cellSize = (width - GAP * (COLS + 1)) / COLS;

  const renderItem = useCallback(
    ({ item, index }: { item: MediaAsset; index: number }) => (
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
          <ActivityIndicator size="large" color="#ff6b9d" />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : error ? (
        <View style={styles.centred}>
          <Feather name="folder" size={40} color="#333" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : assets.length === 0 ? (
        <View style={styles.centred}>
          <Feather name="image" size={40} color="#333" />
          <Text style={styles.errorText}>No photos or videos found in "{FOLDER}"</Text>
        </View>
      ) : (
        <FlatList
          data={assets}
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
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Mi Nena</Text>
              <Text style={styles.headerCount}>{assets.length} items</Text>
            </View>
          }
        />
      )}

      {viewerIndex !== null && (
        <Viewer
          assets={assets}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: "#000" },
  hamburger:     { position: "absolute", left: 16, zIndex: 10, padding: 8 },
  centred:       { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  loadingText:   { color: "#555", fontSize: 14, fontFamily: "Inter_400Regular" },
  errorText:     { color: "#555", fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  header:        { paddingHorizontal: 4, paddingBottom: 12 },
  headerTitle:   { fontSize: 26, fontWeight: "900", color: "#fff", fontFamily: "Inter_700Bold" },
  headerCount:   { fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "Inter_400Regular", marginTop: 2 },
  thumb:         { backgroundColor: "#111", overflow: "hidden" },
  playOverlay:   { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  playBadge:     {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)",
  },
  viewerBg:      { flex: 1, backgroundColor: "#000" },
  viewerClose:   {
    position: "absolute", top: 52, right: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  viewerCounter: {
    position: "absolute", bottom: 48, alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  viewerCounterText: { color: "#fff", fontSize: 13, fontFamily: "Inter_400Regular" },
});
