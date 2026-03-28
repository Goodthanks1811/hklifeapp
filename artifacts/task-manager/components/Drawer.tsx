import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useDrawer } from "@/context/DrawerContext";

// ── Menu data ─────────────────────────────────────────────────────────────────
const REPORTS_ITEMS = [
  { label: "Mood Report",   icon: "activity"  as const, route: "/mood-report",   description: "Monthly mood charts" },
  { label: "My Workload",   icon: "bar-chart" as const, route: "/my-workload",   description: "Created vs done"     },
  { label: "March Sleep",   icon: "moon"      as const, route: "/march-sleep",   description: "Feb 28 – Mar 27"    },
  { label: "Review Digest", icon: "file-text" as const, route: null,             description: "Coming soon"         },
];

const PLACEHOLDER_ITEM = { label: "Coming soon", icon: "clock" as const, route: null, description: "In development" };

const APPS_ITEMS = [
  { label: "Mi Nena", icon: "heart" as const, route: "/mi-nena", description: "Photo & video gallery" },
];
const FOOTY_ITEMS = [PLACEHOLDER_ITEM];
const TOOLS_ITEMS = [
  { label: "IR Quick Add",  icon: "zap"         as const, route: "/ir-quick-add",   description: "Add to Notion DB"       },
  { label: "HK Quick Add",  icon: "plus-circle" as const, route: "/hk-quick-add",   description: "HK Automation task add" },
  { label: "Photo Slider",  icon: "image"       as const, route: "/photo-slider",   description: "Compare & export photos"},
];
const KNOWLEDGE_ITEMS = [PLACEHOLDER_ITEM];

const UI_KIT_ITEMS = [
  { label: "Buttons",        icon: "square"  as const, route: "/ui-kit/buttons", description: "Styles & states"   },
  { label: "Sliders",        icon: "sliders" as const, route: "/ui-kit/sliders", description: "Custom controls"   },
  { label: "Drag & Reorder", icon: "list"    as const, route: "/ui-kit/reorder", description: "Hold to drag"      },
  { label: "Loaders",        icon: "loader"  as const, route: "/ui-kit/loaders", description: "Save states"       },
  { label: "Modals",         icon: "layers"  as const, route: "/ui-kit/modals",  description: "Overlays & alerts" },
];

const ITEM_HEIGHT = 50;

// ── Accordion hook ────────────────────────────────────────────────────────────
function useAccordion(initialOpen: boolean, itemCount: number) {
  const openRef = useRef(initialOpen);
  const locked  = useRef(false);
  const anim    = useRef(new Animated.Value(initialOpen ? 1 : 0)).current;
  const chevron = useRef(new Animated.Value(initialOpen ? 1 : 0)).current;

  const toggle = () => {
    if (locked.current) return;
    locked.current = true;

    openRef.current = !openRef.current;
    const toValue = openRef.current ? 1 : 0;

    Animated.parallel([
      Animated.timing(anim,    { toValue, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(chevron, { toValue, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => { locked.current = false; });

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

  return { toggle, listHeight, chevronRotate };
}

// ── Accordion section ─────────────────────────────────────────────────────────
function AccordionSection({
  label,
  items,
  accordion,
  navigate,
}: {
  label: string;
  items: typeof REPORTS_ITEMS;
  accordion: ReturnType<typeof useAccordion>;
  navigate: (route: string) => void;
}) {
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.accordionHeader} onPress={accordion.toggle} activeOpacity={0.7}>
        <Text style={styles.sectionLabel}>{label}</Text>
        <Animated.View style={{ transform: [{ rotate: accordion.chevronRotate }] }}>
          <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
        </Animated.View>
      </TouchableOpacity>
      <Animated.View style={{ height: accordion.listHeight, overflow: "hidden" }}>
        {items.map((item, i) => (
          <MenuItem
            key={`${item.label}-${i}`}
            item={item}
            onPress={item.route ? () => navigate(item.route!) : undefined}
            dimmed={!item.route}
          />
        ))}
      </Animated.View>
    </View>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────
export function Drawer() {
  const { isOpen, drawerAnim, overlayAnim, closeDrawer, DRAWER_WIDTH } = useDrawer();
  const insets = useSafeAreaInsets();

  const reports   = useAccordion(true,  REPORTS_ITEMS.length);
  const apps      = useAccordion(false, APPS_ITEMS.length);
  const footy     = useAccordion(false, FOOTY_ITEMS.length);
  const tools     = useAccordion(false, TOOLS_ITEMS.length); 
  const knowledge = useAccordion(false, KNOWLEDGE_ITEMS.length);
  const uiKit     = useAccordion(false, UI_KIT_ITEMS.length);

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
        {/* Header image */}
        <View style={{ paddingTop: topPad + 16, paddingHorizontal: 16, paddingBottom: 32 }}>
          <Image
            source={{ uri: "https://i.postimg.cc/zXP1FYQG/IMG_9454.png" }}
            style={styles.headerImage}
            resizeMode="cover"
          />
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Reports */}
          <AccordionSection label="Reports"   items={REPORTS_ITEMS}   accordion={reports}   navigate={navigate} />
          <View style={styles.divider} />
          {/* Apps */}
          <AccordionSection label="Apps"      items={APPS_ITEMS}      accordion={apps}      navigate={navigate} />
          <View style={styles.divider} />
          {/* Footy */}
          <AccordionSection label="Footy"     items={FOOTY_ITEMS}     accordion={footy}     navigate={navigate} />
          <View style={styles.divider} />
          {/* Tools */}
          <AccordionSection label="Tools"     items={TOOLS_ITEMS}     accordion={tools}     navigate={navigate} />
          <View style={styles.divider} />
          {/* Knowledge */}
          <AccordionSection label="Knowledge" items={KNOWLEDGE_ITEMS} accordion={knowledge} navigate={navigate} />
          <View style={styles.divider} />
          {/* UI Kit — bottom */}
          <AccordionSection label="UI Kit"    items={UI_KIT_ITEMS}    accordion={uiKit}     navigate={navigate} />
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
        <Feather name={item.icon} size={16} color={dimmed ? Colors.textMuted : Colors.primary} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, dimmed && styles.menuLabelDimmed]}>{item.label}</Text>
        <Text style={styles.menuDesc}>{item.description}</Text>
      </View>
      {!dimmed && <Feather name="chevron-right" size={13} color={Colors.textMuted} />}
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
  headerImage: {
    width: "50%",
    height: 55,
    borderRadius: 10,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  scrollArea: { flex: 1 },
  section: { paddingHorizontal: 12, marginBottom: 2 },
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
    marginVertical: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    height: ITEM_HEIGHT,
  },
  menuItemPressed:  { backgroundColor: Colors.cardBg },
  menuItemDimmed:   { opacity: 0.45 },
  menuIcon: {
    width: 30, height: 30,
    backgroundColor: "rgba(224,49,49,0.1)",
    borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  menuIconDimmed:  { backgroundColor: "rgba(255,255,255,0.05)" },
  menuText:        { flex: 1 },
  menuLabel:       { color: Colors.textPrimary, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  menuLabelDimmed: { color: Colors.textMuted },
  menuDesc:        { color: Colors.textMuted,   fontSize: 11, fontFamily: "Inter_400Regular" },
  settingsSection: { paddingHorizontal: 20, paddingTop: 8 },
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
