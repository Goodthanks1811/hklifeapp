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

// "sidebar" — drawer pushes content right (Life screens on iPad)
// "overlay" — drawer floats over content, content never moves (all other screens)
export type DrawerMode = "sidebar" | "overlay";

interface DrawerContextType {
  isOpen:              boolean;
  drawerAnim:          Animated.Value;
  overlayAnim:         Animated.Value;
  spacerWidth:         SharedValue<number>;
  drawerMode:          DrawerMode;
  drawerModeRef:       React.MutableRefObject<DrawerMode>;
  setDrawerMode:       (mode: DrawerMode) => void;
  openDrawer:          () => void;
  closeDrawer:         () => void;
  instantClose:        () => void;
  toggleDrawer:        () => void;
  openDrawerToSection: (key: string) => void;
  pendingSectionRef:   React.MutableRefObject<string | null>;
  skipNextAutoClose:   () => void;
  skipAutoCloseRef:    React.MutableRefObject<boolean>;
  DRAWER_WIDTH:        number;
  isTablet:            boolean;
  SIDEBAR_WIDTH:       number;
}

const DrawerContext = createContext<DrawerContextType | null>(null);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);

  // drawerMode — sidebar pushes content, overlay floats above it
  const [drawerMode, setDrawerModeState] = useState<DrawerMode>("sidebar");
  const drawerModeRef = useRef<DrawerMode>("sidebar");
  const setDrawerMode = useCallback((mode: DrawerMode) => {
    drawerModeRef.current = mode;
    setDrawerModeState(mode);
  }, []);

  // Core Animated values
  // Start open: drawerAnim = 0 (fully visible), overlayAnim = 1 on phone (scrim shown)
  const drawerAnim  = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(isTablet ? 0 : 1)).current;

  // Reanimated shared value for the spacer width — UI thread only, sidebar mode only
  const spacerWidth = useSharedValue(isTablet ? SIDEBAR_WIDTH : 0);

  const openDrawer = useCallback(() => {
    setIsOpen(true);
    Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, ...RSPRING }).start();
    if (isTablet) {
      if (drawerModeRef.current === "sidebar") {
        // Sidebar: push content right
        spacerWidth.value = withSpring(SIDEBAR_WIDTH, RSPRING);
      } else {
        // Overlay on iPad: dim behind drawer, content stays full-width
        Animated.timing(overlayAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      }
    } else {
      // iPhone: always overlay with scrim
      Animated.timing(overlayAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [drawerAnim, overlayAnim, spacerWidth]);

  const closeDrawer = useCallback(() => {
    Animated.timing(drawerAnim, {
      toValue: -DRAWER_WIDTH, duration: CLOSE_DUR,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start(() => setIsOpen(false));
    if (isTablet) {
      // Always collapse spacer (safe even if it was already 0 in overlay mode)
      spacerWidth.value = withTiming(0, { duration: CLOSE_DUR, easing: REasing.out(REasing.cubic) });
      // Fade out scrim (used in overlay mode)
      Animated.timing(overlayAnim, { toValue: 0, duration: CLOSE_DUR, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      Animated.timing(overlayAnim, { toValue: 0, duration: CLOSE_DUR, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [drawerAnim, overlayAnim, spacerWidth]);

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

  const skipAutoCloseRef  = useRef(false);
  const skipNextAutoClose = useCallback(() => { skipAutoCloseRef.current = true; }, []);

  // Pending section — set before openDrawer(); Drawer reads this on open and enters the section
  const pendingSectionRef = useRef<string | null>(null);
  const openDrawerToSection = useCallback((key: string) => {
    pendingSectionRef.current = key;
    openDrawer();
  }, [openDrawer]);

  return (
    <DrawerContext.Provider value={{
      isOpen, drawerAnim, overlayAnim, spacerWidth,
      drawerMode, drawerModeRef, setDrawerMode,
      openDrawer, closeDrawer, instantClose, toggleDrawer,
      openDrawerToSection, pendingSectionRef,
      skipNextAutoClose, skipAutoCloseRef,
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
