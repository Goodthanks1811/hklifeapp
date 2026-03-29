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
import React, { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl } from "@/utils/apiClient";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Drawer } from "@/components/Drawer";
import { LockScreen } from "@/components/LockScreen";
import { DrawerProvider, useDrawer } from "@/context/DrawerContext";
import { DrawerConfigProvider } from "@/context/DrawerConfigContext";
import { NotionProvider } from "@/context/NotionContext";
import { BiometricProvider, useBiometric } from "@/context/BiometricContext";
import { HeaderImageProvider } from "@/context/HeaderImageContext";

if (process.env.EXPO_PUBLIC_DOMAIN) {
  setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
}

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
  const { isTablet, SIDEBAR_WIDTH } = useDrawer();
  if (!isTablet) return <>{children}</>;
  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ width: SIDEBAR_WIDTH }} />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function RootLayoutNav() {
  return (
    <BiometricProvider>
      <AppGate>
        <TabletShell>
          <Stack screenOptions={{ headerShown: false }}>
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
                    <KeyboardProvider>
                      <RootLayoutNav />
                    </KeyboardProvider>
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
