import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
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
import { Colors } from "@/constants/colors";
import { useDrawer } from "@/context/DrawerContext";
import { useNotion } from "@/context/NotionContext";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useDrawer();
  const { apiKey, setApiKey, clearConfig } = useNotion();

  const [draft, setDraft]       = useState(apiKey ?? "");
  const [saved, setSaved]       = useState(false);
  const [masked, setMasked]     = useState(true);
  const [clearing, setClearing] = useState(false);

  const tickOpacity = useRef(new Animated.Value(0)).current;

  const topPad    = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  useEffect(() => { setDraft(apiKey ?? ""); }, [apiKey]);

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setApiKey(trimmed);
    setSaved(true);
    tickOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(tickOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(tickOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setSaved(false));
  };

  const handleClear = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setClearing(true);
    await clearConfig();
    setDraft("");
    setClearing(false);
  };

  const isChanged = draft.trim() !== (apiKey ?? "");
  const hasKey    = !!apiKey;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => openDrawer()} style={styles.headerBtn}>
          <Feather name="menu" size={20} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Section: Notion */}
        <Text style={styles.sectionLabel}>NOTION INTEGRATION</Text>
        <View style={styles.card}>

          {/* Status row */}
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: hasKey ? Colors.success : Colors.textMuted }]} />
            <Text style={[styles.statusText, { color: hasKey ? Colors.success : Colors.textMuted }]}>
              {hasKey ? "API key configured" : "Not configured"}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* API Key input */}
          <Text style={styles.fieldLabel}>Notion API Key</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="secret_xxxxxxxxxxxx…"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={masked}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardAppearance="dark"
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
            <Pressable onPress={() => setMasked((m) => !m)} style={styles.eyeBtn}>
              <Feather
                name={masked ? "eye" : "eye-off"}
                size={18}
                color={Colors.textSecondary}
              />
            </Pressable>
          </View>

          <Text style={styles.hint}>
            Get your key at{" "}
            <Text style={styles.hintLink}>notion.so/my-integrations</Text>
            {"\n"}Create an integration → copy the Internal Integration Secret.
          </Text>

          {/* Save button */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.saveBtn, !isChanged && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!isChanged || !draft.trim()}
          >
            {saved ? (
              <Animated.View style={[styles.savedRow, { opacity: tickOpacity }]}>
                <Feather name="check" size={16} color="#fff" />
                <Text style={styles.saveBtnText}>Saved</Text>
              </Animated.View>
            ) : (
              <Text style={styles.saveBtnText}>Save API Key</Text>
            )}
          </TouchableOpacity>

          {/* Clear button — only shown when a key is saved */}
          {hasKey && (
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.clearBtn}
              onPress={handleClear}
              disabled={clearing}
            >
              <Feather name="trash-2" size={14} color={Colors.textSecondary} />
              <Text style={styles.clearBtnText}>
                {clearing ? "Clearing…" : "Remove saved key"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* How it works */}
        <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
        <View style={styles.card}>
          {[
            { n: "1", text: "Go to notion.so/my-integrations and create a new integration." },
            { n: "2", text: 'Copy the "Internal Integration Secret" (starts with secret_).' },
            { n: "3", text: "Paste it above and tap Save API Key." },
            { n: "4", text: "Open your Notion database → Connections → add your integration." },
          ].map((step) => (
            <View key={step.n} style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{step.n}</Text>
              </View>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.darkBg },

  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.darkBg,
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

  content: { padding: 20, gap: 8 },

  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 12,
  },

  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 12,
  },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: -18 },

  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.cardBgElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingRight: 10,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  eyeBtn: { padding: 6 },

  hint: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  hintLink: {
    color: Colors.info,
    fontFamily: "Inter_500Medium",
  },

  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 6 },

  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  clearBtnText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },

  step: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.cardBgElevated,
    borderWidth: 1, borderColor: Colors.borderLight,
    alignItems: "center", justifyContent: "center",
    marginTop: 1,
  },
  stepNumText: { color: Colors.primary, fontSize: 11, fontFamily: "Inter_700Bold" },
  stepText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
});
