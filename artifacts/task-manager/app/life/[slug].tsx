import { Feather } from "@expo/vector-icons";
import Svg, { Path as SvgPath } from "react-native-svg";
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
  Image,
  Keyboard,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
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
const FULL_PICKER  = ["🔥","🚩","👀","🧠","💳","💰","🎧","📌","📕","🏡","🖥️"];

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
function EmojiPicker({ visible, emojis, onSelect, onClose }: {
  visible: boolean; emojis: string[]; onSelect: (e: string) => void; onClose: () => void;
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
            {emojis.map(e => (
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

function DetailSheet({ task, catEmojis, body, bodyLoading, onClose, onSave, onEmojiChange, isTablet }: {
  task:          LifeTask | null;
  catEmojis:     string[];
  body:          string | null;
  bodyLoading:   boolean;
  onClose:       () => void;
  onSave:        (id: string, title: string, notes: string) => Promise<void>;
  onEmojiChange: (id: string, emoji: string) => void;
  isTablet:      boolean;
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

  const tabletSheetStyle = isTablet ? {
    position: undefined as any, left: undefined, right: undefined, bottom: undefined,
    width: 560, maxWidth: "90%" as any, borderRadius: 20,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    alignSelf: "center" as const,
    marginHorizontal: "auto" as any,
    transform: [{ scale: slideAnim.interpolate({ inputRange: [0, 600], outputRange: [1, 0.92] }) }],
  } : { transform: [{ translateY: Animated.subtract(slideAnim, kbAnim) }] };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <Animated.View style={[s.overlay, isTablet && s.overlayCenter, { backgroundColor: bg }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        <Animated.View style={[s.sheet, { paddingBottom: isTablet ? 24 : insets.bottom + 20 }, tabletSheetStyle]}>
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
                  <Svg width={52} height={52} viewBox="0 0 68 68">
                    <SvgPath
                      fill="none"
                      stroke="#fff"
                      strokeWidth={8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 35.9 L26.4 47.2 L48.2 21.7"
                    />
                  </Svg>
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
function QuickAddSheet({ visible, catEmojis, catValue, schema, apiKey, onAdded, onClose, isTablet }: {
  visible: boolean; catEmojis: string[]; catValue: string;
  schema: Schema | null; apiKey: string | null;
  onAdded: (task: LifeTask) => void; onClose: () => void;
  isTablet: boolean;
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

  const tabletSheetStyle = isTablet ? {
    position: undefined as any, left: undefined, right: undefined, bottom: undefined,
    width: 480, maxWidth: "90%" as any, borderRadius: 20,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    alignSelf: "center" as const,
    marginHorizontal: "auto" as any,
    transform: [{ scale: slideAnim.interpolate({ inputRange: [0, 500], outputRange: [1, 0.92] }) }],
  } : { transform: [{ translateY: Animated.subtract(slideAnim, kbAnim) }] };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <Animated.View style={[s.overlay, isTablet && s.overlayCenter, { backgroundColor: bg }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        <Animated.View style={[s.sheet, { paddingBottom: isTablet ? 24 : insets.bottom + 20 }, tabletSheetStyle]}>
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
function TaskRow({ task, isDragging, dimValue, onEmojiPress, onPress, onLongPress, onChecked, onDelete, onSwipeOpen }: {
  task:          LifeTask;
  isDragging:    boolean;
  dimValue:      Animated.Value;
  onEmojiPress:  () => void;
  onPress:       () => void;
  onLongPress:   () => void;
  onChecked:     () => void;
  onDelete:      () => void;
  onSwipeOpen?:  (close: () => void) => void;
}) {
  const swipeableRef = useRef<Swipeable>(null);
  const checkScale   = useRef(new Animated.Value(0)).current;
  const opacityAnim  = useRef(new Animated.Value(1)).current;
  const rowScale     = useRef(new Animated.Value(1)).current;
  const deletingRef  = useRef(false);
  const isRevealedRef = useRef(false);
  const [checked, setChecked] = useState(false);

  const triggerDelete = useCallback(() => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    swipeableRef.current?.close();
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0,    duration: 280, useNativeDriver: false }),
      Animated.timing(rowScale,    { toValue: 0.85, duration: 280, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
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

  const handleRowTap = (action: () => void) => {
    if (isRevealedRef.current) {
      swipeableRef.current?.close();
    } else {
      action();
    }
  };

  const combinedOpacity = Animated.multiply(
    opacityAnim,
    dimValue.interpolate({ inputRange: [0, 1], outputRange: [1, 0.22] })
  );

  const renderRightActions = useCallback(() => (
    <Pressable style={sc.deleteAction} onPress={triggerDelete}>
      <Feather name="trash-2" size={16} color="#fff" />
      <Text style={sc.deletePillTx}>Delete</Text>
    </Pressable>
  ), [triggerDelete]);

  return (
    <Animated.View style={[sc.rowOuter, { opacity: combinedOpacity, transform: [{ scale: rowScale }] }]}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        rightThreshold={40}
        friction={1.5}
        enabled={!isDragging && !deletingRef.current}
        onSwipeableOpen={() => {
          isRevealedRef.current = true;
          onSwipeOpen?.(() => swipeableRef.current?.close());
        }}
        onSwipeableClose={() => { isRevealedRef.current = false; }}
        containerStyle={{ borderRadius: 14, overflow: "hidden" }}
      >
        <View style={[sc.rowWrap, isDragging && sc.rowDragging]}>
          {/* Emoji */}
          <Pressable onPress={() => handleRowTap(onEmojiPress)} hitSlop={6} style={sc.emojiBtn}>
            <Text style={sc.rowEmoji}>{task.emoji === DEFAULT_EMOJI ? "—" : task.emoji}</Text>
          </Pressable>

          {/* Name */}
          <Pressable style={{ flex: 1 }} onPress={() => handleRowTap(onPress)} onLongPress={onLongPress} delayLongPress={200}>
            <Text style={sc.rowTitle} numberOfLines={2}>{task.title}</Text>
          </Pressable>

          {/* Checkbox */}
          <Pressable onPress={() => handleRowTap(handleCheck)} hitSlop={8} style={sc.checkBtn}>
            <Animated.View style={[sc.checkBox, checked && sc.checkBoxDone]}>
              <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                <Feather name="check" size={12} color="#fff" />
              </Animated.View>
            </Animated.View>
          </Pressable>
        </View>
      </Swipeable>
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

  // ── Emoji index helper (component-level so drag + sort + add share same logic) ─
  const emojiIdxFn = useCallback((e: string) => {
    const catEmojis = config?.emojis ?? [];
    const ne = norm(e);
    let i = catEmojis.findIndex(ce => norm(ce) === ne);
    if (i !== -1) return i;
    i = catEmojis.findIndex(ce => {
      const nc = norm(ce);
      return ne.startsWith(nc) || nc.startsWith(ne);
    });
    return i === -1 ? 999 : i;
  }, [config]);

  // ── Data ────────────────────────────────────────────────────────────────────
  const [tasks,      setTasks]      = useState<LifeTask[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [schema,     setSchema]     = useState<Schema | null>(null);
  const tasksRef = useRef<LifeTask[]>([]);
  tasksRef.current = tasks;

  const fetchTasks = useCallback(async (silent = false) => {
    if (!apiKey || !config) return;
    if (!silent) setLoading(true); setError(null);
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
          // Allow any emoji from the full picker set (so cross-category picks aren't silently lost)
          return FULL_PICKER.some(e => norm(e) === norm(t.emoji));
        });
        // Sort: emoji group first, then sortOrder within group, then alphabetical
        filtered.sort((a, b) => {
          const ei = emojiIdxFn(a.emoji) - emojiIdxFn(b.emoji);
          if (ei !== 0) return ei;
          const aOrd = a.sortOrder ?? 9999;
          const bOrd = b.sortOrder ?? 9999;
          if (aOrd !== bOrd) return aOrd - bOrd;
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTasks(true);
    setRefreshing(false);
  }, [fetchTasks]);

  // ── Emoji filter ─────────────────────────────────────────────────────────────
  const [activeEmoji, setActiveEmoji] = useState<string | null>(null);

  const visibleTasks = useMemo(() => {
    if (!activeEmoji) return tasks;
    const n = norm(activeEmoji);
    return tasks.filter(t => norm(t.emoji) === n);
  }, [tasks, activeEmoji]);

  // ── Active swipe tracking — only one row open at a time ─────────────────────
  const activeSwipeClose = useRef<(() => void) | null>(null);

  const handleSwipeOpen = useCallback((close: () => void) => {
    activeSwipeClose.current?.();   // close previous open row
    activeSwipeClose.current = close;
  }, []);

  const closeActiveSwipe = useCallback(() => {
    activeSwipeClose.current?.();
    activeSwipeClose.current = null;
  }, []);

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

  // Banded sort orders: emoji group 0 → 100s, group 1 → 200s, etc.
  // So "top of group" always works: new item gets (groupBase - 1).
  const syncSortOrders = useCallback((ordered: LifeTask[]) => {
    if (!apiKey) return;
    const groupCounters: Record<number, number> = {};
    ordered.forEach(t => {
      const gi = emojiIdxFn(t.emoji);
      if (groupCounters[gi] === undefined) groupCounters[gi] = 0;
      const newOrder = (gi + 1) * 100 + groupCounters[gi];
      groupCounters[gi]++;
      fetch(`${BASE_URL}/api/notion/life-tasks/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
        body: JSON.stringify({ sortOrder: newOrder }),
      }).catch(() => {});
    });
  }, [apiKey, emojiIdxFn]);

  // Reset: sort all tasks by emoji group then title, assign fresh banded sort orders
  const handleResetOrder = useCallback(async () => {
    if (!apiKey) return;
    const ordered = [...tasksRef.current].sort((a, b) => {
      const ei = emojiIdxFn(a.emoji) - emojiIdxFn(b.emoji);
      if (ei !== 0) return ei;
      return a.title.localeCompare(b.title);
    });
    const groupCounters: Record<number, number> = {};
    const updated = ordered.map(t => {
      const gi = emojiIdxFn(t.emoji);
      if (groupCounters[gi] === undefined) groupCounters[gi] = 0;
      const newOrder = (gi + 1) * 100 + groupCounters[gi];
      groupCounters[gi]++;
      return { ...t, sortOrder: newOrder };
    });
    setTasks(updated);
    updated.forEach((t, i) => posAnims.current[t.id]?.setValue(i * SLOT_H));
    await Promise.all(updated.map(t =>
      fetch(`${BASE_URL}/api/notion/life-tasks/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
        body: JSON.stringify({ sortOrder: t.sortOrder }),
      }).catch(() => {})
    ));
  }, [apiKey, emojiIdxFn]);

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
      // Find the minimum sortOrder in the same emoji group and go one below it
      const gi        = emojiIdxFn(task.emoji);
      const groupBase = (gi + 1) * 100;
      const groupTasks = prev.filter(t => emojiIdxFn(t.emoji) === gi);
      const minOrder  = groupTasks.length > 0
        ? Math.min(...groupTasks.map(t => t.sortOrder ?? groupBase + 50))
        : groupBase;
      const newOrder  = minOrder - 1;

      const updatedTask = { ...task, sortOrder: newOrder };

      // Persist new sort order
      if (apiKey) {
        fetch(`${BASE_URL}/api/notion/life-tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
          body: JSON.stringify({ sortOrder: newOrder }),
        }).catch(() => {});
      }

      // Re-sort: emoji group first, then sortOrder within group
      const next = [...prev, updatedTask];
      next.sort((a, b) => {
        const ei = emojiIdxFn(a.emoji) - emojiIdxFn(b.emoji);
        if (ei !== 0) return ei;
        const aOrd = a.sortOrder ?? 9999;
        const bOrd = b.sortOrder ?? 9999;
        return aOrd - bOrd;
      });
      next.forEach((t, i) => {
        if (!posAnims.current[t.id]) posAnims.current[t.id] = new Animated.Value(i * SLOT_H);
        else posAnims.current[t.id].setValue(i * SLOT_H);
      });
      return next;
    });
  }, [apiKey, emojiIdxFn]);

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

  const [resetting, setResetting] = useState(false);
  const onResetPress = useCallback(async () => {
    if (resetting) return;
    setResetting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await handleResetOrder();
    setResetting(false);
  }, [resetting, handleResetOrder]);


  return (
    <View style={[sc.root, { paddingTop: topPad }]}>
      <ScreenHeader
        title={config.title}
        right={
          <Pressable
            onPress={onResetPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={sc.resetBtn}
          >
            <Feather name={resetting ? "loader" : "refresh-cw"} size={16} color={resetting ? Colors.primary : Colors.textMuted} />
          </Pressable>
        }
      />

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
          onScrollBeginDrag={closeActiveSwipe}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
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
                      onSwipeOpen={handleSwipeOpen}
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
              {/* Tap-anywhere-to-cancel overlay — sits above non-dragging rows (z:1) but below the dragging row (z:100) */}
              {dragActiveIdx !== -1 && (
                <Pressable
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
                  onPress={() => endDrag()}
                />
              )}
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
                      onSwipeOpen={handleSwipeOpen}
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
        isTablet={isTablet}
      />

      <EmojiPicker
        visible={!!pickerTask}
        emojis={config.emojis}
        onSelect={(e) => { if (pickerTask) handleEmojiChange(pickerTask.id, e); }}
        onClose={() => setPickerTaskId(null)}
      />

      <QuickAddSheet
        visible={showQuickAdd}
        catEmojis={FULL_PICKER}
        catValue={config.catValue}
        schema={schema}
        apiKey={apiKey}
        onAdded={handleQuickAdded}
        onClose={() => setShowQuickAdd(false)}
        isTablet={isTablet}
      />
    </View>
  );
}

// ── Shared sheet styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay:        { flex: 1 },
  overlayCenter:  { justifyContent: "center", alignItems: "center" },

  // ── EmojiPicker sheet (still a bottom sheet) ────────────────────────────
  sheet: {
    backgroundColor: Colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 20, paddingTop: 0,
    position: "absolute", left: 0, right: 0, bottom: 0,
  },
  handle: { width: 38, height: 5, borderRadius: 3, backgroundColor: Colors.border, alignSelf: "center", marginTop: 10, marginBottom: 18 },
  sheetTitle: { color: Colors.textPrimary, fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 20 },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 8 },
  emojiCell: { width: 68, height: 68, borderRadius: 16, backgroundColor: Colors.cardBgElevated, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  emojiCellPressed: { borderColor: Colors.primary, backgroundColor: "rgba(224,49,49,0.15)" },
  emojiCellText: { fontSize: 30 },

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
  resetBtn: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  headerBanner: { height: 160, overflow: "hidden", backgroundColor: "#000" },
  headerBannerImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },

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

  rowOuter: { height: ITEM_H },
  deleteAction: {
    width: 110, height: ITEM_H,
    backgroundColor: Colors.primary,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
  },
  deletePillTx: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

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
