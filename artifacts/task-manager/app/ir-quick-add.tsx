import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
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
import { useDrawer } from "@/context/DrawerContext";
import { useNotion } from "@/context/NotionContext";

// ── IR Theme ─────────────────────────────────────────────────────────────────
const IR = {
  bg:        "#0C1846",
  card:      "#0E1C4E",
  cardBorder:"rgba(255,255,255,0.10)",
  gold:      "#FE9A01",
  goldDark:  "#d97f00",
  goldGlow:  "rgba(254,154,1,0.28)",
  text:      "#f2f2f7",
  textMuted: "#7a8aaa",
  inputBg:   "rgba(255,255,255,0.08)",
  inputBdr:  "rgba(255,255,255,0.25)",
  inputFocus:"rgba(255,255,255,0.75)",
  cancelBg:  "rgba(255,255,255,0.08)",
  cancelBdr: "rgba(255,255,255,0.12)",
  success:   "#40C057",
  error:     "#FF6B6B",
  divider:   "rgba(255,255,255,0.08)",
};

const IR_DB_ID = "2c9b7eba35238084a6decf83993961e4";
const IR_HEADER_LOGO =
  "https://i.postimg.cc/rwCNn1YJ/4375900A-530F-472F-8D00-3C573594C990.png";

const EPIC_PALETTE: Record<string, { bg: string; bgA: string }> = {
  Admin:     { bg: "rgba(40,160,40,0.22)",   bgA: "rgba(40,160,40,0.50)"   },
  Testing:   { bg: "rgba(255,50,50,0.22)",   bgA: "rgba(220,20,20,0.55)"   },
  Release:   { bg: "rgba(255,255,255,0.09)", bgA: "rgba(255,255,255,0.22)" },
  Review:    { bg: "rgba(255,200,0,0.20)",   bgA: "rgba(255,200,0,0.42)"   },
  Project:   { bg: "rgba(255,200,0,0.20)",   bgA: "rgba(255,200,0,0.42)"   },
  Tool:      { bg: "rgba(255,255,255,0.09)", bgA: "rgba(255,255,255,0.22)" },
  Reporting: { bg: "rgba(255,50,50,0.22)",   bgA: "rgba(220,20,20,0.55)"   },
  Knowledge: { bg: "rgba(40,160,40,0.22)",   bgA: "rgba(40,160,40,0.50)"   },
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
  const [footerH, setFooterH] = useState(90);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const keyboardOffset = useRef(new Animated.Value(0)).current;

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  // Track keyboard height and animate footer up/down
  useEffect(() => {
    const onShow = (e: any) => {
      setKeyboardVisible(true);
      Animated.timing(keyboardOffset, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    };
    const onHide = (e: any) => {
      setKeyboardVisible(false);
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: e.duration || 200,
        useNativeDriver: false,
      }).start();
    };
    const s1 = Keyboard.addListener("keyboardWillShow", onShow);
    const s2 = Keyboard.addListener("keyboardWillHide", onHide);
    const s3 = Keyboard.addListener("keyboardDidShow", onShow);
    const s4 = Keyboard.addListener("keyboardDidHide", onHide);
    return () => { s1.remove(); s2.remove(); s3.remove(); s4.remove(); };
  }, [keyboardOffset]);

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
      Animated.timing(shakeAnim, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const showSuccess = useCallback(() => {
    successAnim.setValue(0);
    Animated.sequence([
      Animated.timing(successAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(900),
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
        headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
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

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => openDrawer()} style={styles.headerBtn}>
          <Feather name="menu" size={20} color={IR.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Quick Add</Text>
        <Pressable onPress={handleCancel} style={styles.headerBtn}>
          <Feather name="x" size={20} color={IR.textMuted} />
        </Pressable>
      </View>

      {/* Scrollable body — bottom padding reserves space for the absolute footer */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: footerH + Math.max(bottomPad, 16) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo — 3× larger */}
        <View style={styles.logoWrap}>
          <Image source={{ uri: IR_HEADER_LOGO }} style={styles.logo} resizeMode="contain" />
        </View>

        {/* Warnings */}
        {!apiKey && (
          <View style={styles.warningBox}>
            <Feather name="alert-circle" size={16} color={IR.gold} />
            <Text style={styles.warningText}>Add your Notion API key in the Task Board settings first.</Text>
          </View>
        )}
        {schemaError && (
          <View style={styles.warningBox}>
            <Feather name="alert-circle" size={16} color={IR.error} />
            <Text style={[styles.warningText, { color: IR.error }]}>{schemaError}</Text>
          </View>
        )}

        {/* Form card */}
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>Summary</Text>
          <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="Enter title"
              placeholderTextColor={IR.textMuted}
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
                    { backgroundColor: isActive ? pal.bgA : pal.bg, opacity: isDimmed ? 0.2 : 1 },
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
                    isDimmed && { opacity: 0.3 },
                  ]}
                >
                  <Text style={styles.emojiText}>{em}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Footer — absolutely positioned, animates up with keyboard */}
      <Animated.View
        style={[styles.footer, { bottom: keyboardOffset }]}
        onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
      >
        {saveStatus === "error" && (
          <Text style={styles.errorText} numberOfLines={2}>{errorMsg}</Text>
        )}
        <View style={[styles.footerBtns, { paddingBottom: keyboardVisible ? 10 : Math.max(bottomPad, 20) }]}>
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
              <ActivityIndicator color={IR.bg} size="small" />
            ) : saveStatus === "success" ? (
              <View style={styles.successRow}>
                <Feather name="check" size={16} color={IR.bg} />
                <Text style={styles.saveBtnText}>Saved!</Text>
              </View>
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Success toast */}
      <Animated.View
        style={[styles.successToast, { top: topPad + 64, opacity: successAnim }]}
        pointerEvents="none"
      >
        <Feather name="check-circle" size={15} color={IR.success} />
        <Text style={styles.successToastText}>Added to Notion</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IR.bg },
  flex: { flex: 1 },

  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: IR.divider,
    backgroundColor: IR.bg,
  },
  headerBtn: {
    width: 36, height: 36,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IR.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: IR.text,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },

  scrollContent: {
    padding: 18,
    paddingBottom: 16,
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 20,
    marginTop: 10,
  },
  logo: {
    width: 300,
    height: 160,
  },

  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(254,154,1,0.10)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(254,154,1,0.30)",
    padding: 12,
    marginBottom: 14,
  },
  warningText: {
    color: IR.gold,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },

  formCard: {
    backgroundColor: IR.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: IR.cardBorder,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },

  fieldLabel: {
    color: IR.text,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.85,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 6,
  },

  textInput: {
    backgroundColor: IR.inputBg,
    borderWidth: 1,
    borderColor: IR.inputBdr,
    borderRadius: 14,
    color: IR.text,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },

  epicGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  epicBtn: {
    width: "23.5%",
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
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
    paddingVertical: 2,
    paddingBottom: 6,
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
    backgroundColor: "rgba(254,154,1,0.28)",
    borderColor: "rgba(254,154,1,0.65)",
  },
  emojiText: {
    fontSize: 22,
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: IR.divider,
    backgroundColor: IR.bg,
    gap: 8,
  },
  footerBtns: {
    flexDirection: "row",
    gap: 12,
  },
  errorText: {
    color: IR.error,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },

  cancelBtn: {
    flex: 1,
    backgroundColor: IR.cancelBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: IR.cancelBdr,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
  },
  cancelBtnText: {
    color: IR.text,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  saveBtn: {
    flex: 2,
    backgroundColor: IR.gold,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    shadowColor: IR.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  saveBtnDisabled: {
    opacity: 0.35,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    color: IR.bg,
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
    borderColor: "rgba(64,192,87,0.35)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  successToastText: {
    color: IR.success,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
