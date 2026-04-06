import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { router, usePathname } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
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
  SECTION_ICONS,
  useDrawerConfig,
  type SectionKey,
  type MenuItem,
} from "@/context/DrawerConfigContext";

// ── Root section row ───────────────────────────────────────────────────────────
function SectionRow({
  sectionKey,
  onPress,
}: {
  sectionKey: SectionKey;
  onPress:    () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.sectionRow,
        pressed && styles.sectionRowPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.menuIcon}>
        <Feather name={SECTION_ICONS[sectionKey] as any} size={17} color={Colors.primary} />
      </View>
      <Text style={styles.sectionRowLabel}>{SECTION_LABELS[sectionKey]}</Text>
      <Feather name="chevron-right" size={16} color={Colors.textMuted} />
    </Pressable>
  );
}

// ── Section children view ──────────────────────────────────────────────────────
function SectionChildrenView({
  sectionKey,
  items,
  onBack,
  navigate,
  pathname,
  bottomPad,
}: {
  sectionKey: SectionKey;
  items:      MenuItem[];
  onBack:     () => void;
  navigate:   (route: string) => void;
  pathname:   string;
  bottomPad:  number;
}) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={10}>
          <Feather name="chevron-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.sectionHeaderTitle}>
          <View style={styles.sectionHeaderIcon}>
            <Feather name={SECTION_ICONS[sectionKey] as any} size={16} color={Colors.primary} />
          </View>
          <Text style={styles.sectionHeaderLabel}>{SECTION_LABELS[sectionKey]}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: bottomPad + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item, i) => (
          <DrawerMenuItem
            key={`${item.label}-${i}`}
            item={item}
            onPress={item.route ? () => navigate(item.route!) : undefined}
            dimmed={!item.route}
            isActive={!!item.route && pathname === item.route}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── DrawerMenuItem ─────────────────────────────────────────────────────────────
function DrawerMenuItem({
  item,
  onPress,
  dimmed,
  isActive,
}: {
  item:      MenuItem;
  onPress?:  () => void;
  dimmed?:   boolean;
  isActive?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        isActive && styles.menuItemActive,
        pressed && onPress && !isActive && styles.menuItemPressed,
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
        <Text style={[styles.menuLabel, dimmed && styles.menuLabelDimmed, isActive && styles.menuLabelActive]}>
          {item.label}
        </Text>
      </View>
      {!dimmed && (
        <Feather name="chevron-right" size={13} color={isActive ? Colors.primary : Colors.textMuted} />
      )}
    </Pressable>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────
export function Drawer() {
  const {
    isOpen, drawerAnim, overlayAnim, spacerWidth,
    openDrawer, closeDrawer,
    drawerMode, drawerModeRef, setDrawerMode,
    skipAutoCloseRef,
    DRAWER_WIDTH, SIDEBAR_WIDTH, isTablet,
  } = useDrawer();

  const { getVisible, getSectionOrder, isSectionHidden, sidebarAlwaysOpen } = useDrawerConfig();

  const pathname     = usePathname();
  const isLifeRoute  = (r: string) => r === "/calendar" || r.startsWith("/life/") || r === "/ui-kit/gradient-header";
  const onLifeScreen = isLifeRoute(pathname);

  const isOpenRef = useRef(isOpen);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  // Phone: close drawer on route change
  useEffect(() => {
    if (isTablet) return;
    if (skipAutoCloseRef.current) { skipAutoCloseRef.current = false; return; }
    closeDrawer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isTablet]);

  useEffect(() => {
    if (isTablet) return undefined;
    const sub = Linking.addEventListener("url", () => { closeDrawer(); });
    return () => sub.remove();
  }, [isTablet, closeDrawer]);

  // ── Two-panel slide navigation ─────────────────────────────────────────────
  const slideAnim        = useRef(new Animated.Value(0)).current;
  const [activeSectionKey,  setActiveSectionKey]  = useState<SectionKey | null>(null);
  const [renderSectionKey,  setRenderSectionKey]  = useState<SectionKey | null>(null);

  const enterSection = useCallback((key: SectionKey) => {
    setRenderSectionKey(key);
    setActiveSectionKey(key);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(slideAnim, {
      toValue: 1,
      tension: 220,
      friction: 26,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const exitSection = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 220,
      friction: 26,
      useNativeDriver: true,
    }).start(() => {
      setActiveSectionKey(null);
      setRenderSectionKey(null);
    });
  }, [slideAnim]);

  // Reset to root panel when drawer closes
  const scrollRootRef    = useRef<ScrollView>(null);
  useEffect(() => {
    if (isOpen) {
      scrollRootRef.current?.scrollTo({ y: 0, animated: false });
    } else {
      const t = setTimeout(() => {
        slideAnim.setValue(0);
        setActiveSectionKey(null);
        setRenderSectionKey(null);
      }, 320);
      return () => clearTimeout(t);
    }
  }, [isOpen, slideAnim]);

  // iPad sidebar logic
  useEffect(() => {
    if (!isTablet) return;
    if (onLifeScreen || sidebarAlwaysOpen) {
      setDrawerMode("sidebar");
      openDrawer();
    } else {
      setDrawerMode("overlay");
      closeDrawer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTablet, onLifeScreen, sidebarAlwaysOpen]);

  // Gesture sync
  const syncGesture = (newX: number) => {
    drawerAnim.setValue(newX);
    if (isTablet && drawerModeRef.current === "sidebar") {
      spacerWidth.value = Math.max(0, SIDEBAR_WIDTH + newX);
    } else {
      overlayAnim.setValue(1 + newX / DRAWER_WIDTH);
    }
  };

  const drawerPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      isOpenRef.current && dx < -6 && Math.abs(dx) > Math.abs(dy) * 1.5,
    onPanResponderGrant: () => {
      drawerAnim.stopAnimation();
      overlayAnim.stopAnimation();
    },
    onPanResponderMove: (_, { dx }) => syncGesture(Math.max(-DRAWER_WIDTH, Math.min(0, dx))),
    onPanResponderRelease: (_, { dx, vx }) => {
      if (dx < -(DRAWER_WIDTH * 0.3) || vx < -0.4) closeDrawer();
      else openDrawer();
    },
  })).current;

  const edgePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      !isOpenRef.current && dx > 6 && Math.abs(dx) > Math.abs(dy) * 1.5,
    onPanResponderGrant: () => {
      drawerAnim.stopAnimation();
      overlayAnim.stopAnimation();
    },
    onPanResponderMove: (_, { dx }) => syncGesture(Math.max(-DRAWER_WIDTH, Math.min(0, -DRAWER_WIDTH + dx))),
    onPanResponderRelease: (_, { dx, vx }) => {
      if (dx > DRAWER_WIDTH * 0.3 || vx > 0.4) openDrawer();
      else closeDrawer();
    },
  })).current;

  const { uri: bannerUri, offsetX: bannerOffX, offsetY: bannerOffY, scale: bannerScale } = useHeaderImage();

  const FALLBACK_BANNER = "https://i.postimg.cc/kX9yvMfb/Photoroom_20260401_052316.png";
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? Math.max(insets.top, 67)    : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const sectionOrder   = getSectionOrder();
  const visibleItems: Record<SectionKey, MenuItem[]> = {} as any;
  for (const key of SECTION_ORDER) {
    visibleItems[key] = getVisible(key);
  }

  const navigate = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isTablet) {
      if (isLifeRoute(route) || sidebarAlwaysOpen) {
        router.replace(route as any);
      } else {
        closeDrawer();
        router.replace(route as any);
      }
    } else {
      closeDrawer();
      setTimeout(() => router.replace(route as any), 20);
    }
  };

  // Panel translate values
  const rootTranslate = slideAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, -DRAWER_WIDTH],
  });
  const childTranslate = slideAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [DRAWER_WIDTH, 0],
  });

  const drawerContent = (
    <View style={[styles.drawerInner, { width: DRAWER_WIDTH }]}>
      {/* Banner — tap goes back to root if in a section */}
      <Pressable
        onPress={activeSectionKey ? exitSection : undefined}
        style={[styles.bannerContainer, { height: isTablet ? topPad + 150 : topPad + 122 }]}
      >
        {(() => {
          const uri = bannerUri ?? FALLBACK_BANNER;
          const sc  = Math.max(1.0, bannerScale ?? 1.0);
          return (
            <Image
              source={{ uri }}
              style={{
                position: "absolute",
                top: 0, left: 0, right: 0, bottom: 0,
                transform: bannerUri ? [
                  { scale:      sc },
                  { translateX: bannerOffX },
                  { translateY: bannerOffY },
                ] : [{ scale: 1 }],
              }}
              resizeMode="cover"
            />
          );
        })()}
      </Pressable>

      {/* Sliding panel container */}
      <View style={styles.panelClip}>
        {/* Root panel — all sections */}
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: rootTranslate }] }]}>
          <ScrollView
            ref={scrollRootRef}
            style={styles.scrollArea}
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: bottomPad + 100 }}
            showsVerticalScrollIndicator={false}
          >
            {sectionOrder
              .filter((key) => !isSectionHidden(key))
              .map((key) => (
                <SectionRow
                  key={key}
                  sectionKey={key}
                  onPress={() => enterSection(key)}
                />
              ))}

            <View style={styles.settingsSection}>
              <Pressable
                style={({ pressed }) => [styles.settingsRow, pressed && styles.menuItemPressed]}
                onPress={() => navigate("/settings")}
              >
                <View style={styles.menuIcon}>
                  <Feather name="settings" size={17} color={Colors.primary} />
                </View>
                <Text style={styles.sectionRowLabel}>Settings</Text>
                <Feather name="chevron-right" size={16} color={Colors.textMuted} />
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
        </Animated.View>

        {/* Section panel — children of selected section */}
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: childTranslate }] }]}>
          {renderSectionKey && (
            <SectionChildrenView
              sectionKey={renderSectionKey}
              items={visibleItems[renderSectionKey]}
              onBack={exitSection}
              navigate={navigate}
              pathname={pathname}
              bottomPad={bottomPad}
            />
          )}
        </Animated.View>
      </View>
    </View>
  );

  const overlayOpacity = overlayAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, 0.6],
  });

  return (
    <>
      <View style={styles.edgeZone} {...edgePan.panHandlers} />

      {(!isTablet || drawerMode === "overlay") && (
        <Animated.View
          style={[styles.overlay, { opacity: overlayOpacity }]}
          pointerEvents={isOpen ? "auto" : "none"}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
        </Animated.View>
      )}

      <Animated.View
        style={[styles.drawer, { width: DRAWER_WIDTH, transform: [{ translateX: drawerAnim }] }]}
        {...drawerPan.panHandlers}
      >
        {drawerContent}
      </Animated.View>
    </>
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
    overflow: "hidden",
  },
  panelClip: {
    flex: 1,
    overflow: "hidden",
  },
  scrollArea: { flex: 1 },

  // ── Root section rows ──────────────────────────────────────────────────────
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    height: 50,
  },
  sectionRowPressed: { backgroundColor: Colors.cardBg },
  sectionRowLabel: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },

  // ── Section detail header ──────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  backBtn: {
    width: 32, height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeaderTitle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionHeaderIcon: {
    width: 30, height: 30,
    backgroundColor: "rgba(224,49,49,0.1)",
    borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  sectionHeaderLabel: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },

  // ── Child menu items ───────────────────────────────────────────────────────
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    height: 50,
  },
  menuItemPressed:  { backgroundColor: Colors.cardBg },
  menuItemDimmed:   { opacity: 0.45 },
  menuItemActive:   {},
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
  menuLabelActive: { color: Colors.primary },

  // ── Settings row ──────────────────────────────────────────────────────────
  settingsSection: { paddingTop: 8 },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    height: 50,
    marginBottom: 12,
  },

  // ── Badge ─────────────────────────────────────────────────────────────────
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
