import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useNotion } from "@/context/NotionContext";

// ── Constants ─────────────────────────────────────────────────────────────────
const LIFE_DB_ID   = "2c8b7eba3523802abbe2e934df42a4e2";
const ITEM_H       = 56;
const ITEM_GAP     = 8;
const SLOT_H       = ITEM_H + ITEM_GAP;
const HIDDEN_EMOJI = "👎";
const DEFAULT_EMOJI = "-";
const FULL_PICKER  = ["🔥","🚩","👀","🧠","💳","💰","🎧","📌","📕"];

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

// ── Slug config ───────────────────────────────────────────────────────────────
type SlugConfig = { title: string; catValue: string; emojis: string[] };
const SLUG_MAP: Record<string, SlugConfig> = {
  "life-admin":  { title: "Life Admin",  catValue: "\uD83D\uDCDD Life Admin",                               emojis: ["🔥","🖥️","🏡"] },
  "investigate": { title: "Investigate", catValue: "\uD83D\uDD0E To Investigate",                         emojis: ["🔥","🚩","👀","🧠"] },
  "to-buy":      { title: "To Buy",      catValue: "\uD83D\uDCB0 To Buy",                                   emojis: ["🔥","💳","💰"] },
  "music":       { title: "Music",       catValue: "\uD83C\uDFA7 Music",                                    emojis: ["🎧"] },
  "reference":   { title: "Reference",   catValue: "\uD83D\uDCCC Reference",                                emojis: ["📌"] },
  "to-read":     { title: "To Read",     catValue: "\uD83D\uDCD5 Read",                                     emojis: ["📕"] },
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface LifeTask { id: string; title: string; emoji: string; sortOrder: number | null; }
interface Schema   { priType: string; priOptions: string[] | null; categoryType: string; }

const norm = (e: string) => e.replace(/\uFE0F/g, "").trim();
const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));

// ── Emoji picker sheet ─────────────────────────────────────────────────────────
function EmojiPicker({ visible, onSelect, onClose }: {
  visible: boolean; onSelect: (e: string) => void; onClose: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const bgAnim    = useRef(new Animated.Value(0)).current;
  const insets    = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, tension: 90, friction: 13 }),
        Animated.timing(bgAnim, { toValue: 1, duration: 220, useNativeDriver: false }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 230, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
        Animated.timing(bgAnim, { toValue: 0, duration: 180, useNativeDriver: false }),
      ]).start();
    }
  }, [visible]);

  const bg = bgAnim.interpolate({ inputRange: [0,1], outputRange: ["rgba(0,0,0,0)","rgba(0,0,0,0.65)"] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { backgroundColor: bg }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 24 }]}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Choose Emoji</Text>
          <View style={s.emojiGrid}>
            {FULL_PICKER.map(e => (
              <Pressable
                key={e} style={({ pressed }) => [s.emojiCell, pressed && s.emojiCellPressed]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(e); }}
              >
                <Text style={s.emojiCellText}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Detail sheet ───────────────────────────────────────────────────────────────
function DetailSheet({ task, body, bodyLoading, isTablet, onClose, onSave, onEmojiChange }: {
  task: LifeTask | null; body: string | null; bodyLoading: boolean;
  isTablet: boolean; onClose: () => void;
  onSave:        (id: string, title: string) => void;
  onEmojiChange: (id: string, emoji: string) => void;
}) {
  const slideAnim = useRef(new Animated.Value(600)).current;
  const bgAnim    = useRef(new Animated.Value(0)).current;
  const insets    = useSafeAreaInsets();
  const [title,   setTitle]    = useState("");
  const [showEP,  setShowEP]   = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, tension: 80, friction: 12 }),
        Animated.timing(bgAnim, { toValue: 1, duration: 250, useNativeDriver: false }),
      ]).start();
    }
  }, [task]);

  const dismiss = (cb?: () => void) => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 600, duration: 260, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
      Animated.timing(bgAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start(() => { cb?.(); onClose(); });
  };

  const bg = bgAnim.interpolate({ inputRange: [0,1], outputRange: ["rgba(0,0,0,0)","rgba(0,0,0,0.7)"] });
  const botPad = insets.bottom + 16;

  const sheetStyle = isTablet
    ? [s.sheet, s.sheetTablet, { paddingBottom: botPad }]
    : [s.sheet, { paddingBottom: botPad }];

  return (
    <>
      <Modal visible={!!task} transparent animationType="none" onRequestClose={() => dismiss()}>
        <Animated.View style={[s.overlay, { backgroundColor: bg, justifyContent: isTablet ? "center" : "flex-end" }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss()} />
          <Animated.View style={[...sheetStyle, { transform: isTablet ? [] : [{ translateY: slideAnim }] }]}>
            <View style={s.handle} />
            <View style={s.detailHeader}>
              {/* Emoji button → opens picker */}
              <Pressable
                onPress={() => setShowEP(true)}
                style={({ pressed }) => [s.detailEmoji, pressed && { opacity: 0.7 }]}
              >
                <Text style={s.detailEmojiText}>{task?.emoji ?? DEFAULT_EMOJI}</Text>
                <View style={s.emojiEditBadge}>
                  <Feather name="edit-2" size={9} color="#fff" />
                </View>
              </Pressable>
              <TextInput
                style={s.detailTitle}
                value={title}
                onChangeText={setTitle}
                multiline
                placeholder="Task name…"
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.primary}
              />
            </View>

            <View style={s.bodySection}>
              <Text style={s.bodySectionLabel}>NOTES</Text>
              {bodyLoading
                ? <Text style={s.bodyPlaceholder}>Loading…</Text>
                : body
                  ? <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      <Text style={s.bodyText}>{body}</Text>
                    </ScrollView>
                  : <Text style={s.bodyPlaceholder}>No notes</Text>
              }
            </View>

            <View style={s.detailActions}>
              <Pressable style={s.cancelBtn} onPress={() => dismiss()}>
                <Text style={s.cancelBtnTx}>Cancel</Text>
              </Pressable>
              <Pressable
                style={s.saveBtn}
                onPress={() => { if (task) { onSave(task.id, title); dismiss(); } }}
              >
                <Feather name="check" size={15} color="#fff" />
                <Text style={s.saveBtnTx}>Save</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      <EmojiPicker
        visible={showEP}
        onSelect={(e) => { if (task) onEmojiChange(task.id, e); setShowEP(false); }}
        onClose={() => setShowEP(false)}
      />
    </>
  );
}

// ── Quick-add sheet ────────────────────────────────────────────────────────────
function QuickAddSheet({ visible, catEmojis, catValue, schema, apiKey, onAdded, onClose }: {
  visible: boolean; catEmojis: string[]; catValue: string;
  schema: Schema | null; apiKey: string | null;
  onAdded: (task: LifeTask) => void; onClose: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(500)).current;
  const bgAnim    = useRef(new Animated.Value(0)).current;
  const kbAnim    = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const insets    = useSafeAreaInsets();
  const [title,    setTitle]   = useState("");
  const [selEmoji, setSelEmoji] = useState<string | null>(null);
  const [saving,   setSaving]  = useState(false);
  const inputRef  = useRef<TextInput>(null);

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // Keyboard avoidance — sheet slides up with the keyboard
  useEffect(() => {
    const onShow = (e: any) => Animated.timing(kbAnim, {
      toValue: e.endCoordinates.height, duration: e.duration || 250, useNativeDriver: false,
    }).start();
    const onHide = (e: any) => Animated.timing(kbAnim, {
      toValue: 0, duration: e.duration || 200, useNativeDriver: false,
    }).start();
    const s1 = Keyboard.addListener("keyboardWillShow", onShow);
    const s2 = Keyboard.addListener("keyboardWillHide", onHide);
    const s3 = Keyboard.addListener("keyboardDidShow",  onShow);
    const s4 = Keyboard.addListener("keyboardDidHide",  onHide);
    return () => { s1.remove(); s2.remove(); s3.remove(); s4.remove(); };
  }, [kbAnim]);

  useEffect(() => {
    if (visible) {
      setTitle(""); setSelEmoji(null); setSaving(false);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, tension: 90, friction: 13 }),
        Animated.timing(bgAnim, { toValue: 1, duration: 220, useNativeDriver: false }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 500, duration: 240, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
        Animated.timing(bgAnim, { toValue: 0, duration: 190, useNativeDriver: false }),
      ]).start();
    }
  }, [visible]);

  const dismiss = () => { Keyboard.dismiss(); onClose(); };

  const handleSave = async () => {
    const t = title.trim();
    if (!t) { triggerShake(); return; }
    if (!apiKey || saving) return;
    setSaving(true);
    try {
      const emoji = selEmoji ?? DEFAULT_EMOJI;
      const body: any = {
        dbId: LIFE_DB_ID, title: t, category: catValue,
        emoji, priType: schema?.priType ?? "select",
        priOptions: schema?.priOptions ?? null,
        categoryType: schema?.categoryType ?? "select",
      };
      const r = await fetch(`${BASE_URL}/api/notion/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (data.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onAdded({ id: data.id, title: t, emoji, sortOrder: null });
        dismiss();
      } else {
        setSaving(false);
      }
    } catch {
      setSaving(false);
    }
  };

  const bg = bgAnim.interpolate({ inputRange: [0,1], outputRange: ["rgba(0,0,0,0)","rgba(0,0,0,0.65)"] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <Animated.View style={[s.overlay, { backgroundColor: bg }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        <Animated.View style={[s.sheet, { transform: [{ translateY: Animated.subtract(slideAnim, kbAnim) }], paddingBottom: insets.bottom + 20 }]}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Quick Add</Text>

          <TextInput
            ref={inputRef}
            style={s.qaInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Task name…"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.primary}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          {/* Emoji row */}
          <View style={s.qaEmojiRow}>
            {catEmojis.map(e => (
              <Pressable
                key={e}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelEmoji(e); }}
                style={[s.qaEmoji, norm(selEmoji ?? "") === norm(e) && s.qaEmojiActive]}
              >
                <Text style={s.qaEmojiText}>{e}</Text>
              </Pressable>
            ))}
          </View>

          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[s.qaAddBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Feather name="plus" size={16} color="#fff" /><Text style={s.qaAddBtnTx}>Add Task</Text></>
              }
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Task row ──────────────────────────────────────────────────────────────────
function TaskRow({ task, isDragging, onEmojiPress, onPress, onLongPress, onChecked, onDelete }: {
  task:         LifeTask;
  isDragging:   boolean;
  onEmojiPress: () => void;
  onPress:      () => void;
  onLongPress:  () => void;
  onChecked:    () => void;
  onDelete:     () => void;
}) {
  const checkScale  = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const rowScale    = useRef(new Animated.Value(1)).current;
  const translateX  = useRef(new Animated.Value(0)).current;
  const deletingRef = useRef(false);
  const [checked, setChecked] = useState(false);

  const handleCheck = () => {
    if (checked) return;
    setChecked(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.spring(checkScale, { toValue: 1, useNativeDriver: false, tension: 240, friction: 8 }).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 0,    duration: 420, useNativeDriver: false }),
        Animated.timing(rowScale,    { toValue: 0.88, duration: 360, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
      ]).start(() => onChecked());
    }, 320);
  };

  const triggerDelete = useCallback(() => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.timing(translateX,  { toValue: -500, duration: 260, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
      Animated.timing(opacityAnim, { toValue: 0,    duration: 220, useNativeDriver: false }),
    ]).start(() => onDelete());
  }, [onDelete]);

  const snapBack = useCallback(() => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: false, tension: 160, friction: 14 }).start();
  }, [translateX]);

  const updateX = useCallback((x: number) => { translateX.setValue(x); }, [translateX]);

  const snapReveal = useCallback(() => {
    Animated.spring(translateX, { toValue: -120, useNativeDriver: false, tension: 160, friction: 14 }).start();
  }, [translateX]);

  const swipe = useMemo(() =>
    Gesture.Pan()
      .activeOffsetX([-8, 8])
      .failOffsetY([-14, 14])
      .onChange(e => { runOnJS(updateX)(Math.max(-120, Math.min(0, e.translationX))); })
      .onEnd(e => {
        if (e.translationX < -60) runOnJS(snapReveal)();
        else runOnJS(snapBack)();
      }),
    [snapReveal, snapBack, updateX]
  );

  const pillOpacity  = translateX.interpolate({ inputRange: [-120, -20, 0], outputRange: [1, 0.1, 0], extrapolate: "clamp" });
  const pillTranslateX = translateX.interpolate({ inputRange: [-120, 0], outputRange: [0, 14], extrapolate: "clamp" });

  return (
    <Animated.View style={[sc.rowOuter, { opacity: opacityAnim, transform: [{ scale: rowScale }] }]}>
      {/* Delete background */}
      <View style={sc.deleteBg}>
        <Animated.View style={{ opacity: pillOpacity, transform: [{ translateX: pillTranslateX }] }}>
          <Pressable style={sc.deletePill} onPress={triggerDelete}>
            <Feather name="trash-2" size={12} color="#fff" />
            <Text style={sc.deletePillTx}>Delete</Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Swipeable foreground */}
      <GestureDetector gesture={swipe}>
        <Animated.View style={[sc.rowWrap, isDragging && sc.rowDragging, { transform: [{ translateX }] }]}>
          {/* Emoji */}
          <Pressable onPress={onEmojiPress} hitSlop={6} style={sc.emojiBtn}>
            <Text style={sc.rowEmoji}>{task.emoji === DEFAULT_EMOJI ? "—" : task.emoji}</Text>
          </Pressable>

          {/* Name */}
          <Pressable style={{ flex: 1 }} onPress={onPress} onLongPress={onLongPress} delayLongPress={400}>
            <Text style={sc.rowTitle} numberOfLines={2}>{task.title}</Text>
          </Pressable>

          {/* Checkbox */}
          <Pressable onPress={handleCheck} hitSlop={8} style={sc.checkBtn}>
            <Animated.View style={[sc.checkBox, checked && sc.checkBoxDone]}>
              <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                <Feather name="check" size={12} color="#fff" />
              </Animated.View>
            </Animated.View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function LifeTaskScreen() {
  const { slug }          = useLocalSearchParams<{ slug: string }>();
  const config            = SLUG_MAP[slug ?? ""] ?? null;
  const insets            = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const isTablet          = screenW >= 768;
  const { apiKey }        = useNotion();

  const topPad    = Platform.OS === "web" ? Math.max(insets.top, 67)    : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  // ── Data ────────────────────────────────────────────────────────────────────
  const [tasks,    setTasks]    = useState<LifeTask[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [schema,   setSchema]   = useState<Schema | null>(null);
  const tasksRef = useRef<LifeTask[]>([]);
  tasksRef.current = tasks;

  const fetchTasks = useCallback(async () => {
    if (!apiKey || !config) return;
    setLoading(true); setError(null);
    try {
      const enc = encodeURIComponent(config.catValue);
      const r   = await fetch(`${BASE_URL}/api/notion/life-tasks?category=${enc}`, {
        headers: { "x-notion-key": apiKey },
      });
      const data = await r.json();
      if (data.tasks) {
        const filtered = (data.tasks as LifeTask[]).filter(t => {
          // Always hide the explicit hidden-emoji marker
          if (norm(t.emoji) === norm(HIDDEN_EMOJI)) return false;
          // Keep items with no emoji assigned (default "-")
          if (t.emoji === DEFAULT_EMOJI || t.emoji === "") return true;
          // Hide items with emojis not in this category's defined set (rogue)
          return config.emojis.some(e => norm(e) === norm(t.emoji));
        });
        // Sort: items with distinct positive sortOrder first (ascending), then by emoji position
        const catEmojis = config.emojis;
        const emojiIdx  = (e: string) => {
          const i = catEmojis.findIndex(ce => norm(ce) === norm(e));
          return i === -1 ? 999 : i;
        };
        filtered.sort((a, b) => {
          const aOrd = (a.sortOrder !== null && a.sortOrder > 0) ? a.sortOrder : null;
          const bOrd = (b.sortOrder !== null && b.sortOrder > 0) ? b.sortOrder : null;
          if (aOrd !== null && bOrd !== null && aOrd !== bOrd) return aOrd - bOrd;
          if (aOrd !== null && bOrd === null) return -1;
          if (aOrd === null && bOrd !== null) return 1;
          // Both lack a meaningful sort order → fall back to emoji position in config
          return emojiIdx(a.emoji) - emojiIdx(b.emoji);
        });
        setTasks(filtered);
        // Reset position anims
        filtered.forEach((t, i) => {
          if (!posAnims.current[t.id]) posAnims.current[t.id] = new Animated.Value(i * SLOT_H);
          else posAnims.current[t.id].setValue(i * SLOT_H);
        });
      } else {
        setError(data.message ?? "Failed to load");
      }
    } catch (e: any) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [apiKey, config]);

  useEffect(() => {
    fetchTasks();
    if (!apiKey) return;
    fetch(`${BASE_URL}/api/notion/schema/${LIFE_DB_ID}`, { headers: { "x-notion-key": apiKey } })
      .then(r => r.json())
      .then(d => setSchema({ priType: d.priType, priOptions: d.priOptions, categoryType: d.categoryType }))
      .catch(() => setSchema({ priType: "select", priOptions: null, categoryType: "select" }));
  }, [fetchTasks]);

  // ── Emoji filter ─────────────────────────────────────────────────────────────
  const [activeEmoji, setActiveEmoji] = useState<string | null>(null);

  const visibleTasks = useMemo(() => {
    if (!activeEmoji) return tasks;
    const n = norm(activeEmoji);
    return tasks.filter(t => norm(t.emoji) === n);
  }, [tasks, activeEmoji]);

  // ── Drag & drop ──────────────────────────────────────────────────────────────
  const posAnims         = useRef<Record<string, Animated.Value>>({});
  const containerRef     = useRef<View>(null);
  const containerTopRef  = useRef(0);
  const scrollOffsetRef  = useRef(0);
  const isDraggingRef    = useRef(false);
  const draggingIdxRef   = useRef(-1);
  const hoverIdxRef      = useRef(-1);
  const dragOccurredRef  = useRef(false);
  const panY             = useRef(new Animated.Value(0)).current;
  const [dragActiveIdx, setDragActiveIdx] = useState(-1);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  tasks.forEach((t, i) => {
    if (!posAnims.current[t.id]) posAnims.current[t.id] = new Animated.Value(i * SLOT_H);
  });

  const animatePositions = useCallback((dragIdx: number, hoverIdx: number) => {
    const cur = tasksRef.current;
    cur.forEach((t, i) => {
      if (i === dragIdx) return;
      let target = i;
      if (dragIdx < hoverIdx && i > dragIdx && i <= hoverIdx) target = i - 1;
      else if (dragIdx > hoverIdx && i >= hoverIdx && i < dragIdx) target = i + 1;
      Animated.timing(posAnims.current[t.id], {
        toValue: target * SLOT_H, duration: 140, useNativeDriver: false,
        easing: Easing.out(Easing.cubic),
      }).start();
    });
  }, []);

  const startDrag = useCallback((idx: number) => {
    // Set drag state immediately (before async measure) so PanResponder
    // captures the very first move event rather than missing it
    isDraggingRef.current  = true;
    draggingIdxRef.current = idx;
    hoverIdxRef.current    = idx;
    dragOccurredRef.current = true;
    setDragActiveIdx(idx);
    setScrollEnabled(false);
    panY.setValue(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Measure async for precise drop-zone calculation
    containerRef.current?.measure((_x, _y, _w, _h, _px, py) => {
      containerTopRef.current = py;
    });
  }, []);

  const endDrag = useCallback(() => {
    const di = draggingIdxRef.current;
    const hi = hoverIdxRef.current;
    isDraggingRef.current  = false;
    draggingIdxRef.current = -1;
    hoverIdxRef.current    = -1;
    panY.setValue(0);
    setScrollEnabled(true);

    if (di >= 0 && hi >= 0 && di !== hi) {
      setTasks(prev => {
        const next = [...prev];
        const [moved] = next.splice(di, 1);
        next.splice(hi, 0, moved);
        next.forEach((t, i) => posAnims.current[t.id]?.setValue(i * SLOT_H));
        // Persist sort order
        syncSortOrders(next);
        return next;
      });
    } else {
      tasksRef.current.forEach((t, i) => posAnims.current[t.id]?.setValue(i * SLOT_H));
    }
    setDragActiveIdx(-1);
    setTimeout(() => { dragOccurredRef.current = false; }, 80);
  }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => isDraggingRef.current,
    onPanResponderMove: (_, gs) => {
      if (!isDraggingRef.current) return;
      const di  = draggingIdxRef.current;
      const len = tasksRef.current.length;
      panY.setValue(gs.dy);
      // Use absolute finger Y for accurate zone — much more precise than dy-based calculation
      const relY     = gs.moveY - containerTopRef.current + scrollOffsetRef.current;
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

  const syncSortOrders = useCallback((ordered: LifeTask[]) => {
    if (!apiKey) return;
    ordered.forEach((t, i) => {
      const newOrder = i + 1;
      if (t.sortOrder !== newOrder) {
        fetch(`${BASE_URL}/api/notion/life-tasks/${t.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
          body: JSON.stringify({ sortOrder: newOrder }),
        }).catch(() => {});
      }
    });
  }, [apiKey]);

  // ── Task actions ─────────────────────────────────────────────────────────────
  const [detailTask,   setDetailTask]   = useState<LifeTask | null>(null);
  const [pageBody,     setPageBody]     = useState<string | null>(null);
  const [bodyLoading,  setBodyLoading]  = useState(false);
  const [pickerTaskId, setPickerTaskId] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const openDetail = useCallback((task: LifeTask) => {
    if (dragOccurredRef.current) return;
    setDetailTask(task);
    setPageBody(null);
    setBodyLoading(true);
    if (apiKey) {
      fetch(`${BASE_URL}/api/notion/page-blocks/${task.id}`, {
        headers: { "x-notion-key": apiKey },
      })
        .then(r => r.json())
        .then(d => { setPageBody(d.body || null); setBodyLoading(false); })
        .catch(() => setBodyLoading(false));
    }
  }, [apiKey]);

  const handleSaveTitle = useCallback((id: string, title: string) => {
    if (!apiKey) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, title } : t));
    fetch(`${BASE_URL}/api/notion/life-tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
      body: JSON.stringify({ title }),
    }).catch(() => {});
  }, [apiKey]);

  const handleEmojiChange = useCallback((id: string, emoji: string) => {
    if (!apiKey) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, emoji } : t));
    setDetailTask(prev => prev?.id === id ? { ...prev, emoji } : prev);
    fetch(`${BASE_URL}/api/notion/life-tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
      body: JSON.stringify({ emoji }),
    }).catch(() => {});
    setPickerTaskId(null);
  }, [apiKey]);

  const handleCheckOff = useCallback((id: string) => {
    if (!apiKey) return;
    setTasks(prev => {
      const next = prev.filter(t => t.id !== id);
      next.forEach((t, i) => {
        Animated.spring(posAnims.current[t.id], {
          toValue: i * SLOT_H,
          useNativeDriver: false,
          tension: 140,
          friction: 14,
        }).start();
      });
      return next;
    });
    fetch(`${BASE_URL}/api/notion/life-tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
      body: JSON.stringify({ done: true }),
    }).catch(() => {});
  }, [apiKey]);

  const handleDelete = useCallback((id: string) => {
    setTasks(prev => {
      const next = prev.filter(t => t.id !== id);
      // Re-position remaining items
      next.forEach((t, i) => {
        Animated.spring(posAnims.current[t.id], {
          toValue: i * SLOT_H,
          useNativeDriver: false,
          tension: 120,
          friction: 14,
        }).start();
      });
      return next;
    });
    if (apiKey) {
      fetch(`${BASE_URL}/api/notion/life-tasks/${id}`, {
        method: "DELETE",
        headers: { "x-notion-key": apiKey },
      }).catch(() => {});
    }
  }, [apiKey]);

  const handleQuickAdded = useCallback((task: LifeTask) => {
    setTasks(prev => {
      const next = [...prev, task];
      posAnims.current[task.id] = new Animated.Value((next.length - 1) * SLOT_H);
      return next;
    });
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!config) {
    return (
      <View style={[sc.root, { paddingTop: topPad }]}>
        <ScreenHeader title="Not found" />
        <View style={sc.center}><Text style={sc.errorText}>Unknown section</Text></View>
      </View>
    );
  }

  const pickerTask = pickerTaskId ? tasks.find(t => t.id === pickerTaskId) ?? null : null;

  return (
    <View style={[sc.root, { paddingTop: topPad }]}>
      <ScreenHeader title={config.title} />

      {/* ── Emoji filter bar ─────────────────────────────────────────────────── */}
      {config.emojis.length > 1 && (
        <View style={sc.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sc.filterScroll}>
            {config.emojis.map(e => {
              const isActive = activeEmoji !== null && norm(activeEmoji) === norm(e);
              return (
                <Pressable
                  key={e}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    // Tap active emoji again to deselect (show all)
                    setActiveEmoji(prev => prev !== null && norm(prev) === norm(e) ? null : e);
                  }}
                  style={[sc.filterChip, isActive && sc.filterChipActive]}
                >
                  <Text style={sc.filterEmojiText}>{e}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── List ─────────────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={sc.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={sc.center}>
          <Text style={sc.errorText}>{error}</Text>
          <Pressable onPress={fetchTasks} style={sc.retryBtn}>
            <Text style={sc.retryTx}>Retry</Text>
          </Pressable>
        </View>
      ) : tasks.length === 0 ? (
        <View style={sc.center}>
          <Text style={sc.mutedText}>Nothing here yet</Text>
        </View>
      ) : (
        <ScrollView
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}
          onScroll={e => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
        >
          {/* Filtered view: simple flow layout, no drag */}
          {activeEmoji !== null && (
            <View style={{ marginHorizontal: 16, marginTop: 8 }}>
              {tasks
                .filter(t => norm(t.emoji) === norm(activeEmoji))
                .map(task => (
                  <View key={task.id} style={{ marginBottom: ITEM_GAP }}>
                    <TaskRow
                      task={task}
                      isDragging={false}
                      onEmojiPress={() => setPickerTaskId(task.id)}
                      onPress={() => openDetail(task)}
                      onLongPress={() => {}}
                      onChecked={() => handleCheckOff(task.id)}
                      onDelete={() => handleDelete(task.id)}
                    />
                  </View>
                ))}
            </View>
          )}

          {/* Unfiltered drag view */}
          {activeEmoji === null && (
            <View
              ref={containerRef}
              {...panResponder.panHandlers}
              style={{ height: Math.max(tasks.length, 1) * SLOT_H + 16, marginHorizontal: 16, marginTop: 8 }}
            >
              {tasks.map((task, idx) => {
                const isDragging = dragActiveIdx === idx;
                const posAnim    = posAnims.current[task.id] ?? new Animated.Value(idx * SLOT_H);
                return (
                  <Animated.View
                    key={task.id}
                    style={[
                      sc.absItem,
                      { top: posAnim, zIndex: isDragging ? 100 : 1 },
                      isDragging && { transform: [{ translateY: panY }] },
                    ]}
                  >
                    <TaskRow
                      task={task}
                      isDragging={isDragging}
                      onEmojiPress={() => setPickerTaskId(task.id)}
                      onPress={() => openDetail(task)}
                      onLongPress={() => startDrag(idx)}
                      onChecked={() => handleCheckOff(task.id)}
                      onDelete={() => handleDelete(task.id)}
                    />
                  </Animated.View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── FAB ──────────────────────────────────────────────────────────────── */}
      <Pressable
        onPress={() => setShowQuickAdd(true)}
        style={({ pressed }) => [sc.fab, pressed && { opacity: 0.82 }]}
      >
        <Feather name="plus" size={22} color="#fff" />
      </Pressable>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      <DetailSheet
        task={detailTask}
        body={pageBody}
        bodyLoading={bodyLoading}
        isTablet={isTablet}
        onClose={() => setDetailTask(null)}
        onSave={handleSaveTitle}
        onEmojiChange={handleEmojiChange}
      />

      <EmojiPicker
        visible={!!pickerTask}
        onSelect={(e) => { if (pickerTask) handleEmojiChange(pickerTask.id, e); }}
        onClose={() => setPickerTaskId(null)}
      />

      <QuickAddSheet
        visible={showQuickAdd}
        catEmojis={config.emojis}
        catValue={config.catValue}
        schema={schema}
        apiKey={apiKey}
        onAdded={handleQuickAdded}
        onClose={() => setShowQuickAdd(false)}
      />
    </View>
  );
}

// ── Shared sheet styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay:        { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: Colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 20, paddingTop: 0,
  },
  sheetTablet: {
    borderRadius: 20, marginHorizontal: 40, marginBottom: 40,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  handle: { width: 38, height: 5, borderRadius: 3, backgroundColor: Colors.border, alignSelf: "center", marginTop: 10, marginBottom: 18 },
  sheetTitle: { color: Colors.textPrimary, fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 20 },

  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 8 },
  emojiCell: { width: 54, height: 54, borderRadius: 14, backgroundColor: Colors.cardBgElevated, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  emojiCellPressed: { borderColor: Colors.primary, backgroundColor: "rgba(224,49,49,0.15)" },
  emojiCellText: { fontSize: 26 },

  detailHeader: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 20, marginTop: 6 },
  detailEmoji: { position: "relative" },
  detailEmojiText: { fontSize: 44 },
  emojiEditBadge: {
    position: "absolute", bottom: 0, right: -2, width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  detailTitle: {
    flex: 1, color: Colors.textPrimary, fontSize: 19, fontFamily: "Inter_600SemiBold",
    paddingTop: 6, lineHeight: 26,
  },
  bodySection: { marginBottom: 20 },
  bodySectionLabel: { color: Colors.textMuted, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1, marginBottom: 8 },
  bodyText: { color: Colors.textSecondary, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  bodyPlaceholder: { color: Colors.textMuted, fontSize: 14, fontFamily: "Inter_400Regular", fontStyle: "italic" },

  detailActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.cardBgElevated, alignItems: "center" },
  cancelBtnTx: { color: Colors.textSecondary, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  saveBtnTx: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  qaInput: {
    backgroundColor: Colors.cardBgElevated, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight,
    color: Colors.textPrimary, fontSize: 16, fontFamily: "Inter_400Regular",
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16,
  },
  qaEmojiRow: { flexDirection: "row", gap: 10, marginBottom: 20, flexWrap: "wrap" },
  qaEmoji: {
    width: 50, height: 50, borderRadius: 12, backgroundColor: Colors.cardBgElevated,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border,
  },
  qaEmojiActive: { borderColor: Colors.primary, backgroundColor: "rgba(224,49,49,0.15)" },
  qaEmojiText: { fontSize: 24 },
  qaAddBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 15,
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6,
  },
  qaAddBtnTx: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});

// ── Screen styles ──────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.darkBg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  mutedText: { color: Colors.textMuted, fontSize: 15, fontFamily: "Inter_400Regular" },
  errorText: { color: Colors.primary, fontSize: 14, fontFamily: "Inter_500Medium" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.cardBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  retryTx: { color: Colors.textPrimary, fontSize: 14, fontFamily: "Inter_600SemiBold" },

  filterBar: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { borderColor: Colors.primary, backgroundColor: "rgba(224,49,49,0.12)" },
  filterChipText: { color: Colors.textSecondary, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  filterChipTextActive: { color: Colors.primary },
  filterEmojiText: { fontSize: 20 },

  absItem: { position: "absolute", left: 0, right: 0, height: ITEM_H },

  rowOuter: { height: ITEM_H, borderRadius: 14, overflow: "hidden" },
  deleteBg: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center", alignItems: "flex-end", paddingRight: 14,
    backgroundColor: "rgba(224,49,49,0.12)",
  },
  deletePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  deletePillTx: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },

  rowWrap: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, height: ITEM_H,
  },
  rowDragging: {
    backgroundColor: Colors.cardBgElevated,
    borderColor: Colors.primary,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 16,
  },
  emojiBtn:  { minWidth: 32, alignItems: "center" },
  rowEmoji:  { fontSize: 24 },
  rowTitle:  { color: Colors.textPrimary, fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20 },
  checkBtn:  { padding: 4 },
  checkBox: {
    width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center", backgroundColor: "transparent",
  },
  checkBoxDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  fab: {
    position: "absolute", bottom: 32, right: 20,
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 8,
  },
});
