import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router, usePathname } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  PanResponder,
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
import { useHeaderImage } from "@/context/HeaderImageContext";
import {
  SECTION_ORDER,
  SECTION_LABELS,
  useDrawerConfig,
  type SectionKey,
  type MenuItem,
} from "@/context/DrawerConfigContext";

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
      Animated.timing(anim,    { toValue, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(chevron, { toValue, duration: 220, easing: Easing.out(Easing.quad),  useNativeDriver: true }),
    ]).start(() => { locked.current = false; });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const listHeight = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, itemCount * ITEM_HEIGHT],
  });

  // Content fades in after height is mostly open, fades out before height collapses
  // This prevents the "partially rendered clipped items" look
  const contentOpacity = anim.interpolate({
    inputRange:  [0, 0.3, 1],
    outputRange: [0, 0,   1],
    extrapolate: "clamp",
  });

  const chevronRotate = chevron.interpolate({
    inputRange:  [0, 1],
    outputRange: ["0deg", "90deg"],
  });

  return { toggle, listHeight, contentOpacity, chevronRotate };
}

// ── Accordion section ─────────────────────────────────────────────────────────
function AccordionSection({
  label,
  items,
  accordion,
  navigate,
  permanentlyOpen,
}: {
  label:           string;
  items:           MenuItem[];
  accordion:       ReturnType<typeof useAccordion>;
  navigate:        (route: string) => void;
  permanentlyOpen?: boolean;
}) {
  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={permanentlyOpen ? undefined : accordion.toggle}
        activeOpacity={permanentlyOpen ? 1 : 0.7}
      >
        <Text style={styles.sectionLabel}>{label}</Text>
        {!permanentlyOpen && (
          <Animated.View style={{ transform: [{ rotate: accordion.chevronRotate }] }}>
            <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
          </Animated.View>
        )}
      </TouchableOpacity>
      <Animated.View style={{ height: accordion.listHeight, overflow: "hidden", backgroundColor: "#111111" }}>
        <Animated.View style={{ opacity: accordion.contentOpacity }}>
          {items.map((item, i) => (
            <DrawerMenuItem
              key={`${item.label}-${i}`}
              item={item}
              onPress={item.route ? () => navigate(item.route!) : undefined}
              dimmed={!item.route}
            />
          ))}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────
export function Drawer() {
  const {
    isOpen, drawerAnim, overlayAnim,
    openDrawer, closeDrawer,
    DRAWER_WIDTH, isTablet,
  } = useDrawer();

  const { getVisible, getSectionOrder, isSectionHidden, sidebarAlwaysOpen } = useDrawerConfig();

  const pathname     = usePathname();
  const onLifeScreen = pathname.startsWith("/life/");

  // Keep a ref so gesture handlers can read isOpen without stale closure
  const isOpenRef = useRef(isOpen);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  // On iPad: auto-open on life screens, auto-close on others (unless sidebarAlwaysOpen)
  useEffect(() => {
    if (!isTablet) return;
    if (sidebarAlwaysOpen || onLifeScreen) openDrawer();
    else closeDrawer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTablet, onLifeScreen, sidebarAlwaysOpen]);

  // ── Drawer panel: swipe left to close ─────────────────────────────────────
  const drawerPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      isOpenRef.current && dx < -6 && Math.abs(dx) > Math.abs(dy) * 1.5,
    onPanResponderGrant: () => {
      drawerAnim.stopAnimation();
      overlayAnim.stopAnimation();
    },
    onPanResponderMove: (_, { dx }) => {
      const newX = Math.max(-DRAWER_WIDTH, Math.min(0, dx));
      drawerAnim.setValue(newX);
      overlayAnim.setValue(1 + newX / DRAWER_WIDTH);
    },
    onPanResponderRelease: (_, { dx, vx }) => {
      if (dx < -(DRAWER_WIDTH * 0.3) || vx < -0.4) {
        closeDrawer();
      } else {
        Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220, overshootClamping: true }).start();
        Animated.timing(overlayAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
      }
    },
  })).current;

  // ── Left-edge zone: swipe right to open ───────────────────────────────────
  const edgePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      !isOpenRef.current && dx > 6 && Math.abs(dx) > Math.abs(dy) * 1.5,
    onPanResponderGrant: () => {
      drawerAnim.stopAnimation();
      overlayAnim.stopAnimation();
    },
    onPanResponderMove: (_, { dx }) => {
      const newX = Math.max(-DRAWER_WIDTH, Math.min(0, -DRAWER_WIDTH + dx));
      drawerAnim.setValue(newX);
      overlayAnim.setValue(1 + newX / DRAWER_WIDTH);
    },
    onPanResponderRelease: (_, { dx, vx }) => {
      if (dx > DRAWER_WIDTH * 0.3 || vx > 0.4) {
        openDrawer();
      } else {
        Animated.spring(drawerAnim, { toValue: -DRAWER_WIDTH, useNativeDriver: true, damping: 22, stiffness: 220, overshootClamping: true }).start();
        Animated.timing(overlayAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start();
      }
    },
  })).current;

  const { uri: bannerUri, resizeMode: bannerResizeMode, offsetX: bannerOffX, offsetY: bannerOffY, update: bannerUpdate } = useHeaderImage();

  const pickBannerImage = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      bannerUpdate({ uri: result.assets[0].uri, offsetX: 0, offsetY: 0 });
    }
  }, [bannerUpdate]);

  const FALLBACK_BANNER = "https://i.postimg.cc/kX9yvMfb/Photoroom_20260401_052316.png";
  const insets = useSafeAreaInsets();

  const sectionOrder = getSectionOrder();

  const visibleItems: Record<SectionKey, MenuItem[]> = {} as any;
  for (const key of SECTION_ORDER) {
    visibleItems[key] = getVisible(key);
  }

  const reports   = useAccordion(false, visibleItems.reports.length);
  const life      = useAccordion(true,  visibleItems.life.length);
  const apps      = useAccordion(false, visibleItems.apps.length);
  const footy     = useAccordion(false, visibleItems.footy.length);
  const tools     = useAccordion(false, visibleItems.tools.length);
  const knowledge = useAccordion(false, visibleItems.knowledge.length);
  const uiKit     = useAccordion(false, visibleItems.uikit.length);

  const accordions: Record<SectionKey, ReturnType<typeof useAccordion>> = {
    reports, life, apps, footy, tools, knowledge, uikit: uiKit,
  };

  const navigate = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isTablet) {
      // On iPad: life screens keep the drawer open; others close it for full-screen.
      // sidebarAlwaysOpen overrides this to keep the drawer open on every screen.
      if (sidebarAlwaysOpen || route.startsWith("/life/")) {
        openDrawer();
      } else {
        closeDrawer();
      }
      router.replace(route as any);
    } else {
      closeDrawer();
      setTimeout(() => router.push(route as any), 30);
    }
  };

  const topPad    = Platform.OS === "web" ? Math.max(insets.top, 67)    : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const drawerContent = (
    <View style={[styles.drawerInner, { width: DRAWER_WIDTH }]}>
      <View style={{ paddingTop: topPad + (isTablet ? 74 : 12), paddingBottom: isTablet ? 20 : 24 }}>
        <Pressable onPress={pickBannerImage} style={[styles.bannerContainer, { height: isTablet ? 150 : 100 }]}>
          <Image
            source={{ uri: bannerUri ?? FALLBACK_BANNER }}
            style={[
              StyleSheet.absoluteFill,
              bannerUri ? { transform: [{ translateX: bannerOffX }, { translateY: bannerOffY }] } : undefined,
            ]}
            resizeMode={bannerUri ? bannerResizeMode : "cover"}
          />
          {/* bottom fade into drawer bg */}
          <LinearGradient
            colors={["transparent", "#111111"]}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 52 }}
            pointerEvents="none"
          />
          {/* left fade */}
          <LinearGradient
            colors={["#111111", "transparent"]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 48 }}
            pointerEvents="none"
          />
          {/* right fade */}
          <LinearGradient
            colors={["transparent", "#111111"]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 48 }}
            pointerEvents="none"
          />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {sectionOrder.filter((key) => !isSectionHidden(key)).map((key) => (
          <React.Fragment key={key}>
            <AccordionSection
              label={SECTION_LABELS[key]}
              items={visibleItems[key]}
              accordion={accordions[key]}
              navigate={navigate}
              permanentlyOpen={false}
            />
            <View style={styles.divider} />
          </React.Fragment>
        ))}

        <View style={styles.settingsSection}>
          <Pressable
            style={({ pressed }) => [styles.settingsRow, pressed && styles.menuItemPressed, pressed && { transform: [{ translateY: 2 }] }]}
            onPress={() => navigate("/settings")}
          >
            <View style={styles.menuIcon}>
              <Feather name="settings" size={18} color={Colors.textSecondary} />
            </View>
            <Text style={styles.settingsLabel}>Settings</Text>
          </Pressable>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>Built on Replit</Text>
            </View>
            {__DEV__ && (
              <View style={styles.devBadge}>
                <Text style={styles.devBadgeText}>DEV</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );

  // Scrim opacity: subtle on iPad (drawer is a sidebar), fuller on iPhone
  const overlayOpacity = overlayAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, isTablet ? 0.4 : 0.6],
  });

  return (
    <>
      {/* Invisible left-edge zone — captures right-swipe to open */}
      <View style={styles.edgeZone} {...edgePan.panHandlers} />

      {/* Scrim — tap to close, transparent when drawer is closed */}
      <Animated.View
        style={[styles.overlay, { opacity: overlayOpacity }]}
        pointerEvents={isOpen ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
      </Animated.View>

      {/* Drawer panel — always mounted, slides off-screen when closed */}
      <Animated.View
        style={[styles.drawer, { width: DRAWER_WIDTH, transform: [{ translateX: drawerAnim }] }]}
        {...drawerPan.panHandlers}
      >
        {drawerContent}
      </Animated.View>
    </>
  );
}

// ── DrawerMenuItem ─────────────────────────────────────────────────────────────
function DrawerMenuItem({
  item,
  onPress,
  dimmed,
}: {
  item:     MenuItem;
  onPress?: () => void;
  dimmed?:  boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        pressed && onPress && styles.menuItemPressed,
        pressed && onPress && { transform: [{ translateY: 2 }] },
        dimmed && styles.menuItemDimmed,
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.menuIcon, dimmed && styles.menuIconDimmed]}>
        <Feather name={item.icon as any} size={16} color={dimmed ? Colors.textMuted : Colors.primary} />
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
  edgeZone: {
    position: "absolute",
    top: 0, left: 0, bottom: 0,
    width: 20,
    zIndex: 99,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
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
  drawerInner: {
    flex: 1,
    backgroundColor: "#111111",
  },
  bannerContainer: {
    width: "100%",
    height: 100,
    overflow: "hidden",
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
    fontSize: 18,
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
  menuLabel:       { color: Colors.textPrimary, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  menuLabelDimmed: { color: Colors.textMuted },
  menuDesc:        { color: Colors.textMuted,   fontSize: 12, fontFamily: "Inter_400Regular" },
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
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  devBadge: {
    paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: "rgba(224,49,49,0.15)",
    borderRadius: 20,
    borderWidth: 1, borderColor: Colors.primary,
    alignSelf: "flex-start",
  },
  devBadgeText: { color: Colors.primary, fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1 },
});
