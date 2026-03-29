import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, Dimensions, Platform } from "react-native";

const SCREEN_WIDTH  = Dimensions.get("window").width;
export const isTablet      = SCREEN_WIDTH >= 768;
export const SIDEBAR_WIDTH = isTablet ? Math.round(SCREEN_WIDTH * 0.28) : 0;

const DRAWER_WIDTH_PHONE = Math.min(SCREEN_WIDTH * 0.78, 320);
const DRAWER_WIDTH       = isTablet ? SIDEBAR_WIDTH : DRAWER_WIDTH_PHONE;

interface DrawerContextType {
  isOpen:       boolean;
  drawerAnim:   Animated.Value;
  overlayAnim:  Animated.Value;
  openDrawer:   () => void;
  closeDrawer:  () => void;
  toggleDrawer: () => void;
  DRAWER_WIDTH: number;
  isTablet:     boolean;
  SIDEBAR_WIDTH: number;
}

const DrawerContext = createContext<DrawerContextType | null>(null);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(isTablet);
  const drawerAnim  = useRef(new Animated.Value(isTablet ? 0 : -DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(isTablet ? 0 : 0)).current;

  const openDrawer = useCallback(() => {
    if (isTablet) return;
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
  }, []);

  const closeDrawer = useCallback(() => {
    if (isTablet) return;
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
  }, []);

  const toggleDrawer = useCallback(() => {
    if (isTablet) return;
    if (isOpen) closeDrawer();
    else openDrawer();
  }, [isOpen, openDrawer, closeDrawer]);

  return (
    <DrawerContext.Provider
      value={{ isOpen, drawerAnim, overlayAnim, openDrawer, closeDrawer, toggleDrawer, DRAWER_WIDTH, isTablet, SIDEBAR_WIDTH }}
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
