import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import { ScreenHeader } from "@/components/ScreenHeader";
import { useNotion } from "@/context/NotionContext";
import {
  ALL_ITEMS,
  SECTION_LABELS,
  SECTION_ORDER,
  useDrawerConfig,
  type MenuItem,
  type SectionKey,
} from "@/context/DrawerConfigContext";

// ── Menu section editor ───────────────────────────────────────────────────────
function MenuSectionCard({ sectionKey }: { sectionKey: SectionKey }) {
  const { getAllItems, isHidden, toggleHidden, moveUp, moveDown } = useDrawerConfig();
  const items = getAllItems(sectionKey);

  return (
    <View style={mStyles.card}>
      <Text style={mStyles.sectionTitle}>{SECTION_LABELS[sectionKey]}</Text>
      {items.map((item, idx) => {
        const hidden    = isHidden(sectionKey, item.label);
        const isFirst   = idx === 0;
        const isLast    = idx === items.length - 1;

        return (
          <View key={item.label} style={[mStyles.itemRow, hidden && mStyles.itemRowHidden]}>
            {/* Icon + label */}
            <View style={[mStyles.iconBox, hidden && mStyles.iconBoxHidden]}>
              <Feather name={item.icon as any} size={14} color={hidden ? Colors.textMuted : Colors.primary} />
            </View>
            <View style={mStyles.itemText}>
              <Text style={[mStyles.itemLabel, hidden && mStyles.itemLabelHidden]}>{item.label}</Text>
              <Text style={mStyles.itemDesc}>{item.description}</Text>
            </View>

            {/* Reorder arrows */}
            <View style={mStyles.arrows}>
              <Pressable
                onPress={() => {
                  if (isFirst) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  moveUp(sectionKey, item.label);
                }}
                style={({ pressed }) => [mStyles.arrowBtn, (isFirst || pressed) && mStyles.arrowBtnDisabled]}
                hitSlop={6}
              >
                <Feather name="chevron-up" size={16} color={isFirst ? Colors.textMuted : Colors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => {
                  if (isLast) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  moveDown(sectionKey, item.label);
                }}
                style={({ pressed }) => [mStyles.arrowBtn, (isLast || pressed) && mStyles.arrowBtnDisabled]}
                hitSlop={6}
              >
                <Feather name="chevron-down" size={16} color={isLast ? Colors.textMuted : Colors.textSecondary} />
              </Pressable>
            </View>

            {/* Eye toggle */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleHidden(sectionKey, item.label);
              }}
              style={({ pressed }) => [mStyles.eyeBtn, pressed && { opacity: 0.6 }]}
              hitSlop={8}
            >
              <Feather
                name={hidden ? "eye-off" : "eye"}
                size={17}
                color={hidden ? Colors.textMuted : Colors.primary}
              />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { apiKey, setApiKey, clearConfig } = useNotion();

  const [draft, setDraft]       = useState(apiKey ?? "");
  const [saved, setSaved]       = useState(false);
  const [masked, setMasked]     = useState(true);
  const [clearing, setClearing] = useState(false);

  const tickOpacity = useRef(new Animated.Value(0)).current;

  const topPad    = Platform.OS === "web" ? Math.max(insets.top, 67)    : insets.top;
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
      <ScreenHeader title="Settings" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Menu Customisation ─────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>MENU</Text>
        <Text style={styles.sectionHint}>Reorder items with the arrows. Tap the eye to show or hide.</Text>
        {SECTION_ORDER.map((key) => (
          <MenuSectionCard key={key} sectionKey={key} />
        ))}

        {/* ── Notion Integration ─────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>NOTION INTEGRATION</Text>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: hasKey ? Colors.success : Colors.textMuted }]} />
            <Text style={[styles.statusText, { color: hasKey ? Colors.success : Colors.textMuted }]}>
              {hasKey ? "API key configured" : "Not configured"}
            </Text>
          </View>

          <View style={styles.divider} />

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
              <Feather name={masked ? "eye" : "eye-off"} size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.hint}>
            Get your key at{" "}
            <Text style={styles.hintLink}>notion.so/my-integrations</Text>
            {"\n"}Create an integration → copy the Internal Integration Secret.
          </Text>

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

        {/* ── How it works ───────────────────────────────────────────────────── */}
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

// ── Menu card styles ──────────────────────────────────────────────────────────
const mStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    marginBottom: 10,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemRowHidden: { opacity: 0.45 },
  iconBox: {
    width: 28, height: 28,
    backgroundColor: "rgba(224,49,49,0.1)",
    borderRadius: 7,
    alignItems: "center", justifyContent: "center",
  },
  iconBoxHidden: { backgroundColor: "rgba(255,255,255,0.05)" },
  itemText: { flex: 1 },
  itemLabel: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  itemLabelHidden: { color: Colors.textMuted },
  itemDesc: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  arrows: {
    flexDirection: "row",
    gap: 2,
  },
  arrowBtn: {
    width: 28, height: 28,
    alignItems: "center", justifyContent: "center",
    borderRadius: 6,
  },
  arrowBtnDisabled: { opacity: 0.3 },
  eyeBtn: {
    width: 32, height: 32,
    alignItems: "center", justifyContent: "center",
    borderRadius: 8,
  },
});

// ── Existing styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.darkBg },
  content: { padding: 20, gap: 8 },

  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
    marginTop: 4,
  },
  sectionHint: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 10,
    lineHeight: 17,
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
