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
import { useBiometric } from "@/context/BiometricContext";
import { Colors } from "@/constants/colors";

export function LockScreen() {
  const insets                        = useSafeAreaInsets();
  const { unlock }                    = useBiometric();
  const [failed, setFailed]           = useState(false);
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
    setFailed(false);
    const success = await unlock();
    setPrompting(false);
    if (!success) {
      setFailed(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake();
    }
  };

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
        <View style={styles.lockCircle}>
          <Feather name="lock" size={36} color={Colors.primary} />
        </View>
        <Text style={styles.title}>App Locked</Text>
        <Text style={styles.subtitle}>
          {failed ? "Face ID failed. Try again." : "Authenticate to continue"}
        </Text>
      </Animated.View>

      {/* Unlock button */}
      <Pressable
        style={({ pressed }) => [styles.unlockBtn, pressed && { opacity: 0.82 }]}
        onPress={handleUnlock}
        disabled={prompting}
      >
        <Feather name="cpu" size={18} color="#fff" />
        <Text style={styles.unlockBtnText}>
          {prompting ? "Authenticating…" : "Unlock with Face ID"}
        </Text>
      </Pressable>
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
  },
  lockCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "rgba(224,49,49,0.12)",
    borderWidth: 1.5, borderColor: "rgba(224,49,49,0.3)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 24,
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
