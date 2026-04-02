import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, Dimensions, Easing } from "react-native";
import {
  useSharedValue,
  withSpring,
  withTiming,
  cancelAnimation,
  Easing as REasing,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

const SCREEN_WIDTH  = Dimensions.get("window").width;
export const isTablet      = SCREEN_WIDTH >= 768;
export const SIDEBAR_WIDTH = isTablet ? Math.min(300, Math.round(SCREEN_WIDTH * 0.28)) : 0;

const DRAWER_WIDTH_PHONE = Math.min(SCREEN_WIDTH * 0.78, 320);
export const DRAWER_WIDTH = isTablet ? SIDEBAR_WIDTH : DRAWER_WIDTH_PHONE;

// Spring config — identical for drawer (native) and spacer (UI thread) so they move as one
const RSPRING = { damping: 24, stiffness: 240, overshootClamping: true } as const;
const CLOSE_DUR = 300;

interface DrawerContextType {
  isOpen:         boolean;
  drawerAnim:     Animated.Value;    // native driver translateX: -DRAWER_WIDTH → 0
  overlayAnim:    Animated.Value;    // native driver opacity 0→1 (iPhone scrim)
  spacerWidth:    SharedValue<number>; // UI-thread spacer: 0 → SIDEBAR_WIDTH (iPad only)
  openDrawer:     () => void;
  closeDrawer:    () => void;
  instantClose:   () => void;        // snap shut instantly — no animation, no transition conflict
  toggleDrawer:   () => void;
  DRAWER_WIDTH:   number;
  isTablet:       boolean;
  SIDEBAR_WIDTH:  number;
}

const DrawerContext = createContext<DrawerContextType | null>(null);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  // Core Animated values — only used for native-driver animations (transform, opacity)
  const drawerAnim  = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Reanimated shared value for the spacer width — runs entirely on the UI thread,
  // no JS-bridge involvement, perfectly in sync with the drawer.
  const spacerWidth = useSharedValue(0);

  const openDrawer = useCallback(() => {
    setIsOpen(true);
    // Drawer translateX → native thread
    Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, ...RSPRING }).start();
    if (isTablet) {
      // Spacer width → UI thread (Reanimated). Same spring config = stays in sync.
      spacerWidth.value = withSpring(SIDEBAR_WIDTH, RSPRING);
    } else {
      // iPhone: scrim → native thread
      Animated.timing(overlayAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [drawerAnim, overlayAnim, spacerWidth]);

  const closeDrawer = useCallback(() => {
    Animated.timing(drawerAnim, {
      toValue: -DRAWER_WIDTH, duration: CLOSE_DUR,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start(() => setIsOpen(false));
    if (isTablet) {
      // Spacer width → UI thread. Same duration = stays in sync with drawer slide.
      spacerWidth.value = withTiming(0, { duration: CLOSE_DUR, easing: REasing.out(REasing.cubic) });
    } else {
      Animated.timing(overlayAnim, { toValue: 0, duration: CLOSE_DUR, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [drawerAnim, overlayAnim, spacerWidth]);

  // Instantly snaps the drawer shut — no animation.
  // Use this before navigating to non-life screens so no animation fights the screen transition.
  const instantClose = useCallback(() => {
    drawerAnim.stopAnimation();
    drawerAnim.setValue(-DRAWER_WIDTH);
    overlayAnim.stopAnimation();
    overlayAnim.setValue(0);
    cancelAnimation(spacerWidth);
    spacerWidth.value = 0;
    setIsOpen(false);
  }, [drawerAnim, overlayAnim, spacerWidth]);

  const toggleDrawer = useCallback(() => {
    if (isOpen) closeDrawer();
    else openDrawer();
  }, [isOpen, openDrawer, closeDrawer]);

  return (
    <DrawerContext.Provider value={{
      isOpen, drawerAnim, overlayAnim, spacerWidth,
      openDrawer, closeDrawer, instantClose, toggleDrawer,
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
