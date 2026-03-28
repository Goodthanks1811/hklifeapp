import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useDrawer } from "@/context/DrawerContext";
import { useNotion } from "@/context/NotionContext";

const IR_DB_ID = "2c9b7eba35238084a6decf83993961e4";
const IR_HEADER_LOGO =
  "https://i.postimg.cc/rwCNn1YJ/4375900A-530F-472F-8D00-3C573594C990.png";

const EPIC_PALETTE: Record<
  string,
  { bg: string; bgA: string; glow: string; glowA: string; shadow: string }
> = {
  Admin:     { bg: "rgba(40,160,40,0.22)",   bgA: "rgba(40,160,40,0.44)",   glow: "rgba(40,160,40,0.22)",   glowA: "rgba(40,160,40,0.54)",   shadow: "rgba(40,160,40,0.65)" },
  Testing:   { bg: "rgba(255,50,50,0.22)",   bgA: "rgba(220,20,20,0.48)",   glow: "rgba(255,50,50,0.45)",   glowA: "rgba(220,20,20,0.75)",   shadow: "rgba(255,60,60,0.8)" },
  Release:   { bg: "rgba(255,255,255,0.10)", bgA: "rgba(255,255,255,0.22)", glow: "rgba(255,255,255,0.14)", glowA: "rgba(255,255,255,0.38)", shadow: "rgba(255,255,255,0.55)" },
  Review:    { bg: "rgba(255,200,0,0.20)",   bgA: "rgba(255,200,0,0.38)",   glow: "rgba(255,200,0,0.22)",   glowA: "rgba(255,200,0,0.52)",   shadow: "rgba(255,200,0,0.6)" },
  Project:   { bg: "rgba(255,200,0,0.20)",   bgA: "rgba(255,200,0,0.38)",   glow: "rgba(255,200,0,0.22)",   glowA: "rgba(255,200,0,0.52)",   shadow: "rgba(255,200,0,0.6)" },
  Tool:      { bg: "rgba(255,255,255,0.10)", bgA: "rgba(255,255,255,0.22)", glow: "rgba(255,255,255,0.14)", glowA: "rgba(255,255,255,0.38)", shadow: "rgba(255,255,255,0.55)" },
  Reporting: { bg: "rgba(255,50,50,0.22)",   bgA: "rgba(220,20,20,0.48)",   glow: "rgba(255,50,50,0.45)",   glowA: "rgba(220,20,20,0.75)",   shadow: "rgba(255,60,60,0.8)" },
  Knowledge: { bg: "rgba(40,160,40,0.22)",   bgA: "rgba(40,160,40,0.44)",   glow: "rgba(40,160,40,0.22)",   glowA: "rgba(40,160,40,0.54)",   shadow: "rgba(40,160,40,0.65)" },
};

const EPICS_ORDER = ["Admin", "Testing", "Release", "Review", "Project", "Tool", "Reporting", "Knowledge"];
const PICKER_EMOJIS = ["🔥", "🚩", "📈", "🪛", "👀", "🧠", "📌"];

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

interface Schema {
  priType: string;
  priOptions: string[] | null;
  epicType: string;
  priorityType: string;
}

export default function IRQuickAdd() {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useDrawer();
  const { apiKey } = useNotion();

  const [schema, setSchema] = useState<Schema | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [selectedEpic, setSelectedEpic] = useState<string | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  useEffect(() => {
    if (!apiKey) return;
    fetch(`${BASE_URL}/api/notion/schema/${IR_DB_ID}`, {
      headers: { "x-notion-key": apiKey },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.message) throw new Error(data.message);
        setSchema(data);
      })
      .catch((e) => setSchemaError(e.message));
  }, [apiKey]);

  const shake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const showSuccess = useCallback(() => {
    successAnim.setValue(0);
    Animated.sequence([
      Animated.timing(successAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(1000),
      Animated.timing(successAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [successAnim]);

  const handleSave = useCallback(async () => {
    const t = title.trim();
    if (!t) { shake(); return; }
    if (!schema || !apiKey) return;

    setIsSaving(true);
    setSaveStatus("idle");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await fetch(`${BASE_URL}/api/notion/pages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-notion-key": apiKey,
        },
        body: JSON.stringify({
          dbId: IR_DB_ID,
          title: t,
          epic: selectedEpic || "Admin",
          emoji: selectedEmoji || "🔥",
          priType: schema.priType,
          priOptions: schema.priOptions,
          epicType: schema.epicType,
          priorityType: schema.priorityType,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to save");

      setSaveStatus("success");
      showSuccess();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTitle("");
      setSelectedEpic(null);
      setSelectedEmoji(null);
      setTimeout(() => {
        inputRef.current?.focus();
        setSaveStatus("idle");
      }, 1500);
    } catch (e: any) {
      setSaveStatus("error");
      setErrorMsg(e.message || "Something went wrong");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setSaveStatus("idle"), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [title, schema, apiKey, selectedEpic, selectedEmoji, shake, showSuccess]);

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const shakeX = shakeAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-8, 0, 8],
  });

  const successOpacity = successAnim;
  const successTranslateY = successAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => openDrawer()} style={styles.headerBtn}>
          <Feather name="menu" size={20} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Quick Add</Text>
        <Pressable onPress={handleCancel} style={styles.headerBtn}>
          <Feather name="x" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={topPad + 56}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image source={{ uri: IR_HEADER_LOGO }} style={styles.logo} resizeMode="contain" />
          </View>

          {/* No API key warning */}
          {!apiKey && (
            <View style={styles.warningBox}>
              <Feather name="alert-circle" size={16} color={Colors.warning} />
              <Text style={styles.warningText}>Add your Notion API key in the Task Board settings first.</Text>
            </View>
          )}

          {/* Schema error */}
          {schemaError && (
            <View style={styles.warningBox}>
              <Feather name="alert-circle" size={16} color={Colors.primary} />
              <Text style={styles.warningText}>{schemaError}</Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Summary</Text>
            <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                placeholder="Enter title"
                placeholderTextColor={Colors.textMuted}
                value={title}
                onChangeText={setTitle}
                autoCorrect
                returnKeyType="done"
                onSubmitEditing={handleSave}
                editable={!isSaving}
              />
            </Animated.View>

            <Text style={styles.fieldLabel}>Epic</Text>
            <View style={styles.epicGrid}>
              {EPICS_ORDER.map((epic) => {
                const isActive = selectedEpic === epic;
                const isDimmed = selectedEpic !== null && !isActive;
                const pal = EPIC_PALETTE[epic];
                return (
                  <TouchableOpacity
                    key={epic}
                    activeOpacity={0.8}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedEpic(selectedEpic === epic ? null : epic);
                    }}
                    style={[
                      styles.epicBtn,
                      {
                        backgroundColor: isActive ? pal.bgA : pal.bg,
                        opacity: isDimmed ? 0.22 : 1,
                      },
                    ]}
                  >
                    <Text style={styles.epicBtnText}>{epic}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Priority</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.emojiRow}
              keyboardShouldPersistTaps="handled"
            >
              {PICKER_EMOJIS.map((em) => {
                const isSelected = selectedEmoji === em;
                const isDimmed = selectedEmoji !== null && !isSelected;
                return (
                  <TouchableOpacity
                    key={em}
                    activeOpacity={0.7}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedEmoji(em);
                    }}
                    style={[
                      styles.emojiBtn,
                      isSelected && styles.emojiBtnSelected,
                      isDimmed && styles.emojiBtnDimmed,
                    ]}
                  >
                    <Text style={styles.emojiText}>{em}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(bottomPad, 20) }]}>
          {saveStatus === "error" && (
            <Text style={styles.errorText} numberOfLines={2}>{errorMsg}</Text>
          )}
          <View style={styles.footerBtns}>
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.cancelBtn}
              onPress={handleCancel}
              disabled={isSaving}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.saveBtn, (!schema || isSaving) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!schema || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : saveStatus === "success" ? (
                <View style={styles.successRow}>
                  <Feather name="check" size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>Saved!</Text>
                </View>
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Success toast */}
      <Animated.View
        style={[
          styles.successToast,
          { top: topPad + 60, opacity: successOpacity, transform: [{ translateY: successTranslateY }] },
        ]}
        pointerEvents="none"
      >
        <Feather name="check-circle" size={16} color={Colors.success} />
        <Text style={styles.successToastText}>Added to Notion</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.darkBg },
  flex: { flex: 1 },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: {
    width: 36, height: 36,
    backgroundColor: Colors.cardBg,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 12,
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 24,
    marginTop: 4,
  },
  logo: {
    width: 200,
    height: 60,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(253,126,20,0.1)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(253,126,20,0.3)",
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    color: Colors.warning,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  formCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 0,
  },
  fieldLabel: {
    color: Colors.textPrimary,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 12,
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  epicGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  epicBtn: {
    width: "23.5%",
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  epicBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  emojiRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  emojiBtn: {
    width: 48, height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  emojiBtnSelected: {
    backgroundColor: "rgba(224,49,49,0.28)",
    borderColor: "rgba(224,49,49,0.6)",
  },
  emojiBtnDimmed: {
    opacity: 0.3,
  },
  emojiText: {
    fontSize: 22,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.darkBg,
    gap: 8,
  },
  footerBtns: {
    flexDirection: "row",
    gap: 12,
  },
  errorText: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  cancelBtnText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  saveBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  saveBtnDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  successRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  successToast: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(64,192,87,0.15)",
    borderWidth: 1,
    borderColor: "rgba(64,192,87,0.4)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  successToastText: {
    color: Colors.success,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
