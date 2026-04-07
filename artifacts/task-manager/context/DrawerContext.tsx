import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing } from "react-native";
import {
  useSharedValue,
  withSpring,
  withTiming,
  cancelAnimation,
  Easing as REasing,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

// ── Static constants (based on launch-time width) ────────────────────────────
// Used for module-level imports in screens that don't need reactivity.
const SCREEN_WIDTH  = Dimensions.get("window").width;
export const isTablet      = SCREEN_WIDTH >= 768;
export const SIDEBAR_WIDTH = isTablet ? Math.min(300, Math.round(SCREEN_WIDTH * 0.28)) : 0;

const DRAWER_WIDTH_PHONE = Math.min(SCREEN_WIDTH * 0.78, 320);
export const DRAWER_WIDTH = isTablet ? SIDEBAR_WIDTH : DRAWER_WIDTH_PHONE;

// Threshold below which we treat the app as being in iPad split-screen mode.
// In full-screen, any supported iPad is >= 768pt.  In any split arrangement
// the window shrinks below that value, so 768 is the right boundary.
const SPLIT_SCREEN_THRESHOLD = 768;

// Spring config — identical for drawer (native) and spacer (UI thread) so they move as one
const RSPRING = { damping: 24, stiffness: 240, overshootClamping: true } as const;
const CLOSE_DUR = 500;

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
  slowOpen:            () => void;
  closeDrawer:         () => void;
  instantClose:        () => void;
  instantOpen:         () => void;
  toggleDrawer:        () => void;
  openDrawerToSection: (key: string) => void;
  drawerPrepareRef:    React.MutableRefObject<((key: string) => void) | null>;
  skipNextAutoClose:   () => void;
  skipAutoCloseRef:    React.MutableRefObject<boolean>;
  DRAWER_WIDTH:        number;
  isTablet:            boolean;
  SIDEBAR_WIDTH:       number;
  isSplitScreen:       boolean;
}

const DrawerContext = createContext<DrawerContextType | null>(null);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);

  // ── Split-screen detection ────────────────────────────────────────────────
  // windowWidth updates whenever the iPad window is resized (split screen
  // enter / exit, orientation change, Slide Over, etc.).
  const [windowWidth, setWindowWidth] = useState(SCREEN_WIDTH);
  const isSplitScreen = isTablet && windowWidth < SPLIT_SCREEN_THRESHOLD;

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

  const instantOpen = useCallback(() => {
    drawerAnim.stopAnimation();
    drawerAnim.setValue(0);
    overlayAnim.stopAnimation();
    overlayAnim.setValue(1);
    setIsOpen(true);
  }, [drawerAnim, overlayAnim]);

  const SLOW_DUR = 600;
  const slowOpen = useCallback(() => {
    setIsOpen(true);
    Animated.timing(drawerAnim, { toValue: 0, duration: SLOW_DUR, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    if (isTablet) {
      if (drawerModeRef.current === "sidebar") {
        spacerWidth.value = withTiming(SIDEBAR_WIDTH, { duration: SLOW_DUR, easing: REasing.out(REasing.cubic) });
      } else {
        Animated.timing(overlayAnim, { toValue: 1, duration: SLOW_DUR, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      }
    } else {
      Animated.timing(overlayAnim, { toValue: 1, duration: SLOW_DUR, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [drawerAnim, overlayAnim, spacerWidth]);

  const toggleDrawer = useCallback(() => {
    if (isOpen) closeDrawer();
    else openDrawer();
  }, [isOpen, openDrawer, closeDrawer]);

  const skipAutoCloseRef  = useRef(false);
  const skipNextAutoClose = useCallback(() => { skipAutoCloseRef.current = true; }, []);

  // drawerPrepareRef — the Drawer registers a callback here on mount.
  // openDrawerToSection calls it synchronously BEFORE openDrawer() so the
  // panel state is already correct on the very first rendered frame; no flash.
  const drawerPrepareRef = useRef<((key: string) => void) | null>(null);
  const openDrawerToSection = useCallback((key: string) => {
    drawerPrepareRef.current?.(key);
    openDrawer();
  }, [openDrawer]);

  // ── Window resize listener (split screen / orientation) ──────────────────
  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => {
      setWindowWidth(window.width);
    });
    return () => sub.remove();
  }, []);

  // ── Auto-collapse drawer in split screen, reopen when back to full screen ─
  // We only do this when the drawer is in sidebar mode (Life screens on iPad).
  // In overlay mode the drawer is already "floating" and the user manages it.
  const wasOpenBeforeSplit = useRef(false);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  useEffect(() => {
    if (!isTablet) return; // iPhone — nothing to do

    if (isSplitScreen) {
      // Entering split screen: collapse if currently open in sidebar mode
      if (drawerModeRef.current === "sidebar" && isOpenRef.current) {
        wasOpenBeforeSplit.current = true;
        closeDrawer();
      }
    } else {
      // Returning to full screen: reopen if we collapsed it on split entry
      if (drawerModeRef.current === "sidebar" && wasOpenBeforeSplit.current && !isOpenRef.current) {
        wasOpenBeforeSplit.current = false;
        openDrawer();
      } else {
        wasOpenBeforeSplit.current = false;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSplitScreen]);

  return (
    <DrawerContext.Provider value={{
      isOpen, drawerAnim, overlayAnim, spacerWidth,
      drawerMode, drawerModeRef, setDrawerMode,
      openDrawer, slowOpen, closeDrawer, instantClose, instantOpen, toggleDrawer,
      openDrawerToSection, drawerPrepareRef,
      skipNextAutoClose, skipAutoCloseRef,
      DRAWER_WIDTH, isTablet, SIDEBAR_WIDTH,
      isSplitScreen,
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
