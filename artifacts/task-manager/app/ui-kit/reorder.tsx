import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useDrawer } from "@/context/DrawerContext";

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
  { id: "3", label: "Unit Tests", subtitle: "Jest + React Testing Library", icon: "check-circle", color: Colors.success, priority: "medium", notes: "Coverage below 70% on the auth module — fix before release." },
  { id: "4", label: "Deploy Pipeline", subtitle: "GitHub Actions, staging → prod", icon: "server", color: "#FAB005", priority: "high", notes: "Add smoke tests to the post-deploy step." },
  { id: "5", label: "Documentation", subtitle: "README, API reference, guides", icon: "file-text", color: "#BE4BDB", priority: "low", notes: "Changelog is three versions behind. Draft for v2.3." },
  { id: "6", label: "Performance Audit", subtitle: "Lighthouse, bundle analysis", icon: "zap", color: "#FD7E14", priority: "medium", notes: "Homepage LCP is 4.2s on mobile. Target under 2.5s." },
  { id: "7", label: "Accessibility", subtitle: "WCAG 2.1 AA compliance", icon: "eye", color: "#20C997", priority: "medium", notes: "Modal focus trapping broken in Safari. Screen reader labels missing on nav." },
  { id: "8", label: "Analytics Setup", subtitle: "Events, funnels, dashboards", icon: "bar-chart-2", color: "#74C0FC", priority: "low", notes: "Add conversion events for onboarding steps 2–4." },
  { id: "9", label: "Security Review", subtitle: "Deps audit, pen test prep", icon: "shield", color: "#FF6B6B", priority: "high", notes: "Three high-severity CVEs in lodash. Upgrade immediately." },
  { id: "10", label: "Mobile Responsiveness", subtitle: "Breakpoints, touch targets", icon: "smartphone", color: "#A9E34B", priority: "medium", notes: "Table component breaks below 375px. Fix column collapse." },
  { id: "11", label: "Onboarding Flow", subtitle: "First-run UX, tooltips", icon: "user-plus", color: "#DA77F2", priority: "low", notes: "Users drop off at step 3. Simplify the org creation form." },
  { id: "12", label: "Error Monitoring", subtitle: "Sentry, Datadog alerts", icon: "alert-triangle", color: "#FFA94D", priority: "medium", notes: "Set up error budgets. Alert when >0.5% error rate sustained 5 min." },
];

const INITIAL_CHECKLIST = [
  { id: "c1", label: "Review PR #47 — auth refactor", done: true },
  { id: "c2", label: "Update staging environment vars", done: false },
  { id: "c3", label: "Send v2.2 release notes to team", done: false },
  { id: "c4", label: "Tag v2.1.0 in git", done: true },
  { id: "c5", label: "Archive feature/old-login branch", done: false },
  { id: "c6", label: "Write migration guide for v2→v3", done: false },
  { id: "c7", label: "Bump min iOS version to 16", done: true },
  { id: "c8", label: "Remove deprecated API calls", done: false },
  { id: "c9", label: "Set up Dependabot alerts", done: false },
  { id: "c10", label: "QA sign-off on login flow", done: false },
  { id: "c11", label: "Update App Store screenshots", done: false },
  { id: "c12", label: "Enable 2FA for CI service accounts", done: true },
];

const INITIAL_SWIPE = [
  { id: "s1", label: "Feature Request: Dark Mode", tag: "Feature", color: Colors.primary },
  { id: "s2", label: "Bug: Login crash on iPad Pro", tag: "Bug", color: "#FF6B6B" },
  { id: "s3", label: "Chore: Update all dependencies", tag: "Chore", color: Colors.info },
  { id: "s4", label: "Feature: CSV export for reports", tag: "Feature", color: Colors.primary },
  { id: "s5", label: "Bug: Notifications not clearing", tag: "Bug", color: "#FF6B6B" },
  { id: "s6", label: "Improvement: Faster search indexing", tag: "Improve", color: "#FAB005" },
  { id: "s7", label: "Bug: Timezone offset wrong in EU", tag: "Bug", color: "#FF6B6B" },
  { id: "s8", label: "Chore: Remove legacy endpoints", tag: "Chore", color: Colors.info },
];

const PRIORITY_COLORS = { low: Colors.success, medium: "#FAB005", high: Colors.primary };
const PRIORITY_LABELS = { low: "Low", medium: "Medium", high: "High" };

function Section({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function DetailModal({
  item,
  onClose,
  onUpdate,
}: {
  item: Item | null;
  onClose: () => void;
  onUpdate: (updated: Item) => void;
}) {
  const [label, setLabel] = useState(item?.label ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [priority, setPriority] = useState<"low" | "medium" | "high">(item?.priority ?? "medium");
  const slideAnim = useRef(new Animated.Value(600)).current;
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

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 600, duration: 280, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
      Animated.timing(bgAnim, { toValue: 0, duration: 220, useNativeDriver: false }),
    ]).start(onClose);
  };

  const handleUpdate = () => {
    if (!item) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onUpdate({ ...item, label, notes, priority });
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 600, duration: 280, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
      Animated.timing(bgAnim, { toValue: 0, duration: 220, useNativeDriver: false }),
    ]).start(onClose);
  };

  const bgColor = bgAnim.interpolate({ inputRange: [0, 1], outputRange: ["rgba(0,0,0,0)", "rgba(0,0,0,0.65)"] });
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 24) : insets.bottom + 8;

  return (
    <Modal visible={!!item} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[styles.modalOverlay, { backgroundColor: bgColor }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <Animated.View style={[styles.modalSheet, { transform: [{ translateY: slideAnim }], paddingBottom: botPad }]}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <View style={[styles.modalIcon, { backgroundColor: `${item?.color ?? Colors.primary}20` }]}>
              <Feather name={item?.icon ?? "file"} size={20} color={item?.color ?? Colors.primary} />
            </View>
            <Text style={styles.modalTitle} numberOfLines={1}>Edit Task</Text>
            <Pressable style={styles.modalClose} onPress={handleClose}>
              <Feather name="x" size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.modalField}>
            <Text style={styles.fieldLabel}>TITLE</Text>
            <TextInput
              style={styles.fieldInput}
              value={label}
              onChangeText={setLabel}
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
            />
          </View>

          <View style={styles.modalField}>
            <Text style={styles.fieldLabel}>NOTES</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldTextArea]}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.modalField}>
            <Text style={styles.fieldLabel}>PRIORITY</Text>
            <View style={styles.priorityRow}>
              {(["low", "medium", "high"] as const).map((p) => (
                <Pressable
                  key={p}
                  style={[
                    styles.priorityBtn,
                    priority === p && { backgroundColor: `${PRIORITY_COLORS[p]}22`, borderColor: PRIORITY_COLORS[p] },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPriority(p);
                  }}
                >
                  <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[p] }]} />
                  <Text style={[styles.priorityText, priority === p && { color: PRIORITY_COLORS[p], fontFamily: "Inter_600SemiBold" }]}>
                    {PRIORITY_LABELS[p]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.modalActions}>
            <Pressable style={styles.cancelBtn} onPress={handleClose}>
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

function DraggableItem({
  item,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onPress,
}: {
  item: Item;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.item} onPress={onPress}>
      <View style={styles.dragHandle}>
        <Feather name="menu" size={16} color={Colors.textMuted} />
      </View>
      <View style={[styles.itemIcon, { backgroundColor: `${item.color}20` }]}>
        <Feather name={item.icon} size={16} color={item.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemLabel}>{item.label}</Text>
        <Text style={styles.itemSub}>{item.subtitle}</Text>
      </View>
      <View style={[styles.priorityPip, { backgroundColor: PRIORITY_COLORS[item.priority] }]} />
      <View style={styles.itemArrows}>
        <Pressable
          style={[styles.arrowBtn, index === 0 && styles.arrowDisabled]}
          onPress={(e) => { e.stopPropagation?.(); if (index > 0) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onMoveUp(); } }}
          disabled={index === 0}
          hitSlop={8}
        >
          <Feather name="chevron-up" size={14} color={index === 0 ? Colors.textMuted : Colors.textSecondary} />
        </Pressable>
        <Pressable
          style={[styles.arrowBtn, index === total - 1 && styles.arrowDisabled]}
          onPress={(e) => { e.stopPropagation?.(); if (index < total - 1) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onMoveDown(); } }}
          disabled={index === total - 1}
          hitSlop={8}
        >
          <Feather name="chevron-down" size={14} color={index === total - 1 ? Colors.textMuted : Colors.textSecondary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function AnimatedCheckItem({
  item,
  onRemove,
}: {
  item: { id: string; label: string; done: boolean };
  onRemove: (id: string) => void;
}) {
  const [done, setDone] = useState(item.done);
  const heightAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(item.done ? 1 : 0)).current;

  const toggle = () => {
    const next = !done;
    setDone(next);
    Haptics.impactAsync(next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);

    if (next) {
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: false, tension: 200, friction: 8 }).start();
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
          Animated.timing(heightAnim, { toValue: 0, duration: 320, delay: 150, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
        ]).start(() => onRemove(item.id));
      }, 600);
    } else {
      Animated.spring(checkScale, { toValue: 0, useNativeDriver: false, tension: 200, friction: 8 }).start();
    }
  };

  const rowHeight = heightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 52] });

  return (
    <Animated.View style={{ height: rowHeight, opacity: opacityAnim, overflow: "hidden" }}>
      <Pressable style={styles.checkItem} onPress={toggle}>
        <Animated.View style={[styles.checkBox, done && styles.checkBoxDone, { transform: [{ scale: checkScale.interpolate({ inputRange: [0, 1], outputRange: [1, 1] }) }] }]}>
          <Animated.View style={{ transform: [{ scale: checkScale }], opacity: checkScale }}>
            <Feather name="check" size={11} color="#fff" />
          </Animated.View>
        </Animated.View>
        <Text style={[styles.checkLabel, done && styles.checkLabelDone]} numberOfLines={1}>
          {item.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function SwipeableRow({
  item,
  onDelete,
  onPress,
}: {
  item: { id: string; label: string; tag: string; color: string };
  onDelete: (id: string) => void;
  onPress: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const heightAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const THRESHOLD = -90;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        const clamped = Math.max(g.dx, -140);
        translateX.setValue(Math.min(clamped, 0));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < THRESHOLD) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          Animated.timing(translateX, { toValue: -400, duration: 250, useNativeDriver: false, easing: Easing.in(Easing.quad) }).start(() => {
            Animated.parallel([
              Animated.timing(heightAnim, { toValue: 0, duration: 280, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
              Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
            ]).start(() => onDelete(item.id));
          });
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: false, tension: 120, friction: 10 }).start();
        }
      },
    })
  ).current;

  const deleteOpacity = translateX.interpolate({ inputRange: [-140, THRESHOLD, 0], outputRange: [1, 0.4, 0] });
  const rowHeight = heightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 60] });

  return (
    <Animated.View style={{ height: rowHeight, opacity: opacityAnim, overflow: "hidden", marginBottom: 2 }}>
      <View style={styles.swipeWrapper}>
        <Animated.View style={[styles.deleteBg, { opacity: deleteOpacity }]}>
          <Feather name="trash-2" size={18} color="#fff" />
          <Text style={styles.deleteBgText}>Delete</Text>
        </Animated.View>
        <Animated.View style={[styles.swipeRow, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
          <Pressable style={styles.swipeContent} onPress={onPress}>
            <View style={[styles.tagPill, { backgroundColor: `${item.color}20`, borderColor: `${item.color}40` }]}>
              <Text style={[styles.tagText, { color: item.color }]}>{item.tag}</Text>
            </View>
            <Text style={styles.swipeLabel} numberOfLines={1}>{item.label}</Text>
            <Feather name="chevron-right" size={14} color={Colors.textMuted} />
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export default function ReorderScreen() {
  const insets = useSafeAreaInsets();
  const { toggleDrawer } = useDrawer();
  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS);
  const [checkItems, setCheckItems] = useState(INITIAL_CHECKLIST.filter(i => !i.done));
  const [swipeItems, setSwipeItems] = useState(INITIAL_SWIPE);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [modalKey, setModalKey] = useState(0);

  const moveItem = (index: number, direction: "up" | "down") => {
    setItems((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const openModal = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalKey(k => k + 1);
    setSelectedItem(item);
  };

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

      <View style={styles.header}>
        <Pressable onPress={toggleDrawer} style={styles.iconBtn}>
          <Feather name="menu" size={20} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>Drag & Reorder</Text>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="x" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Section title="Reorderable List" />
        <Text style={styles.hint}>Tap a row to edit · Use arrows to reorder</Text>
        <View style={styles.listCard}>
          {items.map((item, index) => (
            <DraggableItem
              key={item.id}
              item={item}
              index={index}
              total={items.length}
              onMoveUp={() => moveItem(index, "up")}
              onMoveDown={() => moveItem(index, "down")}
              onPress={() => openModal(item)}
            />
          ))}
        </View>

        <Section title="Checklist — tap to complete & disappear" />
        <Text style={styles.hint}>{checkItems.length} remaining</Text>
        <View style={styles.listCard}>
          {checkItems.length === 0 ? (
            <View style={styles.allDone}>
              <Feather name="check-circle" size={28} color={Colors.success} />
              <Text style={styles.allDoneText}>All done!</Text>
            </View>
          ) : (
            checkItems.map((item) => (
              <AnimatedCheckItem
                key={item.id}
                item={item}
                onRemove={(id) => setCheckItems(prev => prev.filter(i => i.id !== id))}
              />
            ))
          )}
        </View>

        <Section title="Swipe to Delete" />
        <Text style={styles.hint}>Swipe left to delete a row</Text>
        {swipeItems.map((item) => (
          <SwipeableRow
            key={item.id}
            item={item}
            onDelete={(id) => setSwipeItems(prev => prev.filter(i => i.id !== id))}
            onPress={() => openModal({ id: item.id, label: item.label, subtitle: item.tag, icon: "file-text", color: item.color, priority: "medium", notes: "" })}
          />
        ))}
        {swipeItems.length === 0 && (
          <View style={styles.allDone}>
            <Feather name="trash-2" size={24} color={Colors.textMuted} />
            <Text style={styles.allDoneText}>All cleared</Text>
            <Pressable onPress={() => setSwipeItems(INITIAL_SWIPE)} style={styles.resetBtn}>
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    flex: 1,
    textAlign: "center",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scroll: { padding: 16 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 28,
    marginBottom: 8,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 10,
  },
  listCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
    backgroundColor: Colors.cardBg,
  },
  dragHandle: { padding: 4 },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  itemLabel: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  itemSub: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  priorityPip: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  itemArrows: { flexDirection: "row", gap: 2 },
  arrowBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: Colors.cardBgElevated,
  },
  arrowDisabled: { opacity: 0.25 },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxDone: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkLabel: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  checkLabelDone: {
    color: Colors.textMuted,
    textDecorationLine: "line-through",
  },
  allDone: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 8,
  },
  allDoneText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  resetBtn: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: Colors.cardBgElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resetBtnText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  swipeWrapper: {
    flex: 1,
    height: 58,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 2,
  },
  deleteBg: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 140,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: 20,
    gap: 6,
    borderRadius: 12,
  },
  deleteBgText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  swipeRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  swipeContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    height: "100%",
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  swipeLabel: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: Colors.border,
    gap: 16,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.cardBgElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalField: { gap: 6 },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  fieldInput: {
    backgroundColor: Colors.darkBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  fieldTextArea: {
    minHeight: 90,
    paddingTop: 11,
  },
  priorityRow: {
    flexDirection: "row",
    gap: 8,
  },
  priorityBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBgElevated,
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  priorityText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: Colors.cardBgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  updateBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: Colors.primary,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  updateBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
