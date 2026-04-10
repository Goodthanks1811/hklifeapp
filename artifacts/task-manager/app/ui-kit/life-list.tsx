/**
 * UI Kit — Life List Demo
 * Exact visual replica of the Development section (life/[slug].tsx).
 * All interactions work (swipe, hold-to-drag, emoji picker, epic picker,
 * detail sheet). No Notion writes — state resets on every focus.
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
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
  useWindowDimensions,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useDrawer } from "@/context/DrawerContext";

// ── Constants (match life/[slug].tsx exactly) ─────────────────────────────────
const ITEM_H   = 52;
const ITEM_GAP = 8;
const SLOT_H   = ITEM_H + ITEM_GAP;

const HIDDEN_EMOJI  = "👎";
const DEFAULT_EMOJI = "-";

const EMOJIS = ["🔥", "🚆", "🏡", "👀", "💡", "👎"];

const EPIC_COLOUR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  "Enhancement": { bg: "rgba(64,192,87,0.14)",   border: "rgba(64,192,87,0.40)",   text: "#40C057" },
  "HK Life":     { bg: "rgba(224,49,49,0.14)",   border: "rgba(224,49,49,0.40)",   text: "#E03131" },
  "IR App":      { bg: "rgba(51,154,240,0.14)",  border: "rgba(51,154,240,0.40)",  text: "#339AF0" },
  "General":     { bg: "rgba(134,142,150,0.14)", border: "rgba(134,142,150,0.40)", text: "#868E96" },
  "New App":     { bg: "rgba(250,176,5,0.14)",   border: "rgba(250,176,5,0.40)",   text: "#FAB005" },
};
const EPIC_FALLBACK = { bg: "rgba(134,142,150,0.12)", border: "rgba(134,142,150,0.30)", text: "#868E96" };
const EPIC_OPTIONS  = ["HK Life", "Enhancement", "IR App", "New App", "General"];

function epicColor(epic: string | null | undefined) {
  return epic ? (EPIC_COLOUR_MAP[epic] ?? EPIC_FALLBACK) : EPIC_FALLBACK;
}

const norm  = (e: string) => e.replace(/[\uFE00-\uFE0F\u200D\u20E3]/g, "").trim();
const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));
const ZERO_ANIM = new Animated.Value(0);

// ── Types ─────────────────────────────────────────────────────────────────────
interface Task {
  id:    string;
  title: string;
  emoji: string;
  epic:  string;
  notes: string;
}

// ── Stub data (matches the screenshot exactly) ────────────────────────────────
const SEED: Task[] = [
  { id: "1",  emoji: "🔥", title: "Mock life admin section",                                                  epic: "HK Life",     notes: "" },
  { id: "2",  emoji: "🔥", title: "Thumbs down in all life sections should optimistically disappear the row", epic: "HK Life",     notes: "When a user taps thumbs down the row should vanish immediately without waiting for the API." },
  { id: "3",  emoji: "🔥", title: "Concept of Ad hoc training session where all movements appear",            epic: "HK Life",     notes: "" },
  { id: "4",  emoji: "🔥", title: "Calories burned at the bottom of training session",                        epic: "HK Life",     notes: "Show a summary footer with total kcal after the last movement." },
  { id: "5",  emoji: "🔥", title: "New Chisme Section",                                                       epic: "HK Life",     notes: "" },
  { id: "6",  emoji: "🔥", title: "Expense report",                                                           epic: "HK Life",     notes: "Monthly PDF export of tagged expense items." },
  { id: "7",  emoji: "🔥", title: "Combined calendar, psychology and philosophy push notification",            epic: "HK Life",     notes: "" },
  { id: "8",  emoji: "🔥", title: "Publish now to deploy to permanent server",                                 epic: "HK Life",     notes: "" },
  { id: "9",  emoji: "🔥", title: "Change NRL so not green dot, but warning for tips",                        epic: "HK Life",     notes: "" },
  { id: "10", emoji: "🔥", title: "Dev options Amazon",                                                        epic: "Enhancement", notes: "Add Amazon-specific settings to the dev options panel." },
  { id: "11", emoji: "🔥", title: "Fast forwards",                                                            epic: "HK Life",     notes: "" },
  { id: "12", emoji: "🚆", title: "Footy icons in ladder",                                                     epic: "HK Life",     notes: "Show team badge icons next to each team in the ladder view." },
  { id: "13", emoji: "🚆", title: "Move Reminder To App",                                                      epic: "HK Life",     notes: "" },
  { id: "14", emoji: "🚆", title: "Trains",                                                                    epic: "HK Life",     notes: "Departure board widget on the home screen." },
];

// ── Inline emoji picker ───────────────────────────────────────────────────────
type Anchor = { taskId: string; x: number; y: number; w: number; h: number };

function InlineEmojiPicker({ anchor, emojis, currentEmoji, onSelect, onClose }: {
  anchor:       Anchor | null;
  emojis:       string[];
  currentEmoji: string | null;
  onSelect:     (taskId: string, emoji: string) => void;
  onClose:      () => void;
}) {
  const { width: sw, height: sh } = useWindowDimensions();
  if (!anchor) return null;

  const options = currentEmoji
    ? emojis.filter(e => norm(e) !== norm(currentEmoji))
    : emojis;
  if (!options.length) return null;

  const cellSize = 40;
  const gap      = 8;
  const pad      = 10;
  const popW     = options.length * cellSize + (options.length - 1) * gap + pad * 2;
  const popH     = cellSize + pad * 2;

  const rightX = anchor.x + anchor.w + 6;
  const leftX  = Math.min(rightX + popW > sw ? anchor.x - popW - 6 : rightX, sw - popW - 8);
  const topY   = Math.min(Math.max(8, anchor.y + anchor.h / 2 - popH / 2), sh - popH - 20);

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[s.emojiPopover, { top: topY, left: leftX, width: popW }]}>
        {options.map(e => (
          <Pressable
            key={e}
            style={({ pressed }) => [s.emojiPopCell, pressed && s.emojiPopCellPressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(anchor.taskId, e);
              onClose();
            }}
          >
            <Text style={s.emojiPopText}>{e}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

// ── Inline epic picker ────────────────────────────────────────────────────────
function InlineEpicPicker({ anchor, currentEpic, onSelect, onClose }: {
  anchor:      Anchor | null;
  currentEpic: string | null;
  onSelect:    (taskId: string, epic: string) => void;
  onClose:     () => void;
}) {
  const { width: sw, height: sh } = useWindowDimensions();
  if (!anchor) return null;

  const rowH = 34;
  const pad  = 6;
  const gap  = 4;
  const popW = 170;
  const popH = EPIC_OPTIONS.length * rowH + (EPIC_OPTIONS.length - 1) * gap + pad * 2;

  const leftX = Math.max(4, anchor.x - popW - 6);
  const topY  = Math.min(anchor.y - 4, sh - popH - 20);

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[s.epicPopover, { top: topY, left: leftX, width: popW }]}>
        {EPIC_OPTIONS.map(ep => {
          const ec = epicColor(ep);
          return (
            <Pressable
              key={ep}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(anchor.taskId, ep);
                onClose();
              }}
              style={[s.epicPopRow, { backgroundColor: ec.bg, borderColor: ec.border }]}
            >
              <Text style={[s.epicPopText, { color: ec.text }]}>{ep}</Text>
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

// ── Detail sheet (visual copy of the real one, no Notion calls) ───────────────
const DS_SPINNER_SIZE   = 72;
const DS_SPINNER_STROKE = 8;
const DS_CIRCLE_SIZE    = 74;

function DetailSheet({ task, onClose, onEmojiChange, onEpicChange }: {
  task:          Task | null;
  onClose:       () => void;
  onEmojiChange: (id: string, emoji: string) => void;
  onEpicChange:  (id: string, epic: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const isTablet = screenW >= 768;

  const scaleAnim = useRef(new Animated.Value(0.93)).current;
  const slideAnim = useRef(new Animated.Value(600)).current;
  const bgAnim    = useRef(new Animated.Value(0)).current;
  const kbAnim    = useRef(new Animated.Value(0)).current;

  const visible = !!task;

  useEffect(() => {
    const onShow = (e: any) => Animated.timing(kbAnim, { toValue: e.endCoordinates.height, duration: e.duration || 250, useNativeDriver: false }).start();
    const onHide = (e: any) => Animated.timing(kbAnim, { toValue: 0, duration: e.duration || 200, useNativeDriver: false }).start();
    const s1 = Keyboard.addListener("keyboardWillShow", onShow);
    const s2 = Keyboard.addListener("keyboardWillHide", onHide);
    const s3 = Keyboard.addListener("keyboardDidShow",  onShow);
    const s4 = Keyboard.addListener("keyboardDidHide",  onHide);
    return () => { s1.remove(); s2.remove(); s3.remove(); s4.remove(); };
  }, [kbAnim]);

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(500);
      if (isTablet) {
        scaleAnim.setValue(0.93);
        Animated.parallel([
          Animated.timing(scaleAnim, { toValue: 1,   duration: 220, useNativeDriver: false, easing: Easing.out(Easing.back(1.2)) }),
          Animated.timing(bgAnim,    { toValue: 1,   duration: 200, useNativeDriver: false }),
        ]).start();
      } else {
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true, easing: Easing.bezier(0.25, 1, 0.5, 1) }).start();
        Animated.timing(bgAnim,    { toValue: 1, duration: 200, useNativeDriver: false }).start();
      }
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    if (isTablet) {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 0.92, duration: 160, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
        Animated.timing(bgAnim,    { toValue: 0,    duration: 160, useNativeDriver: false }),
      ]).start(onClose);
    } else {
      Animated.timing(slideAnim, { toValue: 500, duration: 200, useNativeDriver: true, easing: Easing.in(Easing.quad) }).start(onClose);
      Animated.timing(bgAnim,    { toValue: 0,   duration: 160, useNativeDriver: false }).start();
    }
  }, [isTablet, onClose]);

  if (!task) return null;

  const bg      = bgAnim.interpolate({ inputRange: [0, 1], outputRange: ["rgba(0,0,0,0)", "rgba(0,0,0,0.72)"] });
  const cardW   = Math.min(560, screenW * 0.92);
  const maxCardH = screenH * 0.88;
  const emojisForPicker = EMOJIS.filter(e => norm(e) !== norm(HIDDEN_EMOJI));

  return (
    <Modal transparent visible animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[s.overlay, isTablet && s.overlayCenter, { backgroundColor: bg }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        {isTablet ? (
          // ── iPad: centered card
          <Animated.View style={[s.dsCard, { width: cardW, maxHeight: maxCardH, marginBottom: kbAnim, transform: [{ scale: scaleAnim }], opacity: bgAnim }]}>
            <DSBody task={task} onClose={handleClose} onEmojiChange={onEmojiChange} onEpicChange={onEpicChange} emojis={emojisForPicker} insetBottom={insets.bottom} isTablet />
          </Animated.View>
        ) : (
          // ── Phone: slide-up sheet
          <Animated.View style={{ flex: 1, transform: [{ translateY: slideAnim }] }} pointerEvents="box-none">
            <Animated.View style={[s.sheet, {
              paddingBottom: Math.max(insets.bottom + 16, 28),
              maxHeight: Animated.subtract(screenH - insets.top - 16, kbAnim),
            }]}>
              <DSBody task={task} onClose={handleClose} onEmojiChange={onEmojiChange} onEpicChange={onEpicChange} emojis={emojisForPicker} insetBottom={0} isTablet={false} />
            </Animated.View>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

function DSBody({ task, onClose, onEmojiChange, onEpicChange, emojis, insetBottom, isTablet }: {
  task: Task; onClose: () => void;
  onEmojiChange: (id: string, emoji: string) => void;
  onEpicChange:  (id: string, epic: string) => void;
  emojis: string[]; insetBottom: number; isTablet: boolean;
}) {
  const ec = epicColor(task.epic);

  return (
    <>
      {/* Handle (phone) */}
      {!isTablet && <View style={s.handle} />}

      {/* Title row */}
      <View style={[s.dsCardTop, isTablet && { paddingTop: 24 }]}>
        <Text style={s.dsTitleInput}>{task.title}</Text>

        {/* Meta row: emoji chips + epic chips */}
        <View style={s.dsMetaRow}>
          {emojis.map(e => (
            <Pressable
              key={e}
              onPress={() => onEmojiChange(task.id, e)}
              style={[s.dsEmojiChip, norm(e) === norm(task.emoji) && s.dsEmojiChipActive]}
            >
              <Text style={s.dsEmojiText}>{e}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[s.dsMetaRow, { marginTop: 10 }]}>
          {EPIC_OPTIONS.map(ep => {
            const ec2    = epicColor(ep);
            const active = ep === task.epic;
            return (
              <Pressable
                key={ep}
                onPress={() => onEpicChange(task.id, ep)}
                style={[s.dsEpicChip, active && { backgroundColor: ec2.bg, borderColor: ec2.border }]}
              >
                <Text style={[s.dsEpicText, { color: active ? ec2.text : Colors.textMuted }]}>{ep}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={s.dsDivider} />

      {/* Body / notes */}
      <ScrollView style={s.dsBodyScroll} showsVerticalScrollIndicator={false}>
        <View style={s.dsBodyInner}>
          <Text style={s.dsSectionLabel}>NOTES</Text>
          <Text style={task.notes ? s.dsBodyText : s.dsBodyPlaceholder}>
            {task.notes || "No notes yet. This is a stub — nothing is saved."}
          </Text>
        </View>
      </ScrollView>

      <View style={s.dsDivider} />

      {/* Actions */}
      <View style={s.dsActions}>
        <Pressable style={s.dsCancelBtn} onPress={handleClose}>
          <Text style={s.dsCancelTx}>Close</Text>
        </Pressable>
        <Pressable style={s.dsUpdateBtn} onPress={handleClose}>
          <Feather name="check" size={16} color="#fff" />
          <Text style={s.dsUpdateTx}>Done</Text>
        </Pressable>
      </View>
    </>
  );

  function handleClose() { onClose(); }
}

// ── Task row (exact copy of TaskRow in life/[slug].tsx) ───────────────────────
function TaskRow({ task, isDragging, dimValue, onEmojiPress, onEpicPress, onPress, onLongPress, onChecked, onDelete, onStartDelete, onSwipeOpen, onSwipeClose }: {
  task:           Task;
  isDragging:     boolean;
  dimValue:       Animated.Value;
  onEmojiPress:   (px: number, py: number, w: number, h: number) => void;
  onEpicPress:    (px: number, py: number, w: number, h: number) => void;
  onPress:        () => void;
  onLongPress:    () => void;
  onChecked:      () => void;
  onDelete:       () => void;
  onStartDelete?: (dur: number) => void;
  onSwipeOpen?:   (close: () => void) => void;
  onSwipeClose?:  () => void;
}) {
  const swipeableRef = useRef<Swipeable>(null);
  const emojiBtnRef  = useRef<View>(null);
  const epicPillRef  = useRef<View>(null);
  const checkScale   = useRef(new Animated.Value(0)).current;
  const opacityAnim  = useRef(new Animated.Value(1)).current;
  const rowHeight    = useRef(new Animated.Value(ITEM_H)).current;
  const pressOverlay = useRef(new Animated.Value(0)).current;
  const deletingRef   = useRef(false);
  const isRevealedRef = useRef(false);
  const [checked, setChecked] = useState(false);

  const onPressIn  = useCallback(() => Animated.timing(pressOverlay, { toValue: 0.28, duration: 60,  useNativeDriver: true }).start(), [pressOverlay]);
  const onPressOut = useCallback(() => Animated.timing(pressOverlay, { toValue: 0,    duration: 130, useNativeDriver: true }).start(), [pressOverlay]);

  const triggerDelete = useCallback(() => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    swipeableRef.current?.close();
    onStartDelete?.(260);
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 220, useNativeDriver: false }),
      Animated.timing(rowHeight,   { toValue: 0, duration: 260, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
    ]).start(() => onDelete());
  }, [onDelete, onStartDelete]);

  const handleCheck = useCallback(() => {
    if (checked) return;
    setChecked(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.spring(checkScale, { toValue: 1, useNativeDriver: false, tension: 240, friction: 8 }).start();
    setTimeout(() => {
      onStartDelete?.(340);
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 0, duration: 380, useNativeDriver: false }),
        Animated.timing(rowHeight,   { toValue: 0, duration: 340, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
      ]).start(() => onChecked());
    }, 320);
  }, [checked, onChecked, onStartDelete]);

  const handleRowTap = (action: () => void) => {
    if (isRevealedRef.current) { swipeableRef.current?.close(); }
    else { action(); }
  };

  const combinedOpacity = Animated.multiply(
    opacityAnim,
    dimValue.interpolate({ inputRange: [0, 1], outputRange: [1, 0.22] })
  );

  const ec = epicColor(task.epic);

  const renderRightActions = useCallback(() => (
    <View style={sc.deleteZone}>
      <Pressable style={sc.deleteAction} onPress={triggerDelete}>
        <Feather name="trash-2" size={20} color="#fff" />
      </Pressable>
    </View>
  ), [triggerDelete]);

  return (
    <Animated.View style={[sc.rowOuter, { height: rowHeight, opacity: combinedOpacity }]}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootLeft={false}
        overshootRight={false}
        rightThreshold={28}
        friction={1.5}
        enabled={!isDragging && !deletingRef.current}
        onSwipeableWillOpen={() => { pressOverlay.setValue(0); }}
        onSwipeableOpen={() => {
          isRevealedRef.current = true;
          onSwipeOpen?.(() => swipeableRef.current?.close());
        }}
        onSwipeableClose={() => { isRevealedRef.current = false; onSwipeClose?.(); }}
        containerStyle={{ borderRadius: 10, overflow: "hidden" }}
      >
        <Animated.View style={[sc.rowWrap, isDragging && sc.rowDragging]}>

          {/* Emoji */}
          <Pressable
            ref={emojiBtnRef as any}
            onPress={() => handleRowTap(() => {
              (emojiBtnRef.current as any)?.measure((_fx: number, _fy: number, w: number, h: number, px: number, py: number) => {
                onEmojiPress(px, py, w, h);
              });
            })}
            hitSlop={6}
            style={sc.emojiBtn}
          >
            <Text style={sc.rowEmoji}>{task.emoji === DEFAULT_EMOJI ? "—" : task.emoji}</Text>
          </Pressable>

          {/* Title */}
          <Pressable
            style={{ flex: 1, alignSelf: "stretch", justifyContent: "center" }}
            onPress={() => { onPressOut(); handleRowTap(onPress); }}
            onLongPress={onLongPress}
            delayLongPress={200}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
          >
            <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 10, backgroundColor: "#fff", opacity: pressOverlay }]} pointerEvents="none" />
            <Text style={sc.rowTitle} numberOfLines={2}>{task.title}</Text>
          </Pressable>

          {/* Epic pill */}
          {task.epic ? (
            <Pressable
              ref={epicPillRef as any}
              onPress={() => handleRowTap(() => {
                (epicPillRef.current as any)?.measure((_fx: number, _fy: number, w: number, h: number, px: number, py: number) => {
                  onEpicPress(px, py, w, h);
                });
              })}
              style={[sc.epicPill, { backgroundColor: ec.bg, borderColor: ec.border }]}
            >
              <Text style={[sc.epicPillText, { color: ec.text }]}>{task.epic}</Text>
            </Pressable>
          ) : null}

          {/* Checkbox */}
          <Pressable onPress={() => handleRowTap(handleCheck)} hitSlop={8} style={sc.checkBtn}>
            <Animated.View style={[sc.checkBox, checked && sc.checkBoxDone]}>
              {checked && <Feather name="check" size={13} color="#fff" />}
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Swipeable>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function LifeListScreen() {
  const insets   = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const isTablet = screenW >= 768;
  const { openDrawerToSection, drawerOpen, closeDrawer } = useDrawer();

  const [tasks, setTasks] = useState<Task[]>(() => SEED.map(t => ({ ...t })));

  // Reset everything on focus
  useFocusEffect(useCallback(() => {
    setTasks(SEED.map(t => ({ ...t })));
    setDetailTask(null);
    setEmojiAnchor(null);
    setEpicAnchor(null);
    Object.keys(posAnims.current).forEach(k => delete posAnims.current[k]);
  }, []));

  // ── Popovers & detail
  const [emojiAnchor, setEmojiAnchor] = useState<Anchor | null>(null);
  const [epicAnchor,  setEpicAnchor]  = useState<Anchor | null>(null);
  const [detailTask,  setDetailTask]  = useState<Task | null>(null);

  // ── Mutations
  const handleEmojiChange = useCallback((taskId: string, emoji: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, emoji } : t));
    setDetailTask(prev => prev?.id === taskId ? { ...prev, emoji } : prev);
  }, []);

  const handleEpicChange = useCallback((taskId: string, epic: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, epic } : t));
    setDetailTask(prev => prev?.id === taskId ? { ...prev, epic } : prev);
  }, []);

  const handleChecked = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  const handleDelete = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  // ── Drag / reorder (exact same pattern as [slug].tsx) ──────────────────────
  const posAnims      = useRef<Record<string, Animated.Value>>({});
  const addedAnims    = useRef<Record<string, Animated.Value>>({});
  const panY          = useRef(new Animated.Value(0)).current;
  const tasksRef      = useRef<Task[]>(tasks);
  tasksRef.current    = tasks;

  const dragActiveIdx  = useRef(-1);
  const hoverIdxRef    = useRef(-1);
  const dragStartY     = useRef(0);
  const scrollOffRef   = useRef(0);
  const containerRef   = useRef<View>(null);
  const openSwipeRef   = useRef<(() => void) | null>(null);
  const [dragIdx, setDragIdx] = useState(-1);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  // Init anims for current tasks list
  useEffect(() => {
    tasks.forEach((t, i) => {
      if (!posAnims.current[t.id]) {
        posAnims.current[t.id] = new Animated.Value(i * SLOT_H);
        addedAnims.current[t.id] = Animated.add(posAnims.current[t.id], panY);
      } else {
        posAnims.current[t.id].setValue(i * SLOT_H);
      }
    });
  }, [tasks.length]);

  const shiftOthers = useCallback((fromIdx: number, toIdx: number) => {
    tasksRef.current.forEach((t, i) => {
      if (i === fromIdx) return;
      let target = i;
      if (fromIdx < toIdx && i > fromIdx && i <= toIdx) target = i - 1;
      if (fromIdx > toIdx && i >= toIdx && i < fromIdx) target = i + 1;
      const anim = posAnims.current[t.id];
      if (anim) Animated.timing(anim, { toValue: target * SLOT_H, duration: 110, useNativeDriver: true, easing: Easing.out(Easing.quad) }).start();
    });
  }, []);

  const endDrag = useCallback(() => {
    if (dragActiveIdx.current === -1) return;
    const from  = dragActiveIdx.current;
    const hover = hoverIdxRef.current;
    dragActiveIdx.current = -1;
    hoverIdxRef.current   = -1;
    setDragIdx(-1);
    setScrollEnabled(true);
    panY.setValue(0);

    setTasks(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(hover, 0, moved);
      next.forEach((t, i) => {
        const anim = posAnims.current[t.id];
        if (anim) Animated.spring(anim, { toValue: i * SLOT_H, useNativeDriver: true, tension: 150, friction: 16 }).start();
      });
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [panY]);

  const startDrag = useCallback((idx: number) => {
    if (dragActiveIdx.current !== -1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    openSwipeRef.current?.();
    openSwipeRef.current = null;

    dragActiveIdx.current = idx;
    hoverIdxRef.current   = idx;
    dragStartY.current    = idx * SLOT_H;
    panY.setValue(0);
    setDragIdx(idx);
    setScrollEnabled(false);
  }, [panY]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => dragActiveIdx.current !== -1,
    onPanResponderMove: (_, gs) => {
      if (dragActiveIdx.current === -1) return;
      panY.setValue(gs.dy);
      const rawY   = dragStartY.current + gs.dy;
      const len    = tasksRef.current.length;
      const capped = clamp(0, rawY, (len - 1) * SLOT_H);
      const newHover = clamp(0, len - 1, Math.floor((capped + SLOT_H / 2) / SLOT_H));
      if (newHover !== hoverIdxRef.current) {
        const prev = dragActiveIdx.current;
        Haptics.selectionAsync();
        shiftOthers(prev, newHover);
        // update drag start so position tracks naturally
        dragStartY.current = newHover * SLOT_H;
        panY.setValue(rawY - dragStartY.current);
        dragActiveIdx.current = newHover;
        hoverIdxRef.current   = newHover;
        setDragIdx(newHover);
      }
    },
    onPanResponderEnd:       () => endDrag(),
    onPanResponderTerminate: () => endDrag(),
  }), [endDrag, shiftOthers, panY]);

  const handleStartDelete = useCallback((taskId: string, dur: number) => {
    const idx = tasksRef.current.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    tasksRef.current.forEach((t, i) => {
      if (i <= idx) return;
      const a = posAnims.current[t.id];
      if (a) Animated.timing(a, { toValue: (i - 1) * SLOT_H, duration: dur, useNativeDriver: true, easing: Easing.out(Easing.quad) }).start();
    });
  }, []);

  const pickerTask = emojiAnchor ? tasks.find(t => t.id === emojiAnchor.taskId) ?? null : null;
  const totalH     = tasks.length * SLOT_H;

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 52) : insets.top;

  return (
    <View style={sc.root}>

      {/* ── Gradient header (exact copy) ──────────────────────────────────── */}
      <View style={[sc.gradHeader, { paddingTop: topPad + 8, paddingBottom: isTablet ? 58 : 36 }]}>
        <LinearGradient
          colors={[
            "rgba(224,49,49,0.90)",
            "rgba(215,42,42,0.74)",
            "rgba(190,28,28,0.56)",
            "rgba(145,16,16,0.38)",
            "rgba(90,8,8,0.20)",
            "rgba(35,3,3,0.08)",
            "#0f0f0f",
          ]}
          locations={[0, 0.18, 0.36, 0.54, 0.70, 0.85, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={sc.gradNav}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); drawerOpen ? closeDrawer() : openDrawerToSection("life"); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={sc.gradIconGhost}
          >
            <Feather name="menu" size={26} color="rgba(255,255,255,0.92)" />
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>
        <Text style={sc.gradTitle}>Development</Text>
        <Text style={sc.gradSub}>UI Kit · stubbed data · resets on navigate</Text>
      </View>

      {/* ── List ──────────────────────────────────────────────────────────── */}
      <ScrollView
        style={{ marginTop: -8 }}
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 12 }}
      >
        <View
          ref={containerRef}
          {...panResponder.panHandlers}
          style={{ height: Math.max(tasks.length, 1) * SLOT_H + 16, marginHorizontal: 16, marginTop: 8 }}
        >
          {dragIdx !== -1 && (
            <Pressable
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
              onPress={() => endDrag()}
            />
          )}
          {tasks.map((task, idx) => {
            const isDragging = dragIdx === idx;
            const posAnim    = posAnims.current[task.id] ?? new Animated.Value(idx * SLOT_H);
            const translateY = isDragging
              ? (addedAnims.current[task.id] ?? posAnim)
              : posAnim;
            return (
              <Animated.View
                key={task.id}
                style={[sc.absItem, { top: 0, zIndex: isDragging ? 100 : 1, transform: [{ translateY }] }]}
              >
                <TaskRow
                  task={task}
                  isDragging={isDragging}
                  dimValue={isDragging ? ZERO_ANIM : (dragIdx !== -1 ? new Animated.Value(1) : ZERO_ANIM)}
                  onPress={() => { setEmojiAnchor(null); setEpicAnchor(null); setDetailTask(task); }}
                  onLongPress={() => startDrag(idx)}
                  onEmojiPress={(px, py, w, h) => { setEpicAnchor(null); setEmojiAnchor({ taskId: task.id, x: px, y: py, w, h }); }}
                  onEpicPress={(px, py, w, h)  => { setEmojiAnchor(null); setEpicAnchor({ taskId: task.id, x: px, y: py, w, h }); }}
                  onChecked={() => handleChecked(task.id)}
                  onDelete={() => handleDelete(task.id)}
                  onStartDelete={(dur) => handleStartDelete(task.id, dur)}
                  onSwipeOpen={(close) => { openSwipeRef.current?.(); openSwipeRef.current = close; }}
                  onSwipeClose={() => { openSwipeRef.current = null; }}
                />
              </Animated.View>
            );
          })}
        </View>

        {tasks.length === 0 && (
          <View style={sc.center}>
            <Text style={{ fontSize: 32 }}>🎉</Text>
            <Text style={sc.mutedText}>All done — navigate away and back to reset</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Popovers & detail sheet ───────────────────────────────────────── */}
      <InlineEmojiPicker
        anchor={emojiAnchor}
        emojis={EMOJIS.filter(e => norm(e) !== norm(HIDDEN_EMOJI))}
        currentEmoji={pickerTask?.emoji ?? null}
        onSelect={handleEmojiChange}
        onClose={() => setEmojiAnchor(null)}
      />

      <InlineEpicPicker
        anchor={epicAnchor}
        currentEpic={epicAnchor ? (tasks.find(t => t.id === epicAnchor.taskId)?.epic ?? null) : null}
        onSelect={handleEpicChange}
        onClose={() => setEpicAnchor(null)}
      />

      <DetailSheet
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onEmojiChange={handleEmojiChange}
        onEpicChange={handleEpicChange}
      />
    </View>
  );
}

// ── Styles — exact copies from life/[slug].tsx ────────────────────────────────

// Sheet / popover styles (from `s` in [slug].tsx)
const s = StyleSheet.create({
  overlay:       { flex: 1 },
  overlayCenter: { justifyContent: "center", alignItems: "center" },

  sheet: {
    backgroundColor: "#0b0b0c", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 0, paddingTop: 0,
    position: "absolute", left: 0, right: 0, bottom: 0,
  },
  handle: { width: 38, height: 5, borderRadius: 3, backgroundColor: Colors.border, alignSelf: "center", marginTop: 10, marginBottom: 18 },

  emojiPopover: {
    position: "absolute",
    backgroundColor: Colors.cardBg,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    padding: 10, flexDirection: "row", flexWrap: "nowrap", gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  epicPopover: {
    position: "absolute",
    backgroundColor: "#0b0b0c",
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    padding: 6, gap: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  epicPopRow:  { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  epicPopText: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2, textAlign: "center" },
  emojiPopCell: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: Colors.cardBgElevated,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  emojiPopCellPressed: { borderColor: Colors.primary, backgroundColor: "rgba(224,49,49,0.15)" },
  emojiPopText: { fontSize: 24 },

  dsCard: {
    backgroundColor: "#0b0b0c",
    borderRadius: 22, borderWidth: 1, borderColor: Colors.border,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.55, shadowRadius: 44, elevation: 24,
  },
  dsCardTop:  { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  dsTitleInput: {
    color: Colors.textPrimary, fontSize: 15, fontFamily: "Inter_600SemiBold",
    paddingTop: 10, paddingBottom: 13, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 10,
  },
  dsMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  dsEmojiChip: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.cardBgElevated,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border,
  },
  dsEmojiChipActive: { borderColor: Colors.primary, backgroundColor: "rgba(224,49,49,0.15)" },
  dsEmojiText:  { fontSize: 20 },
  dsEpicChip:   { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  dsEpicText:   { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4 },
  dsDivider:    { height: 1, backgroundColor: Colors.border },
  dsBodyScroll: { flexShrink: 1 },
  dsBodyInner:  { paddingHorizontal: 20, paddingVertical: 18 },
  dsSectionLabel: { color: Colors.textMuted, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1, marginBottom: 10 },
  dsBodyText:       { color: Colors.textSecondary, fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  dsBodyPlaceholder: { color: Colors.textMuted,    fontSize: 15, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  dsActions:    { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  dsCancelBtn:  { flex: 1, paddingVertical: 15, borderRadius: 13, backgroundColor: Colors.cardBgElevated, alignItems: "center" },
  dsCancelTx:   { color: "#ffffff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  dsUpdateBtn:  { flex: 2, paddingVertical: 15, borderRadius: 13, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  dsUpdateTx:   { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});

// Screen styles (from `sc` in [slug].tsx — pixel-perfect copy)
const sc = StyleSheet.create({
  root:      { flex: 1, backgroundColor: "#0b0b0c" },
  center:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 40 },
  mutedText: { color: Colors.textMuted, fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32 },

  gradHeader: {
    paddingHorizontal: 20, paddingBottom: 56,
    backgroundColor: "#0f0f0f",
  },
  gradNav:      { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  gradIconGhost: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  gradTitle: {
    fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff",
    textAlign: "center", marginBottom: 4,
    textShadowColor: "rgba(224,49,49,0.45)",
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24,
  },
  gradSub: { fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: "Inter_400Regular", textAlign: "center" },

  absItem: { position: "absolute", left: 0, right: 0, height: ITEM_H },

  rowOuter: { height: ITEM_H },
  deleteZone: {
    width: 88, height: ITEM_H,
    paddingVertical: 10, paddingHorizontal: 8,
    justifyContent: "center", alignItems: "stretch",
  },
  deleteAction: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  rowWrap: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0f0f0f", borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14, height: ITEM_H,
  },
  rowDragging: {
    backgroundColor: Colors.cardBgElevated,
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 18, elevation: 18,
  },
  emojiBtn:  { minWidth: 36, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  rowEmoji:  { fontSize: 24 },
  rowTitle:  { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_600SemiBold", lineHeight: 21, paddingBottom: 4 },
  checkBtn:  { padding: 10, margin: -6 },
  checkBox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: "#5a5a5a",
    alignItems: "center", justifyContent: "center", backgroundColor: "transparent",
  },
  checkBoxDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  epicPill:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  epicPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2, textAlign: "center" },

  fab: {
    position: "absolute", bottom: 32, right: 20,
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 8,
  },
});
