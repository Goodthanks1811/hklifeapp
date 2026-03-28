import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
  {
    label: "Mood Report",
    icon: "activity" as const,
    route: "/mood-report",
    description: "Monthly mood charts",
  },
  {
    label: "Review Digest",
    icon: "file-text" as const,
    route: null,
    description: "Coming soon",
  },
];

// Height of a single script menu item (paddingVertical 10 * 2 + icon 36 + gaps ≈ 56)
const ITEM_HEIGHT = 56;

export function Drawer() {
  const { isOpen, drawerAnim, overlayAnim, closeDrawer, DRAWER_WIDTH } = useDrawer();
  const insets = useSafeAreaInsets();
  const [scriptsOpen, setScriptsOpen] = useState(true);

  const accordionAnim = useRef(new Animated.Value(1)).current;
  const chevronAnim   = useRef(new Animated.Value(1)).current;

  const collapsedHeight = 0;
  const expandedHeight  = SCRIPT_ITEMS.length * ITEM_HEIGHT;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(accordionAnim, {
        toValue: scriptsOpen ? 1 : 0,
        useNativeDriver: false,
        bounciness: 4,
      }),
      Animated.timing(chevronAnim, {
        toValue: scriptsOpen ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scriptsOpen]);

  const listHeight = accordionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [collapsedHeight, expandedHeight],
  });

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "90deg"],
  });

  if (!isOpen) return null;

  const navigate = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeDrawer();
    setTimeout(() => router.push(route as any), 200);
  };

  const topPad    = Platform.OS === "web" ? Math.max(insets.top, 67)    : insets.top;
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
        {/* Header */}
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

        {/* Navigation */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NAVIGATION</Text>
          {MENU_ITEMS.slice(0, 1).map((item) => (
            <MenuItem key={item.route} item={item} onPress={() => navigate(item.route)} />
          ))}
        </View>

        <View style={styles.divider} />

        {/* Scripts — accordion */}
        <View style={styles.section}>
          <Pressable
            style={styles.accordionHeader}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setScriptsOpen((v) => !v);
            }}
          >
            <Text style={styles.sectionLabel}>SCRIPTS</Text>
            <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
              <Feather name="chevron-right" size={14} color={Colors.textMuted} />
            </Animated.View>
          </Pressable>

          <Animated.View style={{ height: listHeight, overflow: "hidden" }}>
            {SCRIPT_ITEMS.map((item) => (
              <MenuItem
                key={item.label}
                item={item}
                onPress={item.route ? () => navigate(item.route!) : undefined}
                dimmed={!item.route}
              />
            ))}
          </Animated.View>
        </View>

        <View style={styles.divider} />

        {/* UI Kit */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>UI KIT</Text>
          {MENU_ITEMS.slice(1).map((item) => (
            <MenuItem key={item.route} item={item} onPress={() => navigate(item.route)} />
          ))}
        </View>

        <View style={styles.divider} />

        {/* Bottom — Settings */}
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
  dimmed,
}: {
  item: { label: string; icon: any; description: string };
  onPress?: () => void;
  dimmed?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        pressed && onPress && styles.menuItemPressed,
        dimmed && styles.menuItemDimmed,
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.menuIcon, dimmed && styles.menuIconDimmed]}>
        <Feather
          name={item.icon}
          size={18}
          color={dimmed ? Colors.textMuted : Colors.primary}
        />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, dimmed && styles.menuLabelDimmed]}>{item.label}</Text>
        <Text style={styles.menuDesc}>{item.description}</Text>
      </View>
      {!dimmed && <Feather name="chevron-right" size={14} color={Colors.textMuted} />}
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
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 8,
    paddingBottom: 2,
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
  menuItemDimmed: {
    opacity: 0.45,
  },
  menuIcon: {
    width: 36,
    height: 36,
    backgroundColor: "rgba(224,49,49,0.1)",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconDimmed: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  menuText: {
    flex: 1,
  },
  menuLabel: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  menuLabelDimmed: {
    color: Colors.textMuted,
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
