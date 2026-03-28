import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useDrawer } from "@/context/DrawerContext";

interface Item {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
}

const INITIAL_ITEMS: Item[] = [
  { id: "1", label: "Design System", icon: "layout", color: Colors.primary },
  { id: "2", label: "API Integration", icon: "code", color: Colors.info },
  { id: "3", label: "Unit Tests", icon: "check-circle", color: Colors.success },
  { id: "4", label: "Deploy Pipeline", icon: "server", color: "#FAB005" },
  { id: "5", label: "Documentation", icon: "file-text", color: "#BE4BDB" },
  { id: "6", label: "Performance", icon: "zap", color: "#FD7E14" },
];

const ITEM_HEIGHT = 70;

function DraggableItem({
  item,
  index,
  total,
  onMoveUp,
  onMoveDown,
  isDragging,
  onLongPress,
}: {
  item: Item;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isDragging: boolean;
  onLongPress: () => void;
}) {
  return (
    <Animated.View
      style={[
        styles.item,
        isDragging && styles.itemDragging,
      ]}
    >
      <Pressable
        style={styles.dragHandle}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          onLongPress();
        }}
      >
        <Feather name="menu" size={18} color={Colors.textMuted} />
      </Pressable>

      <View style={[styles.itemIcon, { backgroundColor: `${item.color}20` }]}>
        <Feather name={item.icon} size={18} color={item.color} />
      </View>

      <Text style={styles.itemLabel}>{item.label}</Text>

      <View style={styles.itemActions}>
        <Pressable
          style={[styles.arrowBtn, index === 0 && styles.arrowDisabled]}
          onPress={() => {
            if (index > 0) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onMoveUp();
            }
          }}
          disabled={index === 0}
        >
          <Feather name="chevron-up" size={16} color={index === 0 ? Colors.textMuted : Colors.textSecondary} />
        </Pressable>
        <Pressable
          style={[styles.arrowBtn, index === total - 1 && styles.arrowDisabled]}
          onPress={() => {
            if (index < total - 1) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onMoveDown();
            }
          }}
          disabled={index === total - 1}
        >
          <Feather name="chevron-down" size={16} color={index === total - 1 ? Colors.textMuted : Colors.textSecondary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function Section({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function ChecklistSection() {
  const [items, setItems] = useState([
    { id: "a", label: "Review PR #47", done: true },
    { id: "b", label: "Update staging env", done: false },
    { id: "c", label: "Send release notes", done: false },
    { id: "d", label: "Tag v2.1.0", done: true },
    { id: "e", label: "Archive old branch", done: false },
  ]);

  const toggle = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, done: !i.done } : i));
  };

  return (
    <View style={styles.card}>
      {items.map((item) => (
        <Pressable key={item.id} style={styles.checkItem} onPress={() => toggle(item.id)}>
          <View style={[styles.checkBox, item.done && styles.checkBoxDone]}>
            {item.done && <Feather name="check" size={12} color="#fff" />}
          </View>
          <Text style={[styles.checkLabel, item.done && styles.checkLabelDone]}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function ReorderScreen() {
  const insets = useSafeAreaInsets();
  const { toggleDrawer } = useDrawer();
  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const moveItem = (index: number, direction: "up" | "down") => {
    setItems((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
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
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 24 }]}
      >
        <Section title="Reorderable List" />
        <Text style={styles.hint}>Hold the grip handle or use arrows to reorder</Text>

        <View style={styles.listCard}>
          {items.map((item, index) => (
            <DraggableItem
              key={item.id}
              item={item}
              index={index}
              total={items.length}
              isDragging={draggingId === item.id}
              onLongPress={() => {
                setDraggingId(item.id);
                setTimeout(() => setDraggingId(null), 1000);
              }}
              onMoveUp={() => moveItem(index, "up")}
              onMoveDown={() => moveItem(index, "down")}
            />
          ))}
        </View>

        <Section title="Checklist" />
        <ChecklistSection />

        <Section title="Swipe Actions" />
        <View style={styles.swipeNote}>
          <Feather name="info" size={14} color={Colors.info} />
          <Text style={styles.swipeNoteText}>
            Swipe actions use native gestures — try on a real device via Expo Go
          </Text>
        </View>
        {["Feature Request: Dark Mode", "Bug: Login crash on iPad", "Chore: Update deps"].map((label, i) => (
          <View key={i} style={styles.swipeItem}>
            <View style={styles.swipeContent}>
              <View style={[styles.dot, { backgroundColor: [Colors.primary, Colors.warning, Colors.info][i] }]} />
              <Text style={styles.swipeLabel}>{label}</Text>
            </View>
            <View style={styles.swipeActions}>
              <Pressable
                style={[styles.swipeAction, { backgroundColor: "rgba(64,192,87,0.15)" }]}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              >
                <Feather name="check" size={14} color={Colors.success} />
              </Pressable>
              <Pressable
                style={[styles.swipeAction, { backgroundColor: "rgba(224,49,49,0.15)" }]}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
              >
                <Feather name="trash-2" size={14} color={Colors.primary} />
              </Pressable>
            </View>
          </View>
        ))}
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
  scroll: { padding: 20 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
    backgroundColor: Colors.cardBg,
  },
  itemDragging: {
    backgroundColor: "rgba(224,49,49,0.08)",
    borderColor: Colors.primary,
  },
  dragHandle: {
    padding: 6,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  itemLabel: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  itemActions: {
    flexDirection: "row",
    gap: 2,
  },
  arrowBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: Colors.cardBgElevated,
  },
  arrowDisabled: {
    opacity: 0.3,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
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
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  checkLabelDone: {
    color: Colors.textMuted,
    textDecorationLine: "line-through",
  },
  swipeNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(51,154,240,0.1)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(51,154,240,0.2)",
  },
  swipeNoteText: {
    color: Colors.info,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  swipeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
    overflow: "hidden",
  },
  swipeContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  swipeLabel: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  swipeActions: {
    flexDirection: "row",
    gap: 1,
  },
  swipeAction: {
    width: 44,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
});
