import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/context/DrawerContext";

// ── Types & constants ─────────────────────────────────────────────────────────
const STORAGE_KEY = "mi_nena_folders_v2";
const GRID_COLS   = 3;
const FOLD_COLS   = 2;
const GAP         = 2;
const VIDEO_EXTS  = [".mp4", ".mov", ".m4v", ".avi", ".mkv"];

type MediaItem = { uri: string; name: string; isVideo: boolean };
type Folder    = { id: string; name: string; items: MediaItem[] };

function isVideo(name: string) {
  return VIDEO_EXTS.includes(name.slice(name.lastIndexOf(".")).toLowerCase());
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── Persist helpers ───────────────────────────────────────────────────────────
async function saveFolders(folders: Folder[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
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
  const [idx, setIdx] = useState(startIndex);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToIndex({ index: startIndex, animated: false }), 50);
  }, [startIndex]);

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <StatusBar hidden />
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <FlatList
          ref={listRef}
          data={items}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(item) => item.uri}
          onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index }) =>
            item.isVideo ? (
              <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
                <Video
                  source={{ uri: item.uri }}
                  style={{ width, height }}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={index === idx}
                  isLooping
                />
              </View>
            ) : (
              <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
                <Image source={{ uri: item.uri }} style={{ width, height }} resizeMode="contain" />
              </View>
            )
          }
        />
        <TouchableOpacity style={s.viewerClose} onPress={onClose} activeOpacity={0.8}>
          <Feather name="x" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.viewerCounter}>
          <Text style={s.viewerCounterTxt}>{idx + 1} / {items.length}</Text>
        </View>
      </View>
    </Modal>
  );
}

// ── New folder modal ──────────────────────────────────────────────────────────
function NewFolderModal({
  visible,
  onCancel,
  onCreate,
}: {
  visible: boolean;
  onCancel: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");

  function confirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setName("");
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Pressable style={s.overlay} onPress={() => { Keyboard.dismiss(); onCancel(); }}>
        <Pressable style={s.modalBox} onPress={(e) => e.stopPropagation()}>
          <Text style={s.modalTitle}>New Folder</Text>
          <TextInput
            style={s.modalInput}
            placeholder="Folder name"
            placeholderTextColor="#555"
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={confirm}
          />
          <View style={s.modalBtns}>
            <TouchableOpacity style={s.modalCancel} onPress={onCancel} activeOpacity={0.8}>
              <Text style={s.modalCancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalCreate} onPress={confirm} activeOpacity={0.8}>
              <Text style={s.modalCreateTxt}>Create</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Folder card ───────────────────────────────────────────────────────────────
function FolderCard({
  folder,
  cardSize,
  onPress,
  onLongPress,
}: {
  folder: Folder;
  cardSize: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const cover = folder.items.find((i) => !i.isVideo) ?? folder.items[0];

  return (
    <TouchableOpacity
      style={[s.folderCard, { width: cardSize }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
    >
      <View style={[s.folderCover, { height: cardSize * 0.75 }]}>
        {cover ? (
          <Image source={{ uri: cover.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={s.folderEmpty}>
            <Feather name="image" size={28} color="#333" />
          </View>
        )}
        {folder.items.length > 1 && (
          <View style={s.folderStack1} />
        )}
      </View>
      <View style={s.folderMeta}>
        <Text style={s.folderName} numberOfLines={1}>{folder.name}</Text>
        <Text style={s.folderCount}>{folder.items.length} item{folder.items.length !== 1 ? "s" : ""}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────
function Thumbnail({ item, size, onPress }: { item: MediaItem; size: number; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.thumb, { width: size, height: size }]} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {item.isVideo && (
        <View style={s.playOverlay}>
          <View style={s.playBadge}>
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

  const [folders,        setFolders]        = useState<Folder[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [picking,        setPicking]        = useState(false);
  const [openFolderId,   setOpenFolderId]   = useState<string | null>(null);
  const [viewerIndex,    setViewerIndex]    = useState<number | null>(null);
  const [showNewFolder,  setShowNewFolder]  = useState(false);

  // Load + migrate (prune any URIs that are no longer accessible)
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: Folder[] = JSON.parse(raw);
          // Check each URI — remove ones that are gone
          const migrated = await Promise.all(
            parsed.map(async (folder) => {
              const alive: MediaItem[] = [];
              for (const item of folder.items) {
                try {
                  const info = await FileSystem.getInfoAsync(item.uri);
                  if (info.exists) alive.push(item);
                } catch {
                  // skip broken
                }
              }
              return { ...folder, items: alive };
            })
          );
          const changed = migrated.some((f, i) => f.items.length !== parsed[i].items.length);
          setFolders(migrated);
          if (changed) await saveFolders(migrated);
        }
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  // Pick files, copy them to permanent storage, then add to a folder
  const pickIntoFolder = useCallback(async (folderId: string) => {
    setPicking(true);
    // Small delay so any dismissing modal fully closes before iOS presents the picker
    await new Promise((r) => setTimeout(r, 300));
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "video/*"],
        multiple: true,
        copyToCacheDirectory: true, // ensures we get a readable file:// URI
      });
      if (result.canceled || !result.assets.length) return;

      // Ensure our permanent media dir exists
      const mediaDir = `${FileSystem.documentDirectory}mi_nena_media/`;
      const dirInfo  = await FileSystem.getInfoAsync(mediaDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(mediaDir, { intermediates: true });
      }

      // Copy every picked file into permanent storage so URIs survive restarts
      const picked: MediaItem[] = [];
      for (const a of result.assets) {
        const name = a.name ?? a.uri.split("/").pop() ?? `file_${Date.now()}`;
        const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const dest = `${mediaDir}${Date.now()}_${safe}`;
        try {
          await FileSystem.copyAsync({ from: a.uri, to: dest });
          picked.push({ uri: dest, name, isVideo: isVideo(name) });
        } catch {
          // copy failed — keep the cache URI for this session
          picked.push({ uri: a.uri, name, isVideo: isVideo(name) });
        }
      }

      setFolders((prev) => {
        const next = prev.map((f) => {
          if (f.id !== folderId) return f;
          const existing = new Set(f.items.map((i) => i.uri));
          const fresh    = picked.filter((p) => !existing.has(p.uri));
          return { ...f, items: [...f.items, ...fresh] };
        });
        saveFolders(next).catch(() => {});
        return next;
      });
    } catch (_) {
    } finally {
      setPicking(false);
    }
  }, []);

  // Create folder and navigate into it (user taps + to add files manually)
  const createFolder = useCallback(async (name: string) => {
    setShowNewFolder(false);
    const id = uid();
    const folder: Folder = { id, name, items: [] };
    const next = [...folders, folder];
    setFolders(next);
    await saveFolders(next);
    setOpenFolderId(id);
  }, [folders]);

  // Delete folder
  const deleteFolder = useCallback((folderId: string) => {
    Alert.alert("Delete Folder", "Remove this folder and all its files from the app?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setFolders((prev) => {
            const next = prev.filter((f) => f.id !== folderId);
            saveFolders(next).catch(() => {});
            return next;
          });
        },
      },
    ]);
  }, []);

  const openFolder = folders.find((f) => f.id === openFolderId);
  const folderCardSize = (width - GAP * (FOLD_COLS + 1)) / FOLD_COLS;
  const thumbSize = (width - GAP * (GRID_COLS + 1)) / GRID_COLS;

  // ── Folder grid ──
  if (!openFolder) {
    return (
      <View style={s.screen}>
        <Pressable onPress={openDrawer} style={[s.hamburger, { top: topPad + 10 }]}>
          <Feather name="menu" size={24} color="#fff" />
        </Pressable>

        {loading ? (
          <View style={s.centred}>
            <ActivityIndicator size="large" color="#E03131" />
          </View>
        ) : (
          <FlatList
            key="folder-grid"
            data={folders}
            numColumns={FOLD_COLS}
            keyExtractor={(f) => f.id}
            contentContainerStyle={{
              paddingTop: topPad + 56,
              paddingBottom: insets.bottom + 16,
              paddingHorizontal: GAP,
              gap: GAP,
            }}
            columnWrapperStyle={{ gap: GAP }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={s.listHeader}>
                <View>
                  <Text style={s.pageTitle}>Mi Nena</Text>
                  <Text style={s.pageSubtitle}>{folders.length} folder{folders.length !== 1 ? "s" : ""}</Text>
                </View>
                <TouchableOpacity style={s.addFolderBtn} onPress={() => setShowNewFolder(true)} activeOpacity={0.8}>
                  <Feather name="folder-plus" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            }
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <View style={s.emptyIcon}>
                  <Feather name="folder" size={36} color="#E03131" />
                </View>
                <Text style={s.emptyTitle}>No Folders Yet</Text>
                <Text style={s.emptySubtitle}>Tap the folder icon above to create your first album.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <FolderCard
                folder={item}
                cardSize={folderCardSize}
                onPress={() => setOpenFolderId(item.id)}
                onLongPress={() => deleteFolder(item.id)}
              />
            )}
          />
        )}

        <NewFolderModal
          visible={showNewFolder}
          onCancel={() => setShowNewFolder(false)}
          onCreate={createFolder}
        />
      </View>
    );
  }

  // ── Inside a folder ──
  return (
    <View style={s.screen}>
      {/* Back + title */}
      <View style={[s.folderNav, { top: topPad + 6 }]}>
        <TouchableOpacity onPress={() => setOpenFolderId(null)} style={s.backBtn} activeOpacity={0.8}>
          <Feather name="chevron-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.folderNavTitle} numberOfLines={1}>{openFolder.name}</Text>
        <TouchableOpacity
          style={s.addFilesBtn}
          onPress={() => pickIntoFolder(openFolder.id)}
          activeOpacity={0.8}
          disabled={picking}
        >
          {picking
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="plus" size={20} color="#fff" />
          }
        </TouchableOpacity>
      </View>

      {openFolder.items.length === 0 ? (
        <View style={s.centred}>
          <View style={s.emptyIcon}>
            <Feather name="image" size={36} color="#E03131" />
          </View>
          <Text style={s.emptyTitle}>Empty Folder</Text>
          <Text style={s.emptySubtitle}>Tap the + button to add photos and videos.</Text>
        </View>
      ) : (
        <FlatList
          key="file-grid"
          data={openFolder.items}
          numColumns={GRID_COLS}
          keyExtractor={(item) => item.uri}
          contentContainerStyle={{
            paddingTop: topPad + 60,
            paddingBottom: insets.bottom + 16,
            paddingHorizontal: GAP,
            gap: GAP,
          }}
          columnWrapperStyle={{ gap: GAP }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={s.folderGridHeader}>
              <Text style={s.headerCount}>{openFolder.items.length} item{openFolder.items.length !== 1 ? "s" : ""}</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <Thumbnail item={item} size={thumbSize} onPress={() => setViewerIndex(index)} />
          )}
        />
      )}

      {viewerIndex !== null && (
        <Viewer items={openFolder.items} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: "#000" },
  hamburger: { position: "absolute", left: 16, zIndex: 10, padding: 8 },
  centred:   { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },

  listHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingBottom: 16,
  },
  pageTitle:    { fontSize: 26, fontWeight: "900", color: "#fff", fontFamily: "Inter_700Bold" },
  pageSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "Inter_400Regular", marginTop: 2 },
  addFolderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E03131",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },

  // Folder card
  folderCard:  { marginBottom: GAP },
  folderCover: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  folderEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  folderStack1: {
    position: "absolute",
    bottom: -3,
    left: 4,
    right: 4,
    height: 8,
    borderRadius: 6,
    backgroundColor: "#222",
    zIndex: -1,
  },
  folderMeta:  { paddingTop: 7, paddingHorizontal: 2, paddingBottom: 4 },
  folderName:  { fontSize: 13, fontWeight: "700", color: "#fff", fontFamily: "Inter_600SemiBold" },
  folderCount: { fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Inter_400Regular", marginTop: 1 },

  // Inside folder nav
  folderNav: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    zIndex: 10,
    height: 44,
  },
  backBtn:        { padding: 8 },
  folderNavTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    fontFamily: "Inter_700Bold",
    marginHorizontal: 4,
  },
  addFilesBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E03131",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  folderGridHeader: { paddingHorizontal: 4, paddingBottom: 8 },
  headerCount: { fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "Inter_400Regular" },

  // Thumbnails
  thumb:       { backgroundColor: "#111", overflow: "hidden" },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  playBadge:   {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.6)",
  },

  // Viewer
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
  viewerCounterTxt: { color: "#fff", fontSize: 13, fontFamily: "Inter_400Regular" },

  // Empty state
  emptyWrap:     { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  emptyIcon:     {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(224,49,49,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle:    { fontSize: 20, fontWeight: "900", color: "#fff", fontFamily: "Inter_700Bold" },
  emptySubtitle: { fontSize: 14, color: "#555", fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },

  // New folder modal
  overlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  modalBox:  {
    width: 300,
    backgroundColor: "#111",
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: "#222",
  },
  modalTitle:     { fontSize: 17, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold", marginBottom: 16 },
  modalInput:     {
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: 20,
  },
  modalBtns:      { flexDirection: "row", gap: 10 },
  modalCancel:    {
    flex: 1,
    paddingVertical: 11,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    alignItems: "center",
  },
  modalCancelTxt: { color: "#888", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalCreate:    {
    flex: 1,
    paddingVertical: 11,
    backgroundColor: "#E03131",
    borderRadius: 10,
    alignItems: "center",
  },
  modalCreateTxt: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
