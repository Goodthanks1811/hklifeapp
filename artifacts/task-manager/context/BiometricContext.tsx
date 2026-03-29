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

export type UnlockError =
  | "lockout"           // too many attempts
  | "lockout_permanent" // permanently locked
  | "cancelled"         // user pressed Cancel
  | "failed"            // face not recognized
  | "unavailable"       // hardware/permission issue
  | null;               // no error (success)

interface BiometricContextType {
  isEnabled:    boolean;
  isSupported:  boolean;
  isReady:      boolean;
  isLocked:     boolean;
  unlock:       () => Promise<{ success: boolean; error: UnlockError }>;
  setEnabled:   (val: boolean) => Promise<boolean>;
}

const BiometricContext = createContext<BiometricContextType | null>(null);

export function BiometricProvider({ children }: { children: React.ReactNode }) {
  const [isEnabled,   setIsEnabled]   = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isReady,     setIsReady]     = useState(false);
  const [isLocked,    setIsLocked]    = useState(false);

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
        // stay unlocked on error
      } finally {
        setIsReady(true);
      }
    };
    init();
  }, []);

  const unlock = useCallback(async (): Promise<{ success: boolean; error: UnlockError }> => {
    if (!isSupported) {
      setIsLocked(false);
      return { success: true, error: null };
    }
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:         "Unlock the app",
        // Empty fallbackLabel hides the "Enter Passcode" button in the Face ID dialog
        fallbackLabel:         "",
        cancelLabel:           "Cancel",
        // Must be false for Expo Go — true silently blocks the Face ID dialog
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLocked(false);
        return { success: true, error: null };
      }

      const err = (result as any).error as string | undefined;
      if (err === "biometry_lockout")           return { success: false, error: "lockout" };
      if (err === "biometry_lockout_permanent") return { success: false, error: "lockout_permanent" };
      if (err === "user_cancel" || err === "system_cancel" || err === "app_cancel")
                                                return { success: false, error: "cancelled" };
      if (err === "biometry_not_available" || err === "not_available")
                                                return { success: false, error: "unavailable" };
      return { success: false, error: "failed" };
    } catch {
      return { success: false, error: "unavailable" };
    }
  }, [isSupported]);

  const setEnabled = useCallback(async (val: boolean): Promise<boolean> => {
    if (val) {
      if (!isSupported) return false;
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage:         "Authenticate to enable Face ID lock",
          fallbackLabel:         "",
          cancelLabel:           "Cancel",
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
