import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenHeader } from "@/components/ScreenHeader";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

function Section({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function AlertModal({
  visible,
  type,
  onClose,
}: {
  visible: boolean;
  type: "success" | "warning" | "error" | "info";
  onClose: () => void;
}) {
  const config = {
    success: { icon: "check-circle" as const, color: Colors.success, title: "All Done!", message: "Your changes have been saved successfully." },
    warning: { icon: "alert-triangle" as const, color: "#FAB005", title: "Are you sure?", message: "This action cannot be undone. Please confirm." },
    error: { icon: "x-circle" as const, color: Colors.primary, title: "Something went wrong", message: "Failed to connect. Please check your connection and try again." },
    info: { icon: "info" as const, color: Colors.info, title: "New Update Available", message: "Version 2.1.0 is ready to install with bug fixes and new features." },
  }[type];

  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 15, stiffness: 250 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.85);
      opacity.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={[styles.alertCard, { transform: [{ scale }], opacity }]}>
          <View style={[styles.alertIconBox, { backgroundColor: `${config.color}20` }]}>
            <Feather name={config.icon} size={28} color={config.color} />
          </View>
          <Text style={styles.alertTitle}>{config.title}</Text>
          <Text style={styles.alertMessage}>{config.message}</Text>
          <View style={styles.alertBtns}>
            <Pressable style={[styles.alertBtn, styles.alertBtnGhost]} onPress={onClose}>
              <Text style={styles.alertBtnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.alertBtn, { backgroundColor: config.color }]} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onClose(); }}>
              <Text style={styles.alertBtnText}>Confirm</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function BottomSheet({
  visible,
  onClose,
  children,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}) {
  const translateY = useRef(new Animated.Value(400)).current;
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(translateY, { toValue: 400, duration: 280, useNativeDriver: true, easing: Easing.in(Easing.quad) }).start(() => setRendered(false));
    }
  }, [visible]);

  if (!rendered) return null;

  return (
    <Modal visible={rendered} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          {children}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function Toast({ message, icon, color, visible }: { message: string; icon: keyof typeof Feather.glyphMap; color: string; visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 15 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }], borderLeftColor: color }]}>
      <Feather name={icon} size={16} color={color} />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

export default function ModalsScreen() {
  const insets = useSafeAreaInsets();
  const [alertType, setAlertType] = useState<"success" | "warning" | "error" | "info" | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [inputSheetVisible, setInputSheetVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState<{ msg: string; icon: keyof typeof Feather.glyphMap; color: string } | null>(null);
  const [inputValue, setInputValue] = useState("");
  const toastTimer = useRef<any>(null);

  const showToast = (msg: string, icon: keyof typeof Feather.glyphMap, color: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastVisible({ msg, icon, color });
    toastTimer.current = setTimeout(() => setToastVisible(null), 2500);
  };

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const OPTIONS = ["Edit task", "Assign to me", "Set due date", "Add label", "Move to archive", "Delete"];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ScreenHeader title="Modals" />

      {toastVisible && (
        <View style={styles.toastContainer} pointerEvents="none">
          <Toast message={toastVisible.msg} icon={toastVisible.icon} color={toastVisible.color} visible={!!toastVisible} />
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 24 }]}
      >
        <Section title="Alert Dialogs" />
        <View style={styles.grid}>
          {(["success", "warning", "error", "info"] as const).map((type) => {
            const conf = {
              success: { color: Colors.success, icon: "check-circle" as const, label: "Success" },
              warning: { color: "#FAB005", icon: "alert-triangle" as const, label: "Warning" },
              error: { color: Colors.primary, icon: "x-circle" as const, label: "Error" },
              info: { color: Colors.info, icon: "info" as const, label: "Info" },
            }[type];
            return (
              <Pressable
                key={type}
                style={[styles.gridBtn, { borderColor: `${conf.color}40` }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAlertType(type); }}
              >
                <Feather name={conf.icon} size={22} color={conf.color} />
                <Text style={[styles.gridBtnText, { color: conf.color }]}>{conf.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Section title="Bottom Sheets" />
        <Pressable
          style={styles.triggerBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSheetVisible(true); }}
        >
          <Feather name="more-horizontal" size={16} color="#fff" />
          <Text style={styles.triggerText}>Action Sheet</Text>
        </Pressable>
        <Pressable
          style={[styles.triggerBtn, { backgroundColor: Colors.cardBgElevated, marginTop: 10, borderWidth: 1, borderColor: Colors.border }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setInputSheetVisible(true); }}
        >
          <Feather name="edit-3" size={16} color={Colors.primary} />
          <Text style={[styles.triggerText, { color: Colors.primary }]}>Input Sheet</Text>
        </Pressable>

        <Section title="Toast Notifications" />
        <View style={styles.toastRow}>
          {[
            { label: "Success", icon: "check-circle" as const, color: Colors.success, msg: "Changes saved!" },
            { label: "Error", icon: "alert-circle" as const, color: Colors.primary, msg: "Failed to save." },
            { label: "Info", icon: "info" as const, color: Colors.info, msg: "Syncing data..." },
            { label: "Warning", icon: "alert-triangle" as const, color: "#FAB005", msg: "Storage almost full" },
          ].map((t) => (
            <Pressable
              key={t.label}
              style={[styles.toastTrigger, { borderColor: `${t.color}40` }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); showToast(t.msg, t.icon, t.color); }}
            >
              <Feather name={t.icon} size={14} color={t.color} />
              <Text style={[styles.toastTriggerText, { color: t.color }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Section title="Inline Confirmations" />
        {[
          { label: "Archive this project?", action: "Archive", color: "#FAB005" },
          { label: "Remove team member?", action: "Remove", color: Colors.primary },
        ].map((item, i) => (
          <InlineConfirm key={i} label={item.label} action={item.action} color={item.color} />
        ))}
      </ScrollView>

      {alertType && (
        <AlertModal visible={!!alertType} type={alertType} onClose={() => setAlertType(null)} />
      )}

      <BottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} title="Options">
        {OPTIONS.map((opt, i) => (
          <Pressable
            key={opt}
            style={[styles.sheetOption, i === OPTIONS.length - 1 && { borderBottomWidth: 0 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSheetVisible(false); showToast(`"${opt}" tapped`, "check", Colors.success); }}
          >
            <Text style={[styles.sheetOptionText, opt === "Delete" && { color: Colors.primary }]}>{opt}</Text>
          </Pressable>
        ))}
      </BottomSheet>

      <BottomSheet visible={inputSheetVisible} onClose={() => setInputSheetVisible(false)} title="Add a note">
        <TextInput
              keyboardAppearance="dark"
          style={styles.sheetInput}
          value={inputValue}
          onChangeText={setInputValue}
          placeholder="Type something..."
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={3}
          autoFocus
        />
        <Pressable
          style={styles.sheetSaveBtn}
          onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setInputSheetVisible(false); showToast("Note saved!", "check-circle", Colors.success); setInputValue(""); }}
        >
          <Text style={styles.sheetSaveBtnText}>Save Note</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}

function InlineConfirm({ label, action, color }: { label: string; action: string; color: string }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <View style={[styles.inlineCard, confirming && { borderColor: color }]}>
      <Text style={styles.inlineLabel}>{label}</Text>
      {confirming ? (
        <View style={styles.inlineActions}>
          <Pressable style={styles.inlineCancelBtn} onPress={() => setConfirming(false)}>
            <Text style={styles.inlineCancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.inlineConfirmBtn, { backgroundColor: color }]}
            onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); setConfirming(false); }}
          >
            <Text style={styles.inlineConfirmText}>{action}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.inlineTrigger, { borderColor: color }]}
          onPress={() => { setConfirming(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
        >
          <Text style={[styles.inlineTriggerText, { color }]}>{action}</Text>
        </Pressable>
      )}
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gridBtn: {
    flex: 1,
    minWidth: "44%",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
  },
  gridBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  triggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  triggerText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  alertCard: {
    backgroundColor: Colors.cardBgElevated,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  alertIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  alertTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  alertMessage: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  alertBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    width: "100%",
  },
  alertBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  alertBtnGhost: {
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  alertBtnGhostText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  alertBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.cardBgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 16,
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sheetOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetOptionText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  sheetInput: {
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    margin: 16,
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 80,
    textAlignVertical: "top",
  },
  sheetSaveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 16,
    alignItems: "center",
  },
  sheetSaveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  toastContainer: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    zIndex: 999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.cardBgElevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  toastRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  toastTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: Colors.cardBg,
    borderRadius: 10,
    borderWidth: 1,
  },
  toastTriggerText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  inlineCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    gap: 12,
  },
  inlineLabel: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  inlineActions: { flexDirection: "row", gap: 8 },
  inlineCancelBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inlineCancelText: { color: Colors.textSecondary, fontSize: 12, fontFamily: "Inter_500Medium" },
  inlineConfirmBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  inlineConfirmText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  inlineTrigger: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  inlineTriggerText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
