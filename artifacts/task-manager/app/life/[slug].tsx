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
  Linking,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useNotion } from "@/context/NotionContext";

// ── Constants ─────────────────────────────────────────────────────────────────
const LIFE_DB_ID   = "2c8b7eba3523802abbe2e934df42a4e2";
const ITEM_H       = 48;
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

// ── Loader timing (ms) ────────────────────────────────────────────────────────
const T_FADE_IN    = 200;
const T_SPINNER_IN = 250;
const T_MIN_SPIN   = 2000;
const T_POP        = 420;
const T_TICK       = 400;
const T_HOLD       = 700;
const T_FADE_OUT   = 450;

// ── Types ─────────────────────────────────────────────────────────────────────
interface LifeTask { id: string; title: string; emoji: string; sortOrder: number | null; url: string | null; }
interface Schema   { priType: string; priOptions: string[] | null; categoryType: string; }

const norm  = (e: string) => e.replace(/[\uFE00-\uFE0F\u200D\u20E3]/g, "").trim();
const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));
// A static zero-value used for the dragged row so it never dims itself
const ZERO_ANIM = new Animated.Value(0);

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

// ── Detail sheet (bottom sheet, like QuickAddSheet) ────────────────────────────
const DS_SPINNER_SIZE   = 72;
const DS_SPINNER_STROKE = 8;
const DS_CIRCLE_SIZE    = 74;

function DetailSheet({ task, catEmojis, body, bodyLoading, onClose, onSave, onEmojiChange }: {
  task:          LifeTask | null;
  catEmojis:     string[];
  body:          string | null;
  bodyLoading:   boolean;
  onClose:       () => void;
  onSave:        (id: string, title: string, notes: string) => Promise<void>;
  onEmojiChange: (id: string, emoji: string) => void;
}) {
  const slideAnim = useRef(new Animated.Value(600)).current;
  const bgAnim    = useRef(new Animated.Value(0)).current;
  const kbAnim    = useRef(new Animated.Value(0)).current;
  const insets    = useSafeAreaInsets();
  const [title,   setTitle]  = useState("");
  const [notes,   setNotes]  = useState("");
  const visible = !!task;

  // ── Loader anims ──────────────────────────────────────────────────────────
  const [loaderVisible,   setLoaderVisible]   = useState(false);
  const overlayOpacity  = useRef(new Animated.Value(0)).current;
  const spinnerOpacity  = useRef(new Animated.Value(0)).current;
  const spinnerRotation = useRef(new Animated.Value(0)).current;
  const circleScale     = useRef(new Animated.Value(0)).current;
  const circleOpacity   = useRef(new Animated.Value(0)).current;
  const tickScale       = useRef(new Animated.Value(0)).current;
  const spinLoopRef     = useRef<Animated.CompositeAnimation | null>(null);
  const spinDeg = spinnerRotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  // ── Keyboard avoidance ────────────────────────────────────────────────────
  useEffect(() => {
    const onShow = (e: any) => Animated.timing(kbAnim, { toValue: e.endCoordinates.height, duration: e.duration || 250, useNativeDriver: false }).start();
    const onHide = (e: any) => Animated.timing(kbAnim, { toValue: 0, duration: e.duration || 200, useNativeDriver: false }).start();
    const s1 = Keyboard.addListener("keyboardWillShow", onShow);
    const s2 = Keyboard.addListener("keyboardWillHide", onHide);
    const s3 = Keyboard.addListener("keyboardDidShow",  onShow);
    const s4 = Keyboard.addListener("keyboardDidHide",  onHide);
    return () => { s1.remove(); s2.remove(); s3.remove(); s4.remove(); };
  }, [kbAnim]);

  // Sync notes from body prop whenever sheet opens or body loads
  useEffect(() => {
    if (visible) setNotes(body ?? "");
  }, [visible, body]);

  // ── Open / close animation ────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setTitle(task!.title);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, tension: 90, friction: 13 }),
        Animated.timing(bgAnim,    { toValue: 1, duration: 220, useNativeDriver: false }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 600, duration: 240, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
        Animated.timing(bgAnim,    { toValue: 0,   duration: 190, useNativeDriver: false }),
      ]).start();
    }
  }, [visible]);

  const dismiss = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const resetLoader = useCallback(() => {
    overlayOpacity.setValue(0);  spinnerOpacity.setValue(0);
    spinnerRotation.setValue(0); circleScale.setValue(0);
    circleOpacity.setValue(0);   tickScale.setValue(0);
  }, []);

  const runLoader = useCallback(
    (apiPromise: Promise<void>) =>
      new Promise<void>((resolve) => {
        resetLoader();
        setLoaderVisible(true);
        const tracked = apiPromise.then(() => {}).catch(() => {});

        spinLoopRef.current = Animated.loop(
          Animated.timing(spinnerRotation, { toValue: 1, duration: 600, easing: Easing.linear, useNativeDriver: true })
        );
        spinLoopRef.current.start();

        Animated.timing(overlayOpacity, { toValue: 1, duration: T_FADE_IN, useNativeDriver: true }).start(() => {
          Animated.timing(spinnerOpacity, { toValue: 1, duration: T_SPINNER_IN, useNativeDriver: true }).start(() => {
            const minSpin = new Promise<void>((r) => setTimeout(r, T_MIN_SPIN));
            Promise.all([tracked, minSpin]).then(() => {
              spinLoopRef.current?.stop();
              Animated.parallel([
                Animated.timing(spinnerOpacity, { toValue: 0, duration: T_POP,       useNativeDriver: true }),
                Animated.timing(circleOpacity,  { toValue: 1, duration: T_POP * 0.4, useNativeDriver: true }),
                Animated.timing(circleScale,    { toValue: 1, duration: T_POP, easing: Easing.out(Easing.back(1.7)), useNativeDriver: true }),
              ]).start(() => {
                Animated.timing(tickScale, { toValue: 1, duration: T_TICK, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }).start(() => {
                  setTimeout(() => {
                    Animated.timing(overlayOpacity, { toValue: 0, duration: T_FADE_OUT, useNativeDriver: true }).start(() => {
                      setLoaderVisible(false);
                      resetLoader();
                      dismiss();
                      resolve();
                    });
                  }, T_HOLD);
                });
              });
            });
          });
        });
      }),
    [resetLoader, dismiss]
  );

  const handleSave = useCallback(() => {
    if (!task) return;
    Keyboard.dismiss();
    runLoader(onSave(task.id, title.trim(), notes.trim()));
  }, [task, title, notes, onSave, runLoader]);

  const bg = bgAnim.interpolate({ inputRange: [0, 1], outputRange: ["rgba(0,0,0,0)", "rgba(0,0,0,0.65)"] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <Animated.View style={[s.overlay, { backgroundColor: bg }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        <Animated.View style={[
          s.sheet,
          { transform: [{ translateY: Animated.subtract(slideAnim, kbAnim) }], paddingBottom: insets.bottom + 20 },
        ]}>
          <View style={s.handle} />

          {/* Title input — full width, no icon */}
          <TextInput
            style={s.dsTitleInput}
            value={title}
            onChangeText={setTitle}
            multiline
            placeholder="Task name…"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.primary}
            keyboardAppearance="dark"
          />

          {/* Emoji section */}
          {catEmojis.length > 0 && (
            <>
              <Text style={s.dsSectionLabel}>EMOJI</Text>
              <View style={s.dsEmojiRow}>
                {catEmojis.map(e => {
                  const selected = norm(task?.emoji ?? "") === norm(e);
                  return (
                    <Pressable
                      key={e}
                      onPress={() => { if (task) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onEmojiChange(task.id, e); } }}
                      style={[s.dsEmojiChip, selected && s.dsEmojiChipActive]}
                    >
                      <Text style={s.dsEmojiText}>{e}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* Notes */}
          <Text style={s.dsSectionLabel}>NOTES</Text>
          {bodyLoading
            ? <ActivityIndicator size="small" color={Colors.primary} style={{ alignSelf: "flex-start", marginBottom: 12 }} />
            : (
              <TextInput
                style={s.dsNotesInput}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                placeholder="Add notes…"
                placeholderTextColor={Colors.textMuted}
                selectionColor={Colors.primary}
                keyboardAppearance="dark"
                textAlignVertical="top"
              />
            )
          }

          {/* Reference URL */}
          {task?.url ? (
            <>
              <Text style={[s.dsSectionLabel, { marginTop: 12 }]}>REFERENCE</Text>
              <Pressable onPress={() => task.url && Linking.openURL(task.url)}>
                <Text style={s.dsUrlText} numberOfLines={2}>{task.url}</Text>
              </Pressable>
            </>
          ) : null}

          {/* Action buttons */}
          <View style={s.dsActions}>
            <Pressable style={s.dsCancelBtn} onPress={dismiss}>
              <Text style={s.dsCancelTx}>Cancel</Text>
            </Pressable>
            <TouchableOpacity activeOpacity={0.8} style={s.dsUpdateBtn} onPress={handleSave}>
              <Feather name="check" size={15} color="#fff" />
              <Text style={s.dsUpdateTx}>Update</Text>
            </TouchableOpacity>
          </View>

          {/* Loader overlay (inside sheet) */}
          {loaderVisible && (
            <Animated.View style={[s.dsLoader, { opacity: overlayOpacity }]} pointerEvents="auto">
              <Animated.View style={[s.dsSpinnerWrap, { opacity: spinnerOpacity, transform: [{ rotate: spinDeg }] }]}>
                <View style={s.dsSpinnerRing} />
              </Animated.View>
              <Animated.View style={[s.dsCircleWrap, { opacity: circleOpacity, transform: [{ scale: circleScale }] }]}>
                <Animated.View style={{ transform: [{ scale: tickScale }] }}>
                  <Feather name="check" size={40} color="#fff" />
                </Animated.View>
              </Animated.View>
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
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
        onAdded({ id: data.id, title: t, emoji, sortOrder: null, url: null });
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
function TaskRow({ task, isDragging, dimValue, onEmojiPress, onPress, onLongPress, onChecked, onDelete }: {
  task:         LifeTask;
  isDragging:   boolean;
  dimValue:     Animated.Value;   // 0=normal, 1=dimmed (drag mode, non-dragged rows)
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

  // ── Swipe callbacks (stored in ref so PanResponder closure stays fresh) ───
  const swipeCbs = useRef({
    snapBack:  () => Animated.spring(translateX, { toValue: 0,    useNativeDriver: false, tension: 160, friction: 14 }).start(),
    snapReveal:() => Animated.spring(translateX, { toValue: -120, useNativeDriver: false, tension: 160, friction: 14 }).start(),
  });

  // ── PanResponder for swipe-to-delete (native PanResponder = no RNGH conflict) ──
  const swipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        !deletingRef.current && Math.abs(gs.dx) > 7 && Math.abs(gs.dy) < 10,
      // Capture phase: claim horizontal swipes before Pressable can block them.
      // The outer drag PanResponder runs capture first (since it's an ancestor), so
      // when isDragging=true the outer wins and this never fires.
      onMoveShouldSetPanResponderCapture: (_, gs) =>
        !deletingRef.current && Math.abs(gs.dx) > 7 && Math.abs(gs.dy) < 10,
      onPanResponderMove: (_, gs) => {
        translateX.setValue(Math.max(-120, Math.min(0, gs.dx)));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -60) swipeCbs.current.snapReveal();
        else swipeCbs.current.snapBack();
      },
      onPanResponderTerminate: () => swipeCbs.current.snapBack(),
    })
  ).current;

  const triggerDelete = useCallback(() => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.timing(translateX,  { toValue: -500, duration: 260, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
      Animated.timing(opacityAnim, { toValue: 0,    duration: 220, useNativeDriver: false }),
    ]).start(() => onDelete());
  }, [onDelete]);

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

  // Combine row opacity: check-off anim × drag dim (1 - dimValue * 0.75 → 0.25 when dimmed)
  const combinedOpacity = Animated.multiply(
    opacityAnim,
    dimValue.interpolate({ inputRange: [0, 1], outputRange: [1, 0.22] })
  );

  const pillOpacity   = translateX.interpolate({ inputRange: [-120, -20, 0], outputRange: [1, 0.1, 0], extrapolate: "clamp" });
  const pillTranslate = translateX.interpolate({ inputRange: [-120, 0], outputRange: [0, 14], extrapolate: "clamp" });

  return (
    <Animated.View style={[sc.rowOuter, { opacity: combinedOpacity, transform: [{ scale: rowScale }] }]}>
      {/* Delete background — revealed when row slides left */}
      <View style={sc.deleteBg}>
        <Animated.View style={{ opacity: pillOpacity, transform: [{ translateX: pillTranslate }] }}>
          <Pressable style={sc.deletePill} onPress={triggerDelete}>
            <Feather name="trash-2" size={12} color="#fff" />
            <Text style={sc.deletePillTx}>Delete</Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Swipeable foreground */}
      <Animated.View {...swipePan.panHandlers} style={[sc.rowWrap, isDragging && sc.rowDragging, { transform: [{ translateX }] }]}>
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
          const ne = norm(e);
          // Exact stripped match
          let i = catEmojis.findIndex(ce => norm(ce) === ne);
          if (i !== -1) return i;
          // Prefix match (handles extra ZWJ sequences or modifiers)
          i = catEmojis.findIndex(ce => {
            const nc = norm(ce);
            return ne.startsWith(nc) || nc.startsWith(ne);
          });
          return i === -1 ? 999 : i;
        };
        filtered.sort((a, b) => {
          const aOrd = (a.sortOrder !== null && a.sortOrder > 0) ? a.sortOrder : null;
          const bOrd = (b.sortOrder !== null && b.sortOrder > 0) ? b.sortOrder : null;
          if (aOrd !== null && bOrd !== null && aOrd !== bOrd) return aOrd - bOrd;
          if (aOrd !== null && bOrd === null) return -1;
          if (aOrd === null && bOrd !== null) return 1;
          // Both lack a meaningful sort order → emoji position, then alphabetical
          const ei = emojiIdx(a.emoji) - emojiIdx(b.emoji);
          if (ei !== 0) return ei;
          return a.title.localeCompare(b.title);
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
  const startScrollRef   = useRef(0);   // scroll at drag-start — needed for accurate relY
  const isDraggingRef    = useRef(false);
  const draggingIdxRef   = useRef(-1);
  const hoverIdxRef      = useRef(-1);
  const dragOccurredRef  = useRef(false);
  const panY             = useRef(new Animated.Value(0)).current;
  const dimAnim          = useRef(new Animated.Value(0)).current;   // 0=normal, 1=all-rows-dimmed
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
    isDraggingRef.current   = true;
    draggingIdxRef.current  = idx;
    hoverIdxRef.current     = idx;
    dragOccurredRef.current = true;
    setDragActiveIdx(idx);
    setScrollEnabled(false);
    panY.setValue(0);
    // Dim all other rows
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
    setScrollEnabled(true);
    // Restore row brightness
    Animated.timing(dimAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();

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
      // relY: finger position within the scroll-content coordinate space.
      // containerTopRef was measured at startScrollRef, so we subtract that baseline.
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

  const handleSaveTitle = useCallback((id: string, title: string, notes: string): Promise<void> => {
    if (!apiKey) return Promise.resolve();
    setTasks(prev => prev.map(t => t.id === id ? { ...t, title } : t));
    // Save title + notes concurrently
    return Promise.all([
      fetch(`${BASE_URL}/api/notion/life-tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
        body: JSON.stringify({ title }),
      }),
      fetch(`${BASE_URL}/api/notion/page-blocks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
        body: JSON.stringify({ body: notes }),
      }),
    ]).then(() => {}).catch(() => {});
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
                      dimValue={ZERO_ANIM}
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
                      dimValue={isDragging ? ZERO_ANIM : dimAnim}
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
        catEmojis={config?.emojis ?? []}
        body={pageBody}
        bodyLoading={bodyLoading}
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
  overlay:        { flex: 1, justifyContent: "center" },

  // ── EmojiPicker sheet (still a bottom sheet) ────────────────────────────
  sheet: {
    backgroundColor: Colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 20, paddingTop: 0,
    position: "absolute", left: 0, right: 0, bottom: 0,
  },
  handle: { width: 38, height: 5, borderRadius: 3, backgroundColor: Colors.border, alignSelf: "center", marginTop: 10, marginBottom: 18 },
  sheetTitle: { color: Colors.textPrimary, fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 20 },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 8 },
  emojiCell: { width: 54, height: 54, borderRadius: 14, backgroundColor: Colors.cardBgElevated, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  emojiCellPressed: { borderColor: Colors.primary, backgroundColor: "rgba(224,49,49,0.15)" },
  emojiCellText: { fontSize: 26 },

  // ── Detail sheet (bottom sheet) ─────────────────────────────────────────
  dsTitleInput: {
    color: Colors.textPrimary, fontSize: 17, fontFamily: "Inter_600SemiBold",
    lineHeight: 26, marginBottom: 20, paddingVertical: 0,
    backgroundColor: Colors.cardBgElevated, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.borderLight, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
  },
  dsSectionLabel: { color: Colors.textMuted, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1, marginBottom: 10 },
  dsEmojiRow: { flexDirection: "row", gap: 10, marginBottom: 20, flexWrap: "wrap" },
  dsEmojiChip: {
    width: 50, height: 50, borderRadius: 12, backgroundColor: Colors.cardBgElevated,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border,
  },
  dsEmojiChipActive: { borderColor: Colors.primary, backgroundColor: "rgba(224,49,49,0.15)" },
  dsEmojiText: { fontSize: 24 },
  dsNotesInput: {
    backgroundColor: Colors.cardBgElevated, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight,
    color: Colors.textPrimary, fontSize: 14, fontFamily: "Inter_400Regular",
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
    minHeight: 90, marginBottom: 4, lineHeight: 21,
  },
  dsBodyText: { color: Colors.textSecondary, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21, marginBottom: 4 },
  dsBodyPlaceholder: { color: Colors.textMuted, fontSize: 14, fontFamily: "Inter_400Regular", fontStyle: "italic", marginBottom: 4 },
  dsUrlText: { color: Colors.primary, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, textDecorationLine: "underline", marginBottom: 4 },
  dsActions: { flexDirection: "row", gap: 10, marginTop: 20 },
  dsCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.cardBgElevated, alignItems: "center" },
  dsCancelTx: { color: Colors.textSecondary, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  dsUpdateBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  dsUpdateTx: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  // ── Detail sheet loader ──────────────────────────────────────────────────
  dsLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center", justifyContent: "center", borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 999,
  },
  dsSpinnerWrap: {
    width: DS_SPINNER_SIZE, height: DS_SPINNER_SIZE,
    alignItems: "center", justifyContent: "center", position: "absolute",
  },
  dsSpinnerRing: {
    width: DS_SPINNER_SIZE, height: DS_SPINNER_SIZE, borderRadius: DS_SPINNER_SIZE / 2,
    borderWidth: DS_SPINNER_STROKE,
    borderColor: "rgba(255,255,255,0.85)",
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  dsCircleWrap: {
    width: DS_CIRCLE_SIZE, height: DS_CIRCLE_SIZE, borderRadius: DS_CIRCLE_SIZE / 2,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", position: "absolute",
    borderWidth: 1.5, borderColor: Colors.primary,
  },

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
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 18, elevation: 18,
  },
  emojiBtn:  { minWidth: 32, alignItems: "center" },
  rowEmoji:  { fontSize: 24 },
  rowTitle:  { color: Colors.textPrimary, fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20 },
  checkBtn:  { padding: 4 },
  checkBox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: "#5a5a5a",
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
