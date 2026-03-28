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
  SECTION_LABELS,
  useDrawerConfig,
  type SectionKey,
} from "@/context/DrawerConfigContext";

// ── Types ─────────────────────────────────────────────────────────────────────
type ActiveMove = { section: SectionKey; label: string };

// ── Menu section card ─────────────────────────────────────────────────────────
function MenuSectionCard({
  sectionKey,
  sectionIsFirst,
  sectionIsLast,
  onMoveSectionUp,
  onMoveSectionDown,
  activeMove,
  onStartMove,
  onCompleteMove,
  onCancelMove,
}: {
  sectionKey:        SectionKey;
  sectionIsFirst:    boolean;
  sectionIsLast:     boolean;
  onMoveSectionUp:   () => void;
  onMoveSectionDown: () => void;
  activeMove:        ActiveMove | null;
  onStartMove:       (label: string) => void;
  onCompleteMove:    (label: string, toSection: SectionKey) => void;
  onCancelMove:      () => void;
}) {
  const {
    getAllItems, isHidden, toggleHidden,
    moveUp, moveDown,
    isSectionHidden, toggleSectionHidden,
    getSectionOrder,
  } = useDrawerConfig();

  const items       = getAllItems(sectionKey);
  const secHidden   = isSectionHidden(sectionKey);
  const orderedSecs = getSectionOrder();

  return (
    <View style={[mStyles.card, secHidden && mStyles.cardHidden]}>
      {/* ── Section header ──────────────────────────────────────────────────── */}
      <View style={mStyles.sectionHeader}>
        <Text style={[mStyles.sectionTitle, secHidden && mStyles.sectionTitleHidden]}>
          {SECTION_LABELS[sectionKey]}
        </Text>
        <View style={mStyles.sectionControls}>
          {/* Section reorder arrows */}
          <Pressable
            onPress={() => { if (!sectionIsFirst) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onMoveSectionUp(); } }}
            style={({ pressed }) => [mStyles.arrowBtn, (sectionIsFirst || pressed) && mStyles.arrowBtnDim]}
            hitSlop={8}
          >
            <Feather name="chevron-up" size={15} color={sectionIsFirst ? Colors.textMuted : Colors.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => { if (!sectionIsLast) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onMoveSectionDown(); } }}
            style={({ pressed }) => [mStyles.arrowBtn, (sectionIsLast || pressed) && mStyles.arrowBtnDim]}
            hitSlop={8}
          >
            <Feather name="chevron-down" size={15} color={sectionIsLast ? Colors.textMuted : Colors.textSecondary} />
          </Pressable>
          {/* Section hide toggle */}
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleSectionHidden(sectionKey); }}
            style={({ pressed }) => [mStyles.eyeBtn, pressed && { opacity: 0.6 }]}
            hitSlop={8}
          >
            <Feather name={secHidden ? "eye-off" : "eye"} size={16} color={secHidden ? Colors.textMuted : Colors.primary} />
          </Pressable>
        </View>
      </View>

      {/* ── Items ───────────────────────────────────────────────────────────── */}
      {items.map((item, idx) => {
        const hidden     = isHidden(sectionKey, item.label);
        const itemFirst  = idx === 0;
        const itemLast   = idx === items.length - 1;
        const isMoving   = activeMove?.section === sectionKey && activeMove?.label === item.label;

        return (
          <View key={item.label}>
            {/* Item row */}
            <View style={[mStyles.itemRow, hidden && mStyles.itemRowHidden]}>
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
                  onPress={() => { if (!itemFirst) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); moveUp(sectionKey, item.label); } }}
                  style={({ pressed }) => [mStyles.arrowBtn, (itemFirst || pressed) && mStyles.arrowBtnDim]}
                  hitSlop={5}
                >
                  <Feather name="chevron-up" size={15} color={itemFirst ? Colors.textMuted : Colors.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => { if (!itemLast) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); moveDown(sectionKey, item.label); } }}
                  style={({ pressed }) => [mStyles.arrowBtn, (itemLast || pressed) && mStyles.arrowBtnDim]}
                  hitSlop={5}
                >
                  <Feather name="chevron-down" size={15} color={itemLast ? Colors.textMuted : Colors.textSecondary} />
                </Pressable>
              </View>

              {/* Move-to-section button */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  isMoving ? onCancelMove() : onStartMove(item.label);
                }}
                style={({ pressed }) => [mStyles.moveBtn, (isMoving || pressed) && mStyles.moveBtnActive]}
                hitSlop={6}
              >
                <Feather name="log-in" size={15} color={isMoving ? Colors.primary : Colors.textSecondary} />
              </Pressable>

              {/* Eye toggle */}
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleHidden(sectionKey, item.label); }}
                style={({ pressed }) => [mStyles.eyeBtn, pressed && { opacity: 0.6 }]}
                hitSlop={6}
              >
                <Feather name={hidden ? "eye-off" : "eye"} size={16} color={hidden ? Colors.textMuted : Colors.primary} />
              </Pressable>
            </View>

            {/* Inline section picker */}
            {isMoving && (
              <View style={mStyles.picker}>
                <Text style={mStyles.pickerLabel}>Move to:</Text>
                <View style={mStyles.pickerPills}>
                  {orderedSecs
                    .filter((k) => k !== sectionKey)
                    .map((k) => (
                      <Pressable
                        key={k}
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onCompleteMove(item.label, k); }}
                        style={({ pressed }) => [mStyles.pill, pressed && mStyles.pillPressed]}
                      >
                        <Text style={mStyles.pillText}>{SECTION_LABELS[k]}</Text>
                      </Pressable>
                    ))}
                </View>
                <Pressable onPress={onCancelMove} style={mStyles.pickerCancel} hitSlop={8}>
                  <Feather name="x" size={14} color={Colors.textMuted} />
                </Pressable>
              </View>
            )}
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
  const { getSectionOrder, moveSectionUp, moveSectionDown, moveItemToSection } = useDrawerConfig();

  const [draft,       setDraft]       = useState(apiKey ?? "");
  const [saved,       setSaved]       = useState(false);
  const [masked,      setMasked]      = useState(true);
  const [clearing,    setClearing]    = useState(false);
  const [activeMove,  setActiveMove]  = useState<ActiveMove | null>(null);

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

  const orderedSections = getSectionOrder();
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
        <Text style={styles.sectionHint}>
          Reorder sections and items with ↑↓. Tap{" "}
          <Feather name="log-in" size={11} color={Colors.textMuted} /> to move an item to a different section.
          Tap the eye to show or hide.
        </Text>

        {orderedSections.map((key, idx) => (
          <MenuSectionCard
            key={key}
            sectionKey={key}
            sectionIsFirst={idx === 0}
            sectionIsLast={idx === orderedSections.length - 1}
            onMoveSectionUp={() => moveSectionUp(key)}
            onMoveSectionDown={() => moveSectionDown(key)}
            activeMove={activeMove?.section === key ? activeMove : null}
            onStartMove={(label) => setActiveMove({ section: key, label })}
            onCompleteMove={(label, toSection) => {
              moveItemToSection(key, label, toSection);
              setActiveMove(null);
            }}
            onCancelMove={() => setActiveMove(null)}
          />
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
            <TouchableOpacity activeOpacity={0.75} style={styles.clearBtn} onPress={handleClear} disabled={clearing}>
              <Feather name="trash-2" size={14} color={Colors.textSecondary} />
              <Text style={styles.clearBtnText}>{clearing ? "Clearing…" : "Remove saved key"}</Text>
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
  cardHidden: { opacity: 0.5 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    flex: 1,
  },
  sectionTitleHidden: { color: Colors.textMuted },
  sectionControls: { flexDirection: "row", alignItems: "center", gap: 2 },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemRowHidden: { opacity: 0.4 },

  iconBox: {
    width: 26, height: 26,
    backgroundColor: "rgba(224,49,49,0.1)",
    borderRadius: 7,
    alignItems: "center", justifyContent: "center",
  },
  iconBoxHidden: { backgroundColor: "rgba(255,255,255,0.05)" },

  itemText: { flex: 1 },
  itemLabel: { color: Colors.textPrimary, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  itemLabelHidden: { color: Colors.textMuted },
  itemDesc: { color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },

  arrows: { flexDirection: "row", gap: 1 },
  arrowBtn: { width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  arrowBtnDim: { opacity: 0.3 },

  moveBtn: {
    width: 28, height: 28, alignItems: "center", justifyContent: "center",
    borderRadius: 7, borderWidth: 1, borderColor: "transparent",
  },
  moveBtnActive: {
    backgroundColor: "rgba(224,49,49,0.12)",
    borderColor: Colors.border,
  },

  eyeBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 8 },

  // Inline section picker
  picker: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(224,49,49,0.05)",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  pickerPills: { flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.cardBgElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillPressed: { borderColor: Colors.primary, backgroundColor: "rgba(224,49,49,0.15)" },
  pillText: { color: Colors.textPrimary, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pickerCancel: { padding: 4 },
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
    lineHeight: 18,
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

  fieldLabel: { color: Colors.textSecondary, fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4 },
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

  hint: { color: Colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  hintLink: { color: Colors.info, fontFamily: "Inter_500Medium" },

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

  clearBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6 },
  clearBtnText: { color: Colors.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular" },

  step: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.cardBgElevated,
    borderWidth: 1, borderColor: Colors.borderLight,
    alignItems: "center", justifyContent: "center",
    marginTop: 1,
  },
  stepNumText: { color: Colors.primary, fontSize: 11, fontFamily: "Inter_700Bold" },
  stepText: { flex: 1, color: Colors.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
});
