import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { runOnJS } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

interface Item {
  id: string;
  label: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  priority: "low" | "medium" | "high";
  notes: string;
}

const INITIAL_ITEMS: Item[] = [
  { id: "1", label: "Design System", subtitle: "Tokens, components, docs", icon: "layout", color: Colors.primary, priority: "high", notes: "Update spacing tokens and button variants before handoff." },
  { id: "2", label: "API Integration", subtitle: "REST + GraphQL endpoints", icon: "code", color: Colors.info, priority: "high", notes: "Auth headers need rotating. Check rate limits on prod." },
  { id: "3", label: "Unit Tests", subtitle: "Jest + React Testing Library", icon: "check-circle", color: Colors.success, priority: "medium", notes: "Coverage below 70% on auth module — fix before release." },
  { id: "4", label: "Deploy Pipeline", subtitle: "GitHub Actions, staging → prod", icon: "server", color: "#FAB005", priority: "high", notes: "Add smoke tests to the post-deploy step." },
  { id: "5", label: "Documentation", subtitle: "README, API reference, guides", icon: "file-text", color: "#BE4BDB", priority: "low", notes: "Changelog is three versions behind." },
  { id: "6", label: "Performance Audit", subtitle: "Lighthouse, bundle analysis", icon: "zap", color: "#FD7E14", priority: "medium", notes: "Homepage LCP is 4.2s on mobile. Target under 2.5s." },
  { id: "7", label: "Accessibility", subtitle: "WCAG 2.1 AA compliance", icon: "eye", color: "#20C997", priority: "medium", notes: "Modal focus trapping broken in Safari." },
  { id: "8", label: "Analytics Setup", subtitle: "Events, funnels, dashboards", icon: "bar-chart-2", color: "#74C0FC", priority: "low", notes: "Add conversion events for onboarding steps 2–4." },
  { id: "9", label: "Security Review", subtitle: "Deps audit, pen test prep", icon: "shield", color: "#FF6B6B", priority: "high", notes: "Three high-severity CVEs in lodash. Upgrade immediately." },
  { id: "10", label: "Mobile Responsiveness", subtitle: "Breakpoints, touch targets", icon: "smartphone", color: "#A9E34B", priority: "medium", notes: "Table component breaks below 375px." },
];

const INITIAL_CHECKLIST = [
  { id: "c1", label: "Review PR #47 — auth refactor" },
  { id: "c2", label: "Update staging environment vars" },
  { id: "c3", label: "Send v2.2 release notes to team" },
  { id: "c4", label: "Archive feature/old-login branch" },
  { id: "c5", label: "Write migration guide for v2→v3" },
  { id: "c6", label: "Remove deprecated API calls" },
  { id: "c7", label: "Set up Dependabot alerts" },
  { id: "c8", label: "QA sign-off on login flow" },
  { id: "c9", label: "Update App Store screenshots" },
  { id: "c10", label: "Enable 2FA for CI service accounts" },
];

const INITIAL_SWIPE = [
  { id: "s1", label: "Feature Request: Dark Mode", tag: "Feature", color: Colors.primary },
  { id: "s2", label: "Bug: Login crash on iPad Pro", tag: "Bug", color: "#FF6B6B" },
  { id: "s3", label: "Chore: Update all dependencies", tag: "Chore", color: Colors.info },
  { id: "s4", label: "Feature: CSV export for reports", tag: "Feature", color: Colors.primary },
  { id: "s5", label: "Bug: Notifications not clearing", tag: "Bug", color: "#FF6B6B" },
  { id: "s6", label: "Improvement: Faster search indexing", tag: "Improve", color: "#FAB005" },
  { id: "s7", label: "Bug: Timezone offset in EU", tag: "Bug", color: "#FF6B6B" },
  { id: "s8", label: "Chore: Remove legacy endpoints", tag: "Chore", color: Colors.info },
];

const PRIORITY_COLORS = { low: Colors.success, medium: "#FAB005", high: Colors.primary };
const PRIORITY_LABELS = { low: "Low", medium: "Medium", high: "High" };
const ITEM_H = 64;
const clamp = (min: number, val: number, max: number) => Math.max(min, Math.min(max, val));

function Section({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function DetailModal({ item, onClose, onUpdate }: {
  item: Item | null;
  onClose: () => void;
  onUpdate: (updated: Item) => void;
}) {
  const [label, setLabel] = useState(item?.label ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [priority, setPriority] = useState<"low" | "medium" | "high">(item?.priority ?? "medium");
  const slideAnim = useRef(new Animated.Value(700)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (item) {
      setLabel(item.label);
      setNotes(item.notes);
      setPriority(item.priority);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, tension: 80, friction: 12 }),
        Animated.timing(bgAnim, { toValue: 1, duration: 250, useNativeDriver: false }),
      ]).start();
    }
  }, [item]);

  const dismiss = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 700, duration: 260, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
      Animated.timing(bgAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start(() => { cb?.(); onClose(); });
  };

  const handleUpdate = () => {
    if (!item) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    dismiss(() => onUpdate({ ...item, label, notes, priority }));
  };

  const bgColor = bgAnim.interpolate({ inputRange: [0, 1], outputRange: ["rgba(0,0,0,0)", "rgba(0,0,0,0.7)"] });
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 24) : insets.bottom + 8;

  return (
    <Modal visible={!!item} transparent animationType="none" onRequestClose={() => dismiss()}>
      <Animated.View style={[styles.modalOverlay, { backgroundColor: bgColor }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss()} />
        <Animated.View style={[styles.modalSheet, { transform: [{ translateY: slideAnim }], paddingBottom: botPad }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={[styles.modalIconBg, { backgroundColor: `${item?.color ?? Colors.primary}22` }]}>
              <Feather name={item?.icon ?? "file"} size={20} color={item?.color ?? Colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Edit Task</Text>
            <Pressable style={styles.modalCloseBtn} onPress={() => dismiss()}>
              <Feather name="x" size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>TITLE</Text>
            <TextInput
              keyboardAppearance="dark" style={styles.fieldInput} value={label} onChangeText={setLabel} placeholderTextColor={Colors.textMuted} selectionColor={Colors.primary} />
          </View>
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>NOTES</Text>
            <TextInput
              keyboardAppearance="dark" style={[styles.fieldInput, styles.fieldTextArea]} value={notes} onChangeText={setNotes} multiline numberOfLines={4} placeholderTextColor={Colors.textMuted} selectionColor={Colors.primary} textAlignVertical="top" />
          </View>
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>PRIORITY</Text>
            <View style={styles.priorityRow}>
              {(["low", "medium", "high"] as const).map((p) => (
                <Pressable key={p} style={[styles.priorityBtn, priority === p && { backgroundColor: `${PRIORITY_COLORS[p]}22`, borderColor: PRIORITY_COLORS[p] }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPriority(p); }}>
                  <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[p] }]} />
                  <Text style={[styles.priorityText, priority === p && { color: PRIORITY_COLORS[p], fontFamily: "Inter_600SemiBold" }]}>{PRIORITY_LABELS[p]}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.modalActions}>
            <Pressable style={styles.cancelBtn} onPress={() => dismiss()}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.updateBtn} onPress={handleUpdate}>
              <Feather name="check" size={16} color="#fff" />
              <Text style={styles.updateBtnText}>Update Task</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function DraggableItem({ item, index, posAnim, panY, isDragging, onItemPress, onDragStart, onDragMove, onDragEnd }: {
  item: Item;
  index: number;
  posAnim: Animated.Value;
  panY: Animated.Value;
  isDragging: boolean;
  onItemPress: (item: Item) => void;
  onDragStart: (index: number) => void;
  onDragMove: (dy: number) => void;
  onDragEnd: () => void;
}) {
  const startDrag = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onDragStart(index);
  }, [index, onDragStart]);

  const moveDrag = useCallback((dy: number) => {
    onDragMove(dy);
  }, [onDragMove]);

  const endDrag = useCallback(() => {
    onDragEnd();
  }, [onDragEnd]);

  const openItem = useCallback(() => {
    onItemPress(item);
  }, [item, onItemPress]);

  const pan = useMemo(() =>
    Gesture.Pan()
      .activateAfterLongPress(400)
      .onStart(() => { runOnJS(startDrag)(); })
      .onChange((e) => { runOnJS(moveDrag)(e.translationY); })
      .onEnd(() => { runOnJS(endDrag)(); })
      .onFinalize(() => { runOnJS(endDrag)(); }),
    [startDrag, moveDrag, endDrag]
  );

  const tap = useMemo(() =>
    Gesture.Tap().maxDuration(300).onEnd((_e, success) => {
      if (success) runOnJS(openItem)();
    }),
    [openItem]
  );

  const gesture = useMemo(() => Gesture.Exclusive(pan, tap), [pan, tap]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.absoluteItem,
          { top: posAnim, zIndex: isDragging ? 100 : 1 },
          isDragging && styles.itemFloating,
          isDragging ? { transform: [{ translateY: panY }] } : {},
        ]}
      >
        <View style={[styles.item, isDragging && styles.itemDragging]}>
          <View style={[styles.itemIcon, { backgroundColor: `${item.color}20` }]}>
            <Feather name={item.icon} size={16} color={item.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemLabel}>{item.label}</Text>
            <Text style={styles.itemSub}>{item.subtitle}</Text>
          </View>
          <View style={[styles.priorityPip, { backgroundColor: PRIORITY_COLORS[item.priority] }]} />
          <Feather name="menu" size={16} color={isDragging ? Colors.primary : Colors.textMuted} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

function LiveDraggableList({ items, setItems, onItemPress }: {
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
  onItemPress: (item: Item) => void;
}) {
  const posAnims = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(items.map((item, i) => [item.id, new Animated.Value(i * ITEM_H)]))
  );

  const draggingIdxRef = useRef(-1);
  const hoverIdxRef = useRef(-1);
  const panY = useRef(new Animated.Value(0)).current;
  const [dragActiveIdx, setDragActiveIdx] = useState(-1);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const animatePositions = useCallback((dragIdx: number, hoverIdx: number) => {
    itemsRef.current.forEach((item, i) => {
      if (i === dragIdx) return;
      let target = i;
      if (dragIdx < hoverIdx && i > dragIdx && i <= hoverIdx) target = i - 1;
      else if (dragIdx > hoverIdx && i >= hoverIdx && i < dragIdx) target = i + 1;
      Animated.timing(posAnims.current[item.id], {
        toValue: target * ITEM_H,
        duration: 140,
        useNativeDriver: false,
        easing: Easing.out(Easing.cubic),
      }).start();
    });
  }, []);

  const startDrag = useCallback((index: number) => {
    draggingIdxRef.current = index;
    hoverIdxRef.current = index;
    setDragActiveIdx(index);
  }, []);

  const moveDrag = useCallback((dy: number) => {
    panY.setValue(dy);
    const di = draggingIdxRef.current;
    if (di < 0) return;
    const len = itemsRef.current.length;
    const newHover = clamp(0, len - 1, Math.round(di + dy / ITEM_H));
    if (newHover !== hoverIdxRef.current) {
      hoverIdxRef.current = newHover;
      animatePositions(di, newHover);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [animatePositions]);

  const endDrag = useCallback(() => {
    const di = draggingIdxRef.current;
    const hi = hoverIdxRef.current;
    panY.setValue(0);
    draggingIdxRef.current = -1;
    hoverIdxRef.current = -1;

    if (di >= 0 && hi >= 0 && di !== hi) {
      setItems(prev => {
        const next = [...prev];
        const [moved] = next.splice(di, 1);
        next.splice(hi, 0, moved);
        next.forEach((item, i) => { posAnims.current[item.id]?.setValue(i * ITEM_H); });
        return next;
      });
    } else {
      itemsRef.current.forEach((item, i) => { posAnims.current[item.id]?.setValue(i * ITEM_H); });
    }
    setDragActiveIdx(-1);
  }, [setItems]);

  return (
    <View style={{ height: items.length * ITEM_H, ...styles.listCard }}>
      {items.map((item, index) => (
        <DraggableItem
          key={item.id}
          item={item}
          index={index}
          posAnim={posAnims.current[item.id]}
          panY={panY}
          isDragging={dragActiveIdx === index}
          onItemPress={onItemPress}
          onDragStart={startDrag}
          onDragMove={moveDrag}
          onDragEnd={endDrag}
        />
      ))}
    </View>
  );
}

function AnimatedCheckItem({ item, onRemove }: { item: { id: string; label: string }; onRemove: (id: string) => void }) {
  const heightAnim = useRef(new Animated.Value(52)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const [done, setDone] = useState(false);

  const toggle = () => {
    if (done) return;
    setDone(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.spring(checkScale, { toValue: 1, useNativeDriver: false, tension: 240, friction: 8 }).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 0, duration: 280, useNativeDriver: false }),
        Animated.timing(heightAnim, { toValue: 0, duration: 300, delay: 80, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
      ]).start(() => onRemove(item.id));
    }, 500);
  };

  return (
    <Animated.View style={{ height: heightAnim, opacity: opacityAnim, overflow: "hidden" }}>
      <Pressable style={styles.checkItem} onPress={toggle}>
        <Animated.View style={[styles.checkBox, done && styles.checkBoxDone]}>
          <Animated.View style={{ transform: [{ scale: checkScale }], opacity: checkScale }}>
            <Feather name="check" size={11} color="#fff" />
          </Animated.View>
        </Animated.View>
        <Text style={[styles.checkLabel, done && styles.checkLabelDone]} numberOfLines={1}>{item.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function SwipeRow({ item, onDelete, onPress }: {
  item: { id: string; label: string; tag: string; color: string };
  onDelete: (id: string) => void;
  onPress: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const heightAnim = useRef(new Animated.Value(56)).current;
  const marginAnim = useRef(new Animated.Value(6)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const deletingRef = useRef(false);

  const triggerDelete = useCallback(() => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 110, useNativeDriver: false }),
      Animated.timing(heightAnim, { toValue: 0, duration: 260, delay: 60, useNativeDriver: false, easing: Easing.in(Easing.cubic) }),
      Animated.timing(marginAnim, { toValue: 0, duration: 260, delay: 60, useNativeDriver: false, easing: Easing.in(Easing.cubic) }),
    ]).start(() => onDelete(item.id));
  }, [item.id, onDelete]);

  const snapBack = useCallback(() => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: false, tension: 150, friction: 14 }).start();
  }, [translateX]);

  const updateX = useCallback((x: number) => {
    translateX.setValue(x);
  }, [translateX]);

  const gesture = useMemo(() =>
    Gesture.Pan()
      .activeOffsetX([-10, 10])
      .failOffsetY([-12, 12])
      .onChange((e) => {
        runOnJS(updateX)(clamp(-120, e.translationX, 0));
      })
      .onEnd((e) => {
        if (e.translationX < -75) {
          runOnJS(triggerDelete)();
        } else {
          runOnJS(snapBack)();
        }
      }),
    [triggerDelete, snapBack, updateX]
  );

  const pillOpacity = translateX.interpolate({ inputRange: [-120, -30, 0], outputRange: [1, 0.1, 0], extrapolate: "clamp" });
  const pillTranslate = translateX.interpolate({ inputRange: [-120, 0], outputRange: [0, 16], extrapolate: "clamp" });

  return (
    <Animated.View style={{ height: heightAnim, opacity: opacityAnim, marginBottom: marginAnim, borderRadius: 12, overflow: "hidden" }}>
      {/* Fixed background — delete pill revealed as row slides left */}
      <View style={styles.swipeBg}>
        <Animated.View style={{ opacity: pillOpacity, transform: [{ translateX: pillTranslate }] }}>
          <Pressable style={styles.deletePill} onPress={triggerDelete}>
            <Feather name="trash-2" size={12} color="#fff" />
            <Text style={styles.deletePillText}>Delete</Text>
          </Pressable>
        </Animated.View>
      </View>
      {/* Sliding foreground row */}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.swipeRowOuter, { transform: [{ translateX }] }]}>
          <Pressable style={styles.swipeRow} onPress={onPress}>
            <View style={[styles.tagPill, { backgroundColor: `${item.color}18`, borderColor: `${item.color}40` }]}>
              <Text style={[styles.tagText, { color: item.color }]}>{item.tag}</Text>
            </View>
            <Text style={styles.swipeLabel} numberOfLines={1}>{item.label}</Text>
            <Feather name="chevron-right" size={14} color={Colors.textMuted} />
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

export default function ReorderScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS);
  const [checkItems, setCheckItems] = useState(INITIAL_CHECKLIST);
  const [swipeItems, setSwipeItems] = useState(INITIAL_SWIPE);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [modalKey, setModalKey] = useState(0);

  const openModal = useCallback((item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalKey(k => k + 1);
    setSelectedItem(item);
  }, []);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <DetailModal
        key={modalKey}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdate={(updated) => {
          setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
          setSelectedItem(null);
        }}
      />

      <ScreenHeader title="Drag & Reorder" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Section title="Reorderable List" />
        <Text style={styles.hint}>Tap to edit · Long press to drag and reorder</Text>
        <LiveDraggableList items={items} setItems={setItems} onItemPress={openModal} />

        <Section title="Checklist — tap to complete" />
        <Text style={styles.hint}>{checkItems.length} remaining · rows collapse when checked</Text>
        <View style={styles.listCard}>
          {checkItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="check-circle" size={28} color={Colors.success} />
              <Text style={styles.emptyText}>All done!</Text>
              <Pressable style={styles.resetBtn} onPress={() => setCheckItems(INITIAL_CHECKLIST)}>
                <Text style={styles.resetBtnText}>Reset</Text>
              </Pressable>
            </View>
          ) : (
            checkItems.map((item) => (
              <AnimatedCheckItem key={item.id} item={item} onRemove={(id) => setCheckItems(prev => prev.filter(i => i.id !== id))} />
            ))
          )}
        </View>

        <Section title="Swipe to Delete" />
        <Text style={styles.hint}>Swipe left to reveal delete · tap the pill to confirm</Text>
        {swipeItems.map((item) => (
          <SwipeRow
            key={item.id}
            item={item}
            onDelete={(id) => setSwipeItems(prev => prev.filter(i => i.id !== id))}
            onPress={() => openModal({ id: item.id, label: item.label, subtitle: item.tag, icon: "file-text", color: item.color, priority: "medium", notes: "" })}
          />
        ))}
        {swipeItems.length === 0 && (
          <View style={[styles.emptyState, styles.listCard]}>
            <Feather name="trash-2" size={24} color={Colors.textMuted} />
            <Text style={styles.emptyText}>All cleared</Text>
            <Pressable style={styles.resetBtn} onPress={() => setSwipeItems(INITIAL_SWIPE)}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12,
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 17, fontFamily: "Inter_700Bold", flex: 1, textAlign: "center" },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.cardBg, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
  scroll: { padding: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 28, marginBottom: 8 },
  sectionLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  sectionTitle: { color: Colors.textMuted, fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1, textTransform: "uppercase" },
  hint: { color: Colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 10 },
  listCard: {
    backgroundColor: Colors.cardBg, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: "hidden",
  },
  absoluteItem: { position: "absolute", left: 0, right: 0, height: ITEM_H },
  itemFloating: {
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 12,
  },
  item: {
    flexDirection: "row", alignItems: "center",
    height: ITEM_H, paddingHorizontal: 14, gap: 10,
    backgroundColor: Colors.cardBg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  itemDragging: { backgroundColor: "rgba(224,49,49,0.07)" },
  itemIcon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  itemLabel: { color: Colors.textPrimary, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  itemSub: { color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  priorityPip: { width: 7, height: 7, borderRadius: 4 },
  checkItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    height: 52, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  checkBox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
    borderColor: Colors.border, alignItems: "center", justifyContent: "center",
  },
  checkBoxDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkLabel: { color: Colors.textPrimary, fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  checkLabelDone: { color: Colors.textMuted, textDecorationLine: "line-through" },
  swipeBg: {
    position: "absolute", top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.darkBg,
    alignItems: "center", justifyContent: "flex-end", flexDirection: "row",
    paddingRight: 14,
  },
  deletePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.primary, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  deletePillText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  swipeRowOuter: {
    position: "absolute", top: 0, bottom: 0, left: 0, right: 0,
  },
  swipeRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.cardBg, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, height: 56, gap: 10,
  },
  tagPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  tagText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4 },
  swipeLabel: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 14, fontFamily: "Inter_500Medium" },
  resetBtn: {
    marginTop: 4, paddingVertical: 7, paddingHorizontal: 20,
    backgroundColor: Colors.cardBgElevated, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  resetBtnText: { color: Colors.textSecondary, fontSize: 13, fontFamily: "Inter_500Medium" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: Colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderColor: Colors.border, gap: 16,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginBottom: 4 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  modalIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modalTitle: { flex: 1, color: Colors.textPrimary, fontSize: 17, fontFamily: "Inter_700Bold" },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.cardBgElevated,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border,
  },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: Colors.textMuted, fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  fieldInput: {
    backgroundColor: Colors.darkBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    color: Colors.textPrimary, fontSize: 14, fontFamily: "Inter_400Regular",
    paddingHorizontal: 14, paddingVertical: 11,
  },
  fieldTextArea: { minHeight: 88, paddingTop: 11 },
  priorityRow: { flexDirection: "row", gap: 8 },
  priorityBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.cardBgElevated,
  },
  priorityDot: { width: 7, height: 7, borderRadius: 4 },
  priorityText: { color: Colors.textSecondary, fontSize: 12, fontFamily: "Inter_500Medium" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
    backgroundColor: Colors.cardBgElevated, borderWidth: 1, borderColor: Colors.border,
  },
  cancelBtnText: { color: Colors.textSecondary, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  updateBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: "center",
    backgroundColor: Colors.primary, flexDirection: "row", justifyContent: "center", gap: 8,
  },
  updateBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
