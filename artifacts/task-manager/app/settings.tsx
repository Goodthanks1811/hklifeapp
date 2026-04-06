import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
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
import { useGoogleCalendar } from "@/context/GoogleCalendarContext";
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
    backgroundColor: "#0f0f0f",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    overflow: "hidden",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: "transparent",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  iconBox: {
    width: 28, height: 28,
    backgroundColor: "rgba(224,49,49,0.15)",
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(224,49,49,0.30)",
    alignItems: "center", justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  title: {
    color: "#ffffff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});

// ── Sub-accordion (nested inside a parent Accordion) ──────────────────────────
function SubAccordion({
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
      duration: 240,
      create:  { type: "easeInEaseOut", property: "opacity" },
      update:  { type: "spring",        springDamping: 0.75 },
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
    <View style={sacc.wrapper}>
      <Pressable
        style={({ pressed }) => [sacc.header, pressed && { opacity: 0.75 }]}
        onPress={toggle}
        hitSlop={4}
      >
        <View style={sacc.headerLeft}>
          <View style={sacc.iconBox}>
            <Feather name={icon as any} size={16} color={Colors.primary} />
          </View>
          <Text style={sacc.title}>{title}</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Feather name="chevron-down" size={16} color={Colors.textMuted} />
        </Animated.View>
      </Pressable>
      {open && <View style={sacc.body}>{children}</View>}
    </View>
  );
}

const sacc = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0f0f0f",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  iconBox: {
    width: 32, height: 32,
    backgroundColor: "rgba(224,49,49,0.12)",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(224,49,49,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  body: { paddingTop: 8 },
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
const PREVIEW_H = 122;

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
  const PREVIEW_SECTION_H = 200;
  const editorW = screenW;
  const editorH = Math.max(180,
    screenH - insets.top - insets.bottom - HEADER_H - HINT_H - PREVIEW_SECTION_H);

  // Shared values (editor-space pixels) — initialised to 0; set correctly after Image.getSize
  const tx           = useSharedValue(0);
  const ty           = useSharedValue(0);
  const savedTx      = useSharedValue(0);
  const savedTy      = useSharedValue(0);
  const sc           = useSharedValue(initialScale);
  const savedSc      = useSharedValue(initialScale);
  // Cover-scaled image size in editor pixels (= imgDim * coverZoomEditor).
  // Pan limit: maxPan = max(0, (coverImgSize * scale - containerSize) / 2)
  const coverImgWSv  = useSharedValue(editorW);
  const coverImgHSv  = useSharedValue(editorH);
  // Ratio to convert editor-space offsets to drawer-space offsets.
  // = coverZoomDrawer / coverZoomEditor  (a single scalar for both axes)
  const coverRatioSv = useSharedValue(DRAWER_WIDTH / editorW);
  // Minimum editor scale = contain scale in cover-space (containZoom / coverZoom).
  // At this scale the full image is visible (may show black bars around it).
  // The drawer always renders with Math.max(1.0, bannerScale) so blank areas
  // only appear in the editor preview — never in the live drawer.
  const minScSv = useSharedValue(1.0);

  // On every open / URI change: resolve image dimensions, then set transforms
  const prevVisible = useRef(false);
  const prevUri     = useRef<string | null>(null);
  useEffect(() => {
    const justOpened    = visible && !prevVisible.current;
    const newUri        = uri !== prevUri.current;
    prevVisible.current = visible;
    prevUri.current     = uri;

    if (!((justOpened || newUri) && uri)) return;

    Image.getSize(
      uri,
      (imgW, imgH) => {
        const coverZoomE   = Math.max(editorW / imgW, editorH / imgH);
        const containZoomE = Math.min(editorW / imgW, editorH / imgH);
        const coverZoomD   = Math.max(DRAWER_WIDTH / imgW, PREVIEW_H / imgH);
        // Contain scale in cover-space: at this scale the full image is visible.
        // Cap at 0.5 so iPad portrait (near-square editor) always has zoom-out room.
        const minSc = Math.min(containZoomE / coverZoomE, 0.5);

        coverImgWSv.value  = imgW * coverZoomE;
        coverImgHSv.value  = imgH * coverZoomE;
        coverRatioSv.value = coverZoomD / coverZoomE;
        minScSv.value      = minSc;

        if (newUri && initialScale <= 1.0) {
          // Brand-new pick: start at contain (full image visible) so user can see
          // what they are cropping. They can zoom in from here.
          sc.value      = minSc;
          savedSc.value = minSc;
          tx.value      = 0;
          ty.value      = 0;
          savedTx.value = 0;
          savedTy.value = 0;
        } else {
          // Reopen to reposition: invert the save formula to recover editor-space offsets.
          // Save formula: bannerOffX = editor_tx * coverRatioSv * (drawSc / editorSc)
          //   where drawSc = max(1.0, editorSc)
          // Invert: editor_tx = bannerOffX * editorSc / (coverRatioSv * drawSc)
          const editorSc = Math.max(minSc, initialScale);
          const drawSc   = Math.max(1.0, editorSc);
          const initX = coverRatioSv.value > 0
            ? (initialOffX * editorSc) / (coverRatioSv.value * drawSc)
            : 0;
          const initY = coverRatioSv.value > 0
            ? (initialOffY * editorSc) / (coverRatioSv.value * drawSc)
            : 0;
          tx.value      = initX;
          ty.value      = initY;
          sc.value      = editorSc;
          savedTx.value = initX;
          savedTy.value = initY;
          savedSc.value = editorSc;
        }
      },
      () => {
        // getSize failed - use safe defaults
        coverImgWSv.value  = editorW;
        coverImgHSv.value  = editorH;
        coverRatioSv.value = DRAWER_WIDTH / editorW;
        const initX = initialOffX / (DRAWER_WIDTH / editorW);
        const initY = initialOffY / (PREVIEW_H / editorH);
        tx.value      = initX;
        ty.value      = initY;
        sc.value      = initialScale;
        savedTx.value = initX;
        savedTy.value = initY;
        savedSc.value = initialScale;
      },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, uri]);

  const pan = Gesture.Pan()
    .onStart(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((e) => {
      // Math.abs works for both directions:
      //   scale > 1: image overflows container → clamp so no background shows
      //   scale < 1: image smaller than container → allow sliding within container
      const mX = Math.abs(coverImgWSv.value * sc.value - editorW) / 2;
      const mY = Math.abs(coverImgHSv.value * sc.value - editorH) / 2;
      tx.value = Math.max(-mX, Math.min(mX, savedTx.value + e.translationX));
      ty.value = Math.max(-mY, Math.min(mY, savedTy.value + e.translationY));
    });

  const pinch = Gesture.Pinch()
    .onStart(() => { savedSc.value = sc.value; })
    .onUpdate((e) => {
      // Min = contain scale (full image visible); max = 4x zoom in.
      // Drawer always clamps to cover-fill via Math.max(1.0, bannerScale).
      const newSc = Math.max(minScSv.value, Math.min(4.0, savedSc.value * e.scale));
      sc.value = newSc;
      // Same Math.abs logic as pan: works whether image overflows or is smaller
      const mX = Math.abs(coverImgWSv.value * newSc - editorW) / 2;
      const mY = Math.abs(coverImgHSv.value * newSc - editorH) / 2;
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

  // Preview mirrors the drawer exactly, including the Math.max(1.0,...) clamp.
  // When sc < 1.0 the drawer still shows cover-fill (sc clamped to 1.0), so the
  // offset must be scaled up by (1.0/sc) to keep the same image center.
  const previewImgStyle = useAnimatedStyle(() => {
    const drawSc    = Math.max(1.0, sc.value);
    const offFactor = sc.value > 0 ? drawSc / sc.value : 1.0;
    return {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      transform: [
        { scale:      drawSc },
        { translateX: tx.value * coverRatioSv.value * offFactor },
        { translateY: ty.value * coverRatioSv.value * offFactor },
      ],
    };
  });

  const doSave = () => {
    // Offsets must account for scale clamping in the drawer.
    // The drawer renders at drawSc = max(1.0, sc), so offsets must satisfy:
    //   bannerOffX / (drawSc × coverZoomD) = tx / (sc × coverZoomE)
    //   bannerOffX = tx × coverRatioSv × (drawSc / sc)
    const drawSc    = Math.max(1.0, sc.value);
    const offFactor = sc.value > 0 ? drawSc / sc.value : 1.0;
    onSave(
      tx.value * coverRatioSv.value * offFactor,
      ty.value * coverRatioSv.value * offFactor,
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
          <Text style={edSt.hintText}>Pinch to zoom, drag to reposition. Zoom in to crop.</Text>
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
    backgroundColor: "#0f0f0f",
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
  const { getSectionOrder, moveSectionUp, moveSectionDown, moveItemToSection } = useDrawerConfig();
  const { isConnected: gcalConnected, signIn: gcalSignIn, signOut: gcalSignOut } = useGoogleCalendar();

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

  type SpotifyPL = { name: string; url: string };

  const DEFAULT_SPOTIFY_PL: SpotifyPL[] = [
    { name: "Liked Songs",      url: "spotify://collection/tracks" },
    { name: "January 2026",     url: "spotify://playlist/2MwL8nIietYcMDHb4YaO8R?si=AYhQI2eASgSuTXJxAv0QoQ&pi=MkwaUygfSHSKb" },
    { name: "The Game",         url: "spotify://playlist/2NvbWjiow97CpX3ZuTewVd?si=GfxpBK7ISGWA8iG73G_SjA&pi=3oKvGMXsQKOM1" },
    { name: "Krayzie Bone",     url: "spotify://playlist/0AaZ9pO9JLDNzrGwkLQms9?si=G0rrS01DRqGNPsOXnYGjqQ&pi=a-NgLJdujPRYij" },
    { name: "October 2025",     url: "spotify://playlist/7gEbs45sKp9Bd7xoQpS9RB?si=fyr3oOWRQBmPPxE2a_FrkQ&pi=BgbSg8ZkQuKmM&add=1" },
    { name: "Spanish",          url: "spotify://playlist/2UFK9fljpU7TIYnAx1v9Za?si=5KtFrzuuTcCvix7oOjb7ig&pi=ph-Qxgk0QPic" },
    { name: "January 2024",     url: "spotify://playlist/3DI4nKtBqyq9anP4RSdJ7G?si=w8cWQrlbQ1ycUbRhDMW_jw&pi=Q_VF0U4EQ7-1O/" },
    { name: "Repeat 2023",      url: "spotify://playlist/5wItz7OUdUPIj9VNzBi9jr?si=zEHmbbmfQNS9pEHHneza7Q&pi=BK14ACn0S1KQV" },
    { name: "Life",             url: "spotify://playlist/7A7nzaXeOuAiTRdRzOQ64H?si=z1-VlOfxR1awOGPHBOUjPA&pi=XjlBmTebRtiNB" },
    { name: "September 2022",   url: "spotify://playlist/5G1ZOG3K4srwBr6Y2gdLCi?si=wManU4LNRly01VsODI2kbA&pi=IPovAIyWT26bK" },
  ];
  const [spotifyPL,       setSpotifyPL]       = useState<SpotifyPL[]>(DEFAULT_SPOTIFY_PL);
  const [newSpotifyName,  setNewSpotifyName]  = useState("");
  const [newSpotifyURL,   setNewSpotifyURL]   = useState("");

  useEffect(() => {
    AsyncStorage.getItem("music_spotify_playlists").then(v => { if (v) setSpotifyPL(JSON.parse(v)); });
  }, []);

  const saveSpotify = (list: SpotifyPL[]) => { setSpotifyPL(list); AsyncStorage.setItem("music_spotify_playlists", JSON.stringify(list)); };

  const addSpotifyPL    = () => { const n = newSpotifyName.trim(); if (!n) return; saveSpotify([...spotifyPL, { name: n, url: newSpotifyURL.trim() }]); setNewSpotifyName(""); setNewSpotifyURL(""); };
  const removeSpotifyPL = (i: number) => { if (editSpotifyIdx === i) setEditSpotifyIdx(null); saveSpotify(spotifyPL.filter((_, idx) => idx !== i)); };
  const moveSpotifyUp   = (i: number) => { if (i === 0) return; const next = [...spotifyPL]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; saveSpotify(next); };
  const moveSpotifyDown = (i: number) => { if (i === spotifyPL.length - 1) return; const next = [...spotifyPL]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; saveSpotify(next); };

  const [editSpotifyIdx,  setEditSpotifyIdx]  = useState<number | null>(null);
  const [editSpotifyName, setEditSpotifyName] = useState("");
  const [editSpotifyURL,  setEditSpotifyURL]  = useState("");

  // Apple Music playlist name filter
  const [appleNames,   setAppleNames]   = useState<string[]>([]);
  const [appleNewName, setAppleNewName] = useState("");

  useEffect(() => {
    AsyncStorage.getItem("music_apple_filter_names").then(v => { if (v) setAppleNames(JSON.parse(v)); });
  }, []);

  const saveAppleNames = (next: string[]) => {
    setAppleNames(next);
    AsyncStorage.setItem("music_apple_filter_names", JSON.stringify(next));
  };

  const addAppleName = () => {
    const trimmed = appleNewName.trim();
    if (!trimmed || appleNames.includes(trimmed)) return;
    saveAppleNames([...appleNames, trimmed]);
    setAppleNewName("");
  };

  const removeAppleName = (i: number) => saveAppleNames(appleNames.filter((_, idx) => idx !== i));

  const startEditSpotify = (i: number) => {
    setEditSpotifyIdx(i);
    setEditSpotifyName(spotifyPL[i].name);
    setEditSpotifyURL(spotifyPL[i].url);
  };
  const saveEditSpotify = () => {
    if (editSpotifyIdx === null) return;
    const updated = spotifyPL.map((pl, i) =>
      i === editSpotifyIdx ? { name: editSpotifyName.trim() || pl.name, url: editSpotifyURL.trim() } : pl
    );
    saveSpotify(updated);
    setEditSpotifyIdx(null);
  };

  const tickOpacity = useRef(new Animated.Value(0)).current;

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // 'limited' = user chose "Selected Photos" on iOS 14+ — still allows picking
    if (perm.status === "denied" || perm.status === "blocked") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        // Unique filename avoids the React Native image cache serving the old file
        const ts   = Date.now();
        const dest = (FileSystem.documentDirectory ?? "") + `hk_life_banner_${ts}.jpg`;
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: dest });
        setPendingUri(dest);
        setEditorVisible(true);
      } catch (e) {
        console.warn("[pickImage] copy failed:", e);
      }
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
              <Feather name="camera" size={14} color="#fff" />
              <Text style={styles.replaceBtnText}>{headerUri ? "Replace Image" : "Pick from Library"}</Text>
            </TouchableOpacity>

            {headerUri && (
              <TouchableOpacity activeOpacity={0.75} style={styles.clearBtn} onPress={headerClear}>
                <Feather name="trash-2" size={14} color={Colors.primary} />
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

        {/* ══ GOOGLE CALENDAR ══════════════════════════════════════════════════ */}
        <Accordion title="Google Calendar" icon="calendar" defaultOpen={false}>
          <View style={styles.accordionBody}>

            <View style={styles.toggleRow}>
              <View style={styles.toggleIcon}>
                <Feather name="calendar" size={16} color={gcalConnected ? Colors.success : Colors.textMuted} />
              </View>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>Google Calendar</Text>
                <Text style={styles.toggleDesc}>
                  {gcalConnected
                    ? "Connected — events sync on all devices"
                    : "Connect to sync calendar events on iPad and iPhone"}
                </Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: gcalConnected ? Colors.success : Colors.textMuted }]} />
            </View>

            <View style={styles.divider} />

            {gcalConnected ? (
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.clearBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); gcalSignOut(); }}
              >
                <Feather name="log-out" size={14} color={Colors.textSecondary} />
                <Text style={styles.clearBtnText}>Disconnect Google Account</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.saveBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); gcalSignIn(); }}
              >
                <Text style={styles.saveBtnText}>Connect Google Calendar</Text>
              </TouchableOpacity>
            )}

          </View>
        </Accordion>

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

            {/* Notion API sub-section */}
            <SubAccordion title="Notion API" icon="key">
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
            </SubAccordion>

            {/* Anthropic API sub-section */}
            <SubAccordion title="Anthropic API" icon="cpu">
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
            </SubAccordion>

          </View>
        </Accordion>

        {/* ══ MUSIC ════════════════════════════════════════════════════════════ */}
        <Accordion title="Music" icon="music" defaultOpen={false}>
          <View style={styles.accordionBody}>

            {/* ── Spotify Playlists ── */}
            <SubAccordion title="Spotify Playlists" icon="headphones" defaultOpen={false}>
              {spotifyPL.map((pl, i) => (
                editSpotifyIdx === i ? (
                  <View key={i} style={[styles.mPLRow, { flexDirection: "column", alignItems: "stretch", gap: 6 }]}>
                    <TextInput
                      style={styles.mPLInput}
                      value={editSpotifyName}
                      onChangeText={setEditSpotifyName}
                      placeholder="Playlist name..."
                      placeholderTextColor={Colors.textMuted}
                      autoCapitalize="words"
                      autoCorrect={false}
                      keyboardAppearance="dark"
                      returnKeyType="next"
                      autoFocus
                    />
                    <View style={styles.mPLAddRow}>
                      <TextInput
                        style={[styles.mPLInput, { flex: 1 }]}
                        value={editSpotifyURL}
                        onChangeText={setEditSpotifyURL}
                        placeholder="Spotify URL..."
                        placeholderTextColor={Colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardAppearance="dark"
                        returnKeyType="done"
                        onSubmitEditing={saveEditSpotify}
                      />
                      <Pressable style={({ pressed }) => [styles.mPLAddBtn, pressed && { opacity: 0.7 }]} onPress={saveEditSpotify}>
                        <Feather name="check" size={16} color="#fff" />
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View key={i} style={styles.mPLRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mPLName} numberOfLines={1}>{pl.name}</Text>
                      <Text style={[styles.mPLUrl, !pl.url && { color: "rgba(255,255,255,0.2)" }]} numberOfLines={1}>
                        {pl.url || "Tap pencil to add URL"}
                      </Text>
                    </View>
                    <View style={mStyles.arrows}>
                      <Pressable
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); moveSpotifyUp(i); }}
                        style={({ pressed }) => [mStyles.arrowBtn, (i === 0 || pressed) && mStyles.arrowBtnDim]}
                        hitSlop={5}
                      >
                        <Feather name="chevron-up" size={15} color={i === 0 ? Colors.textMuted : Colors.textSecondary} />
                      </Pressable>
                      <Pressable
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); moveSpotifyDown(i); }}
                        style={({ pressed }) => [mStyles.arrowBtn, (i === spotifyPL.length - 1 || pressed) && mStyles.arrowBtnDim]}
                        hitSlop={5}
                      >
                        <Feather name="chevron-down" size={15} color={i === spotifyPL.length - 1 ? Colors.textMuted : Colors.textSecondary} />
                      </Pressable>
                    </View>
                    <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); startEditSpotify(i); }} hitSlop={8} style={{ marginLeft: 6, marginRight: 10 }}>
                      <Feather name="edit-2" size={14} color={Colors.textMuted} />
                    </Pressable>
                    <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); removeSpotifyPL(i); }} hitSlop={8}>
                      <Feather name="x" size={15} color={Colors.textMuted} />
                    </Pressable>
                  </View>
                )
              ))}
              <TextInput
                style={[styles.mPLInput, { marginTop: 8 }]}
                value={newSpotifyName}
                onChangeText={setNewSpotifyName}
                placeholder="New playlist name..."
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                keyboardAppearance="dark"
                returnKeyType="next"
              />
              <View style={styles.mPLAddRow}>
                <TextInput
                  style={[styles.mPLInput, { flex: 1 }]}
                  value={newSpotifyURL}
                  onChangeText={setNewSpotifyURL}
                  placeholder="Spotify URL..."
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardAppearance="dark"
                  returnKeyType="done"
                  onSubmitEditing={addSpotifyPL}
                />
                <Pressable style={({ pressed }) => [styles.mPLAddBtn, pressed && { opacity: 0.7 }]} onPress={addSpotifyPL}>
                  <Feather name="plus" size={16} color="#fff" />
                </Pressable>
              </View>
            </SubAccordion>

            {/* ── Apple Music Playlists ── */}
            <SubAccordion title="Apple Music Playlists" icon="music" defaultOpen={false}>
              <Text style={[styles.mPLUrl, { marginBottom: 10 }]}>
                Type playlist names exactly as they appear in your library. Apple Music will only show matches.
              </Text>

              {appleNames.map((name, i) => (
                <View key={i} style={[styles.mPLRow, { alignItems: "center" }]}>
                  <Text style={[styles.mPLName, { flex: 1 }]} numberOfLines={1}>{name}</Text>
                  <Pressable
                    style={({ pressed }) => [styles.mPLDeleteBtn, pressed && { opacity: 0.6 }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); removeAppleName(i); }}
                  >
                    <Feather name="trash-2" size={16} color="#E03131" />
                  </Pressable>
                </View>
              ))}

              <View style={[styles.mPLAddRow, { marginTop: appleNames.length > 0 ? 8 : 0 }]}>
                <TextInput
                  style={styles.mPLInput}
                  value={appleNewName}
                  onChangeText={setAppleNewName}
                  placeholder="Playlist name…"
                  placeholderTextColor={Colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={addAppleName}
                />
                <Pressable style={({ pressed }) => [styles.mPLAddBtn, pressed && { opacity: 0.7 }]} onPress={addAppleName}>
                  <Feather name="plus" size={16} color="#fff" />
                </Pressable>
              </View>
            </SubAccordion>

          </View>
        </Accordion>

      </ScrollView>
    </View>
  );
}

// ── Menu card styles ──────────────────────────────────────────────────────────
const mStyles = StyleSheet.create({
  card: {
    backgroundColor: "#0f0f0f",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    overflow: "hidden",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHidden: { opacity: 0.5 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
    backgroundColor: "transparent",
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
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  itemRowHidden: { opacity: 0.4 },

  iconBox: {
    width: 28, height: 28,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  iconBoxHidden: { backgroundColor: "rgba(255,255,255,0.03)", opacity: 0.5 },

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
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "#2A2A2A",
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
  root: { flex: 1, backgroundColor: "#0b0b0c" },
  content: { padding: 16, gap: 16 },

  accordionBody: {
    padding: 18,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
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

  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginHorizontal: -18 },

  fieldLabel: { color: Colors.textSecondary, fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4, marginBottom: 6 },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0f0f0f", borderRadius: 12,
    borderWidth: 1, borderColor: "#2A2A2A", paddingRight: 10,
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
    gap: 8, paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  replaceBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  clearBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10,
  },
  clearBtnText: { color: Colors.primary, fontSize: 13, fontFamily: "Inter_500Medium", opacity: 0.8 },

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

  toggleRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#0f0f0f",
    borderRadius: 14, borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 6,
    overflow: "hidden",
  },
  toggleIcon: {
    width: 38, height: 38,
    backgroundColor: "rgba(224,49,49,0.12)",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(224,49,49,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  toggleText: { flex: 1 },
  toggleLabel: { color: Colors.textPrimary, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  toggleDesc: { color: Colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  bioActiveRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bioActiveText: { color: Colors.success, fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },

  mPLRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#0f0f0f", borderRadius: 12,
    borderWidth: 1, borderColor: "#2A2A2A",
    paddingHorizontal: 14, paddingVertical: 11,
    marginBottom: 6,
  },
  mPLName: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textPrimary },
  mPLUrl:  { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },

  mPLAddRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 4,
  },
  mPLInput: {
    flex: 1, color: Colors.textPrimary, fontSize: 14,
    fontFamily: "Inter_400Regular",
    backgroundColor: "#0f0f0f", borderRadius: 12,
    borderWidth: 1, borderColor: "#2A2A2A",
    paddingHorizontal: 14, paddingVertical: 11,
  },
  mPLAddBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  mPLDeleteBtn: {
    width: 34, height: 34, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
});
