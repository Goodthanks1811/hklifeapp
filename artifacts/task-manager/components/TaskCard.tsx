import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors } from "@/constants/colors";
import type { NotionTask } from "@/context/NotionContext";

const STATUSES = ["Not started", "In Progress", "Done", "Backlog", "Cancelled"];

interface TaskCardProps {
  task: NotionTask;
  onStatusChange: (taskId: string, newStatus: string) => void;
}

function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority) return null;
  const colors: Record<string, string> = {
    urgent: "#E03131",
    high: "#FD7E14",
    medium: "#FAB005",
    low: "#40C057",
  };
  const color = colors[priority.toLowerCase()] || Colors.textMuted;
  return (
    <View style={[styles.priorityBadge, { borderColor: color }]}>
      <Text style={[styles.priorityText, { color }]}>
        {priority.toUpperCase()}
      </Text>
    </View>
  );
}

export function TaskCard({ task, onStatusChange }: TaskCardProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const pressY = React.useRef(new Animated.Value(0)).current;

  const statusColor =
    Colors.categories[task.status] || Colors.textMuted;

  const onPressIn = () => {
    Animated.timing(pressY, { toValue: 2, duration: 55, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(pressY, { toValue: 0, useNativeDriver: true, tension: 600, friction: 20 }).start();
  };

  const handleStatusSelect = (status: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onStatusChange(task.id, status);
    setMenuVisible(false);
  };

  return (
    <>
      <Animated.View style={[{ transform: [{ translateY: pressY }] }]}>
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setMenuVisible(true);
          }}
          style={styles.card}
          accessibilityLabel={`Task: ${task.title}`}
        >
          <View style={styles.cardHeader}>
            <View
              style={[styles.statusDot, { backgroundColor: statusColor }]}
            />
            <Text style={styles.statusLabel} numberOfLines={1}>
              {task.status}
            </Text>
            {task.priority && <PriorityBadge priority={task.priority} />}
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {task.title}
          </Text>

          {task.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {task.description}
            </Text>
          ) : null}

          <View style={styles.footer}>
            <View style={styles.tags}>
              {(task.tags || []).slice(0, 2).map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
            {task.dueDate ? (
              <View style={styles.dueRow}>
                <Feather name="calendar" size={11} color={Colors.textMuted} />
                <Text style={styles.dueText}>{task.dueDate}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.moveHint}>
            <Feather name="move" size={12} color={Colors.textMuted} />
            <Text style={styles.moveHintText}>Hold to move</Text>
          </View>
        </Pressable>
      </Animated.View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>Move to</Text>
            {STATUSES.map((status) => (
              <Pressable
                key={status}
                style={[
                  styles.menuItem,
                  task.status === status && styles.menuItemActive,
                ]}
                onPress={() => handleStatusSelect(status)}
              >
                <View
                  style={[
                    styles.menuDot,
                    {
                      backgroundColor:
                        Colors.categories[status] || Colors.textMuted,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.menuItemText,
                    task.status === status && styles.menuItemTextActive,
                  ]}
                >
                  {status}
                </Text>
                {task.status === status && (
                  <Feather name="check" size={14} color={Colors.primary} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  priorityBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  priorityText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
    marginBottom: 6,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginBottom: 8,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tags: {
    flexDirection: "row",
    gap: 4,
    flex: 1,
  },
  tag: {
    backgroundColor: Colors.cardBgElevated,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  dueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  dueText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  moveHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 8,
  },
  moveHintText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  menu: {
    backgroundColor: Colors.cardBgElevated,
    borderRadius: 16,
    padding: 8,
    width: "100%",
    maxWidth: 320,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    paddingVertical: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  menuItemActive: {
    backgroundColor: "rgba(224, 49, 49, 0.1)",
  },
  menuDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  menuItemText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  menuItemTextActive: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
});
