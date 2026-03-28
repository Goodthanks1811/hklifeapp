import React from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors } from "@/constants/colors";
import type { NotionTask } from "@/context/NotionContext";
import { TaskCard } from "@/components/TaskCard";

interface CategoryColumnProps {
  status: string;
  tasks: NotionTask[];
  onStatusChange: (taskId: string, newStatus: string) => void;
  columnWidth: number;
}

export function CategoryColumn({
  status,
  tasks,
  onStatusChange,
  columnWidth,
}: CategoryColumnProps) {
  const color = Colors.categories[status] || Colors.textMuted;

  return (
    <View style={[styles.column, { width: columnWidth }]}>
      <View style={styles.header}>
        <View style={[styles.colorBar, { backgroundColor: color }]} />
        <Text style={styles.statusTitle}>{status}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{tasks.length}</Text>
        </View>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TaskCard task={item} onStatusChange={onStatusChange} />
        )}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No tasks</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    marginRight: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  colorBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  statusTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    letterSpacing: 0.2,
  },
  countBadge: {
    backgroundColor: Colors.cardBgElevated,
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  empty: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
