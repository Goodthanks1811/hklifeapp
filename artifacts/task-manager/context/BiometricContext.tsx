import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";

const STORAGE_KEY = "biometric_lock_enabled";

interface BiometricContextType {
  isEnabled:          boolean;
  isSupported:        boolean;
  isReady:            boolean;
  isLocked:           boolean;
  unlock:             () => Promise<boolean>;
  setEnabled:         (val: boolean) => Promise<boolean>;
}

const BiometricContext = createContext<BiometricContextType | null>(null);

export function BiometricProvider({ children }: { children: React.ReactNode }) {
  const [isEnabled,   setIsEnabled]   = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isReady,     setIsReady]     = useState(false);
  const [isLocked,    setIsLocked]    = useState(false);

  // ── Boot: load pref + check hardware support ─────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [savedPref, hardware, enrolled] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        const supported = Platform.OS !== "web" && hardware && enrolled;
        setIsSupported(supported);
        const enabled = supported && savedPref === "true";
        setIsEnabled(enabled);
        if (enabled) setIsLocked(true);
      } catch {
        // If anything fails, stay unlocked
      } finally {
        setIsReady(true);
      }
    };
    init();
  }, []);

  const unlock = useCallback(async (): Promise<boolean> => {
    if (!isSupported) { setIsLocked(false); return true; }
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:   "Unlock the app",
        fallbackLabel:   "Use Passcode",
        cancelLabel:     "Cancel",
        disableDeviceFallback: false,
      });
      if (result.success) {
        setIsLocked(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [isSupported]);

  const setEnabled = useCallback(async (val: boolean): Promise<boolean> => {
    if (val) {
      // Require a successful auth before enabling
      if (!isSupported) return false;
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage:   "Authenticate to enable Face ID lock",
          cancelLabel:     "Cancel",
          disableDeviceFallback: false,
        });
        if (!result.success) return false;
      } catch {
        return false;
      }
    }
    await AsyncStorage.setItem(STORAGE_KEY, val ? "true" : "false");
    setIsEnabled(val);
    return true;
  }, [isSupported]);

  return (
    <BiometricContext.Provider value={{ isEnabled, isSupported, isReady, isLocked, unlock, setEnabled }}>
      {children}
    </BiometricContext.Provider>
  );
}

export function useBiometric() {
  const ctx = useContext(BiometricContext);
  if (!ctx) throw new Error("useBiometric must be used inside BiometricProvider");
  return ctx;
}
