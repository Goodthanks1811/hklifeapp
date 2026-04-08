import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
  Animated,
  Dimensions,
  Easing,
  GestureResponderEvent,
  Keyboard,
  KeyboardAvoidingView,
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
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useDrawer } from "@/context/DrawerContext";
import { useNotion } from "@/context/NotionContext";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

const SCREEN_H = Dimensions.get("window").height;

// ── Layout constants (exact match to life section) ────────────────────────────
const ITEM_H    = 48;
const ITEM_GAP  = 8;
const SLOT_H    = ITEM_H + ITEM_GAP;
const ZERO_ANIM = new Animated.Value(0);

// life screen signature: (min, v, max) → max(min, min(max, v))
const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));

// ── Types ─────────────────────────────────────────────────────────────────────
interface Exercise {
  id:       string;
  name:     string;
  setup:    string;
  bodyPart: string;
}

interface LoggedSet {
  reps:    string;
  weight:  string;
  checked: boolean;          // per-set completion checkbox
}

interface TodayExercise extends Exercise {
  localId: string;
  sets:    LoggedSet[];
  notes:   string;
  done:    boolean;
}

function dayLabel(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

// ── Set Logger bottom sheet ───────────────────────────────────────────────────
function SetLoggerSheet({
  exercise,
  bodyPart,
  onClose,
  onSave,
}: {
  exercise: TodayExercise | null;
  bodyPart: string;
  onClose:  () => void;
  onSave:   (localId: string, sets: LoggedSet[], notes: string, setup: string) => void;
}) {
  const insets    = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(800)).current;
  const bgAnim    = useRef(new Animated.Value(0)).current;
  const [sets,  setSets]  = useState<LoggedSet[]>([]);
  const [notes, setNotes] = useState("");
  const [setup, setSetup] = useState("");
  const visible    = !!exercise;
  const swipingOut = useRef(false);
  const dismissRef = useRef<() => void>(() => {});
  // Track keyboard height so ScrollView shrinks and buttons stay pinned
  const [kbH, setKbH] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", e => setKbH(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKbH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  // Cap ScrollView so handle + scrollview + buttons always fits on screen
  const scrollMaxH = Math.min(SCREEN_H * 0.55, SCREEN_H - kbH - 200);

  useEffect(() => {
    if (visible && exercise) {
      const init = exercise.sets.length > 0
        ? exercise.sets.map(s => ({ ...s, checked: s.checked ?? false }))
        : [{ reps: "", weight: "", checked: false }];
      setSets(init);
      setNotes(exercise.notes || "");
      setSetup(exercise.setup || "");
    }
  }, [visible, exercise?.localId]);

  useEffect(() => {
    if (visible) {
      swipingOut.current = false;
      slideAnim.setValue(800);   // reset off-screen before springing in
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 85, friction: 14 }).start();
      Animated.timing(bgAnim, { toValue: 1, duration: 220, useNativeDriver: false }).start();
    } else if (!swipingOut.current) {
      // Normal close (Done button etc.) — slide out
      Animated.timing(slideAnim, { toValue: 800, duration: 240, useNativeDriver: true, easing: Easing.in(Easing.quad) }).start();
      Animated.timing(bgAnim,    { toValue: 0,   duration: 190, useNativeDriver: false }).start();
    } else {
      // Closed via swipe — sheet already off-screen, just fade overlay
      Animated.timing(bgAnim, { toValue: 0, duration: 190, useNativeDriver: false }).start();
    }
  }, [visible]);

  const dismiss = useCallback(() => {
    Keyboard.dismiss();
    if (exercise) onSave(exercise.localId, sets, notes, setup);
    onClose();
  }, [exercise, sets, notes, setup, onSave, onClose]);

  // Keep ref fresh so handlePan never has stale closure
  dismissRef.current = dismiss;

  // Pan responder on the drag handle — modifies slideAnim directly (no Animated.add)
  const handlePan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      // Stop any in-progress spring so drag feels responsive
      slideAnim.stopAnimation();
    },
    onPanResponderMove: (_, gs) => {
      if (gs.dy > 0) slideAnim.setValue(gs.dy);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 80 || gs.vy > 0.8) {
        // Fly off-screen then close
        swipingOut.current = true;
        Animated.timing(slideAnim, {
          toValue: SCREEN_H, duration: 200, useNativeDriver: true,
          easing: Easing.in(Easing.quad),
        }).start(() => dismissRef.current());
      } else {
        // Snap back into place
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 120, friction: 14 }).start();
      }
    },
  }), [slideAnim]);

  // Refs for each set's reps input — lets us auto-focus after Add Set
  const repsRefs = useRef<Array<TextInput | null>>([]);

  const addSet = () => {
    setSets(prev => {
      const next = [...prev, { reps: "", weight: "", checked: false }];
      // Focus the new reps field after React renders the new row
      setTimeout(() => repsRefs.current[next.length - 1]?.focus(), 50);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removeSet = (i: number) => {
    if (sets.length <= 1) return;
    setSets(prev => prev.filter((_, idx) => idx !== i));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const updateSet = (i: number, field: "reps" | "weight", val: string) => {
    setSets(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  };

  const toggleSetCheck = (i: number) => {
    setSets(prev => prev.map((s, idx) => idx === i ? { ...s, checked: !s.checked } : s));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const bg = bgAnim.interpolate({ inputRange: [0, 1], outputRange: ["rgba(0,0,0,0)", "rgba(0,0,0,0.88)"] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      {/* Dim overlay — no pointer events so touches fall through to sheet or dismiss */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} pointerEvents="none" />

      {/* KAV fills the full screen, pushes content up when keyboard appears */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={StyleSheet.absoluteFill}
        pointerEvents="box-none"
      >
        {/* Flex spacer — tapping here dismisses */}
        <Pressable style={{ flex: 1 }} onPress={dismiss} />

        {/* Sheet — slides in from bottom */}
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          {/* Pressable wrapper blocks dismiss from firing when tapping sheet content */}
          <Pressable onPress={() => {}} style={sh.sheet}>

            {/* Handle — drag here to swipe-down-dismiss */}
            <View style={sh.handle} {...handlePan.panHandlers} />

            {/* ALL content scrolls — header, sets, notes.
                Using maxHeight (not flex:1) so the ScrollView has a known size. */}
            <ScrollView
              style={{ maxHeight: scrollMaxH }}
              bounces={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              {/* ── Header ───────────────────────── */}
              <Text style={sh.contextLabel}>{bodyPart.toUpperCase()} · EXERCISE NOTES</Text>
              <Text style={sh.exerciseTitle} numberOfLines={2}>{exercise?.name}</Text>

              <TextInput
                style={sh.setupInput}
                value={setup}
                onChangeText={setSetup}
                multiline
                placeholder="Setup notes…"
                placeholderTextColor="#444"
                selectionColor={Colors.primary}
                keyboardAppearance="dark"
                textAlignVertical="top"
              />

              <View style={sh.divider} />

              {/* ── Sets ─────────────────────────── */}
              <View style={sh.colHeaderRow}>
                <View style={{ width: 60 }} />
                <Text style={sh.colHeader}>REPS</Text>
                <Text style={sh.colHeader}>KG</Text>
              </View>

              {sets.map((s, i) => (
                <View key={i} style={sh.setRow}>
                  <Text style={sh.setLabel}>Set {i + 1}</Text>
                  <TextInput
                    ref={el => { repsRefs.current[i] = el; }}
                    style={sh.setInput}
                    value={s.reps}
                    onChangeText={v => updateSet(i, "reps", v)}
                    keyboardType="numeric"
                    placeholder="—"
                    placeholderTextColor="#444"
                    selectionColor={Colors.primary}
                    keyboardAppearance="dark"
                    textAlign="center"
                  />
                  <TextInput
                    style={sh.setInput}
                    value={s.weight}
                    onChangeText={v => updateSet(i, "weight", v)}
                    keyboardType="numeric"
                    placeholder="—"
                    placeholderTextColor="#444"
                    selectionColor={Colors.primary}
                    keyboardAppearance="dark"
                    textAlign="center"
                  />
                  {/* Spacer pushes checkbox to right */}
                  <View style={{ flex: 1 }} />
                  {/* Per-set completion checkbox — right-aligned */}
                  <Pressable onPress={() => toggleSetCheck(i)} hitSlop={12} style={sh.setCheckBtn}>
                    <View style={[sh.setCheckBox, s.checked && sh.setCheckBoxDone]}>
                      {s.checked && <Feather name="check" size={10} color="#fff" />}
                    </View>
                  </Pressable>
                </View>
              ))}

              <View style={sh.divider} />

              {/* ── Notes ────────────────────────── */}
              <Text style={sh.notesLabel}>NOTES</Text>
              <TextInput
                style={sh.notesInput}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Anything from today…"
                placeholderTextColor="#444"
                selectionColor={Colors.primary}
                keyboardAppearance="dark"
                textAlignVertical="top"
              />
            </ScrollView>

            {/* Buttons — pinned BELOW ScrollView, always visible above keyboard */}
            <View style={sh.divider} />
            <View style={[sh.bottomRow, { paddingBottom: kbH > 0 ? 6 : Math.max(insets.bottom, 12) }]}>
              <TouchableOpacity style={sh.addSetBtn} onPress={addSet} activeOpacity={0.75}>
                <Feather name="plus" size={15} color={Colors.primary} />
                <Text style={sh.addSetTx}>Add Set</Text>
              </TouchableOpacity>
              <TouchableOpacity style={sh.doneBtn} onPress={dismiss} activeOpacity={0.82}>
                <Text style={sh.doneTx}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>

          {/* Background extension — covers the gap between sheet and keyboard edge */}
          <View style={{ backgroundColor: "#111111", height: 60 }} />
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Spinner loader ─────────────────────────────────────────────────────────────
function ListLoader() {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(rot, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, []);
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <View style={sc.center}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 4, borderColor: Colors.primary, borderTopColor: "rgba(224,49,49,0.15)" }} />
      </Animated.View>
    </View>
  );
}

// ── TodayRow — EXACT life-section pattern ─────────────────────────────────────
function TodayRow({
  exercise,
  isDragging,
  dimValue,
  onPress,
  onLongPress,
  onChecked,
  onRemove,
  onStartRemove,
  onSwipeOpen,
  onSwipeClose,
}: {
  exercise:      TodayExercise;
  isDragging:    boolean;
  dimValue:      Animated.Value;
  onPress:       () => void;
  onLongPress:   () => void;
  onChecked:     (done: boolean) => void;   // now toggleable
  onRemove:      () => void;
  onStartRemove: (dur: number) => void;
  onSwipeOpen:   (close: () => void) => void;
  onSwipeClose:  () => void;
}) {
  const swipeableRef  = useRef<Swipeable>(null);
  const checkScale    = useRef(new Animated.Value(exercise.done ? 1 : 0)).current;
  const opacityAnim   = useRef(new Animated.Value(1)).current;
  const rowHeight     = useRef(new Animated.Value(ITEM_H)).current;
  const pressOverlay  = useRef(new Animated.Value(0)).current;
  const deletingRef   = useRef(false);
  const isRevealedRef = useRef(false);

  // Sync check animation when exercise.done changes externally (e.g. uncheck from parent)
  useEffect(() => {
    Animated.spring(checkScale, { toValue: exercise.done ? 1 : 0, useNativeDriver: false, tension: 240, friction: 8 }).start();
  }, [exercise.done]);

  const onPressIn  = useCallback(() => Animated.timing(pressOverlay, { toValue: 0.28, duration: 60,  useNativeDriver: true }).start(), [pressOverlay]);
  const onPressOut = useCallback(() => Animated.timing(pressOverlay, { toValue: 0,    duration: 130, useNativeDriver: true }).start(), [pressOverlay]);

  const triggerRemove = useCallback(() => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    swipeableRef.current?.close();
    onStartRemove(260);
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 220, useNativeDriver: false }),
      Animated.timing(rowHeight,   { toValue: 0, duration: 260, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
    ]).start(() => onRemove());
  }, [onRemove, onStartRemove]);

  // Toggle: check AND uncheck
  const handleCheck = useCallback(() => {
    const newDone = !exercise.done;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChecked(newDone);
  }, [exercise.done, onChecked]);

  const handleRowTap = (action: () => void) => {
    if (isRevealedRef.current) { swipeableRef.current?.close(); }
    else { action(); }
  };

  const combinedOpacity = Animated.multiply(
    opacityAnim,
    dimValue.interpolate({ inputRange: [0, 1], outputRange: [1, 0.22] }),
  );

  const renderRightActions = useCallback(() => (
    <Pressable style={sc.deleteAction} onPress={triggerRemove}>
      <Feather name="trash-2" size={18} color="#fff" />
    </Pressable>
  ), [triggerRemove]);

  const setCount = exercise.sets.filter(s => s.reps || s.weight).length;

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
        onSwipeableWillOpen={() => pressOverlay.setValue(0)}
        onSwipeableOpen={() => { isRevealedRef.current = true; onSwipeOpen(() => swipeableRef.current?.close()); }}
        onSwipeableClose={() => { isRevealedRef.current = false; onSwipeClose(); }}
        containerStyle={{ borderRadius: 10, overflow: "hidden" }}
      >
        <Animated.View style={[sc.rowWrap, isDragging && sc.rowDragging, exercise.done && sc.rowWrapDone]}>
          <Pressable
            style={{ flex: 1, alignSelf: "stretch", justifyContent: "center" }}
            onPress={() => { onPressOut(); handleRowTap(onPress); }}
            onLongPress={onLongPress}
            delayLongPress={200}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
          >
            <Text
              style={[sc.rowTitle, exercise.done && sc.rowTitleDone]}
              numberOfLines={1}
            >
              {exercise.name}
            </Text>
          </Pressable>

          {setCount > 0 && (
            <View style={sc.setBadge}>
              <Text style={sc.setBadgeTx}>{setCount} {setCount === 1 ? "set" : "sets"}</Text>
            </View>
          )}

          {/* Toggle-able checkbox */}
          <Pressable onPress={() => handleRowTap(handleCheck)} hitSlop={8} style={sc.checkBtn}>
            <Animated.View style={[sc.checkBox, exercise.done && sc.checkBoxDone]}>
              <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                <Feather name="check" size={12} color="#fff" />
              </Animated.View>
            </Animated.View>
          </Pressable>

          <Animated.View
            pointerEvents="none"
            style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "#000", borderRadius: 10, opacity: pressOverlay }}
          />
        </Animated.View>
      </Swipeable>
    </Animated.View>
  );
}

// ── BaseRow — All Exercises (tap moves to today, long-press cross-drag) ───────
function BaseRow({
  exercise,
  onMoveToToday,
  onCrossDragStart,
  onCrossDragMove,
  onCrossDragEnd,
}: {
  exercise:         Exercise;
  onMoveToToday:    () => void;
  onCrossDragStart: (exercise: Exercise, y: number) => void;
  onCrossDragMove:  (y: number) => void;
  onCrossDragEnd:   (y: number) => void;
}) {
  const isCrossDraggingRef = useRef(false);
  const pressOverlay = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder:        () => false,
    onMoveShouldSetPanResponder:         () => isCrossDraggingRef.current,
    onMoveShouldSetPanResponderCapture:  () => isCrossDraggingRef.current,
    onPanResponderMove: (_, gs) => {
      if (!isCrossDraggingRef.current) return;
      onCrossDragMove(gs.moveY);
    },
    onPanResponderRelease:   (_, gs) => { isCrossDraggingRef.current = false; onCrossDragEnd(gs.moveY); },
    onPanResponderTerminate: ()        => { isCrossDraggingRef.current = false; onCrossDragEnd(-1); },
  }), [onCrossDragMove, onCrossDragEnd]);

  const handleLongPress = useCallback((evt: GestureResponderEvent) => {
    isCrossDraggingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onCrossDragStart(exercise, evt.nativeEvent.pageY);
  }, [exercise, onCrossDragStart]);

  return (
    <View style={sc.baseRowOuter} {...panResponder.panHandlers}>
      <Pressable
        style={sc.baseRowWrap}
        onPress={onMoveToToday}
        onLongPress={handleLongPress}
        delayLongPress={200}
        onPressIn={() => Animated.timing(pressOverlay, { toValue: 0.22, duration: 60, useNativeDriver: true }).start()}
        onPressOut={() => Animated.timing(pressOverlay, { toValue: 0, duration: 130, useNativeDriver: true }).start()}
      >
        <View style={sc.baseRowDot}><View style={sc.baseRowDotInner} /></View>
        <Text style={sc.rowTitle} numberOfLines={1}>{exercise.name}</Text>
        <Animated.View
          pointerEvents="none"
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "#000", borderRadius: 10, opacity: pressOverlay }}
        />
      </Pressable>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function TrainingDayScreen() {
  const { day }    = useLocalSearchParams<{ day: string }>();
  const insets     = useSafeAreaInsets();
  const { apiKey } = useNotion();
  const { isOpen: drawerOpen, closeDrawer, openDrawerToSection } = useDrawer();

  const topPad    = Platform.OS === "web" ? Math.max(insets.top, 67)    : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;
  const bodyPart  = useMemo(() => dayLabel(day ?? ""), [day]);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [allExercises,   setAllExercises]   = useState<Exercise[]>([]);
  const [todayList,      setTodayList]      = useState<TodayExercise[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [loggerExercise, setLoggerExercise] = useState<TodayExercise | null>(null);
  const [logging,        setLogging]        = useState(false);
  const [logSuccess,     setLogSuccess]     = useState(false);

  const todayListRef = useRef<TodayExercise[]>([]);
  todayListRef.current = todayList;

  const todayIds = useMemo(() => new Set(todayList.map(ex => ex.id)), [todayList]);
  const visibleBaseExercises = useMemo(
    () => allExercises.filter(ex => !todayIds.has(ex.id)),
    [allExercises, todayIds],
  );

  const fetchExercises = useCallback(async (silent = false) => {
    if (!apiKey || !bodyPart) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const r    = await fetch(`${BASE_URL}/api/training/exercises/${encodeURIComponent(bodyPart)}`, {
        headers: { "x-notion-key": apiKey },
      });
      const data = await r.json();
      if (data.exercises) setAllExercises(data.exercises as Exercise[]);
      else setError(data.message ?? "Failed to load");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [apiKey, bodyPart]);

  useEffect(() => { fetchExercises(); }, [fetchExercises]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchExercises(true);
    setRefreshing(false);
  }, [fetchExercises]);

  // ── Drag & drop — EXACT life-section implementation ────────────────────────
  const posAnims         = useRef<Record<string, Animated.Value>>({});
  const addedAnims       = useRef<Record<string, ReturnType<typeof Animated.add>>>({});
  const enterAnims       = useRef<Record<string, Animated.Value>>({});
  const containerRef     = useRef<View>(null);
  const containerTopRef  = useRef(0);
  const scrollOffsetRef  = useRef(0);
  const startScrollRef   = useRef(0);
  const isDraggingRef    = useRef(false);
  const draggingIdxRef   = useRef(-1);
  const hoverIdxRef      = useRef(-1);
  const dragOccurredRef  = useRef(false);
  const panY             = useRef(new Animated.Value(0)).current;
  const dimAnim          = useRef(new Animated.Value(0)).current;
  const [dragActiveIdx,  setDragActiveIdx]  = useState(-1);
  const [scrollEnabled,  setScrollEnabled]  = useState(true);

  todayList.forEach((ex, i) => {
    if (!posAnims.current[ex.localId]) {
      posAnims.current[ex.localId] = new Animated.Value(i * SLOT_H);
      addedAnims.current[ex.localId] = Animated.add(posAnims.current[ex.localId], panY);
    }
  });

  const animatePositions = useCallback((dragIdx: number, hoverIdx: number) => {
    const cur = todayListRef.current;
    cur.forEach((ex, i) => {
      if (i === dragIdx) return;
      let target = i;
      if (dragIdx < hoverIdx && i > dragIdx && i <= hoverIdx) target = i - 1;
      else if (dragIdx > hoverIdx && i >= hoverIdx && i < dragIdx) target = i + 1;
      posAnims.current[ex.localId]?.stopAnimation();
      Animated.timing(posAnims.current[ex.localId], {
        toValue: target * SLOT_H, duration: 110, useNativeDriver: true,
        easing: Easing.out(Easing.quad),
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
    Animated.timing(dimAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    if (di >= 0 && hi >= 0 && di !== hi) {
      setTodayList(prev => {
        const next = [...prev];
        const [moved] = next.splice(di, 1);
        next.splice(hi, 0, moved);
        next.forEach((ex, i) => posAnims.current[ex.localId]?.setValue(i * SLOT_H));
        return next;
      });
    } else {
      todayListRef.current.forEach((ex, i) => posAnims.current[ex.localId]?.setValue(i * SLOT_H));
    }
    setDragActiveIdx(-1);
    setTimeout(() => { dragOccurredRef.current = false; }, 80);
  }, []);

  // panResponder — identical name and structure to life screen
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => isDraggingRef.current,
    onPanResponderMove: (_, gs) => {
      if (!isDraggingRef.current) return;
      const di  = draggingIdxRef.current;
      const len = todayListRef.current.length;
      panY.setValue(gs.dy);
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

  // ── Swipe tracking ─────────────────────────────────────────────────────────
  const activeSwipeClose = useRef<(() => void) | null>(null);
  const [swipedId, setSwipedId] = useState<string | null>(null);

  const handleSwipeOpen = useCallback((id: string, close: () => void) => {
    activeSwipeClose.current?.();
    activeSwipeClose.current = close;
    setSwipedId(id);
  }, []);
  const handleSwipeClose = useCallback(() => { setSwipedId(null); }, []);
  const closeActiveSwipe = useCallback(() => {
    activeSwipeClose.current?.();
    activeSwipeClose.current = null;
    setSwipedId(null);
  }, []);

  // ── Cross-section drag (bottom → today) ───────────────────────────────────
  const [crossDragExercise, setCrossDragExercise] = useState<Exercise | null>(null);
  const crossDragY       = useRef(new Animated.Value(0)).current;
  const allExSectionTopY = useRef(0);
  const allExSectionRef  = useRef<View>(null);

  const handleCrossDragStart = useCallback((exercise: Exercise, y: number) => {
    setCrossDragExercise(exercise);
    crossDragY.setValue(y - ITEM_H / 2);
    allExSectionRef.current?.measure((_fx, _fy, _w, _h, _px, py) => {
      allExSectionTopY.current = py;
    });
  }, [crossDragY]);

  const handleCrossDragMove = useCallback((y: number) => {
    crossDragY.setValue(y - ITEM_H / 2);
  }, [crossDragY]);

  const handleCrossDragEnd = useCallback((y: number) => {
    if (!crossDragExercise) { setCrossDragExercise(null); return; }
    if (y > 0 && y < allExSectionTopY.current + 40) {
      const ex = crossDragExercise;
      const localId = `${ex.id}-${Date.now()}`;
      const entry: TodayExercise = { ...ex, localId, sets: [], notes: "", done: false };
      const enterAnim = new Animated.Value(0);
      enterAnims.current[localId] = enterAnim;
      setTodayList(prev => {
        const next = [...prev, entry];
        posAnims.current[localId] = new Animated.Value((next.length - 1) * SLOT_H);
        addedAnims.current[localId] = Animated.add(posAnims.current[localId], panY);
        return next;
      });
      Animated.timing(enterAnim, {
        toValue: 1, duration: 320, useNativeDriver: true, easing: Easing.out(Easing.quad),
      }).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setCrossDragExercise(null);
  }, [crossDragExercise, panY]);

  // ── Exercise actions ───────────────────────────────────────────────────────
  const addToToday = useCallback((exercise: Exercise) => {
    const localId = `${exercise.id}-${Date.now()}`;
    const entry: TodayExercise = { ...exercise, localId, sets: [], notes: "", done: false };
    const enterAnim = new Animated.Value(0);
    enterAnims.current[localId] = enterAnim;
    setTodayList(prev => {
      const next = [...prev, entry];
      posAnims.current[localId] = new Animated.Value((next.length - 1) * SLOT_H);
      addedAnims.current[localId] = Animated.add(posAnims.current[localId], panY);
      return next;
    });
    Animated.timing(enterAnim, {
      toValue: 1, duration: 320, useNativeDriver: true, easing: Easing.out(Easing.quad),
    }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [panY]);

  const removeFromToday = useCallback((localId: string) => {
    setTodayList(prev => {
      const next = prev.filter(ex => ex.localId !== localId);
      next.forEach((ex, i) => posAnims.current[ex.localId]?.setValue(i * SLOT_H));
      return next;
    });
  }, []);

  const handleStartRemove = useCallback((localId: string, _dur: number) => {
    const idx = todayListRef.current.findIndex(ex => ex.localId === localId);
    if (idx < 0) return;
    todayListRef.current.forEach((ex, i) => {
      if (ex.localId === localId) return;
      const target = i > idx ? i - 1 : i;
      posAnims.current[ex.localId]?.stopAnimation();
      Animated.timing(posAnims.current[ex.localId], {
        toValue: target * SLOT_H, duration: 280, useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }).start();
    });
  }, []);

  // Toggle done — exercise stays in list for logging
  const markDone = useCallback((localId: string, done: boolean) => {
    setTodayList(prev => prev.map(ex => ex.localId === localId ? { ...ex, done } : ex));
  }, []);

  const saveSets = useCallback((localId: string, sets: LoggedSet[], notes: string, setup: string) => {
    setTodayList(prev => prev.map(ex => ex.localId === localId ? { ...ex, sets, notes, setup } : ex));
    setLoggerExercise(prev => prev?.localId === localId ? { ...prev, sets, notes, setup } : prev);
  }, []);

  // ── Log session ────────────────────────────────────────────────────────────
  const totalSets = todayList.reduce((sum, ex) => sum + ex.sets.filter(s => s.reps || s.weight).length, 0);

  const handleLogSession = useCallback(async () => {
    if (!apiKey || logging || todayList.length === 0) return;
    const entries = todayList
      .filter(ex => ex.sets.some(s => s.reps || s.weight))
      .map(ex => ({
        name: ex.name, bodyPart: ex.bodyPart, setup: ex.setup, notes: ex.notes || "",
        sets: ex.sets.filter(s => s.reps || s.weight)
          .map((s, idx) => ({ setNumber: idx + 1, reps: s.reps || "0", weight: s.weight || "0" })),
      }));
    if (entries.length === 0) return;
    setLogging(true);
    try {
      const r = await fetch(`${BASE_URL}/api/training/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
        body: JSON.stringify({ entries }),
      });
      const data = await r.json();
      if (data.success || data.created > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setLogSuccess(true);
        setTodayList([]);
        posAnims.current   = {};
        addedAnims.current = {};
        setTimeout(() => setLogSuccess(false), 3000);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLogging(false);
    }
  }, [apiKey, logging, todayList]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={sc.root}>
      {/* Header */}
      <View style={[sc.gradHeader, { paddingTop: topPad + 8, paddingBottom: 36 }]}>
        <LinearGradient
          colors={["rgba(224,49,49,0.90)","rgba(215,42,42,0.74)","rgba(190,28,28,0.56)","rgba(145,16,16,0.38)","rgba(90,8,8,0.20)","rgba(35,3,3,0.08)","#0f0f0f"]}
          locations={[0,0.18,0.36,0.54,0.70,0.85,1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={sc.gradNav}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); drawerOpen ? closeDrawer() : openDrawerToSection("training"); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={sc.gradIconGhost}
          >
            <Feather name="menu" size={26} color="rgba(255,255,255,0.92)" />
          </Pressable>
        </View>
        <Text style={sc.gradTitle}>{bodyPart}</Text>
      </View>

      {loading ? (
        <ListLoader />
      ) : error ? (
        <View style={sc.center}>
          <Text style={sc.errorText}>{error}</Text>
          <Pressable onPress={() => fetchExercises()} style={sc.retryBtn}>
            <Text style={sc.retryTx}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={{ marginTop: -8 }}
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}
          onScroll={e => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: bottomPad + 100, paddingTop: 12 }}
          onScrollBeginDrag={closeActiveSwipe}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
          }
        >
          {/* TODAY header */}
          <View style={sc.sectionHeader}>
            <Text style={sc.sectionLabel}>TODAY</Text>
            {todayList.length > 0 && <Text style={sc.sectionCount}>{todayList.length}</Text>}
          </View>

          {/* Progress bar — shown when exercises are in Today section */}
          {todayList.length > 0 && (() => {
            const doneCount = todayList.filter(ex => ex.done).length;
            const pct       = todayList.length > 0 ? doneCount / todayList.length : 0;
            return (
              <View style={sc.progressWrap}>
                <Animated.View style={[sc.progressTrack]}>
                  <View style={[sc.progressFill, { width: `${Math.round(pct * 100)}%` as any }]} />
                </Animated.View>
                <Text style={sc.progressTx}>{doneCount}/{todayList.length}</Text>
              </View>
            );
          })()}

          {/* TODAY rows — panResponder container (matches life-section structure exactly) */}
          {todayList.length === 0 ? (
            <View style={sc.emptyToday}>
              <Feather name="arrow-down" size={16} color={Colors.textMuted} />
              <Text style={sc.emptyTodayText}>Tap or drag exercises from below</Text>
            </View>
          ) : (
            <View
              ref={containerRef}
              {...panResponder.panHandlers}
              style={{ height: Math.max(todayList.length, 1) * SLOT_H + 16, marginHorizontal: 16, marginTop: 8 }}
            >
              {dragActiveIdx !== -1 && (
                <Pressable
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
                  onPress={() => endDrag()}
                />
              )}
              {todayList.map((ex, idx) => {
                const isDragging = dragActiveIdx === idx;
                const posAnim    = posAnims.current[ex.localId] ?? new Animated.Value(idx * SLOT_H);
                const translateY = isDragging
                  ? (addedAnims.current[ex.localId] ?? posAnim)
                  : posAnim;
                const enterOpacity = enterAnims.current[ex.localId] ?? 1;
                return (
                  <Animated.View
                    key={ex.localId}
                    style={[sc.absItem, { top: 0, zIndex: isDragging ? 100 : swipedId === ex.localId ? 10 : 1, transform: [{ translateY }], opacity: enterOpacity }]}
                  >
                    <TodayRow
                      exercise={ex}
                      isDragging={isDragging}
                      dimValue={isDragging ? ZERO_ANIM : dimAnim}
                      onPress={() => {
                        if (!dragOccurredRef.current) {
                          // Always read from ref so sets logged since last render are included
                          const latest = todayListRef.current.find(e => e.localId === ex.localId);
                          setLoggerExercise(latest ?? ex);
                        }
                      }}
                      onLongPress={() => startDrag(idx)}
                      onChecked={(done) => markDone(ex.localId, done)}
                      onRemove={() => removeFromToday(ex.localId)}
                      onStartRemove={(dur) => handleStartRemove(ex.localId, dur)}
                      onSwipeOpen={(close) => handleSwipeOpen(ex.localId, close)}
                      onSwipeClose={handleSwipeClose}
                    />
                  </Animated.View>
                );
              })}
            </View>
          )}

          {/* ALL EXERCISES header */}
          <View ref={allExSectionRef} style={sc.sectionHeader}>
            <Text style={sc.sectionLabel}>ALL EXERCISES</Text>
            <Text style={sc.sectionCount}>{visibleBaseExercises.length}</Text>
          </View>

          {visibleBaseExercises.length === 0 && allExercises.length === 0 ? (
            <View style={sc.center}><Text style={sc.mutedText}>No exercises found</Text></View>
          ) : visibleBaseExercises.length === 0 ? (
            <View style={sc.emptyToday}>
              <Feather name="check-circle" size={16} color={Colors.primary} />
              <Text style={sc.emptyTodayText}>All exercises added to Today</Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, gap: ITEM_GAP }}>
              {visibleBaseExercises.map(ex => (
                <BaseRow
                  key={ex.id}
                  exercise={ex}
                  onMoveToToday={() => addToToday(ex)}
                  onCrossDragStart={handleCrossDragStart}
                  onCrossDragMove={handleCrossDragMove}
                  onCrossDragEnd={handleCrossDragEnd}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Log Session bar */}
      {todayList.length > 0 && !loading && (
        <View style={[sc.logBar, { paddingBottom: bottomPad + 8 }]}>
          <View style={sc.logBarInner}>
            <View style={sc.logBarInfo}>
              <Text style={sc.logBarCount}>{todayList.length} exercise{todayList.length !== 1 ? "s" : ""}</Text>
              {totalSets > 0 && <Text style={sc.logBarSets}>{totalSets} set{totalSets !== 1 ? "s" : ""} logged</Text>}
            </View>
            <TouchableOpacity
              style={[sc.logBtn, (logging || totalSets === 0) && sc.logBtnDisabled]}
              onPress={handleLogSession}
              disabled={logging || totalSets === 0}
              activeOpacity={0.82}
            >
              {logging
                ? <Text style={sc.logBtnTx}>Logging…</Text>
                : <><Feather name="send" size={15} color="#fff" /><Text style={sc.logBtnTx}>Log Session</Text></>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Cross-drag ghost */}
      {crossDragExercise && (
        <Animated.View
          pointerEvents="none"
          style={[sc.ghostRow, { transform: [{ translateY: crossDragY }] }]}
        >
          <View style={[sc.rowWrap, sc.rowDragging]}>
            <View style={{ flex: 1, alignSelf: "stretch", justifyContent: "center" }}>
              <Text style={sc.rowTitle} numberOfLines={1}>{crossDragExercise.name}</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Success toast */}
      {logSuccess && (
        <View style={[sc.toast, { bottom: bottomPad + 20 }]}>
          <Feather name="check-circle" size={16} color="#fff" />
          <Text style={sc.toastTx}>Session logged to Notion!</Text>
        </View>
      )}

      <SetLoggerSheet
        exercise={loggerExercise}
        bodyPart={bodyPart}
        onClose={() => setLoggerExercise(null)}
        onSave={saveSets}
      />
    </View>
  );
}

// ── Sheet styles ───────────────────────────────────────────────────────────────
const sh = StyleSheet.create({
  sheet: {
    backgroundColor: "#111111",
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 20,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: "#444",
    alignSelf: "center", marginTop: 12, marginBottom: 16,
    flexShrink: 0,
  },

  contextLabel: {
    color: Colors.primary, fontSize: 10, fontFamily: "Inter_700Bold",
    letterSpacing: 1.4, marginBottom: 6,
  },
  exerciseTitle: {
    color: "#FFFFFF", fontSize: 24, fontFamily: "Inter_700Bold",
    lineHeight: 30, marginBottom: 10,
  },
  setupInput: {
    color: Colors.textPrimary, fontSize: 15, fontFamily: "Inter_600SemiBold",
    paddingTop: 10, paddingBottom: 13, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 10,
    marginBottom: 10, textAlignVertical: "top", minHeight: 50,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },

  // Column headers — spacer (60) + gap (16) must match setLabel + gap exactly
  colHeaderRow: {
    flexDirection: "row", alignItems: "center",
    gap: 16, marginBottom: 4,
  },
  colHeader: {
    width: 92, color: "#FFFFFF", fontSize: 10, fontFamily: "Inter_700Bold",
    letterSpacing: 1, textAlign: "center",
  },

  setRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12 },
  setLabel: {
    width: 60, color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold",
    flexShrink: 0,
  },
  setInput: {
    width: 92,
    backgroundColor: "#1c1c1c", borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 12, paddingHorizontal: 4,
    color: "#FFFFFF", fontSize: 17, fontFamily: "Inter_700Bold",
    textAlign: "center",
  },

  // Per-set checkbox — right-aligned via flex spacer in setRow
  setCheckBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  setCheckBox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: "#5a5a5a",
    alignItems: "center", justifyContent: "center", backgroundColor: "transparent",
  },
  setCheckBoxDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  notesLabel: {
    color: "#FFFFFF", fontSize: 10, fontFamily: "Inter_700Bold",
    letterSpacing: 1.2, marginBottom: 8,
  },
  notesInput: {
    color: Colors.textPrimary, fontSize: 15, fontFamily: "Inter_600SemiBold",
    paddingTop: 10, paddingBottom: 13, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 10,
    minHeight: 80, textAlignVertical: "top",
  },

  // Pinned outside ScrollView — sits flush above keyboard
  bottomRow: {
    flexDirection: "row", gap: 10,
    paddingTop: 12, flexShrink: 0,
  },
  addSetBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "transparent", borderWidth: 1.5, borderColor: Colors.primary,
    borderRadius: 14, paddingVertical: 15,
  },
  addSetTx: { color: Colors.primary, fontSize: 15, fontFamily: "Inter_700Bold" },
  doneBtn: {
    flex: 1, backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: "center", justifyContent: "center",
  },
  doneTx: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});

// ── Screen styles ──────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  root:  { flex: 1, backgroundColor: "#0b0b0c" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 32 },
  mutedText: { color: Colors.textMuted, fontSize: 15, fontFamily: "Inter_400Regular" },
  errorText: { color: Colors.primary, fontSize: 14, fontFamily: "Inter_500Medium" },
  retryBtn:  { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.cardBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  retryTx:   { color: Colors.textPrimary, fontSize: 14, fontFamily: "Inter_600SemiBold" },

  gradHeader:    { paddingHorizontal: 20, backgroundColor: "#0f0f0f" },
  gradNav:       { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  gradIconGhost: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  gradTitle: {
    fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center", marginBottom: 4,
    textShadowColor: "rgba(224,49,49,0.45)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24,
  },
  gradSub: { fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: "Inter_400Regular", textAlign: "center" },

  sectionHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10, gap: 8,
  },
  sectionLabel: { color: "#FFFFFF", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.2 },
  sectionCount: {
    color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_600SemiBold",
    backgroundColor: Colors.cardBg, paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border, overflow: "hidden",
  },

  emptyToday: {
    marginHorizontal: 16, marginBottom: 8, height: 56, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
  },
  emptyTodayText: { color: Colors.textMuted, fontSize: 14, fontFamily: "Inter_400Regular" },

  absItem: { position: "absolute", left: 0, right: 0, height: ITEM_H },

  rowOuter: { height: ITEM_H },
  deleteAction: {
    width: 72, height: ITEM_H, backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
  },

  // rowWrap — matches life section exactly (borderRadius: 10, gap: 12)
  rowWrap: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0f0f0f", borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, height: ITEM_H,
  },
  rowDragging: {
    backgroundColor: Colors.cardBgElevated,
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 18, elevation: 18,
  },
  rowWrapDone: { opacity: 0.45 },
  rowTitle: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_600SemiBold", lineHeight: 21, paddingBottom: 4 },
  rowTitleDone: { textDecorationLine: "line-through", color: Colors.textMuted },

  progressWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, marginTop: -4, marginBottom: 8,
  },
  progressTrack: {
    flex: 1, height: 4, backgroundColor: "#1e1e1e",
    borderRadius: 2, overflow: "hidden",
  },
  progressFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  progressTx: { color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_600SemiBold", minWidth: 28, textAlign: "right" },

  setBadge: {
    backgroundColor: "rgba(224,49,49,0.12)", borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: "rgba(224,49,49,0.25)",
  },
  setBadgeTx: { color: Colors.primary, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  checkBtn:   { padding: 10, margin: -6 },
  checkBox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: "#5a5a5a",
    alignItems: "center", justifyContent: "center", backgroundColor: "transparent",
  },
  checkBoxDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  baseRowOuter: { marginBottom: ITEM_GAP },
  baseRowWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#0f0f0f", borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, height: ITEM_H, overflow: "hidden",
  },
  baseRowDot:      { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  baseRowDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#444" },

  ghostRow: {
    position: "absolute", left: 16, right: 16, top: 0, height: ITEM_H, zIndex: 9999,
    shadowColor: "#000", shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55, shadowRadius: 20, elevation: 20,
  },

  logBar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: "#0b0b0c", borderTopWidth: 1, borderTopColor: Colors.border,
    paddingTop: 12, paddingHorizontal: 16,
  },
  logBarInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  logBarInfo:  { flex: 1 },
  logBarCount: { color: Colors.textPrimary, fontSize: 14, fontFamily: "Inter_700Bold" },
  logBarSets:  { color: Colors.textMuted,   fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  logBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 12,
  },
  logBtnDisabled: { opacity: 0.4 },
  logBtnTx: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },

  toast: {
    position: "absolute", left: 24, right: 24,
    backgroundColor: "#111", borderRadius: 14, borderWidth: 1, borderColor: "#16a34a",
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  toastTx: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
