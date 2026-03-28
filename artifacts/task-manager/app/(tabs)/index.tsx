import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryColumn } from "@/components/CategoryColumn";
import { Colors } from "@/constants/colors";
import { useDrawer } from "@/context/DrawerContext";
import { useNotion } from "@/context/NotionContext";

const STATUSES = ["Not started", "In Progress", "Done", "Backlog", "Cancelled"];

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IS_TABLET = SCREEN_WIDTH >= 768;

function getColumnWidth() {
  if (IS_TABLET) {
    return (SCREEN_WIDTH - 48) / 3;
  }
  return SCREEN_WIDTH - 48;
}

export default function TaskBoardScreen() {
  const insets = useSafeAreaInsets();
  const { toggleDrawer } = useDrawer();
  const {
    tasks,
    updateTaskStatus,
  } = useNotion();

  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const columnWidth = getColumnWidth();

  const groupedTasks = useMemo(() => {
    const filtered = filterStatus
      ? tasks.filter((t) => t.status === filterStatus)
      : tasks;
    const grouped: Record<string, typeof tasks> = {};
    for (const s of STATUSES) {
      grouped[s] = filtered.filter((t) => t.status === s);
    }
    return grouped;
  }, [tasks, filterStatus]);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable
          style={styles.iconBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            toggleDrawer();
          }}
        >
          <Feather name="menu" size={20} color={Colors.textSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.logoMark} />
          <View>
            <Text style={styles.headerTitle}>TaskBoard</Text>
            <Text style={styles.headerSub}>UI Components</Text>
          </View>
        </View>
      </View>

      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {STATUSES.map((s) => {
            const isActive = filterStatus === s;
            const color = Colors.categories[s] || Colors.textMuted;
            return (
              <Pressable
                key={s}
                style={[
                  styles.filterChip,
                  isActive && { borderColor: color, backgroundColor: `${color}22` },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFilterStatus(isActive ? null : s);
                }}
              >
                <View style={[styles.filterDot, { backgroundColor: color }]} />
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && { color, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {s}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.emptyState}>
        <Feather name="layers" size={40} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>No tasks yet</Text>
        <Text style={styles.emptySubtitle}>
          Open the menu to explore the UI kit components
        </Text>
        <Pressable
          style={styles.menuHint}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            toggleDrawer();
          }}
        >
          <Feather name="menu" size={16} color="#fff" />
          <Text style={styles.menuHintText}>Open Menu</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.darkBg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoMark: {
    width: 32,
    height: 32,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    lineHeight: 22,
  },
  headerSub: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 14,
  },
  headerRight: {
    flexDirection: "row",
    gap: 4,
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
  filterRow: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBg,
  },
  filterChipActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(224, 49, 49, 0.12)",
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterChipText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  filterChipTextActive: {
    color: Colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    marginTop: 4,
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  board: {
    paddingHorizontal: 20,
    paddingTop: 16,
    flexDirection: "row",
  },
  boardVertical: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  columnWrapper: {
    marginBottom: 24,
  },
});
