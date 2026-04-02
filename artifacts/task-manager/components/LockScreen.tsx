import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBiometric, type UnlockError } from "@/context/BiometricContext";
import { Colors } from "@/constants/colors";

function errorMessage(err: UnlockError): string {
  switch (err) {
    case "lockout":           return "Too many attempts. Unlock your device with your passcode first, then try again.";
    case "lockout_permanent": return "Face ID is permanently locked. Please unlock your device.";
    case "cancelled":         return "Authentication cancelled.";
    case "unavailable":       return "Face ID is not available right now.";
    case "failed":            return "Face not recognised. Try again.";
    default:                  return "Authenticate to continue";
  }
}

export function LockScreen() {
  const insets                        = useSafeAreaInsets();
  const { unlock }                    = useBiometric();
  const [lastError, setLastError]     = useState<UnlockError>(null);
  const [prompting, setPrompting]     = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 340, useNativeDriver: true }).start();
    const t = setTimeout(() => { handleUnlock(); }, 420);
    return () => clearTimeout(t);
  }, []);

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   7, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  -7, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 45, useNativeDriver: true }),
    ]).start();
  };

  const handleUnlock = async () => {
    if (prompting) return;
    setPrompting(true);
    setLastError(null);
    const { success, error } = await unlock();
    setPrompting(false);
    if (!success) {
      setLastError(error);
      // Don't shake for lockout — shaking implies "try again" which won't help
      if (error !== "lockout" && error !== "lockout_permanent") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        shake();
      }
    }
  };

  const isLockedOut = lastError === "lockout" || lastError === "lockout_permanent";
  const subtitle    = lastError ? errorMessage(lastError) : "Authenticate to continue";

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        styles.root,
        { opacity: fadeAnim },
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
      ]}
    >
      {/* Lock circle + title */}
      <Animated.View style={[styles.centerGroup, { transform: [{ translateX: shakeAnim }] }]}>
        <View style={[styles.lockCircle, isLockedOut && styles.lockCircleWarning]}>
          <Feather
            name={isLockedOut ? "alert-triangle" : "lock"}
            size={36}
            color={isLockedOut ? "#F59F00" : Colors.primary}
          />
        </View>
        <Text style={styles.title}>{isLockedOut ? "Locked Out" : "Face ID Required"}</Text>
        <Text style={[styles.subtitle, isLockedOut && styles.subtitleWarning]}>
          {subtitle}
        </Text>
      </Animated.View>

      {/* Unlock button — only shown when idle and not locked out (i.e. tap to retry) */}
      {!isLockedOut && !prompting && (
        <Pressable
          style={({ pressed }) => [styles.unlockBtn, pressed && { opacity: 0.82 }]}
          onPress={handleUnlock}
        >
          <Feather name="cpu" size={18} color="#fff" />
          <Text style={styles.unlockBtnText}>Unlock with Face ID</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: "#0a0a0a",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  centerGroup: {
    alignItems: "center",
    marginBottom: 56,
    paddingHorizontal: 32,
  },
  lockCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "rgba(224,49,49,0.12)",
    borderWidth: 1.5, borderColor: "rgba(224,49,49,0.3)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 24,
  },
  lockCircleWarning: {
    backgroundColor: "rgba(245,159,0,0.12)",
    borderColor: "rgba(245,159,0,0.35)",
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  subtitleWarning: {
    color: "#F59F00",
    fontSize: 14,
  },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    paddingHorizontal: 36,
    paddingVertical: 17,
    borderRadius: 18,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  unlockBtnText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.1,
  },
});
