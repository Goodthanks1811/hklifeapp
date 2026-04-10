import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import { ScreenHeader } from "@/components/ScreenHeader";

// ── Constants ──────────────────────────────────────────────────────────────────
const ITEM_H   = 52;
const ITEM_GAP = 8;
const SLOT_H   = ITEM_H + ITEM_GAP;

const EMOJIS  = ["🔥", "🚆", "🏡", "👀", "💡"];
const EPICS   = ["HK Life", "Enhancement", "IR App", "New App", "General"];

const EPIC_COLOUR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  "Enhancement": { bg: "rgba(64,192,87,0.14)",   border: "rgba(64,192,87,0.40)",   text: "#40C057" },
  "HK Life":     { bg: "rgba(224,49,49,0.14)",   border: "rgba(224,49,49,0.40)",   text: "#E03131" },
  "IR App":      { bg: "rgba(51,154,240,0.14)",  border: "rgba(51,154,240,0.40)",  text: "#339AF0" },
  "General":     { bg: "rgba(134,142,150,0.14)", border: "rgba(134,142,150,0.40)", text: "#868E96" },
  "New App":     { bg: "rgba(250,176,5,0.14)",   border: "rgba(250,176,5,0.40)",   text: "#FAB005" },
};
const EPIC_FALLBACK = { bg: "rgba(134,142,150,0.12)", border: "rgba(134,142,150,0.30)", text: "#868E96" };
function epicColor(epic: string) { return EPIC_COLOUR_MAP[epic] ?? EPIC_FALLBACK; }

const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));
const ZERO_ANIM = new Animated.Value(0);

// ── Types ──────────────────────────────────────────────────────────────────────
interface Task { id: string; title: string; emoji: string; epic: string; notes: string; }

const SEED: Task[] = [
  { id: "1",  emoji: "🔥", title: "Mock life admin section",                                                    epic: "HK Life",     notes: "Create a mock version of the life admin section for UI testing." },
  { id: "2",  emoji: "🔥", title: "Thumbs down in all life sections should optimistically disappear the row",   epic: "HK Life",     notes: "When a user taps thumbs down the row should vanish immediately without waiting for the API." },
  { id: "3",  emoji: "🔥", title: "Concept of Ad hoc training session where all movements appear",              epic: "HK Life",     notes: "" },
  { id: "4",  emoji: "🔥", title: "Calories burned at the bottom of training session",                          epic: "HK Life",     notes: "Show a summary footer with total kcal after the last movement." },
  { id: "5",  emoji: "🔥", title: "New Chisme Section",                                                         epic: "HK Life",     notes: "" },
  { id: "6",  emoji: "🔥", title: "Expense report",                                                             epic: "HK Life",     notes: "Monthly PDF export of tagged expense items." },
  { id: "7",  emoji: "🔥", title: "Combined calendar, psychology and philosophy push notification",              epic: "HK Life",     notes: "Daily digest notification that pulls from all three sources." },
  { id: "8",  emoji: "🔥", title: "Publish now to deploy to permanent server",                                   epic: "HK Life",     notes: "" },
  { id: "9",  emoji: "🔥", title: "Change NRL so not green dot, but warning for tips",                          epic: "HK Life",     notes: "Replace the green presence dot with an amber warning indicator for unpaid tips." },
  { id: "10", emoji: "🔥", title: "Dev options Amazon",                                                          epic: "Enhancement", notes: "Add Amazon-specific settings to the dev options panel." },
  { id: "11", emoji: "🔥", title: "Fast forwards",                                                              epic: "HK Life",     notes: "" },
  { id: "12", emoji: "🚆", title: "Footy icons in ladder",                                                       epic: "HK Life",     notes: "Show team badge icons next to each team in the ladder view." },
  { id: "13", emoji: "🚆", title: "Move Reminder To App",                                                        epic: "HK Life",     notes: "" },
  { id: "14", emoji: "🚆", title: "Trains",                                                                      epic: "HK Life",     notes: "Departure board widget on the home screen." },
];

// ── Inline emoji picker ────────────────────────────────────────────────────────
type Anchor = { taskId: string; x: number; y: number; w: number; h: number };

function InlineEmojiPicker({ anchor, currentEmoji, onSelect, onClose }: {
  anchor:       Anchor | null;
  currentEmoji: string;
  onSelect:     (taskId: string, emoji: string) => void;
  onClose:      () => void;
}) {
  const { width: sw, height: sh } = useWindowDimensions();
  if (!anchor) return null;

  const options = EMOJIS.filter(e => e !== currentEmoji);
  if (!options.length) return null;

  const cellSize = 40;
  const gap      = 6;
  const pad      = 8;
  const popW     = options.length * cellSize + (options.length - 1) * gap + pad * 2;
  const popH     = cellSize + pad * 2;

  const rightX = anchor.x + anchor.w + 6;
  const leftX  = Math.min(rightX + popW > sw ? anchor.x - popW - 6 : rightX, sw - popW - 8);
  const topY   = Math.min(Math.max(8, anchor.y + anchor.h / 2 - popH / 2), sh - popH - 20);

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[ls.emojiPopover, { top: topY, left: leftX, width: popW }]}>
        {options.map(e => (
          <Pressable
            key={e}
            style={({ pressed }) => [ls.emojiPopCell, pressed && ls.emojiPopCellPressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(anchor.taskId, e);
              onClose();
            }}
          >
            <Text style={ls.emojiPopText}>{e}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

// ── Inline epic picker ─────────────────────────────────────────────────────────
function InlineEpicPicker({ anchor, currentEpic, onSelect, onClose }: {
  anchor:      Anchor | null;
  currentEpic: string;
  onSelect:    (taskId: string, epic: string) => void;
  onClose:     () => void;
}) {
  const { width: sw, height: sh } = useWindowDimensions();
  if (!anchor) return null;

  const rowH = 34;
  const pad  = 6;
  const gap  = 5;
  const popW = 170;
  const popH = EPICS.length * rowH + (EPICS.length - 1) * gap + pad * 2;

  const leftX = Math.max(4, anchor.x - popW - 6);
  const topY  = Math.min(anchor.y - 4, sh - popH - 20);

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[ls.epicPopover, { top: topY, left: leftX, width: popW }]}>
        {EPICS.map(ep => {
          const ec       = epicColor(ep);
          const selected = ep === currentEpic;
          return (
            <Pressable
              key={ep}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(anchor.taskId, ep);
                onClose();
              }}
              style={[ls.epicPopRow, { backgroundColor: ec.bg, borderColor: ec.border, opacity: selected ? 0.5 : 1 }]}
            >
              <Text style={[ls.epicPopText, { color: ec.text }]}>{ep}</Text>
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

// ── Detail sheet ───────────────────────────────────────────────────────────────
function DetailSheet({ task, onClose, onEmojiChange, onEpicChange }: {
  task:          Task | null;
  onClose:       () => void;
  onEmojiChange: (id: string, emoji: string) => void;
  onEpicChange:  (id: string, epic: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const isTablet = screenW >= 768;

  const slideAnim = useRef(new Animated.Value(600)).current;
  const scaleAnim = useRef(new Animated.Value(0.93)).current;
  const bgAnim    = useRef(new Animated.Value(0)).current;
  const kbAnim    = useRef(new Animated.Value(0)).current;

  const visible = !!task;

  // Keyboard avoidance
  useEffect(() => {
    const onShow = (e: any) => Animated.timing(kbAnim, { toValue: e.endCoordinates.height, duration: e.duration || 250, useNativeDriver: false }).start();
    const onHide = (e: any) => Animated.timing(kbAnim, { toValue: 0, duration: e.duration || 200, useNativeDriver: false }).start();
    const s1 = Keyboard.addListener("keyboardWillShow", onShow);
    const s2 = Keyboard.addListener("keyboardWillHide", onHide);
    const s3 = Keyboard.addListener("keyboardDidShow",  onShow);
    const s4 = Keyboard.addListener("keyboardDidHide",  onHide);
    return () => { s1.remove(); s2.remove(); s3.remove(); s4.remove(); };
  }, [kbAnim]);

  // Open / close animation
  useEffect(() => {
    if (visible) {
      slideAnim.setValue(500);
      if (isTablet) {
        Animated.parallel([
          Animated.timing(scaleAnim, { toValue: 1,   duration: 220, useNativeDriver: false, easing: Easing.out(Easing.back(1.2)) }),
          Animated.timing(bgAnim,    { toValue: 1,   duration: 200, useNativeDriver: false }),
        ]).start();
      } else {
        Animated.timing(slideAnim, { toValue: 0,   duration: 280, useNativeDriver: true, easing: Easing.bezier(0.25, 1, 0.5, 1) }).start();
        Animated.timing(bgAnim,    { toValue: 1,   duration: 200, useNativeDriver: false }).start();
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

  if (!task && !visible) return null;

  const bg = bgAnim.interpolate({ inputRange: [0, 1], outputRange: ["rgba(0,0,0,0)", "rgba(0,0,0,0.65)"] });

  const maxCardH = screenH * 0.88;
  const cardW    = Math.min(560, screenW * 0.92);

  const ec = epicColor(task?.epic ?? "");

  return (
    <Modal transparent visible={!!task} animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[ls.overlay, isTablet && ls.overlayCenter, { backgroundColor: bg }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        {isTablet ? (
          <Animated.View style={[ls.dsCard, { width: cardW, maxHeight: maxCardH, marginBottom: kbAnim, transform: [{ scale: scaleAnim }], opacity: bgAnim }]}>
            <SheetBody
              task={task}
              onClose={handleClose}
              onEmojiChange={onEmojiChange}
              onEpicChange={onEpicChange}
              insetBottom={insets.bottom}
              isTablet
            />
          </Animated.View>
        ) : (
          <Animated.View style={{ flex: 1, transform: [{ translateY: slideAnim }] }} pointerEvents="box-none">
            <Animated.View style={[ls.sheet, {
              paddingBottom: Math.max(insets.bottom + 16, 28),
              maxHeight: Animated.subtract(screenH - insets.top - 16, kbAnim),
            }]}>
              <SheetBody
                task={task}
                onClose={handleClose}
                onEmojiChange={onEmojiChange}
                onEpicChange={onEpicChange}
                insetBottom={0}
                isTablet={false}
              />
            </Animated.View>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

function SheetBody({ task, onClose, onEmojiChange, onEpicChange, insetBottom, isTablet }: {
  task: Task | null;
  onClose: () => void;
  onEmojiChange: (id: string, emoji: string) => void;
  onEpicChange:  (id: string, epic: string) => void;
  insetBottom: number;
  isTablet: boolean;
}) {
  if (!task) return null;
  const ec = epicColor(task.epic);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, paddingBottom: insetBottom + 20, gap: 20 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {!isTablet && <View style={ls.modalHandle} />}

      {/* Header */}
      <View style={ls.dsHeader}>
        <Pressable
          onPress={() => {
            const next = EMOJIS[(EMOJIS.indexOf(task.emoji) + 1) % EMOJIS.length];
            onEmojiChange(task.id, next);
          }}
          style={ls.dsEmojiBtn}
          hitSlop={6}
        >
          <Text style={{ fontSize: 26 }}>{task.emoji}</Text>
        </Pressable>
        <Text style={ls.dsTitle} numberOfLines={3}>{task.title}</Text>
        <Pressable onPress={onClose} style={ls.dsCloseBtn}>
          <Feather name="x" size={16} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {/* Epic pill row */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Text style={ls.dsLabel}>EPIC</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {EPICS.map(ep => {
            const ec2  = epicColor(ep);
            const isSel = ep === task.epic;
            return (
              <Pressable
                key={ep}
                onPress={() => onEpicChange(task.id, ep)}
                style={[ls.epicChip, { backgroundColor: ec2.bg, borderColor: isSel ? ec2.border : "transparent", borderWidth: 1.5 }]}
              >
                <Text style={[ls.epicChipText, { color: ec2.text }]}>{ep}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Stubbed notes */}
      <View style={{ gap: 6 }}>
        <Text style={ls.dsLabel}>NOTES</Text>
        <View style={ls.dsNotesBox}>
          <Text style={ls.dsNotesText}>
            {task.notes || "No notes yet. Tap to add…"}
          </Text>
        </View>
      </View>

      {/* Emoji picker row */}
      <View style={{ gap: 6 }}>
        <Text style={ls.dsLabel}>EMOJI</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {EMOJIS.map(e => (
            <Pressable
              key={e}
              onPress={() => onEmojiChange(task.id, e)}
              style={[ls.dsEmojiOption, task.emoji === e && ls.dsEmojiOptionActive]}
            >
              <Text style={{ fontSize: 20 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Close button */}
      <Pressable onPress={onClose} style={ls.dsDoneBtn}>
        <Text style={ls.dsDoneBtnText}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── Task row ───────────────────────────────────────────────────────────────────
function TaskRow({ task, isDragging, dimValue, onEmojiPress, onEpicPress, onPress, onLongPress, onDelete, onStartDelete, onSwipeOpen, onSwipeClose }: {
  task:           Task;
  isDragging:     boolean;
  dimValue:       Animated.Value;
  onEmojiPress:   (pageX: number, pageY: number, w: number, h: number) => void;
  onEpicPress:    (pageX: number, pageY: number, w: number, h: number) => void;
  onPress:        () => void;
  onLongPress:    () => void;
  onDelete:       () => void;
  onStartDelete?: (dur: number) => void;
  onSwipeOpen?:   (close: () => void) => void;
  onSwipeClose?:  () => void;
}) {
  const swipeableRef  = useRef<Swipeable>(null);
  const emojiBtnRef   = useRef<View>(null);
  const epicPillRef   = useRef<View>(null);
  const opacityAnim   = useRef(new Animated.Value(1)).current;
  const rowHeight     = useRef(new Animated.Value(ITEM_H)).current;
  const pressOverlay  = useRef(new Animated.Value(0)).current;
  const deletingRef   = useRef(false);
  const isRevealedRef = useRef(false);
  const checkScale    = useRef(new Animated.Value(0)).current;
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
      ]).start(() => onDelete());
    }, 320);
  }, [checked, onDelete, onStartDelete]);

  const handleRowTap = (action: () => void) => {
    if (isRevealedRef.current) { swipeableRef.current?.close(); }
    else { action(); }
  };

  const combinedOpacity = Animated.multiply(
    opacityAnim,
    dimValue.interpolate({ inputRange: [0, 1], outputRange: [1, 0.22] })
  );

  const ec = epicColor(task.epic);
  const checkTick = checkScale.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

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
        containerStyle={{ borderRadius: 14, overflow: "hidden" }}
      >
        <Animated.View style={[sc.rowWrap, isDragging && sc.rowDragging]}>

          {/* Emoji button */}
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
            <Text style={sc.rowEmoji}>{task.emoji}</Text>
          </Pressable>

          {/* Title — fills full row height */}
          <Pressable
            style={{ flex: 1, alignSelf: "stretch", justifyContent: "center" }}
            onPress={() => { onPressOut(); handleRowTap(onPress); }}
            onLongPress={onLongPress}
            delayLongPress={200}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
          >
            <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 14, backgroundColor: Colors.cardBgElevated, opacity: pressOverlay }]} pointerEvents="none" />
            <Text style={sc.rowTitle} numberOfLines={2}>{task.title}</Text>
          </Pressable>

          {/* Epic pill */}
          <Pressable
            ref={epicPillRef as any}
            onPress={() => handleRowTap(() => {
              (epicPillRef.current as any)?.measure((_fx: number, _fy: number, w: number, h: number, px: number, py: number) => {
                onEpicPress(px, py, w, h);
              });
            })}
            style={[sc.epicPill, { backgroundColor: ec.bg, borderColor: ec.border }]}
          >
            <Text style={[sc.epicText, { color: ec.text }]}>{task.epic}</Text>
          </Pressable>

          {/* Checkbox */}
          <Pressable onPress={handleCheck} style={sc.checkBtn} hitSlop={8}>
            <Animated.View style={[sc.checkBox, checked && sc.checkBoxDone, { transform: [{ scale: checkTick }] }]}>
              {checked && <Feather name="check" size={13} color="#fff" />}
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Swipeable>
    </Animated.View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function LifeListScreen() {
  const insets = useSafeAreaInsets();

  const [tasks, setTasks] = useState<Task[]>(() => SEED.map(t => ({ ...t })));

  // Reset to initial data every time the screen is focused
  useFocusEffect(useCallback(() => {
    setTasks(SEED.map(t => ({ ...t })));
    setSelectedTask(null);
    setEmojiAnchor(null);
    setEpicAnchor(null);
  }, []));

  // ── Popovers ────────────────────────────────────────────────────────────────
  const [emojiAnchor, setEmojiAnchor] = useState<Anchor | null>(null);
  const [epicAnchor,  setEpicAnchor]  = useState<Anchor | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const closeAllPopovers = useCallback(() => {
    setEmojiAnchor(null);
    setEpicAnchor(null);
  }, []);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const handleEmojiChange = useCallback((taskId: string, emoji: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, emoji } : t));
    setSelectedTask(prev => prev?.id === taskId ? { ...prev, emoji } : prev);
  }, []);

  const handleEpicChange = useCallback((taskId: string, epic: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, epic } : t));
    setSelectedTask(prev => prev?.id === taskId ? { ...prev, epic } : prev);
  }, []);

  const handleDelete = useCallback((taskId: string) => {
    setTasks(prev => {
      const next = prev.filter(t => t.id !== taskId);
      posAnims.current = Object.fromEntries(
        next.map((t, i) => [t.id, posAnims.current[t.id] ?? new Animated.Value(i * SLOT_H)])
      );
      return next;
    });
  }, []);

  // ── Drag/reorder ─────────────────────────────────────────────────────────────
  const posAnims     = useRef<Record<string, Animated.Value>>({});
  const tasksRef     = useRef<Task[]>(tasks);
  tasksRef.current   = tasks;

  const isDraggingRef   = useRef(false);
  const dragIndexRef    = useRef(-1);
  const hoverIndexRef   = useRef(-1);
  const dragYRef        = useRef(0);
  const dragStartRef    = useRef(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const openSwipeRef    = useRef<(() => void) | null>(null);

  // Init posAnims for any new task
  useFocusEffect(useCallback(() => {
    tasks.forEach((t, i) => {
      if (!posAnims.current[t.id]) posAnims.current[t.id] = new Animated.Value(i * SLOT_H);
      else posAnims.current[t.id].setValue(i * SLOT_H);
    });
  }, []));

  // Also init posAnims when tasks change (e.g. delete)
  useEffect(() => {
    tasks.forEach((t, i) => {
      if (!posAnims.current[t.id]) posAnims.current[t.id] = new Animated.Value(i * SLOT_H);
    });
  }, [tasks]);

  const shiftOthers = useCallback((fromIdx: number, hoverIdx: number) => {
    const current = tasksRef.current;
    current.forEach((t, i) => {
      if (i === fromIdx) return;
      let target = i;
      if (fromIdx < hoverIdx && i > fromIdx && i <= hoverIdx) target = i - 1;
      if (fromIdx > hoverIdx && i >= hoverIdx && i < fromIdx) target = i + 1;
      const anim = posAnims.current[t.id];
      if (anim) Animated.timing(anim, { toValue: target * SLOT_H, duration: 110, useNativeDriver: true, easing: Easing.out(Easing.quad) }).start();
    });
  }, []);

  const endDrag = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const from  = dragIndexRef.current;
    const hover = hoverIndexRef.current;
    dragIndexRef.current  = -1;
    hoverIndexRef.current = -1;
    setDraggingId(null);

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
  }, []);

  const startDrag = useCallback((index: number) => {
    if (isDraggingRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    openSwipeRef.current?.();
    openSwipeRef.current = null;

    isDraggingRef.current = true;
    dragIndexRef.current  = index;
    hoverIndexRef.current = index;
    dragStartRef.current  = index * SLOT_H;
    dragYRef.current      = index * SLOT_H;
    setDraggingId(tasksRef.current[index]?.id ?? null);
  }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => isDraggingRef.current,
    onPanResponderMove: (_, gs) => {
      if (!isDraggingRef.current) return;
      const rawY   = dragStartRef.current + gs.dy;
      const len    = tasksRef.current.length;
      dragYRef.current = clamp(0, rawY, (len - 1) * SLOT_H);

      const anim = posAnims.current[tasksRef.current[dragIndexRef.current]?.id];
      if (anim) anim.setValue(dragYRef.current);

      const newHover = clamp(0, len - 1, Math.floor((dragYRef.current + SLOT_H / 2) / SLOT_H));
      if (newHover !== hoverIndexRef.current) {
        const prev = hoverIndexRef.current;
        hoverIndexRef.current = newHover;
        Haptics.selectionAsync();
        shiftOthers(dragIndexRef.current, newHover);
      }
    },
    onPanResponderEnd:       () => endDrag(),
    onPanResponderTerminate: () => endDrag(),
  }), [endDrag, shiftOthers]);

  const totalH = tasks.length * SLOT_H;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.darkBg }}>
      <ScreenHeader title="Life List Demo" subtitle="Swipe · Hold · Drag · Emoji · Modal" />

      {/* Demo hint banner */}
      <View style={ls.hintBanner}>
        <View style={ls.hintItem}><Text style={ls.hintIcon}>👈</Text><Text style={ls.hintText}>Swipe left</Text></View>
        <View style={ls.hintItem}><Text style={ls.hintIcon}>⏱</Text><Text style={ls.hintText}>Hold to drag</Text></View>
        <View style={ls.hintItem}><Text style={ls.hintIcon}>😀</Text><Text style={ls.hintText}>Tap emoji</Text></View>
        <View style={ls.hintItem}><Text style={ls.hintIcon}>📄</Text><Text style={ls.hintText}>Tap row</Text></View>
        <View style={ls.hintItem}><Text style={ls.hintIcon}>☑️</Text><Text style={ls.hintText}>Checkmark</Text></View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        scrollEnabled={!draggingId}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ height: totalH + 16, marginHorizontal: 16, marginTop: 8 }} {...panResponder.panHandlers}>
          {tasks.map((task, idx) => {
            const posAnim   = posAnims.current[task.id] ?? new Animated.Value(idx * SLOT_H);
            const isDragging = task.id === draggingId;
            const dimValue  = isDragging ? ZERO_ANIM : (draggingId ? new Animated.Value(1) : ZERO_ANIM);

            return (
              <Animated.View
                key={task.id}
                style={[
                  sc.absRow,
                  { transform: [{ translateY: posAnim }], zIndex: isDragging ? 99 : 1 },
                ]}
              >
                <TaskRow
                  task={task}
                  isDragging={isDragging}
                  dimValue={dimValue}
                  onPress={() => {
                    closeAllPopovers();
                    setSelectedTask(task);
                  }}
                  onLongPress={() => startDrag(idx)}
                  onEmojiPress={(px, py, w, h) => {
                    setEpicAnchor(null);
                    setEmojiAnchor({ taskId: task.id, x: px, y: py, w, h });
                  }}
                  onEpicPress={(px, py, w, h) => {
                    setEmojiAnchor(null);
                    setEpicAnchor({ taskId: task.id, x: px, y: py, w, h });
                  }}
                  onDelete={() => handleDelete(task.id)}
                  onStartDelete={(dur) => {
                    const dragIdx = tasksRef.current.findIndex(t => t.id === task.id);
                    if (dragIdx === -1) return;
                    tasksRef.current.forEach((t, i) => {
                      if (i <= dragIdx) return;
                      const a = posAnims.current[t.id];
                      if (a) Animated.timing(a, { toValue: (i - 1) * SLOT_H, duration: dur, useNativeDriver: true, easing: Easing.out(Easing.quad) }).start();
                    });
                  }}
                  onSwipeOpen={(close) => {
                    openSwipeRef.current?.();
                    openSwipeRef.current = close;
                  }}
                  onSwipeClose={() => { if (openSwipeRef.current) openSwipeRef.current = null; }}
                />
              </Animated.View>
            );
          })}
        </View>

        {tasks.length === 0 && (
          <View style={ls.emptyState}>
            <Text style={{ fontSize: 36 }}>🎉</Text>
            <Text style={ls.emptyText}>All tasks complete! Navigate away and back to reset.</Text>
          </View>
        )}
      </ScrollView>

      {/* Emoji picker popover */}
      <InlineEmojiPicker
        anchor={emojiAnchor}
        currentEmoji={emojiAnchor ? (tasks.find(t => t.id === emojiAnchor.taskId)?.emoji ?? "") : ""}
        onSelect={handleEmojiChange}
        onClose={() => setEmojiAnchor(null)}
      />

      {/* Epic picker popover */}
      <InlineEpicPicker
        anchor={epicAnchor}
        currentEpic={epicAnchor ? (tasks.find(t => t.id === epicAnchor.taskId)?.epic ?? "") : ""}
        onSelect={handleEpicChange}
        onClose={() => setEpicAnchor(null)}
      />

      {/* Detail sheet */}
      <DetailSheet
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onEmojiChange={handleEmojiChange}
        onEpicChange={handleEpicChange}
      />
    </View>
  );
}

// ── Row styles ─────────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  absRow: {
    position: "absolute",
    left: 0,
    right: 0,
    height: ITEM_H,
  },
  rowOuter: {
    overflow: "hidden",
    marginBottom: ITEM_GAP,
    borderRadius: 14,
  },
  rowWrap: {
    height: ITEM_H,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    gap: 8,
  },
  rowDragging: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    backgroundColor: Colors.cardBgElevated,
  },
  emojiBtn: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  rowEmoji: {
    fontSize: 18,
  },
  rowTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  epicPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  epicText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  checkBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxDone: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  deleteZone: {
    width: 72,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteAction: {
    width: 64,
    height: ITEM_H,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ── Screen / sheet styles ──────────────────────────────────────────────────────
const ls = StyleSheet.create({
  hintBanner: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  hintItem: {
    alignItems: "center",
    gap: 2,
  },
  hintIcon: {
    fontSize: 16,
  },
  hintText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontFamily: "Inter_500Medium",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  // ── Emoji popover
  emojiPopover: {
    position: "absolute",
    flexDirection: "row",
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 8,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  emojiPopCell: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.cardBgElevated,
  },
  emojiPopCellPressed: {
    backgroundColor: Colors.border,
  },
  emojiPopText: {
    fontSize: 20,
  },
  // ── Epic popover
  epicPopover: {
    position: "absolute",
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 6,
    gap: 5,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  epicPopRow: {
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },
  epicPopText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  // ── Detail sheet
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlayCenter: {
    justifyContent: "center",
    alignItems: "center",
  },
  sheet: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  dsCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 4,
  },
  dsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  dsEmojiBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.cardBgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dsTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 22,
    paddingTop: 4,
  },
  dsCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.cardBgElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dsLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  epicChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  epicChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  dsNotesBox: {
    backgroundColor: Colors.darkBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 80,
  },
  dsNotesText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  dsEmojiOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.cardBgElevated,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  dsEmojiOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(224,49,49,0.12)",
  },
  dsDoneBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: Colors.primary,
    marginTop: 4,
  },
  dsDoneBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
