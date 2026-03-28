import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useDrawer } from "@/context/DrawerContext";

type SaveState = "idle" | "saving" | "saved" | "error";

function useSaveButton(delay = 1500, succeed = true): [SaveState, () => void] {
  const [state, setState] = useState<SaveState>("idle");
  const trigger = () => {
    if (state !== "idle") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState("saving");
    setTimeout(() => {
      setState(succeed ? "saved" : "error");
      Haptics.notificationAsync(
        succeed ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      );
      setTimeout(() => setState("idle"), 2000);
    }, delay);
  };
  return [state, trigger];
}

function SaveBtn({
  label,
  state,
  onPress,
  variant = "primary",
}: {
  label: string;
  state: SaveState;
  onPress: () => void;
  variant?: "primary" | "outline";
}) {
  const bg = variant === "primary"
    ? { idle: Colors.primary, saving: Colors.cardBgElevated, saved: Colors.success, error: "#C92A2A" }
    : { idle: "transparent", saving: "transparent", saved: "transparent", error: "transparent" };

  const icons: Record<SaveState, keyof typeof Feather.glyphMap> = {
    idle: "save",
    saving: "loader",
    saved: "check",
    error: "alert-circle",
  };
  const labels: Record<SaveState, string> = {
    idle: label,
    saving: "Saving...",
    saved: "Saved!",
    error: "Failed",
  };

  return (
    <Pressable
      style={[
        styles.saveBtn,
        { backgroundColor: bg[state] },
        variant === "outline" && { borderWidth: 1, borderColor: state === "idle" ? Colors.primary : state === "saved" ? Colors.success : state === "error" ? Colors.primary : Colors.border },
      ]}
      onPress={onPress}
      disabled={state !== "idle"}
    >
      {state === "saving" ? (
        <ActivityIndicator size="small" color={variant === "primary" ? "#fff" : Colors.textSecondary} />
      ) : (
        <Feather name={icons[state]} size={16} color={variant === "primary" ? "#fff" : state === "saved" ? Colors.success : state === "error" ? Colors.primary : Colors.primary} />
      )}
      <Text style={[styles.saveBtnText, variant === "outline" && { color: state === "saved" ? Colors.success : state === "error" ? Colors.primary : Colors.primary }]}>
        {labels[state]}
      </Text>
    </Pressable>
  );
}

function ProgressBar({ progress, color = Colors.primary }: { progress: number; color?: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
      easing: Easing.out(Easing.quad),
    }).start();
  }, [progress]);
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, { width: anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }), backgroundColor: color }]} />
    </View>
  );
}

function SkeletonBox({ width, height = 16, radius = 6 }: { width: number | string; height?: number; radius?: number }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.ease }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true, easing: Easing.ease }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ width, height, borderRadius: radius, backgroundColor: Colors.cardBgElevated, opacity: anim }} />
  );
}

function HeartbeatLoader({ uri, size = 100 }: { uri: string; size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const beat = Animated.sequence([
      Animated.timing(scale, { toValue: 1.28, duration: 120, useNativeDriver: false, easing: Easing.out(Easing.quad) }),
      Animated.timing(scale, { toValue: 0.92, duration: 100, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
      Animated.timing(scale, { toValue: 1.16, duration: 110, useNativeDriver: false, easing: Easing.out(Easing.quad) }),
      Animated.timing(scale, { toValue: 1.0, duration: 150, useNativeDriver: false, easing: Easing.inOut(Easing.quad) }),
      Animated.delay(700),
    ]);

    const glowBeat = Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 120, useNativeDriver: false }),
      Animated.timing(glow, { toValue: 0, duration: 600, useNativeDriver: false }),
      Animated.delay(360),
    ]);

    Animated.loop(
      Animated.parallel([beat, glowBeat])
    ).start();
  }, []);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] });
  const glowScale = scale.interpolate({ inputRange: [0.9, 1.3], outputRange: [1.0, 1.6] });

  return (
    <View style={heartStyles.wrapper}>
      <Animated.View
        style={[
          heartStyles.glowRing,
          { width: size * 1.6, height: size * 1.6, borderRadius: size * 0.8, opacity: glowOpacity, transform: [{ scale: glowScale }] },
        ]}
      />
      <Animated.Image
        source={{ uri }}
        style={[heartStyles.image, { width: size, height: size, transform: [{ scale }] }]}
        resizeMode="contain"
      />
    </View>
  );
}

const heartStyles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 180,
    height: 180,
  },
  glowRing: {
    position: "absolute",
    backgroundColor: "#4A6FFF",
  },
  image: {
    borderRadius: 12,
  },
});

function Section({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

export default function LoadersScreen() {
  const insets = useSafeAreaInsets();
  const { toggleDrawer } = useDrawer();
  const [saveState1, triggerSave1] = useSaveButton(1800, true);
  const [saveState2, triggerSave2] = useSaveButton(2000, false);
  const [saveState3, triggerSave3] = useSaveButton(1200, true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const startUpload = () => {
    if (isUploading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsUploading(true);
    setUploadProgress(0);
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 15 + 5;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 600);
      }
      setUploadProgress(Math.min(p / 100, 1));
    }, 200);
  };

  const STEPS = ["Validate", "Process", "Upload", "Complete"];

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={toggleDrawer} style={styles.iconBtn}>
          <Feather name="menu" size={20} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>Loaders</Text>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="x" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 24 }]}
      >
        <Section title="Save Buttons" />
        <View style={styles.card}>
          <View style={styles.row}>
            <SaveBtn label="Save" state={saveState1} onPress={triggerSave1} />
            <SaveBtn label="Sync" state={saveState2} onPress={triggerSave2} variant="outline" />
          </View>
          <SaveBtn label="Save Changes" state={saveState3} onPress={triggerSave3} />
        </View>

        <Section title="Activity Indicators" />
        <View style={styles.card}>
          <View style={styles.spinnerRow}>
            <View style={styles.spinnerBox}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.spinnerLabel}>Small</Text>
            </View>
            <View style={styles.spinnerBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.spinnerLabel}>Large</Text>
            </View>
            <View style={styles.spinnerBox}>
              <ActivityIndicator size="small" color={Colors.success} />
              <Text style={styles.spinnerLabel}>Success</Text>
            </View>
            <View style={styles.spinnerBox}>
              <ActivityIndicator size="small" color={Colors.info} />
              <Text style={styles.spinnerLabel}>Info</Text>
            </View>
          </View>
        </View>

        <Section title="Progress Bars" />
        <View style={styles.card}>
          {[
            { label: "Storage", pct: 0.72, color: Colors.primary },
            { label: "Upload", pct: 0.45, color: Colors.info },
            { label: "Budget", pct: 0.88, color: "#FAB005" },
            { label: "Goals", pct: 0.33, color: Colors.success },
          ].map((item) => (
            <View key={item.label} style={{ gap: 6, marginBottom: 12 }}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>{item.label}</Text>
                <Text style={[styles.progressPct, { color: item.color }]}>{Math.round(item.pct * 100)}%</Text>
              </View>
              <ProgressBar progress={item.pct} color={item.color} />
            </View>
          ))}
        </View>

        <Section title="File Upload" />
        <View style={styles.card}>
          <View style={styles.uploadArea}>
            <Feather name="upload-cloud" size={32} color={isUploading ? Colors.primary : Colors.textMuted} />
            <Text style={styles.uploadLabel}>
              {isUploading ? `Uploading... ${Math.round(uploadProgress * 100)}%` : "Tap to simulate upload"}
            </Text>
            {isUploading && <ProgressBar progress={uploadProgress} />}
          </View>
          <Pressable style={[styles.uploadBtn, isUploading && styles.uploadBtnDisabled]} onPress={startUpload} disabled={isUploading}>
            <Text style={styles.uploadBtnText}>{isUploading ? "Uploading..." : "Start Upload"}</Text>
          </Pressable>
        </View>

        <Section title="Step Progress" />
        <View style={styles.card}>
          <View style={styles.steps}>
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <Pressable
                  style={[styles.step, i < stepIndex && styles.stepDone, i === stepIndex && styles.stepActive]}
                  onPress={() => {
                    setStepIndex(i);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  {i < stepIndex ? (
                    <Feather name="check" size={12} color="#fff" />
                  ) : (
                    <Text style={[styles.stepNum, i === stepIndex && { color: "#fff" }]}>{i + 1}</Text>
                  )}
                </Pressable>
                {i < STEPS.length - 1 && (
                  <View style={[styles.stepLine, i < stepIndex && styles.stepLineDone]} />
                )}
              </React.Fragment>
            ))}
          </View>
          <Text style={styles.stepLabel}>{STEPS[stepIndex]}</Text>
          <View style={styles.stepButtons}>
            <Pressable style={[styles.stepBtn, stepIndex === 0 && styles.stepBtnDisabled]} disabled={stepIndex === 0} onPress={() => { setStepIndex(i => Math.max(0, i - 1)); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
              <Text style={styles.stepBtnText}>Back</Text>
            </Pressable>
            <Pressable style={[styles.stepBtn, styles.stepBtnPrimary, stepIndex === STEPS.length - 1 && styles.stepBtnDisabled]} disabled={stepIndex === STEPS.length - 1} onPress={() => { setStepIndex(i => Math.min(STEPS.length - 1, i + 1)); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
              <Text style={[styles.stepBtnText, { color: "#fff" }]}>Next</Text>
            </Pressable>
          </View>
        </View>

        <Section title="Skeleton Loading" />
        <View style={styles.card}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonItem}>
              <SkeletonBox width={40} height={40} radius={10} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonBox width="80%" height={14} />
                <SkeletonBox width="55%" height={11} />
              </View>
            </View>
          ))}
        </View>

        <Section title="Heartbeat Loader" />
        <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
          <View style={styles.heartbeatBg}>
            <HeartbeatLoader
              uri="https://i.postimg.cc/rwCNn1YJ/4375900A-530F-472F-8D00-3C573594C990.png"
              size={110}
            />
            <Text style={styles.heartbeatLabel}>Loading...</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    flex: 1,
    textAlign: "center",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scroll: { padding: 20 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 24,
    marginBottom: 16,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
    gap: 12,
  },
  row: { flexDirection: "row", gap: 10 },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    minHeight: 46,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  spinnerRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  spinnerBox: {
    alignItems: "center",
    gap: 8,
    padding: 8,
  },
  spinnerLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  progressPct: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.cardBgElevated,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  uploadArea: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    borderStyle: "dashed",
  },
  uploadLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  uploadBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  uploadBtnDisabled: { opacity: 0.5 },
  uploadBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  steps: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  step: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  stepActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  stepDone: { borderColor: Colors.success, backgroundColor: Colors.success },
  stepNum: { color: Colors.textMuted, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border, maxWidth: 40 },
  stepLineDone: { backgroundColor: Colors.success },
  stepLabel: {
    textAlign: "center",
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 8,
  },
  stepButtons: { flexDirection: "row", gap: 10 },
  stepBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBgElevated,
  },
  stepBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepBtnDisabled: { opacity: 0.35 },
  stepBtnText: { color: Colors.textSecondary, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  skeletonItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  heartbeatBg: {
    backgroundColor: "#0C1846",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 16,
    borderRadius: 14,
  },
  heartbeatLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
});
