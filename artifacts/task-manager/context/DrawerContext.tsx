import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, Dimensions, Easing } from "react-native";

const SCREEN_WIDTH  = Dimensions.get("window").width;
export const isTablet      = SCREEN_WIDTH >= 768;
export const SIDEBAR_WIDTH = isTablet ? Math.min(300, Math.round(SCREEN_WIDTH * 0.28)) : 0;

const DRAWER_WIDTH_PHONE = Math.min(SCREEN_WIDTH * 0.78, 320);
export const DRAWER_WIDTH = isTablet ? SIDEBAR_WIDTH : DRAWER_WIDTH_PHONE;

// Shared spring config for open and gesture snap-back
const SPRING = { damping: 24, stiffness: 240, overshootClamping: true } as const;

interface DrawerContextType {
  isOpen:      boolean;
  drawerAnim:  Animated.Value; // translateX: -DRAWER_WIDTH (hidden) → 0 (visible)
  overlayAnim: Animated.Value; // iPhone scrim opacity 0→1
  spacerAnim:  Animated.Value; // iPad spacer width 0 → SIDEBAR_WIDTH
  openDrawer:  () => void;
  closeDrawer: () => void;
  toggleDrawer:() => void;
  DRAWER_WIDTH: number;
  isTablet:     boolean;
  SIDEBAR_WIDTH:number;
}

const DrawerContext = createContext<DrawerContextType | null>(null);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  // drawerAnim: native driver ok (transform)
  const drawerAnim  = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  // overlayAnim: native driver ok (opacity) — iPhone only
  const overlayAnim = useRef(new Animated.Value(0)).current;
  // spacerAnim: non-native driver required (width) — iPad only
  const spacerAnim  = useRef(new Animated.Value(0)).current;

  const openDrawer = useCallback(() => {
    setIsOpen(true);
    // Drawer slides in (native driver)
    Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, ...SPRING }).start();
    if (isTablet) {
      // iPad: spacer grows to push content right (non-native, width not supported on native driver)
      Animated.spring(spacerAnim, { toValue: SIDEBAR_WIDTH, useNativeDriver: false, ...SPRING }).start();
    } else {
      // iPhone: scrim fades in
      Animated.timing(overlayAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [drawerAnim, overlayAnim, spacerAnim]);

  const closeDrawer = useCallback(() => {
    Animated.timing(drawerAnim, { toValue: -DRAWER_WIDTH, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => setIsOpen(false));
    if (isTablet) {
      // iPad: spacer collapses
      Animated.timing(spacerAnim, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    } else {
      // iPhone: scrim fades out
      Animated.timing(overlayAnim, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [drawerAnim, overlayAnim, spacerAnim]);

  const toggleDrawer = useCallback(() => {
    if (isOpen) closeDrawer();
    else openDrawer();
  }, [isOpen, openDrawer, closeDrawer]);

  return (
    <DrawerContext.Provider value={{
      isOpen, drawerAnim, overlayAnim, spacerAnim,
      openDrawer, closeDrawer, toggleDrawer,
      DRAWER_WIDTH, isTablet, SIDEBAR_WIDTH,
    }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error("useDrawer must be inside DrawerProvider");
  return ctx;
}
