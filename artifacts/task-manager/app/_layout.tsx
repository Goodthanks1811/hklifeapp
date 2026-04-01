import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { PanResponder, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl } from "@/utils/apiClient";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Drawer } from "@/components/Drawer";
import { LockScreen } from "@/components/LockScreen";
import { StartupScan } from "@/components/StartupScan";
import { DrawerProvider, isTablet, useDrawer } from "@/context/DrawerContext";
import { DrawerConfigProvider } from "@/context/DrawerConfigContext";
import { NotionProvider } from "@/context/NotionContext";
import { BiometricProvider, useBiometric } from "@/context/BiometricContext";
import { HeaderImageProvider } from "@/context/HeaderImageContext";

const apiDomain = process.env.EXPO_PUBLIC_DOMAIN || "814374fd-199d-4ed7-9a1e-8e8568da7f50-00-1sgtb2onftd5g.spock.replit.dev";
setBaseUrl(`https://${apiDomain}`);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AppGate({ children }: { children: React.ReactNode }) {
  const { isReady, isLocked } = useBiometric();
  if (!isReady) return null;
  return (
    <>
      {children}
      {isLocked && <LockScreen />}
    </>
  );
}

function TabletShell({ children }: { children: React.ReactNode }) {
  const { isTablet, SIDEBAR_WIDTH, tabletSidebarVisible, showTabletSidebar } = useDrawer();

  // Keep mutable refs so the PanResponder (created once) always has current values
  const visibleRef = useRef(tabletSidebarVisible);
  const showRef    = useRef(showTabletSidebar);
  useEffect(() => { visibleRef.current = tabletSidebarVisible; }, [tabletSidebarVisible]);
  useEffect(() => { showRef.current    = showTabletSidebar;    }, [showTabletSidebar]);

  // Swipe-in from left edge → reveal sidebar (only when sidebar is hidden)
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gs) =>
        !visibleRef.current &&
        evt.nativeEvent.pageX < 32 &&
        gs.dx > 8 &&
        Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderRelease: (_evt, gs) => {
        if (gs.dx > 40) showRef.current();
      },
    })
  ).current;

  if (!isTablet) return <>{children}</>;
  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ width: tabletSidebarVisible ? SIDEBAR_WIDTH : 0, backgroundColor: "#111111" }} />
      <View style={{ flex: 1, backgroundColor: "#000000" }} {...panResponder.panHandlers}>
        {children}
      </View>
    </View>
  );
}

function RootLayoutNav() {
  return (
    <BiometricProvider>
      <AppGate>
        <TabletShell>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#000000" } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="ui-kit" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="ir-quick-add" />
          </Stack>
        </TabletShell>
        <Drawer />
      </AppGate>
    </BiometricProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [showStartup, setShowStartup] = useState(true);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <NotionProvider>
            <HeaderImageProvider>
              <DrawerConfigProvider>
                <DrawerProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <RootLayoutNav />
                    {showStartup && !isTablet && (
                      <StartupScan onDone={() => setShowStartup(false)} />
                    )}
                  </GestureHandlerRootView>
                </DrawerProvider>
              </DrawerConfigProvider>
            </HeaderImageProvider>
          </NotionProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
