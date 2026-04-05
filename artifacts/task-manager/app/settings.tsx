import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Keyboard,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from "react-native-reanimated";
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

// Enable LayoutAnimation on Android
if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useNotion } from "@/context/NotionContext";
import { useAnthropic } from "@/context/AnthropicContext";
import { useBiometric } from "@/context/BiometricContext";
import { useHeaderImage } from "@/context/HeaderImageContext";
import {
  SECTION_LABELS,
  useDrawerConfig,
  type SectionKey,
} from "@/context/DrawerConfigContext";
import { isTablet, DRAWER_WIDTH } from "@/context/DrawerContext";

// ── Types ─────────────────────────────────────────────────────────────────────
type ActiveMove = { section: SectionKey; label: string };

// ── Accordion ─────────────────────────────────────────────────────────────────
function Accordion({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen]     = useState(defaultOpen);
  const chevronAnim         = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = () => {
    const next = !open;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext({
      duration: 280,
      create:  { type: "easeInEaseOut", property: "opacity" },
      update:  { type: "spring",        springDamping: 0.72 },
      delete:  { type: "easeInEaseOut", property: "opacity" },
    });
    setOpen(next);
    Animated.spring(chevronAnim, {
      toValue: next ? 1 : 0,
      tension: 180, friction: 22, useNativeDriver: true,
    }).start();
  };

  const chevronRotate = chevronAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View style={acc.wrapper}>
      {/* Header row */}
      <Pressable
        style={({ pressed }) => [acc.header, pressed && { opacity: 0.8 }]}
        onPress={toggle}
        hitSlop={4}
      >
        <View style={acc.headerLeft}>
          <View style={acc.iconBox}>
            <Feather name={icon as any} size={14} color={Colors.primary} />
          </View>
          <Text style={acc.title}>{title}</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Feather name="chevron-down" size={18} color={Colors.textMuted} />
        </Animated.View>
      </Pressable>

      {/* Body — conditionally mounted so LayoutAnimation handles the expand/collapse */}
      {open && (
        <View>
          {children}
        </View>
      )}
    </View>
  );
}

const acc = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  iconBox: {
    width: 28, height: 28,
    backgroundColor: "rgba(224,49,49,0.12)",
    borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.1,
  },
});

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
            <View style={[mStyles.itemRow, hidden && mStyles.itemRowHidden]}>
              <View style={[mStyles.iconBox, hidden && mStyles.iconBoxHidden]}>
                <Feather name={item.icon as any} size={14} color={hidden ? Colors.textMuted : Colors.primary} />
              </View>
              <View style={mStyles.itemText}>
                <Text style={[mStyles.itemLabel, hidden && mStyles.itemLabelHidden]}>{item.label}</Text>
                <Text style={mStyles.itemDesc}>{item.description}</Text>
              </View>
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
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleHidden(sectionKey, item.label); }}
                style={({ pressed }) => [mStyles.eyeBtn, pressed && { opacity: 0.6 }]}
                hitSlop={6}
              >
                <Feather name={hidden ? "eye-off" : "eye"} size={16} color={hidden ? Colors.textMuted : Colors.primary} />
              </Pressable>
            </View>

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

// ── Banner editor modal ───────────────────────────────────────────────────────
const PREVIEW_H = 70;

function BannerEditorModal({
  visible, uri, initialOffX, initialOffY, initialScale,
  onSave, onClose,
}: {
  visible: boolean;
  uri: string;
  initialOffX: number;
  initialOffY: number;
  initialScale: number;
  onSave: (offX: number, offY: number, scale: number) => void;
  onClose: () => void;
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Editor box fills the screen minus header, hint, preview, and safe areas
  const HEADER_H  = 56;
  const HINT_H    = 38;
  const PREVIEW_SECTION_H = 148;
  const editorW = screenW;
  const editorH = Math.max(180,
    screenH - insets.top - insets.bottom - HEADER_H - HINT_H - PREVIEW_SECTION_H);

  // Shared values (editor-space pixels) — never read .value during render
  const initTx = initialOffX * editorW / DRAWER_WIDTH;
  const initTy = initialOffY * editorH / PREVIEW_H;
  const tx     = useSharedValue(initTx);
  const ty     = useSharedValue(initTy);
  const savedTx = useSharedValue(initTx);
  const savedTy = useSharedValue(initTy);
  const sc      = useSharedValue(initialScale);
  const savedSc = useSharedValue(initialScale);

  // Reset shared values whenever the editor opens (or a new URI arrives)
  // so re-opening after a cancelled edit always starts from the committed position
  const prevVisible = useRef(false);
  const prevUri     = useRef<string | null>(null);
  useEffect(() => {
    const justOpened   = visible && !prevVisible.current;
    const newUri       = uri !== prevUri.current;
    prevVisible.current = visible;
    prevUri.current     = uri;

    if ((justOpened || newUri) && uri) {
      const initX = initialOffX * editorW / DRAWER_WIDTH;
      const initY = initialOffY * editorH / PREVIEW_H;
      tx.value      = initX;
      ty.value      = initY;
      sc.value      = initialScale;
      savedTx.value = initX;
      savedTy.value = initY;
      savedSc.value = initialScale;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, uri]);

  const pan = Gesture.Pan()
    .onStart(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((e) => {
      const mX = editorW * (sc.value - 1) / 2;
      const mY = editorH * (sc.value - 1) / 2;
      tx.value = Math.max(-mX, Math.min(mX, savedTx.value + e.translationX));
      ty.value = Math.max(-mY, Math.min(mY, savedTy.value + e.translationY));
    });

  const pinch = Gesture.Pinch()
    .onStart(() => { savedSc.value = sc.value; })
    .onUpdate((e) => {
      const newSc = Math.max(1.0, Math.min(4.0, savedSc.value * e.scale));
      sc.value = newSc;
      const mX = editorW * (newSc - 1) / 2;
      const mY = editorH * (newSc - 1) / 2;
      tx.value = Math.max(-mX, Math.min(mX, tx.value));
      ty.value = Math.max(-mY, Math.min(mY, ty.value));
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  // Image fills the container (resizeMode cover), then we scale + pan it.
  // Using transform keeps cover crop fixed as reference; scale zooms in from center.
  const editorImgStyle = useAnimatedStyle(() => ({
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    transform: [
      { scale: sc.value },
      { translateX: tx.value },
      { translateY: ty.value },
    ],
  }));

  const previewImgStyle = useAnimatedStyle(() => ({
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    transform: [
      { scale: sc.value },
      { translateX: tx.value * DRAWER_WIDTH / editorW },
      { translateY: ty.value * PREVIEW_H / editorH },
    ],
  }));

  const doSave = () => {
    onSave(
      tx.value * DRAWER_WIDTH / editorW,
      ty.value * PREVIEW_H / editorH,
      sc.value,
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0f0f0f" }}>
        {/* Header */}
        <View style={[edSt.header, { paddingTop: insets.top, height: HEADER_H + insets.top }]}>
          <TouchableOpacity onPress={onClose} style={edSt.headerSideBtn} hitSlop={12}>
            <Text style={edSt.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={edSt.headerTitle}>EDIT BANNER</Text>
          <TouchableOpacity onPress={doSave} hitSlop={8}>
            <View style={edSt.savePill}>
              <Text style={edSt.saveText}>Save</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Hint */}
        <View style={[edSt.hintRow, { height: HINT_H }]}>
          <Feather name="zoom-in" size={12} color={Colors.textMuted} />
          <Text style={edSt.hintText}>Pinch to zoom, drag to reposition</Text>
        </View>

        {/* Editor — full-width, flex fill */}
        <GestureDetector gesture={composed}>
          <View style={[edSt.editorBox, { width: editorW, height: editorH }]} collapsable={false}>
            <Reanimated.Image source={{ uri }} style={editorImgStyle} resizeMode="cover" />
            {/* Crosshair center guide */}
            <View style={edSt.crossH} pointerEvents="none" />
            <View style={edSt.crossV} pointerEvents="none" />
          </View>
        </GestureDetector>

        {/* Preview strip */}
        <View style={[edSt.previewSection, { height: PREVIEW_SECTION_H }]}>
          <Text style={edSt.previewLabel}>DRAWER PREVIEW</Text>
          <View style={[edSt.previewBox, { width: DRAWER_WIDTH, height: PREVIEW_H }]}>
            <Reanimated.Image source={{ uri }} style={previewImgStyle} resizeMode="cover" />
            <LinearGradient
              colors={["transparent", "#111111"]}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 32 }}
              pointerEvents="none"
            />
            <LinearGradient
              colors={["#111111", "transparent"]}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 32 }}
              pointerEvents="none"
            />
          </View>
          <Text style={edSt.previewNote}>This is how it will look in the side drawer</Text>
        </View>

        {/* Bottom safe area */}
        <View style={{ height: insets.bottom, backgroundColor: "#0f0f0f" }} />
      </GestureHandlerRootView>
    </Modal>
  );
}

const edSt = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 10,
    backgroundColor: "#161616",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  headerSideBtn: {
    minWidth: 60,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  savePill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: "center",
  },
  saveText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0f0f0f",
  },
  hintText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  editorBox: {
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  crossH: {
    position: "absolute",
    top: "50%",
    left: 0, right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  crossV: {
    position: "absolute",
    left: "50%",
    top: 0, bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  previewSection: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#161616",
    borderTopWidth: 1,
    borderTopColor: "#2a2a2a",
  },
  previewLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  previewBox: {
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  previewNote: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { apiKey, setApiKey, clearConfig } = useNotion();
  const { apiKey: anthropicKey, setApiKey: setAnthropicKey, clearKey: clearAnthropicKey } = useAnthropic();
  const { isEnabled: biometricEnabled, isSupported: biometricSupported, setEnabled: setBiometric } = useBiometric();
  const { getSectionOrder, moveSectionUp, moveSectionDown, moveItemToSection, sidebarAlwaysOpen, setSidebarAlwaysOpen } = useDrawerConfig();

  const { uri: headerUri, offsetX: headerOffX, offsetY: headerOffY, scale: headerScale, update: headerUpdate, clear: headerClear } = useHeaderImage();

  const [draft,        setDraft]        = useState(apiKey ?? "");
  const [saved,        setSaved]        = useState(false);
  const [masked,       setMasked]       = useState(true);
  const [aiDraft,      setAiDraft]      = useState(anthropicKey ?? "");
  const [aiSaved,      setAiSaved]      = useState(false);
  const [aiMasked,     setAiMasked]     = useState(true);
  const [clearing,     setClearing]     = useState(false);
  const [activeMove,   setActiveMove]   = useState<ActiveMove | null>(null);
  const [bioToggling,  setBioToggling]  = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  // Holds the temp file path for a newly picked image (not yet committed to context)
  const [pendingUri, setPendingUri] = useState<string | null>(null);

  const tickOpacity = useRef(new Animated.Value(0)).current;

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      // Unique filename avoids the React Native image cache serving the old file
      const ts   = Date.now();
      const dest = (FileSystem.documentDirectory ?? "") + `hk_life_banner_${ts}.jpg`;
      await FileSystem.copyAsync({ from: result.assets[0].uri, to: dest });
      setPendingUri(dest);
      setEditorVisible(true);
    }
  };

  const topPad    = Platform.OS === "web" ? Math.max(insets.top, 67)    : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  useEffect(() => { setDraft(apiKey ?? ""); }, [apiKey]);
  useEffect(() => { setAiDraft(anthropicKey ?? ""); }, [anthropicKey]);

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

  const aiTickOpacity = useRef(new Animated.Value(0)).current;
  const handleAiSave = async () => {
    const trimmed = aiDraft.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setAnthropicKey(trimmed);
    setAiSaved(true);
    aiTickOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(aiTickOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(aiTickOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setAiSaved(false));
  };

  const handleBiometricToggle = async (val: boolean) => {
    if (bioToggling) return;
    setBioToggling(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await setBiometric(val);
    if (!success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setBioToggling(false);
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

        {/* ══ NOTION API ══════════════════════════════════════════════════════ */}
        <Accordion title="Notion API" icon="key" defaultOpen={false}>
          <View style={styles.accordionBody}>

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

            <View style={[styles.divider, { marginTop: 4 }]} />

            {/* How it works steps */}
            <Text style={styles.howTitle}>How it works</Text>
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
        </Accordion>

        {/* ══ ANTHROPIC API ═══════════════════════════════════════════════════ */}
        <Accordion title="Anthropic API" icon="cpu" defaultOpen={false}>
          <View style={styles.accordionBody}>

            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: anthropicKey ? Colors.success : Colors.textMuted }]} />
              <Text style={[styles.statusText, { color: anthropicKey ? Colors.success : Colors.textMuted }]}>
                {anthropicKey ? "API key configured" : "Not configured"}
              </Text>
            </View>

            <View style={styles.divider} />

            <Text style={styles.fieldLabel}>Claude API Key</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={aiDraft}
                onChangeText={setAiDraft}
                placeholder="sk-ant-xxxxxxxxxxxx…"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={aiMasked}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardAppearance="dark"
                returnKeyType="done"
                onSubmitEditing={handleAiSave}
              />
              <Pressable onPress={() => setAiMasked((m) => !m)} style={styles.eyeBtn}>
                <Feather name={aiMasked ? "eye" : "eye-off"} size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.hint}>
              Get your key at{" "}
              <Text style={styles.hintLink}>console.anthropic.com</Text>
              {"\n"}API Keys → Create Key. Used for Psychology Daily and any future AI features.
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.saveBtn, (aiDraft.trim() === (anthropicKey ?? "")) && styles.saveBtnDisabled]}
              onPress={handleAiSave}
              disabled={aiDraft.trim() === (anthropicKey ?? "") || !aiDraft.trim()}
            >
              {aiSaved ? (
                <Animated.View style={[styles.savedRow, { opacity: aiTickOpacity }]}>
                  <Feather name="check" size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>Saved</Text>
                </Animated.View>
              ) : (
                <Text style={styles.saveBtnText}>Save API Key</Text>
              )}
            </TouchableOpacity>

            {anthropicKey && (
              <TouchableOpacity activeOpacity={0.75} style={styles.clearBtn} onPress={clearAnthropicKey}>
                <Feather name="trash-2" size={14} color={Colors.textSecondary} />
                <Text style={styles.clearBtnText}>Remove saved key</Text>
              </TouchableOpacity>
            )}

          </View>
        </Accordion>

        {/* ══ MENU SETTINGS ═══════════════════════════════════════════════════ */}
        <Accordion title="Menu Settings" icon="menu" defaultOpen={false}>
          <View style={styles.accordionBody}>
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
          </View>
        </Accordion>

        {/* ══ HEADER IMAGE ════════════════════════════════════════════════════ */}
        <Accordion title="Drawer Banner" icon="image" defaultOpen={false}>
          <View style={styles.accordionBody}>

            {headerUri ? (
              <>
                {/* Static preview - tap to open editor */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setEditorVisible(true)}
                  style={imgSt.previewBox}
                >
                  <Image
                    source={{ uri: headerUri }}
                    style={{ position: "absolute", width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                  <View style={imgSt.previewHint}>
                    <Feather name="maximize-2" size={11} color="rgba(255,255,255,0.85)" />
                    <Text style={imgSt.previewHintText}>Tap to adjust position & zoom</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.divider} />
              </>
            ) : (
              <Text style={styles.sectionHint}>
                Pick an image from your library to use as a banner at the top of the drawer. Pinch and drag to position it exactly where you want.
              </Text>
            )}

            <TouchableOpacity activeOpacity={0.8} style={styles.replaceBtn} onPress={pickImage}>
              <Feather name="camera" size={14} color={Colors.textSecondary} />
              <Text style={styles.replaceBtnText}>{headerUri ? "Replace Image" : "Pick from Library"}</Text>
            </TouchableOpacity>

            {headerUri && (
              <TouchableOpacity activeOpacity={0.75} style={styles.clearBtn} onPress={headerClear}>
                <Feather name="trash-2" size={14} color={Colors.textSecondary} />
                <Text style={styles.clearBtnText}>Remove image</Text>
              </TouchableOpacity>
            )}

          </View>
        </Accordion>

        {/* Banner editor modal — mounts when there's something to edit */}
        {(pendingUri != null || headerUri != null) && (
          <BannerEditorModal
            visible={editorVisible}
            uri={pendingUri ?? headerUri!}
            initialOffX={pendingUri ? 0 : headerOffX}
            initialOffY={pendingUri ? 0 : headerOffY}
            initialScale={pendingUri ? 1.0 : (headerScale ?? 1.0)}
            onSave={(offX, offY, sc) => {
              if (pendingUri) {
                // New image: commit the pending file, delete the old one
                if (headerUri && headerUri !== pendingUri) {
                  FileSystem.deleteAsync(headerUri, { idempotent: true }).catch(() => {});
                }
                headerUpdate({ uri: pendingUri, offsetX: offX, offsetY: offY, scale: sc });
                setPendingUri(null);
              } else {
                // Reposition only: URI unchanged, just update offsets
                headerUpdate({ offsetX: offX, offsetY: offY, scale: sc });
              }
              setEditorVisible(false);
            }}
            onClose={() => {
              if (pendingUri) {
                // Cancel on new image: discard the temp file
                FileSystem.deleteAsync(pendingUri, { idempotent: true }).catch(() => {});
                setPendingUri(null);
              }
              setEditorVisible(false);
            }}
          />
        )}

        {/* ══ IPAD DISPLAY ════════════════════════════════════════════════════ */}
        {isTablet && (
          <Accordion title="iPad Display" icon="tablet" defaultOpen={false}>
            <View style={styles.accordionBody}>

              <View style={styles.toggleRow}>
                <View style={styles.toggleIcon}>
                  <Feather name="sidebar" size={16} color={Colors.primary} />
                </View>
                <View style={styles.toggleText}>
                  <Text style={styles.toggleLabel}>Sidebar always visible</Text>
                  <Text style={styles.toggleDesc}>
                    {sidebarAlwaysOpen
                      ? "Sidebar stays docked on every screen"
                      : "Sidebar auto-hides on non-Life screens (default)"}
                  </Text>
                </View>
                <Switch
                  value={sidebarAlwaysOpen}
                  onValueChange={(v) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setSidebarAlwaysOpen(v);
                  }}
                  trackColor={{ false: "#2a2a2a", true: "#E03131" }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#2a2a2a"
                />
              </View>

            </View>
          </Accordion>
        )}

        {/* ══ SECURITY ════════════════════════════════════════════════════════ */}
        <Accordion title="Security" icon="shield" defaultOpen={false}>
          <View style={styles.accordionBody}>

            {/* Face ID row */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleIcon}>
                <Feather name="cpu" size={16} color={biometricSupported ? Colors.primary : Colors.textMuted} />
              </View>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>Face ID / Biometrics</Text>
                <Text style={styles.toggleDesc}>
                  {!biometricSupported
                    ? "Not available on this device or simulator"
                    : biometricEnabled
                      ? "App is locked on launch"
                      : "Lock app on launch with Face ID"}
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                disabled={!biometricSupported || bioToggling}
                trackColor={{ false: "#2a2a2a", true: "#E03131" }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#2a2a2a"
              />
            </View>

            {biometricEnabled && (
              <>
                <View style={styles.divider} />
                <View style={styles.bioActiveRow}>
                  <Feather name="shield" size={13} color={Colors.success} />
                  <Text style={styles.bioActiveText}>
                    Face ID lock is active. You'll be prompted on next launch.
                  </Text>
                </View>
              </>
            )}

          </View>
        </Accordion>

      </ScrollView>
    </View>
  );
}

// ── Menu card styles ──────────────────────────────────────────────────────────
const mStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBgElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    marginBottom: 8,
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
  pickerLabel: { color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_500Medium" },
  pickerPills: { flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 },
  pill: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.cardBgElevated,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
  },
  pillPressed: { borderColor: Colors.primary, backgroundColor: "rgba(224,49,49,0.15)" },
  pillText: { color: Colors.textPrimary, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pickerCancel: { padding: 4 },
});

// ── Header image styles ───────────────────────────────────────────────────────
const imgSt = StyleSheet.create({
  previewBox: {
    height: 170,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.cardBgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    position: "relative",
  },
  previewImg: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
  },
  previewHint: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  previewHintText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  modeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 4 },
  modePill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBgElevated,
  },
  modePillActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(224,49,49,0.15)",
  },
  modePillText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  modePillTextActive: { color: Colors.primary },
});

// ── Screen styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.darkBg },
  content: { padding: 20, gap: 8 },

  accordionBody: {
    padding: 18,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  sectionHint: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
    lineHeight: 18,
  },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: -18 },

  fieldLabel: { color: Colors.textSecondary, fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4 },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.cardBgElevated, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.borderLight, paddingRight: 10,
  },
  input: {
    flex: 1, color: Colors.textPrimary, fontSize: 14, fontFamily: "Inter_400Regular",
    paddingHorizontal: 14, paddingVertical: 13,
  },
  eyeBtn: { padding: 6 },

  hint: { color: Colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  hintLink: { color: Colors.primary, fontFamily: "Inter_500Medium" },

  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  saveBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  saveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 8 },

  replaceBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 11,
    borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBgElevated,
  },
  replaceBtnText: { color: Colors.textSecondary, fontSize: 13, fontFamily: "Inter_500Medium" },

  clearBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10,
  },
  clearBtnText: { color: Colors.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular" },

  howTitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },

  step: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  stepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(224,49,49,0.15)",
    borderWidth: 1, borderColor: "rgba(224,49,49,0.3)",
    alignItems: "center", justifyContent: "center",
    marginTop: 1,
  },
  stepNumText: { color: Colors.primary, fontSize: 11, fontFamily: "Inter_700Bold" },
  stepText: { color: Colors.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 19 },

  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleIcon: {
    width: 36, height: 36,
    backgroundColor: "rgba(224,49,49,0.1)",
    borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  toggleText: { flex: 1 },
  toggleLabel: { color: Colors.textPrimary, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  toggleDesc: { color: Colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  bioActiveRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bioActiveText: { color: Colors.success, fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
});
