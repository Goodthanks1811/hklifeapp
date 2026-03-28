import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBiometric } from "@/context/BiometricContext";
import { Colors } from "@/constants/colors";

const LOGO_URI = "https://i.postimg.cc/rwCNn1YJ/4375900A-530F-472F-8D00-3C573594C990.png";

export function LockScreen() {
  const insets                        = useSafeAreaInsets();
  const { unlock }                    = useBiometric();
  const [failed, setFailed]           = useState(false);
  const [prompting, setPrompting]     = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Fade in on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 160, friction: 14, useNativeDriver: true }),
    ]).start();
    // Auto-prompt a moment after mount
    const t = setTimeout(() => { handleUnlock(); }, 420);
    return () => clearTimeout(t);
  }, []);

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  9, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -9, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  6, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 50, useNativeDriver: true }),
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
      {/* Logo */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: "center" }}>
        <Image
          source={{ uri: LOGO_URI }}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Lock icon + message */}
      <Animated.View style={[styles.centerGroup, { transform: [{ translateX: shakeAnim }] }]}>
        <View style={styles.lockCircle}>
          <Feather name="lock" size={32} color={Colors.primary} />
        </View>
        <Text style={styles.title}>App Locked</Text>
        <Text style={styles.subtitle}>
          {failed ? "Authentication failed. Try again." : "Authenticate to continue"}
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
    gap: 0,
    zIndex: 9999,
  },
  logo: {
    width: 130,
    height: 130,
    marginBottom: 48,
  },
  centerGroup: {
    alignItems: "center",
    marginBottom: 52,
  },
  lockCircle: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: "rgba(224,49,49,0.12)",
    borderWidth: 1.5, borderColor: "rgba(224,49,49,0.3)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    color: "#ffffff",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
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
