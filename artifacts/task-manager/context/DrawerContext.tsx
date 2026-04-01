import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, Dimensions, Platform } from "react-native";

const SCREEN_WIDTH  = Dimensions.get("window").width;
export const isTablet      = SCREEN_WIDTH >= 768;
export const SIDEBAR_WIDTH = isTablet ? Math.min(280, Math.round(SCREEN_WIDTH * 0.28)) : 0;

const DRAWER_WIDTH_PHONE = Math.min(SCREEN_WIDTH * 0.78, 320);
const DRAWER_WIDTH       = isTablet ? SIDEBAR_WIDTH : DRAWER_WIDTH_PHONE;

interface DrawerContextType {
  isOpen:                boolean;
  drawerAnim:            Animated.Value;
  overlayAnim:           Animated.Value;
  sidebarSlide:          Animated.Value;
  tabletSidebarVisible:  boolean;
  openDrawer:            () => void;
  closeDrawer:           () => void;
  toggleDrawer:          () => void;
  showTabletSidebar:     () => void;
  hideTabletSidebar:     () => void;
  DRAWER_WIDTH:          number;
  isTablet:              boolean;
  SIDEBAR_WIDTH:         number;
}

const DrawerContext = createContext<DrawerContextType | null>(null);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen,               setIsOpen]               = useState(true);
  const [tabletSidebarVisible, setTabletSidebarVisible] = useState(true);

  const drawerAnim  = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(isTablet ? 0 : 1)).current;
  const sidebarSlide = useRef(new Animated.Value(0)).current; // 0 = shown, -SIDEBAR_WIDTH = hidden

  // ── Tablet sidebar show/hide ──────────────────────────────────────────────
  const showTabletSidebar = useCallback(() => {
    if (!isTablet) return;
    setTabletSidebarVisible(true);
    Animated.spring(sidebarSlide, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 200,
    }).start();
  }, [sidebarSlide]);

  const hideTabletSidebar = useCallback(() => {
    if (!isTablet) return;
    Animated.spring(sidebarSlide, {
      toValue: -SIDEBAR_WIDTH,
      useNativeDriver: true,
      damping: 20,
      stiffness: 200,
    }).start(() => setTabletSidebarVisible(false));
  }, [sidebarSlide]);

  // ── Phone drawer open/close ───────────────────────────────────────────────
  const openDrawer = useCallback(() => {
    if (isTablet) { showTabletSidebar(); return; }
    setIsOpen(true);
    Animated.parallel([
      Animated.spring(drawerAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [showTabletSidebar]);

  const closeDrawer = useCallback(() => {
    if (isTablet) { hideTabletSidebar(); return; }
    Animated.parallel([
      Animated.spring(drawerAnim, {
        toValue: -DRAWER_WIDTH,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setIsOpen(false));
  }, [hideTabletSidebar]);

  const toggleDrawer = useCallback(() => {
    if (isTablet) {
      if (tabletSidebarVisible) hideTabletSidebar();
      else showTabletSidebar();
      return;
    }
    if (isOpen) closeDrawer();
    else openDrawer();
  }, [isOpen, tabletSidebarVisible, openDrawer, closeDrawer, showTabletSidebar, hideTabletSidebar]);

  return (
    <DrawerContext.Provider
      value={{
        isOpen, drawerAnim, overlayAnim, sidebarSlide,
        tabletSidebarVisible,
        openDrawer, closeDrawer, toggleDrawer,
        showTabletSidebar, hideTabletSidebar,
        DRAWER_WIDTH, isTablet, SIDEBAR_WIDTH,
      }}
    >
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error("useDrawer must be inside DrawerProvider");
  return ctx;
}
