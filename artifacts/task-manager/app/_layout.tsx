import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { BebasNeue_400Regular } from "@expo-google-fonts/bebas-neue";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "expo-router";
import { CardStyleInterpolators } from "@react-navigation/stack";
import { CustomStack, asymmetricSlide, TRANSITION_SPEC } from "./custom-stack";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useState } from "react";
import { Image, View } from "react-native";
import ReAnimated, { useAnimatedStyle } from "react-native-reanimated";
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
import { AnthropicProvider } from "@/context/AnthropicContext";
import { BiometricProvider, useBiometric } from "@/context/BiometricContext";
import { HeaderImageProvider } from "@/context/HeaderImageContext";
import { GoogleCalendarProvider } from "@/context/GoogleCalendarContext";
import { MusicPlayerProvider } from "@/context/MusicPlayerContext";
import { PlaybackService } from "@/service";

// Guard RNTP registration — native module doesn't exist in Expo Go
try {
  const rntp = require("react-native-track-player");
  const TrackPlayer = rntp.default ?? rntp;
  TrackPlayer.registerPlaybackService(() => PlaybackService);
} catch {
  // Expo Go — no native module, skip registration
}

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
  const { isTablet, spacerWidth } = useDrawer();
  const spacerStyle = useAnimatedStyle(() => ({ width: spacerWidth.value }));

  if (!isTablet) return <>{children}</>;
  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#000000" }}>
      <ReAnimated.View style={spacerStyle} />
      <View style={{ flex: 1 }}>
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
          <CustomStack
            screenOptions={{
              headerShown: false,
              gestureEnabled: false,
              cardStyle: { backgroundColor: "#000000" },
              cardStyleInterpolator: isTablet
                ? CardStyleInterpolators.forNoAnimation
                : asymmetricSlide,
              transitionSpec: { open: TRANSITION_SPEC, close: TRANSITION_SPEC },
            }}
          >
            <CustomStack.Screen
              name="(tabs)"
              options={{ cardStyleInterpolator: CardStyleInterpolators.forNoAnimation }}
            />
            <CustomStack.Screen
              name="life"
              options={{ cardStyleInterpolator: CardStyleInterpolators.forNoAnimation }}
            />
            <CustomStack.Screen name="ui-kit" />
            <CustomStack.Screen name="settings" />
            <CustomStack.Screen name="ir-quick-add" />
          </CustomStack>
        </TabletShell>
        <Drawer />
      </AppGate>
    </BiometricProvider>
  );
}

// Lives inside DrawerProvider so it can call openDrawer / skipNextAutoClose
function StartupGate() {
  const { openDrawer, skipNextAutoClose } = useDrawer();
  const [show, setShow] = useState(!isTablet);

  const handleDone = useCallback(() => {
    // Prevent the upcoming route-change from auto-closing the drawer
    skipNextAutoClose();
    // Land on Development screen so it shows in the background
    router.replace("/life/automation" as any);
    // Open the drawer immediately
    openDrawer();
    setShow(false);
  }, [openDrawer, skipNextAutoClose]);

  if (!show) return null;
  return <StartupScan onDone={handleDone} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    BebasNeue_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      {/* Preload assets used by screens so they are cached before first navigation */}
      <Image source={require("../assets/images/shazam-icon.png")}  style={{ width: 0, height: 0, position: "absolute" }} />
      <Image source={require("../assets/images/spotify-icon.png")} style={{ width: 0, height: 0, position: "absolute" }} />
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GoogleCalendarProvider>
          <NotionProvider>
            <AnthropicProvider>
              <HeaderImageProvider>
                <DrawerConfigProvider>
                  <DrawerProvider>
                    <MusicPlayerProvider>
                      <GestureHandlerRootView style={{ flex: 1 }}>
                        <RootLayoutNav />
                        <StartupGate />
                      </GestureHandlerRootView>
                    </MusicPlayerProvider>
                  </DrawerProvider>
                </DrawerConfigProvider>
              </HeaderImageProvider>
            </AnthropicProvider>
          </NotionProvider>
          </GoogleCalendarProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
