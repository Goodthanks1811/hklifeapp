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

// ── Menu data ─────────────────────────────────────────────────────────────────
const SCRIPT_ITEMS = [
  { label: "IR Quick Add",  icon: "zap"       as const, route: "/ir-quick-add",  description: "Add to Notion DB"      },
  { label: "Mood Report",   icon: "activity"  as const, route: "/mood-report",   description: "Monthly mood charts"   },
  { label: "My Workload",   icon: "bar-chart" as const, route: "/my-workload",   description: "Created vs done"       },
  { label: "Review Digest", icon: "file-text" as const, route: null,             description: "Coming soon"           },
];

const UI_KIT_ITEMS = [
  { label: "Buttons",       icon: "square"    as const, route: "/ui-kit/buttons",  description: "Styles & states"   },
  { label: "Sliders",       icon: "sliders"   as const, route: "/ui-kit/sliders",  description: "Custom controls"   },
  { label: "Drag & Reorder",icon: "list"      as const, route: "/ui-kit/reorder",  description: "Hold to drag"      },
  { label: "Loaders",       icon: "loader"    as const, route: "/ui-kit/loaders",  description: "Save states"       },
  { label: "Modals",        icon: "layers"    as const, route: "/ui-kit/modals",   description: "Overlays & alerts" },
];

const ITEM_HEIGHT = 56;

// ── Accordion hook ────────────────────────────────────────────────────────────
function useAccordion(initialOpen: boolean, itemCount: number) {
  const [open, setOpen] = useState(initialOpen);
  const anim      = useRef(new Animated.Value(initialOpen ? 1 : 0)).current;
  const chevron   = useRef(new Animated.Value(initialOpen ? 1 : 0)).current;
  const lastPress = useRef(0);

  const toggle = () => {
    const now = Date.now();
    if (now - lastPress.current < 500) return;
    lastPress.current = now;

    const next = !open;
    setOpen(next);
    Animated.parallel([
      Animated.spring(anim,    { toValue: next ? 1 : 0, useNativeDriver: false, bounciness: 4 }),
      Animated.timing(chevron, { toValue: next ? 1 : 0, duration: 220, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const listHeight = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, itemCount * ITEM_HEIGHT],
  });

  const chevronRotate = chevron.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "90deg"],
  });

  return { open, toggle, listHeight, chevronRotate };
}

// ── Drawer ────────────────────────────────────────────────────────────────────
export function Drawer() {
  const { isOpen, drawerAnim, overlayAnim, closeDrawer, DRAWER_WIDTH } = useDrawer();
  const insets = useSafeAreaInsets();

  const scripts = useAccordion(true,  SCRIPT_ITEMS.length);
  const uiKit   = useAccordion(false, UI_KIT_ITEMS.length);

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
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} pointerEvents="auto">
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
      </Animated.View>

      <Animated.View
        style={[
          styles.drawer,
          { width: DRAWER_WIDTH, transform: [{ translateX: drawerAnim }] },
        ]}
      >
        {/* Header placeholder — image will go here */}
        <View style={{ height: topPad + 32 }} />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* UI Kit accordion — above Scripts */}
          <View style={styles.section}>
            <Pressable style={styles.accordionHeader} onPress={uiKit.toggle}>
              <Text style={styles.sectionLabel}>UI Kit</Text>
              <Animated.View style={{ transform: [{ rotate: uiKit.chevronRotate }] }}>
                <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
              </Animated.View>
            </Pressable>
            <Animated.View style={{ height: uiKit.listHeight, overflow: "hidden" }}>
              {UI_KIT_ITEMS.map((item) => (
                <MenuItem
                  key={item.route}
                  item={item}
                  onPress={() => navigate(item.route!)}
                />
              ))}
            </Animated.View>
          </View>

          <View style={styles.divider} />

          {/* Scripts accordion */}
          <View style={styles.section}>
            <Pressable style={styles.accordionHeader} onPress={scripts.toggle}>
              <Text style={styles.sectionLabel}>Scripts</Text>
              <Animated.View style={{ transform: [{ rotate: scripts.chevronRotate }] }}>
                <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
              </Animated.View>
            </Pressable>
            <Animated.View style={{ height: scripts.listHeight, overflow: "hidden" }}>
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

          {/* Settings */}
          <View style={styles.settingsSection}>
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
        </ScrollView>
      </Animated.View>
    </>
  );
}

// ── MenuItem ──────────────────────────────────────────────────────────────────
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
        <Feather name={item.icon} size={18} color={dimmed ? Colors.textMuted : Colors.primary} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, dimmed && styles.menuLabelDimmed]}>{item.label}</Text>
        <Text style={styles.menuDesc}>{item.description}</Text>
      </View>
      {!dimmed && <Feather name="chevron-right" size={14} color={Colors.textMuted} />}
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    zIndex: 100,
  },
  drawer: {
    position: "absolute",
    top: 0, left: 0, bottom: 0,
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
  scrollArea: { flex: 1 },
  section: { paddingHorizontal: 12, marginBottom: 4 },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  sectionLabel: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
    marginVertical: 6,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  menuItemPressed:  { backgroundColor: Colors.cardBg },
  menuItemDimmed:   { opacity: 0.45 },
  menuIcon: {
    width: 32, height: 32,
    backgroundColor: "rgba(224,49,49,0.1)",
    borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  menuIconDimmed:  { backgroundColor: "rgba(255,255,255,0.05)" },
  menuText:        { flex: 1 },
  menuLabel:       { color: Colors.textPrimary, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  menuLabelDimmed: { color: Colors.textMuted },
  menuDesc:        { color: Colors.textMuted,   fontSize: 11, fontFamily: "Inter_400Regular" },
  settingsSection: { paddingHorizontal: 20, paddingTop: 4 },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  settingsLabel: { color: Colors.textSecondary, fontSize: 14, fontFamily: "Inter_500Medium" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: Colors.cardBg,
    borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border,
    alignSelf: "flex-start",
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  badgeText: { color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_500Medium" },
});
