import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, Dimensions, Easing } from "react-native";

const SCREEN_WIDTH  = Dimensions.get("window").width;
export const isTablet      = SCREEN_WIDTH >= 768;
export const SIDEBAR_WIDTH = isTablet ? Math.min(300, Math.round(SCREEN_WIDTH * 0.28)) : 0;

const DRAWER_WIDTH_PHONE = Math.min(SCREEN_WIDTH * 0.78, 320);
export const DRAWER_WIDTH = isTablet ? SIDEBAR_WIDTH : DRAWER_WIDTH_PHONE;

interface DrawerContextType {
  isOpen:      boolean;
  drawerAnim:  Animated.Value;
  overlayAnim: Animated.Value;
  openDrawer:  () => void;
  closeDrawer: () => void;
  toggleDrawer:() => void;
  DRAWER_WIDTH:number;
  isTablet:    boolean;
  SIDEBAR_WIDTH:number;
}

const DrawerContext = createContext<DrawerContextType | null>(null);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  // Starts fully off-screen (left). openDrawer springs to 0 (visible).
  const drawerAnim  = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const openDrawer = useCallback(() => {
    setIsOpen(true);
    Animated.parallel([
      Animated.spring(drawerAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
        overshootClamping: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [drawerAnim, overlayAnim]);

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.timing(drawerAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setIsOpen(false));
  }, [drawerAnim, overlayAnim]);

  const toggleDrawer = useCallback(() => {
    if (isOpen) closeDrawer();
    else openDrawer();
  }, [isOpen, openDrawer, closeDrawer]);

  return (
    <DrawerContext.Provider
      value={{
        isOpen, drawerAnim, overlayAnim,
        openDrawer, closeDrawer, toggleDrawer,
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
