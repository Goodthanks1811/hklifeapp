import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenHeader } from "@/components/ScreenHeader";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

function Section({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function Btn({
  label,
  variant = "primary",
  size = "md",
  icon,
  disabled,
  loading,
  onPress,
}: {
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "success";
  size?: "sm" | "md" | "lg";
  icon?: keyof typeof Feather.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
}) {
  const bg: Record<string, string> = {
    primary: Colors.primary,
    secondary: Colors.cardBgElevated,
    ghost: "transparent",
    danger: "#C92A2A",
    outline: "transparent",
    success: Colors.success,
  };
  const textColor: Record<string, string> = {
    primary: "#fff",
    secondary: Colors.textPrimary,
    ghost: Colors.textSecondary,
    danger: "#fff",
    outline: Colors.primary,
    success: "#fff",
  };
  const border: Record<string, string | undefined> = {
    outline: Colors.primary,
    ghost: undefined,
    primary: undefined,
    secondary: Colors.border,
    danger: undefined,
    success: undefined,
  };
  const pad: Record<string, { paddingVertical: number; paddingHorizontal: number; fontSize: number }> = {
    sm: { paddingVertical: 7, paddingHorizontal: 14, fontSize: 12 },
    md: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 14 },
    lg: { paddingVertical: 16, paddingHorizontal: 28, fontSize: 16 },
  };

  const handlePress = () => {
    if (!disabled && !loading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress?.();
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg[variant],
          borderWidth: border[variant] ? 1 : 0,
          borderColor: border[variant],
          paddingVertical: pad[size].paddingVertical,
          paddingHorizontal: pad[size].paddingHorizontal,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor[variant]} />
      ) : (
        <>
          {icon && <Feather name={icon} size={pad[size].fontSize} color={textColor[variant]} />}
          <Text style={[styles.btnText, { color: textColor[variant], fontSize: pad[size].fontSize }]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export default function ButtonsScreen() {
  const insets = useSafeAreaInsets();
  const [toggled, setToggled] = useState(false);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ScreenHeader title="Buttons" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 24 }]}
      >
        <Section title="Variants" />
        <View style={styles.row}>
          <Btn label="Primary" variant="primary" />
          <Btn label="Secondary" variant="secondary" />
        </View>
        <View style={styles.row}>
          <Btn label="Danger" variant="danger" />
          <Btn label="Success" variant="success" />
        </View>
        <View style={styles.row}>
          <Btn label="Outline" variant="outline" />
          <Btn label="Ghost" variant="ghost" />
        </View>

        <Section title="Sizes" />
        <Btn label="Large Button" variant="primary" size="lg" />
        <View style={styles.spacer} />
        <Btn label="Medium Button" variant="primary" size="md" />
        <View style={styles.spacer} />
        <View style={styles.row}>
          <Btn label="Small" variant="primary" size="sm" />
          <Btn label="Small" variant="secondary" size="sm" />
        </View>

        <Section title="With Icons" />
        <Btn label="Save Changes" variant="primary" icon="save" />
        <View style={styles.spacer} />
        <Btn label="Add Item" variant="secondary" icon="plus" />
        <View style={styles.spacer} />
        <View style={styles.row}>
          <Btn label="Share" variant="outline" icon="share-2" size="sm" />
          <Btn label="Delete" variant="danger" icon="trash-2" size="sm" />
          <Btn label="Search" variant="ghost" icon="search" size="sm" />
        </View>

        <Section title="States" />
        <Btn label="Loading..." variant="primary" loading />
        <View style={styles.spacer} />
        <Btn label="Disabled" variant="primary" disabled />
        <View style={styles.spacer} />
        <Btn label="Disabled Outline" variant="outline" disabled />

        <Section title="Toggle & Icon Buttons" />
        <View style={styles.row}>
          <Pressable
            onPress={() => {
              setToggled((v) => !v);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[
              styles.toggleBtn,
              toggled && { backgroundColor: Colors.primary, borderColor: Colors.primary },
            ]}
          >
            <Text style={[styles.toggleText, toggled && { color: "#fff" }]}>
              {toggled ? "ON" : "OFF"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setLiked((v) => !v);
              if (!liked) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            style={styles.iconCircle}
          >
            <Feather
              name="heart"
              size={22}
              color={liked ? Colors.primary : Colors.textSecondary}
            />
          </Pressable>

          <Pressable
            onPress={() => {
              setBookmarked((v) => !v);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[styles.iconCircle, bookmarked && { borderColor: Colors.primary }]}
          >
            <Feather
              name="bookmark"
              size={22}
              color={bookmarked ? Colors.primary : Colors.textSecondary}
            />
          </Pressable>

          <Pressable
            style={styles.fabSmall}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
          >
            <Feather name="plus" size={20} color="#fff" />
          </Pressable>
        </View>

        <Section title="Full Width" />
        <Pressable
          style={styles.fullWidthBtn}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
        >
          <Feather name="arrow-right-circle" size={18} color="#fff" />
          <Text style={styles.fullWidthText}>Continue to Next Step</Text>
        </Pressable>

        <Pressable
          style={styles.destructiveBtn}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)}
        >
          <Feather name="trash-2" size={18} color={Colors.primary} />
          <Text style={styles.destructiveText}>Delete Account</Text>
        </Pressable>
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
  scroll: { padding: 20, gap: 0 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 24,
    marginBottom: 16,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  btn: {
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnText: { fontFamily: "Inter_600SemiBold" },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  spacer: { height: 10 },
  toggleBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBg,
  },
  toggleText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fabSmall: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidthBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 12,
  },
  fullWidthText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  destructiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(224,49,49,0.1)",
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(224,49,49,0.3)",
  },
  destructiveText: {
    color: Colors.primary,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
