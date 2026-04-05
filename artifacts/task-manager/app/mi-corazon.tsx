import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { Audio, ResizeMode, Video } from "expo-av";
import * as VideoThumbnails from "expo-video-thumbnails";
import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";

// ── Types & constants ─────────────────────────────────────────────────────────
const STORAGE_KEY   = "mi_corazon_folders_v2";
const MEDIA_DIR     = (FileSystem.documentDirectory ?? "") + "mi_corazon_media/";
// FOLD_COLS is now dynamic — see folderCols below
const GAP           = 2;
// Height of the text area below each folder cover thumbnail (name + count + padding)
const CARD_META_H   = 50;

// Compute the x/y position of a folder at index i in a numCols-wide grid
function gridPos(i: number, numCols: number, cardW: number) {
  const cardH = cardW * 0.75 + CARD_META_H;
  const col   = i % numCols;
  const row   = Math.floor(i / numCols);
  return { x: GAP + col * (cardW + GAP), y: row * (cardH + GAP) };
}

// ── Path helpers ──────────────────────────────────────────────────────────────
// Store paths relative to documentDirectory so they survive reinstalls (iOS
// changes the container UUID on fresh install, breaking absolute file:// URIs).
// ph:// (photo library) and http:// URIs are returned unchanged.
function toRel(uri: string): string {
  if (!uri || uri.startsWith("ph://") || uri.startsWith("http")) return uri;
  const marker = "mi_corazon_media/";
  const idx = uri.indexOf(marker);
  return idx !== -1 ? uri.slice(idx) : uri;
}
function toAbs(uri: string): string {
  if (!uri || uri.startsWith("ph://") || uri.startsWith("file://") || uri.startsWith("http")) return uri;
  return (FileSystem.documentDirectory ?? "") + uri;
}
const VIDEO_EXTS  = [".mp4", ".mov", ".m4v", ".avi", ".mkv"];

type MediaItem = { uri: string; name: string; isVideo: boolean };
type Folder    = {
  id:        string;
  name:      string;
  items:     MediaItem[];
  coverUri?: string;
  parentId?: string;   // undefined = root-level
};

function isVideoFile(name: string) {
  return VIDEO_EXTS.includes(name.slice(name.lastIndexOf(".")).toLowerCase());
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function getAllDescendantIds(folderId: string, all: Folder[]): string[] {
  const children = all.filter((f) => f.parentId === folderId);
  return children.flatMap((c) => [c.id, ...getAllDescendantIds(c.id, all)]);
}

// ── Persist helpers ───────────────────────────────────────────────────────────
async function saveFolders(folders: Folder[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
}

// ── Full-screen viewer ────────────────────────────────────────────────────────
// How far to lift the video bottom above the screen edge
const VIDEO_BOTTOM_LIFT = 90;

function Viewer({
  items,
  startIndex,
  onClose,
}: {
  items:      MediaItem[];
  startIndex: number;
  onClose:    () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets             = useSafeAreaInsets();
  const videoH             = height - insets.bottom - VIDEO_BOTTOM_LIFT;
  const [idx, setIdx]      = useState(startIndex);
  const listRef            = useRef<FlatList<MediaItem>>(null);

  // ── Tap → show/hide close button ─────────────────────────────────────────────
  const showControlsRef = useRef(false);
  const ctrlOpacity     = useRef(new Animated.Value(0)).current;
  const toggleControls  = useCallback(() => {
    const next = !showControlsRef.current;
    showControlsRef.current = next;
    Animated.timing(ctrlOpacity, {
      toValue: next ? 1 : 0, duration: 180, useNativeDriver: true,
    }).start();
  }, [ctrlOpacity]);

  // ── Dismiss gesture ──────────────────────────────────────────────────────────
  const dragY      = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  const heightRef  = useRef(height);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { heightRef.current = height;  }, [height]);

  // All decision logic lives in refs so panResponder closures are never stale
  const dismissRef  = useRef(() => {
    Animated.timing(dragY, {
      toValue: heightRef.current,
      duration: 180,
      useNativeDriver: true,
    }).start(() => onCloseRef.current());
  });
  const snapBackRef = useRef(() => {
    Animated.spring(dragY, {
      toValue: 0, useNativeDriver: true, tension: 180, friction: 24,
    }).start();
  });

  const panResponder = useRef(
    PanResponder.create({
      // Bubble: grab any downward drag
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        dy > 2 && Math.abs(dy) >= Math.abs(dx),
      // Capture: steal from inner ScrollView/FlatList before they see the event
      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) =>
        dy > 4 && Math.abs(dy) > Math.abs(dx) * 0.8,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) dragY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > heightRef.current * 0.15 || vy > 0.25) {
          dismissRef.current();
        } else {
          snapBackRef.current();
        }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => snapBackRef.current(),
    })
  ).current;

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS:        false,
      staysActiveInBackground:   false,
      playsInSilentModeIOS:      true,
      shouldDuckAndroid:         true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    dragY.setValue(0);
    setTimeout(() => listRef.current?.scrollToIndex({ index: startIndex, animated: false }), 50);
  }, [startIndex]);

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <StatusBar hidden />
      {/* Solid black background — always present so nothing bleeds through */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]} pointerEvents="none" />
      {/* Content slides down on dismiss */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: dragY }] }]}
        {...panResponder.panHandlers}
      >
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
          renderItem={({ item, index }) => (
            <TouchableWithoutFeedback onPress={toggleControls}>
              <View style={{ width, height }}>
                <ScrollView
                  style={{ width, height }}
                  contentContainerStyle={{ width, height, alignItems: "center", justifyContent: "center" }}
                  minimumZoomScale={1}
                  maximumZoomScale={item.isVideo ? 3 : 6}
                  centerContent
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  bouncesZoom
                >
                  {item.isVideo ? (
                    <Video
                      source={{ uri: toAbs(item.uri) }}
                      style={{ width, height: videoH }}
                      useNativeControls
                      resizeMode={ResizeMode.CONTAIN}
                      shouldPlay={index === idx}
                      isLooping
                      volume={1}
                    />
                  ) : (
                    <Image source={{ uri: toAbs(item.uri) }} style={{ width, height }} resizeMode="contain" />
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          )}
        />
      </Animated.View>

      {/* Close button — fades in on tap */}
      <Animated.View
        style={[s.viewerControls, { opacity: ctrlOpacity, paddingTop: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity style={s.viewerCloseBtn} onPress={onClose} activeOpacity={0.8}>
          <Feather name="x" size={22} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ── New folder modal ──────────────────────────────────────────────────────────
function NewFolderModal({
  visible,
  onCancel,
  onCreate,
}: {
  visible:  boolean;
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
              keyboardAppearance="dark"
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
  subCount,
  onPress,
  onLongPress,
  onOptions,
  isDragging   = false,
  isAnyDragging = false,
}: {
  folder:        Folder;
  cardSize:      number;
  subCount:      number;
  onPress:       () => void;
  onLongPress:   () => void;
  onOptions?:    () => void;
  isDragging?:   boolean;
  isAnyDragging?: boolean;
}) {
  const autoCover    = folder.items.find((i) => !i.isVideo) ?? folder.items[0];
  const coverUri     = folder.coverUri ?? autoCover?.uri;
  const hasCustom    = !!folder.coverUri;
  // Cover is a video when it's the auto-picked item and that item is a video,
  // or when it's a custom cover with a video extension.
  const isCoverVideo = coverUri
    ? (!folder.coverUri && !!autoCover?.isVideo) ||
      VIDEO_EXTS.some((e) => coverUri.toLowerCase().endsWith(e))
    : false;

  const countParts: string[] = [];
  if (folder.items.length > 0)
    countParts.push(`${folder.items.length} file${folder.items.length !== 1 ? "s" : ""}`);
  if (subCount > 0)
    countParts.push(`${subCount} folder${subCount !== 1 ? "s" : ""}`);
  const countLabel = countParts.length > 0 ? countParts.join(" · ") : "Empty";

  return (
    <TouchableOpacity
      style={[
        s.folderCard,
        { width: cardSize },
        isDragging    && { opacity: 0.92, transform: [{ scale: 1.06 }] },
        isAnyDragging && !isDragging && { opacity: 0.6 },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
      activeOpacity={0.85}
    >
      <View style={[s.folderCover, { height: cardSize * 0.75 }]}>
        {coverUri ? (
          isCoverVideo ? (
            <VideoThumb uri={toAbs(coverUri)} style={StyleSheet.absoluteFill} />
          ) : (
            <Image source={{ uri: toAbs(coverUri) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )
        ) : (
          <View style={s.folderEmpty}>
            <Feather name={subCount > 0 ? "folder" : "image"} size={28} color="#333" />
          </View>
        )}
        {(folder.items.length > 1 || subCount > 0) && <View style={s.folderStack1} />}
        {hasCustom && (
          <View style={s.customCoverBadge}>
            <Feather name="camera" size={10} color="#fff" />
          </View>
        )}
        {/* Options button — top-right corner */}
        {onOptions && (
          <TouchableOpacity style={s.folderOptionsBtn} onPress={onOptions} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Feather name="more-horizontal" size={15} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
      <View style={s.folderMeta}>
        <Text style={s.folderName} numberOfLines={1}>{folder.name}</Text>
        <Text style={s.folderCount}>{countLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Video thumbnail ───────────────────────────────────────────────────────────
// Module-level cache so the frame is only extracted once per video URI
// across renders and navigation.
const _thumbCache = new Map<string, string>();

function VideoThumb({
  uri,
  style,
  resizeMode = "cover",
}: {
  uri:        string;
  style:      any;
  resizeMode?: "cover" | "contain";
}) {
  const [thumb, setThumb] = useState<string | null>(_thumbCache.get(uri) ?? null);

  useEffect(() => {
    if (thumb) return;
    let dead = false;
    // Seek 500 ms in — more likely to land on a real frame than t=0
    VideoThumbnails.getThumbnailAsync(uri, { time: 500 })
      .then(({ uri: tu }) => {
        if (!dead) { _thumbCache.set(uri, tu); setThumb(tu); }
      })
      .catch(() => {}); // silently stay black on any error
    return () => { dead = true; };
  }, [uri]);

  if (!thumb) return <View style={[style, { backgroundColor: "#111" }]} />;
  return <Image source={{ uri: thumb }} style={style} resizeMode={resizeMode} />;
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────
function Thumbnail({ item, size, onPress }: { item: MediaItem; size: number; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.thumb, { width: size, height: size }]} onPress={onPress} activeOpacity={0.85}>
      {item.isVideo ? (
        <VideoThumb uri={toAbs(item.uri)} style={StyleSheet.absoluteFill} />
      ) : (
        <Image source={{ uri: toAbs(item.uri) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}
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
  const insets         = useSafeAreaInsets();
  const { width }      = useWindowDimensions();
  const topPad         = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const [folders,       setFolders]       = useState<Folder[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [picking,       setPicking]       = useState(false);
  const [folderStack,   setFolderStack]   = useState<string[]>([]); // navigation stack of folder IDs
  const [viewerIndex,   setViewerIndex]   = useState<number | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);

  // ── Folder drag-reorder state ─────────────────────────────────────────────
  const posXAnims       = useRef<Record<string, Animated.Value>>({});
  const posYAnims       = useRef<Record<string, Animated.Value>>({});
  const addedX          = useRef<Record<string, ReturnType<typeof Animated.add>>>({});
  const addedY          = useRef<Record<string, ReturnType<typeof Animated.add>>>({});
  const dragPanX        = useRef(new Animated.Value(0)).current;
  const dragPanY        = useRef(new Animated.Value(0)).current;
  const isDraggingRef   = useRef(false);
  const draggingIdxRef  = useRef(-1);
  const hoverIdxRef     = useRef(-1);
  const dragOccurredRef = useRef(false);
  const scrollOffRef    = useRef(0);
  const startScrollRef  = useRef(0);
  const containerTopRef = useRef(0);
  const gridContainerRef = useRef<View>(null);
  const vFoldersRef     = useRef<Folder[]>([]);    // stale-closure-safe visible folders
  const folderColsRef   = useRef(2);
  const cardWRef        = useRef(0);
  const [dragActiveIdx, setDragActiveIdx]       = useState(-1);
  const [gridScrollEnabled, setGridScrollEnabled] = useState(true);

  // Derived from stack
  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1] : null;
  const currentFolder   = currentFolderId ? folders.find((f) => f.id === currentFolderId) ?? null : null;

  // Folders visible at the current level (memoized so useEffect deps are stable)
  const visibleFolders = React.useMemo(
    () => folders.filter((f) => (f.parentId ?? null) === currentFolderId),
    [folders, currentFolderId]
  );

  // Sub-folder counts (for card labels)
  const subCountMap = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of folders) {
      if (f.parentId) m[f.parentId] = (m[f.parentId] ?? 0) + 1;
    }
    return m;
  }, [folders]);

  // Load + migrate on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: Folder[] = JSON.parse(raw);
          const migrated = await Promise.all(
            parsed.map(async (folder) => {
              const alive: MediaItem[] = [];
              for (const item of folder.items) {
                try {
                  if (item.uri.startsWith("ph://")) {
                    // Persistent photo library reference — always valid
                    alive.push(item);
                  } else if (item.uri.includes("mi_corazon_media")) {
                    // Migrate absolute → relative, then check existence via absolute
                    const rel  = toRel(item.uri);
                    const info = await FileSystem.getInfoAsync(toAbs(rel));
                    if (info.exists) alive.push({ ...item, uri: rel });
                  }
                  // Drop any other stale file:// cache URIs
                } catch {
                  // skip on error
                }
              }
              // Validate coverUri — migrate absolute → relative, check existence
              let coverUri = folder.coverUri;
              if (coverUri && !coverUri.startsWith("ph://")) {
                try {
                  const rel  = toRel(coverUri);
                  const info = await FileSystem.getInfoAsync(toAbs(rel));
                  coverUri = info.exists ? rel : undefined;
                } catch { coverUri = undefined; }
              }
              return { ...folder, items: alive, coverUri };
            })
          );
          const changed = migrated.some((f, i) =>
            f.items.length !== parsed[i].items.length ||
            f.coverUri !== parsed[i].coverUri ||
            f.items.some((item, j) => item.uri !== parsed[i].items[j]?.uri)
          );
          setFolders(migrated);
          if (changed) await saveFolders(migrated);
        }
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  // Navigation helpers
  const navigateInto = useCallback((id: string) => setFolderStack((p) => [...p, id]), []);
  const navigateBack = useCallback(() => setFolderStack((p) => p.slice(0, -1)), []);
  const navigateTo   = useCallback((idx: number) => setFolderStack((p) => p.slice(0, idx + 1)), []);

  // Pick files into the current folder — opens the Files app via DocumentPicker.
  // Each file is copied into the app's permanent mi_corazon_media directory so
  // the pruning logic keeps it across sessions.
  const pickIntoFolder = useCallback(async (folderId: string) => {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      // Ensure persistent storage directory exists
      const dirInfo = await FileSystem.getInfoAsync(MEDIA_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
      }

      // Copy each picked file from cache → documents/mi_corazon_media/
      const picked: MediaItem[] = await Promise.all(
        result.assets.map(async (asset) => {
          const ext  = asset.name.includes(".") ? asset.name.slice(asset.name.lastIndexOf(".")) : "";
          const dest = MEDIA_DIR + uid() + ext;
          await FileSystem.copyAsync({ from: asset.uri, to: dest });
          return { uri: toRel(dest), name: asset.name, isVideo: isVideoFile(asset.name) };
        })
      );

      setFolders((prev) => {
        const next = prev.map((f) => {
          if (f.id !== folderId) return f;
          return { ...f, items: [...f.items, ...picked] };
        });
        saveFolders(next).catch(() => {});
        return next;
      });
    } catch (_) {
    } finally {
      setPicking(false);
    }
  }, []);

  // Create folder (at current level)
  const createFolder = useCallback(async (name: string) => {
    setShowNewFolder(false);
    const id     = uid();
    const folder: Folder = {
      id,
      name,
      items: [],
      ...(currentFolderId ? { parentId: currentFolderId } : {}),
    };
    const next = [...folders, folder];
    setFolders(next);
    await saveFolders(next);
    setFolderStack((p) => [...p, id]);
  }, [folders, currentFolderId]);

  // Delete folder + all descendants
  const deleteFolder = useCallback((folderId: string) => {
    Alert.alert("Delete Folder", "Remove this folder and all its contents?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setFolders((prev) => {
            const toDelete = new Set([folderId, ...getAllDescendantIds(folderId, prev)]);
            const next = prev.filter((f) => !toDelete.has(f.id));
            saveFolders(next).catch(() => {});
            return next;
          });
          // If we're inside the deleted folder (or a descendant), pop the stack
          setFolderStack((prev) => {
            const idx = prev.indexOf(folderId);
            if (idx !== -1) return prev.slice(0, idx);
            return prev;
          });
        },
      },
    ]);
  }, []);

  // Set custom cover image
  const setCoverImage = useCallback(async (folderId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo library access in Settings.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    // Store persistent ph:// URI — survives reinstall, no copy needed
    const persistentUri = asset.assetId ? `ph://${asset.assetId}` : asset.uri;
    setFolders((prev) => {
      const next = prev.map((f) => f.id === folderId ? { ...f, coverUri: persistentUri } : f);
      saveFolders(next).catch(() => {});
      return next;
    });
  }, []);

  // Long-press action sheet
  const handleFolderLongPress = useCallback((folderId: string) => {
    const folder = folders.find((f) => f.id === folderId);
    Alert.alert(
      folder?.name ?? "Folder",
      undefined,
      [
        { text: "Set Cover Image", onPress: () => setCoverImage(folderId) },
        ...(folder?.coverUri ? [{
          text: "Remove Cover",
          onPress: () => {
            setFolders((prev) => {
              const next = prev.map((f) => f.id === folderId ? { ...f, coverUri: undefined } : f);
              saveFolders(next).catch(() => {});
              return next;
            });
          },
        }] : []),
        { text: "Delete Folder", style: "destructive" as const, onPress: () => deleteFolder(folderId) },
        { text: "Cancel", style: "cancel" as const },
      ]
    );
  }, [folders, setCoverImage, deleteFolder]);

  const gridCols       = width >= 768 ? 4 : 3;
  const folderCols     = width >= 768 ? 4 : 2;  // 4-across on iPad, 2 on iPhone
  const folderCardSize = (width - GAP * (folderCols + 1)) / folderCols;
  const thumbSize      = (width - GAP * (gridCols + 1)) / gridCols;

  // ── Keep refs in sync for stale-closure-safe drag callbacks ──────────────
  useEffect(() => { vFoldersRef.current  = visibleFolders;  }, [visibleFolders]);
  useEffect(() => { folderColsRef.current = folderCols; cardWRef.current = folderCardSize; }, [folderCols, folderCardSize]);

  // Initialize anims during render so cards are never null on first paint
  // (same pattern used by the life task list). Guards against re-init on every render.
  visibleFolders.forEach((f, i) => {
    if (!posXAnims.current[f.id]) {
      const { x, y } = gridPos(i, folderCols, folderCardSize);
      posXAnims.current[f.id] = new Animated.Value(x);
      posYAnims.current[f.id] = new Animated.Value(y);
      addedX.current[f.id]    = Animated.add(posXAnims.current[f.id], dragPanX);
      addedY.current[f.id]    = Animated.add(posYAnims.current[f.id], dragPanY);
    }
  });

  // Sync positions when grid dimensions or folder order changes (but not during drag)
  useEffect(() => {
    if (isDraggingRef.current) return;
    visibleFolders.forEach((f, i) => {
      const { x, y } = gridPos(i, folderCols, folderCardSize);
      posXAnims.current[f.id]?.setValue(x);
      posYAnims.current[f.id]?.setValue(y);
    });
  }, [visibleFolders, folderCols, folderCardSize]);

  // ── Drag callbacks ────────────────────────────────────────────────────────
  const animateFolderPositions = useCallback((dragIdx: number, hoverIdx: number) => {
    const folds = vFoldersRef.current;
    const nc    = folderColsRef.current;
    const cw    = cardWRef.current;
    folds.forEach((f, i) => {
      if (i === dragIdx) return;
      let target = i;
      if (dragIdx < hoverIdx && i > dragIdx && i <= hoverIdx) target = i - 1;
      else if (dragIdx > hoverIdx && i >= hoverIdx && i < dragIdx) target = i + 1;
      const { x, y } = gridPos(target, nc, cw);
      posXAnims.current[f.id]?.stopAnimation();
      posYAnims.current[f.id]?.stopAnimation();
      Animated.timing(posXAnims.current[f.id], { toValue: x, duration: 120, useNativeDriver: true, easing: (t) => t }).start();
      Animated.timing(posYAnims.current[f.id], { toValue: y, duration: 120, useNativeDriver: true, easing: (t) => t }).start();
    });
  }, []);

  const startFolderDrag = useCallback((idx: number) => {
    isDraggingRef.current   = true;
    draggingIdxRef.current  = idx;
    hoverIdxRef.current     = idx;
    dragOccurredRef.current = true;
    dragPanX.setValue(0);
    dragPanY.setValue(0);
    setDragActiveIdx(idx);
    setGridScrollEnabled(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startScrollRef.current = scrollOffRef.current;
    gridContainerRef.current?.measure((_x, _y, _w, _h, _px, py) => {
      containerTopRef.current = py;
    });
  }, [dragPanX, dragPanY]);

  const endFolderDrag = useCallback(() => {
    const di = draggingIdxRef.current;
    const hi = hoverIdxRef.current;
    isDraggingRef.current  = false;
    draggingIdxRef.current = -1;
    hoverIdxRef.current    = -1;
    dragPanX.setValue(0);
    dragPanY.setValue(0);
    setGridScrollEnabled(true);
    setDragActiveIdx(-1);

    if (di >= 0 && hi >= 0 && di !== hi) {
      setFolders((prev) => {
        // Reorder among the visible (root-level) folders only
        const visible = prev.filter((f) => (f.parentId ?? null) === null);
        const others  = prev.filter((f) => (f.parentId ?? null) !== null);
        const next    = [...visible];
        const [moved] = next.splice(di, 1);
        next.splice(hi, 0, moved);
        // Snap anims to final grid positions
        const nc = folderColsRef.current;
        const cw = cardWRef.current;
        next.forEach((f, i) => {
          const { x, y } = gridPos(i, nc, cw);
          posXAnims.current[f.id]?.setValue(x);
          posYAnims.current[f.id]?.setValue(y);
        });
        const result = [...next, ...others];
        saveFolders(result).catch(() => {});
        return result;
      });
    } else {
      // Snap everything back
      vFoldersRef.current.forEach((f, i) => {
        const { x, y } = gridPos(i, folderColsRef.current, cardWRef.current);
        posXAnims.current[f.id]?.setValue(x);
        posYAnims.current[f.id]?.setValue(y);
      });
    }
    setTimeout(() => { dragOccurredRef.current = false; }, 80);
  }, [dragPanX, dragPanY]);

  const folderGridPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder:        () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponderCapture:  () => isDraggingRef.current,
    onPanResponderMove: (_, gs) => {
      if (!isDraggingRef.current) return;
      dragPanX.setValue(gs.dx);
      dragPanY.setValue(gs.dy);
      const di  = draggingIdxRef.current;
      const nc  = folderColsRef.current;
      const cw  = cardWRef.current;
      const ch  = cw * 0.75 + CARD_META_H;
      const relY     = gs.moveY - containerTopRef.current + (scrollOffRef.current - startScrollRef.current);
      const relX     = gs.moveX;
      const hoverCol = Math.max(0, Math.min(nc - 1, Math.floor((relX - GAP) / (cw + GAP))));
      const hoverRow = Math.max(0, Math.floor(relY / (ch + GAP)));
      const newHover = Math.min(vFoldersRef.current.length - 1, hoverRow * nc + hoverCol);
      if (newHover !== hoverIdxRef.current) {
        hoverIdxRef.current = newHover;
        animateFolderPositions(di, newHover);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    onPanResponderEnd:       () => endFolderDrag(),
    onPanResponderTerminate: () => endFolderDrag(),
  }), [animateFolderPositions, endFolderDrag, dragPanX, dragPanY]);

  // ── Root folder grid ───────────────────────────────────────────────────────
  if (!currentFolder) {
    return (
      <View style={[s.screen, { paddingTop: topPad }]}>
        <ScreenHeader title="Mi Corazon" />

        {loading ? (
          <View style={s.centred}>
            <ActivityIndicator size="large" color="#E03131" />
          </View>
        ) : (
          <ScrollView
            scrollEnabled={gridScrollEnabled}
            onScroll={(e) => { scrollOffRef.current = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            canCancelContentTouches={false}
            contentContainerStyle={{
              paddingTop: 8,
              paddingBottom: insets.bottom + 24,
            }}
          >
            {/* List header */}
            <View style={s.listHeader}>
              <Text style={s.pageSubtitle}>
                {visibleFolders.length} folder{visibleFolders.length !== 1 ? "s" : ""}
              </Text>
              <TouchableOpacity style={s.addFolderBtn} onPress={() => setShowNewFolder(true)} activeOpacity={0.8}>
                <Feather name="folder-plus" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {visibleFolders.length === 0 ? (
              <View style={s.emptyWrap}>
                <View style={s.emptyIcon}>
                  <Feather name="folder" size={36} color="#E03131" />
                </View>
                <Text style={s.emptyTitle}>No Folders Yet</Text>
                <Text style={s.emptySubtitle}>Tap the folder icon above to create your first album.</Text>
              </View>
            ) : (
              /* Absolute-position grid — enables live drag animation */
              <View
                ref={gridContainerRef}
                {...folderGridPan.panHandlers}
                style={{
                  height: Math.ceil(visibleFolders.length / folderCols) * (folderCardSize * 0.75 + CARD_META_H + GAP),
                }}
              >
                {/* Overlay to cancel drag on tap-outside */}
                {dragActiveIdx !== -1 && (
                  <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => endFolderDrag()}
                  />
                )}
                {visibleFolders.map((folder, idx) => {
                  const isDragging = dragActiveIdx === idx;
                  const txAnim = isDragging
                    ? (addedX.current[folder.id] ?? posXAnims.current[folder.id])
                    : posXAnims.current[folder.id];
                  const tyAnim = isDragging
                    ? (addedY.current[folder.id] ?? posYAnims.current[folder.id])
                    : posYAnims.current[folder.id];
                  if (!txAnim || !tyAnim) return null;
                  return (
                    <Animated.View
                      key={folder.id}
                      style={[
                        { position: "absolute", left: 0, top: 0, width: folderCardSize, zIndex: isDragging ? 100 : 1 },
                        { transform: [{ translateX: txAnim }, { translateY: tyAnim }] },
                      ]}
                    >
                      <FolderCard
                        folder={folder}
                        cardSize={folderCardSize}
                        subCount={subCountMap[folder.id] ?? 0}
                        onPress={() => { if (!dragOccurredRef.current) navigateInto(folder.id); }}
                        onLongPress={() => startFolderDrag(idx)}
                        onOptions={() => handleFolderLongPress(folder.id)}
                        isDragging={isDragging}
                        isAnyDragging={dragActiveIdx !== -1}
                      />
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}

        <NewFolderModal
          visible={showNewFolder}
          onCancel={() => setShowNewFolder(false)}
          onCreate={createFolder}
        />
      </View>
    );
  }

  // ── Inside a folder ────────────────────────────────────────────────────────
  const subFolders = visibleFolders; // folders whose parentId === currentFolderId
  const isEmpty    = subFolders.length === 0 && currentFolder.items.length === 0;

  return (
    <View style={[s.screen, { paddingTop: topPad }]}>

      {/* Breadcrumb navigation bar */}
      <View style={s.breadcrumbBar}>
        <TouchableOpacity onPress={navigateBack} style={s.backBtn} activeOpacity={0.8}>
          <Feather name="chevron-left" size={22} color="#fff" />
        </TouchableOpacity>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.breadcrumbScroll}
          contentContainerStyle={s.breadcrumbContent}
        >
          <TouchableOpacity onPress={() => setFolderStack([])} activeOpacity={0.7}>
            <Text style={s.breadcrumbRoot}>Mi Corazon</Text>
          </TouchableOpacity>
          {folderStack.map((id, idx) => {
            const f      = folders.find((f) => f.id === id);
            const isLast = idx === folderStack.length - 1;
            return (
              <React.Fragment key={id}>
                <Feather name="chevron-right" size={11} color="rgba(255,255,255,0.5)" style={{ marginHorizontal: 3, marginTop: 1 }} />
                <TouchableOpacity
                  onPress={() => navigateTo(idx)}
                  activeOpacity={isLast ? 1 : 0.7}
                  disabled={isLast}
                >
                  <Text style={[s.breadcrumbItem, isLast && s.breadcrumbActive]} numberOfLines={1}>
                    {f?.name ?? "…"}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </ScrollView>

        <View style={s.breadcrumbActions}>
          <TouchableOpacity onPress={() => setShowNewFolder(true)} style={s.iconBtn} activeOpacity={0.8}>
            <Feather name="folder-plus" size={17} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => pickIntoFolder(currentFolderId!)}
            style={[s.iconBtn, s.iconBtnRed]}
            activeOpacity={0.8}
            disabled={picking}
          >
            {picking
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="plus" size={20} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </View>

      {isEmpty ? (
        <View style={s.centred}>
          <View style={s.emptyIcon}>
            <Feather name="image" size={36} color="#E03131" />
          </View>
          <Text style={s.emptyTitle}>Empty Folder</Text>
          <Text style={s.emptySubtitle}>Tap + to add photos and videos, or the folder icon to create a sub-folder.</Text>
        </View>
      ) : (
        <FlatList
          key={`file-grid-${currentFolderId}-${gridCols}`}
          data={currentFolder.items}
          numColumns={gridCols}
          keyExtractor={(item) => item.uri}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: insets.bottom + 16,
            paddingHorizontal: GAP,
            gap: GAP,
          }}
          columnWrapperStyle={currentFolder.items.length > 0 ? { gap: GAP } : undefined}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* Sub-folder grid */}
              {subFolders.length > 0 && (
                <View style={s.subSection}>
                  <Text style={s.sectionLabel}>Folders</Text>
                  <View style={s.subFolderWrap}>
                    {subFolders.map((sf) => (
                      <FolderCard
                        key={sf.id}
                        folder={sf}
                        cardSize={folderCardSize}
                        subCount={subCountMap[sf.id] ?? 0}
                        onPress={() => navigateInto(sf.id)}
                        onLongPress={() => handleFolderLongPress(sf.id)}
                      />
                    ))}
                  </View>
                </View>
              )}
              {/* Files section header */}
              {currentFolder.items.length > 0 && (
                <View style={s.folderGridHeader}>
                  {subFolders.length > 0 && <Text style={s.sectionLabel}>Files</Text>}
                  <Text style={s.headerCount}>
                    {currentFolder.items.length} file{currentFolder.items.length !== 1 ? "s" : ""}
                  </Text>
                </View>
              )}
            </>
          }
          renderItem={({ item, index }) => (
            <Thumbnail item={item} size={thumbSize} onPress={() => setViewerIndex(index)} />
          )}
        />
      )}

      {viewerIndex !== null && (
        <Viewer items={currentFolder.items} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}

      <NewFolderModal
        visible={showNewFolder}
        onCancel={() => setShowNewFolder(false)}
        onCreate={createFolder}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: "#000" },
  centred: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },

  // Root list header
  listHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingBottom: 16,
  },
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

  // Breadcrumb nav bar (inside-folder view)
  breadcrumbBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e1e",
    backgroundColor: "#0a0a0a",
    paddingRight: 4,
  },
  backBtn: { padding: 10, paddingLeft: 12 },
  breadcrumbScroll: { flex: 1 },
  breadcrumbContent: { alignItems: "center", paddingRight: 8 },
  breadcrumbRoot: {
    fontSize: 13,
    color: "#fff",
    fontFamily: "Inter_400Regular",
  },
  breadcrumbItem: {
    fontSize: 13,
    color: "#fff",
    fontFamily: "Inter_400Regular",
    maxWidth: 120,
  },
  breadcrumbActive: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },
  breadcrumbActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1e1e1e",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnRed: { backgroundColor: "#E03131" },

  // Sub-folder section inside a folder
  subSection: { paddingBottom: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.3)",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 4,
    paddingBottom: 8,
    paddingTop: 4,
  },
  subFolderWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },

  // Folder card
  folderCard:  { marginBottom: GAP },
  folderCover: { borderRadius: 10, overflow: "hidden", backgroundColor: "#111" },
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
  customCoverBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  folderOptionsBtn: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  folderMeta:  { paddingTop: 7, paddingHorizontal: 2, paddingBottom: 4 },
  folderName:  { fontSize: 13, fontWeight: "700", color: "#fff", fontFamily: "Inter_600SemiBold" },
  folderCount: { fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Inter_400Regular", marginTop: 1 },

  // Viewer close button overlay
  viewerControls: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    pointerEvents: "box-none",
  },
  viewerCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  // File grid header
  folderGridHeader: { paddingHorizontal: 4, paddingBottom: 8, gap: 2 },
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
  overlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  modalBox: {
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
  modalCreateTxt: { color: "#fff", fontSize: 14, fontWeight: "700", fontFamily: "Inter_600SemiBold" },
});
