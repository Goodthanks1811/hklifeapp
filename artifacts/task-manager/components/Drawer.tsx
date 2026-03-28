import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useDrawer } from "@/context/DrawerContext";

const MENU_ITEMS = [
  {
    label: "Task Board",
    icon: "check-square" as const,
    route: "/",
    description: "Notion tasks",
  },
  {
    label: "Buttons",
    icon: "square" as const,
    route: "/ui-kit/buttons",
    description: "Styles & states",
  },
  {
    label: "Sliders",
    icon: "sliders" as const,
    route: "/ui-kit/sliders",
    description: "Custom controls",
  },
  {
    label: "Drag & Reorder",
    icon: "list" as const,
    route: "/ui-kit/reorder",
    description: "Hold to drag",
  },
  {
    label: "Loaders",
    icon: "loader" as const,
    route: "/ui-kit/loaders",
    description: "Save states",
  },
  {
    label: "Modals",
    icon: "layers" as const,
    route: "/ui-kit/modals",
    description: "Overlays & alerts",
  },
];

const SCRIPT_ITEMS = [
  {
    label: "IR Quick Add",
    icon: "zap" as const,
    route: "/ir-quick-add",
    description: "Add to Notion DB",
  },
];

export function Drawer() {
  const { isOpen, drawerAnim, overlayAnim, closeDrawer, DRAWER_WIDTH } = useDrawer();
  const insets = useSafeAreaInsets();

  if (!isOpen) return null;

  const navigate = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeDrawer();
    setTimeout(() => router.push(route as any), 200);
  };

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Animated.View
        style={[styles.overlay, { opacity: overlayAnim }]}
        pointerEvents="auto"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
      </Animated.View>

      <Animated.View
        style={[
          styles.drawer,
          {
            width: DRAWER_WIDTH,
            transform: [{ translateX: drawerAnim }],
            paddingTop: topPad,
            paddingBottom: bottomPad + 20,
          },
        ]}
      >
        <View style={styles.drawerHeader}>
          <View style={styles.logoRow}>
            <View style={styles.logoBox}>
              <Feather name="check-square" size={20} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.appName}>TaskBoard</Text>
              <Text style={styles.appSub}>UI Kit</Text>
            </View>
          </View>
          <Pressable onPress={closeDrawer} style={styles.closeBtn}>
            <Feather name="x" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NAVIGATION</Text>
          {MENU_ITEMS.slice(0, 1).map((item) => (
            <MenuItem key={item.route} item={item} onPress={() => navigate(item.route)} />
          ))}
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Scripts</Text>
          {SCRIPT_ITEMS.map((item) => (
            <MenuItem key={item.route} item={item} onPress={() => navigate(item.route)} />
          ))}
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>UI KIT</Text>
          {MENU_ITEMS.slice(1).map((item) => (
            <MenuItem key={item.route} item={item} onPress={() => navigate(item.route)} />
          ))}
        </View>

        <View style={styles.divider} />

        <View style={styles.bottom}>
          <Pressable
            style={({ pressed }) => [styles.settingsRow, pressed && styles.menuItemPressed]}
            onPress={() => navigate("/settings")}
          >
            <View style={styles.menuIcon}>
              <Feather name="settings" size={18} color={Colors.textSecondary} />
            </View>
            <Text style={styles.settingsLabel}>Settings</Text>
          </Pressable>
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>Built on Replit</Text>
          </View>
        </View>
      </Animated.View>
    </>
  );
}

function MenuItem({
  item,
  onPress,
}: {
  item: (typeof MENU_ITEMS)[0];
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={onPress}>
      <View style={styles.menuIcon}>
        <Feather name={item.icon} size={18} color={Colors.primary} />
      </View>
      <View style={styles.menuText}>
        <Text style={styles.menuLabel}>{item.label}</Text>
        <Text style={styles.menuDesc}>{item.description}</Text>
      </View>
      <Feather name="chevron-right" size={14} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    zIndex: 100,
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: "#111111",
    zIndex: 101,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoBox: {
    width: 36,
    height: 36,
    backgroundColor: "rgba(224,49,49,0.15)",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(224,49,49,0.3)",
  },
  appName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  appSub: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  closeBtn: {
    width: 32,
    height: 32,
    backgroundColor: Colors.cardBg,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  section: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
    marginVertical: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  menuItemPressed: {
    backgroundColor: Colors.cardBg,
  },
  menuIcon: {
    width: 36,
    height: 36,
    backgroundColor: "rgba(224,49,49,0.1)",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: {
    flex: 1,
  },
  menuLabel: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  menuDesc: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  bottom: {
    position: "absolute",
    bottom: 40,
    left: 20,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: Colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  badgeText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  settingsLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
