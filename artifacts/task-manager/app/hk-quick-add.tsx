import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useNotion } from "@/context/NotionContext";

// ── HK Theme ──────────────────────────────────────────────────────────────────
const HK = {
  bg:        "#0a0a0e",
  card:      "#15151c",
  cardBorder:"rgba(255,255,255,0.09)",
  red:       "#ff1e1e",
  redDark:   "#c81212",
  text:      "#f2f2f7",
  textMuted: "#8d8e9c",
  inputBg:   "#15151c",
  inputBdr:  "rgba(255,255,255,0.10)",
  cancelBg:  "rgba(255,255,255,0.07)",
  cancelBdr: "rgba(255,255,255,0.10)",
  success:   "#40C057",
  error:     "#FF6B6B",
  overlay:   "rgba(10,10,14,0.78)",
};

const HK_DB_ID  = "2c8b7eba3523802abbe2e934df42a4e2";
// Category value matching the original Scriptable script
const HK_CATEGORY = " ".repeat(22) + "\u26A1\uFE0F   Automation";

const EPICS: { label: string; bg: string; bgA: string; tx: string }[] = [
  { label: "Enhancement", bg: "rgba(64,192,87,0.14)",   bgA: "rgba(64,192,87,0.34)",   tx: "#40C057" },
  { label: "Bug",         bg: "rgba(224,49,49,0.14)",   bgA: "rgba(224,49,49,0.34)",   tx: "#E03131" },
  { label: "Research",    bg: "rgba(51,154,240,0.14)",  bgA: "rgba(51,154,240,0.34)",  tx: "#339AF0" },
  { label: "General",     bg: "rgba(134,142,150,0.14)", bgA: "rgba(134,142,150,0.34)", tx: "#868E96" },
  { label: "New App",     bg: "rgba(250,176,5,0.14)",   bgA: "rgba(250,176,5,0.34)",   tx: "#FAB005" },
];

const PICKER_EMOJIS = ["🔥", "🚆", "🏡", "👀", "💡"];

// Loader timing (ms)
const T_FADE_IN    = 200;
const T_SPINNER_IN = 250;
const T_MIN_SPIN   = 2000;
const T_POP        = 420;
const T_TICK       = 400;
const T_HOLD       = 700;
const T_FADE_OUT   = 450;

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

interface Schema {
  priType: string;
  priOptions: string[] | null;
  epicType: string;
  categoryType: string;
}

export default function HKQuickAdd() {
  const insets    = useSafeAreaInsets();
  const { apiKey }     = useNotion();
  const { width: screenW } = useWindowDimensions();
  const isTablet  = screenW >= 768;
  const contentW  = isTablet ? Math.min(screenW * 0.62, 720) : undefined;

  const [schema,       setSchema]       = useState<Schema | null>(null);
  const [schemaError,  setSchemaError]  = useState<string | null>(null);
  const [title,        setTitle]        = useState("");
  const [selectedEpic, setSelectedEpic] = useState<string | null>(null);
  const [selectedEmoji,setSelectedEmoji]= useState<string | null>(null);
  const [saveDisabled, setSaveDisabled] = useState(false);
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [footerH,      setFooterH]      = useState(90);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [loaderVisible,   setLoaderVisible]   = useState(false);

  const keyboardOffset  = useRef(new Animated.Value(0)).current;
  const shakeAnim       = useRef(new Animated.Value(0)).current;
  const inputRef        = useRef<TextInput>(null);
  const overlayOpacity  = useRef(new Animated.Value(0)).current;
  const spinnerOpacity  = useRef(new Animated.Value(0)).current;
  const spinnerRotation = useRef(new Animated.Value(0)).current;
  const circleScale     = useRef(new Animated.Value(0)).current;
  const circleOpacity   = useRef(new Animated.Value(0)).current;
  const tickScale       = useRef(new Animated.Value(0)).current;
  const spinLoopRef     = useRef<Animated.CompositeAnimation | null>(null);

  const topPad    = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  // Keyboard listeners
  useEffect(() => {
    const onShow = (e: any) => {
      setKeyboardVisible(true);
      Animated.timing(keyboardOffset, { toValue: e.endCoordinates.height, duration: e.duration || 250, useNativeDriver: false }).start();
    };
    const onHide = (e: any) => {
      setKeyboardVisible(false);
      Animated.timing(keyboardOffset, { toValue: 0, duration: e.duration || 200, useNativeDriver: false }).start();
    };
    const s1 = Keyboard.addListener("keyboardWillShow", onShow);
    const s2 = Keyboard.addListener("keyboardWillHide", onHide);
    const s3 = Keyboard.addListener("keyboardDidShow",  onShow);
    const s4 = Keyboard.addListener("keyboardDidHide",  onHide);
    return () => { s1.remove(); s2.remove(); s3.remove(); s4.remove(); };
  }, [keyboardOffset]);

  // Schema fetch with retry
  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    const tryFetch = async (left: number) => {
      try {
        const r    = await fetch(`${BASE_URL}/api/notion/schema/${HK_DB_ID}`, { headers: { "x-notion-key": apiKey } });
        const text = await r.text();
        let data: any;
        try { data = JSON.parse(text); } catch {
          if (left > 1 && !cancelled) { await new Promise((res) => setTimeout(res, 2000)); if (!cancelled) tryFetch(left - 1); }
          else if (!cancelled) setSchemaError("Server is starting up — pull down to retry");
          return;
        }
        if (cancelled) return;
        if (data.message) throw new Error(data.message);
        setSchema(data);
      } catch (e: any) { if (!cancelled) setSchemaError(e.message); }
    };
    tryFetch(3);
    return () => { cancelled = true; };
  }, [apiKey]);

  // Shake
  const shake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // Loader
  const resetLoaderValues = useCallback(() => {
    overlayOpacity.setValue(0);  spinnerOpacity.setValue(0);
    spinnerRotation.setValue(0); circleScale.setValue(0);
    circleOpacity.setValue(0);   tickScale.setValue(0);
  }, [overlayOpacity, spinnerOpacity, spinnerRotation, circleScale, circleOpacity, tickScale]);

  const runLoader = useCallback(
    (apiPromise: Promise<void>): Promise<{ success: boolean; error?: string }> =>
      new Promise((resolve) => {
        resetLoaderValues();
        setLoaderVisible(true);

        let apiResult: { success: boolean; error?: string } | null = null;
        const trackedApi = apiPromise
          .then(() => { apiResult = { success: true }; })
          .catch((e: Error) => { apiResult = { success: false, error: e.message || "Something went wrong" }; });

        spinLoopRef.current = Animated.loop(
          Animated.timing(spinnerRotation, { toValue: 1, duration: 600, easing: Easing.linear, useNativeDriver: true })
        );
        spinLoopRef.current.start();

        Animated.timing(overlayOpacity, { toValue: 1, duration: T_FADE_IN, useNativeDriver: true }).start(() => {
          Animated.timing(spinnerOpacity, { toValue: 1, duration: T_SPINNER_IN, useNativeDriver: true }).start(() => {
            const minSpin = new Promise<void>((r) => setTimeout(r, T_MIN_SPIN));
            Promise.all([trackedApi, minSpin]).then(() => {
              spinLoopRef.current?.stop();
              if (apiResult?.success) {
                Animated.parallel([
                  Animated.timing(spinnerOpacity, { toValue: 0, duration: T_POP, useNativeDriver: true }),
                  Animated.timing(circleOpacity,  { toValue: 1, duration: T_POP * 0.4, useNativeDriver: true }),
                  Animated.timing(circleScale, { toValue: 1, duration: T_POP, easing: Easing.out(Easing.back(1.7)), useNativeDriver: true }),
                ]).start(() => {
                  Animated.timing(tickScale, { toValue: 1, duration: T_TICK, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }).start(() => {
                    setTimeout(() => {
                      Animated.timing(overlayOpacity, { toValue: 0, duration: T_FADE_OUT, useNativeDriver: true }).start(() => {
                        setLoaderVisible(false); resetLoaderValues(); resolve({ success: true });
                      });
                    }, T_HOLD);
                  });
                });
              } else {
                Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
                  setLoaderVisible(false); resetLoaderValues(); resolve({ success: false, error: apiResult?.error });
                });
              }
            });
          });
        });
      }),
    [overlayOpacity, spinnerOpacity, spinnerRotation, circleScale, circleOpacity, tickScale, resetLoaderValues]
  );

  // Save
  const handleSave = useCallback(async () => {
    const t = title.trim();
    if (!t) { shake(); return; }
    if (!schema || !apiKey) return;

    setSaveDisabled(true);
    setErrorMsg(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();

    const apiPromise = fetch(`${BASE_URL}/api/notion/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
      body: JSON.stringify({
        dbId:         HK_DB_ID,
        title:        t,
        epic:         selectedEpic  || "General",
        emoji:        selectedEmoji || "🔥",
        priType:      schema.priType,
        priOptions:   schema.priOptions,
        epicType:     schema.epicType,
        category:     HK_CATEGORY,
        categoryType: schema.categoryType || "select",
      }),
    })
      .then((r) => r.json())
      .then((data) => { if (!data.success) throw new Error(data.message || "Failed"); });

    const result = await runLoader(apiPromise);

    if (!result.success) {
      setErrorMsg(result.error || "Something went wrong");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setErrorMsg(null), 3500);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTitle("");
      setSelectedEpic(null);
      setSelectedEmoji(null);
    }
    setSaveDisabled(false);
  }, [title, schema, apiKey, selectedEpic, selectedEmoji, shake, runLoader]);

  const handleCancel = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); };

  const shakeX  = shakeAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-8, 0, 8] });
  const spinDeg = spinnerRotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScreenHeader title="HK Quick Add" />

      {/* Body */}
      <Animated.View style={[styles.flex, { marginBottom: keyboardOffset }]}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingTop: 8, paddingBottom: footerH + 8 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignSelf: "center", width: "100%", maxWidth: contentW }}>

            {/* Warnings */}
            {!apiKey && (
              <View style={styles.warningBox}>
                <Feather name="alert-circle" size={16} color={HK.red} />
                <Text style={styles.warningText}>Add your Notion API key in settings first.</Text>
              </View>
            )}
            {schemaError && (
              <View style={styles.warningBox}>
                <Feather name="alert-circle" size={16} color={HK.error} />
                <Text style={[styles.warningText, { color: HK.error }]}>{schemaError}</Text>
              </View>
            )}

            {/* Form card */}
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>Summary</Text>
              <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
                <TextInput
                  ref={inputRef}
                  style={styles.textInput}
                  placeholder="Add summary"
                  placeholderTextColor={HK.textMuted}
                  value={title}
                  onChangeText={setTitle}
                  autoCorrect
                  returnKeyType="done"
                  keyboardAppearance="dark"
                  onSubmitEditing={handleSave}
                  editable={!saveDisabled}
                />
              </Animated.View>

              <Text style={styles.fieldLabel}>Epic</Text>
              <View style={styles.epicGrid}>
                {EPICS.map(({ label, bg, bgA, tx }) => {
                  const isActive = selectedEpic === label;
                  const isDimmed = selectedEpic !== null && !isActive;
                  return (
                    <TouchableOpacity
                      key={label}
                      activeOpacity={0.8}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedEpic(selectedEpic === label ? null : label); }}
                      style={[styles.epicBtn, { backgroundColor: isActive ? bgA : bg, opacity: isDimmed ? 0.18 : 1 }]}
                    >
                      <Text style={[styles.epicBtnText, { color: tx }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Emoji</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.emojiRow}
                keyboardShouldPersistTaps="handled"
              >
                {PICKER_EMOJIS.map((em) => {
                  const isSelected = selectedEmoji === em;
                  const isDimmed   = selectedEmoji !== null && !isSelected;
                  return (
                    <TouchableOpacity
                      key={em}
                      activeOpacity={0.7}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedEmoji(em); }}
                      style={[styles.emojiBtn, isSelected && styles.emojiBtnSelected, isDimmed && { opacity: 0.3 }]}
                    >
                      <Text style={styles.emojiText}>{em}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

          </View>
        </ScrollView>
      </Animated.View>

      {/* Footer */}
      <Animated.View
        style={[styles.footer, { bottom: keyboardOffset }]}
        onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
      >
        <View style={{ alignSelf: "center", width: "100%", maxWidth: contentW }}>
          {errorMsg && <Text style={styles.errorText} numberOfLines={2}>{errorMsg}</Text>}
          <View style={[styles.footerBtns, { paddingBottom: keyboardVisible ? 10 : Math.max(bottomPad, 20) }]}>
            <TouchableOpacity activeOpacity={0.75} style={styles.cancelBtn} onPress={handleCancel} disabled={saveDisabled}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.saveBtn, (!schema || saveDisabled) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!schema || saveDisabled}
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Loader overlay */}
      {loaderVisible && (
        <Animated.View style={[styles.loaderOverlay, { opacity: overlayOpacity }]} pointerEvents="auto">
          <Animated.View style={[styles.spinnerWrap, { opacity: spinnerOpacity, transform: [{ rotate: spinDeg }] }]}>
            <View style={styles.spinnerRing} />
          </Animated.View>
          <Animated.View style={[styles.circleWrap, { opacity: circleOpacity, transform: [{ scale: circleScale }] }]}>
            <Animated.View style={{ transform: [{ scale: tickScale }] }}>
              <Feather name="check" size={40} color="#fff" strokeWidth={3} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const SPINNER_SIZE   = 72;
const SPINNER_STROKE = 8;
const CIRCLE_SIZE    = 74;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: HK.bg },
  flex: { flex: 1 },

  hamburgerBtn: {
    position: "absolute", left: 16, zIndex: 10,
    width: 38, height: 38,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 11, borderWidth: 1, borderColor: HK.cardBorder,
    alignItems: "center", justifyContent: "center",
  },

  scrollContent: { paddingHorizontal: 18, paddingBottom: 16 },

  pageHeader: { alignItems: "center", paddingVertical: 20 },
  pageTitle:  { fontSize: 26, fontWeight: "900", letterSpacing: -0.5, color: HK.text, fontFamily: "Inter_700Bold" },

  warningBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,30,30,0.08)",
    borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,30,30,0.25)",
    padding: 12, marginBottom: 14,
  },
  warningText: { color: HK.red, fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },

  formCard: {
    backgroundColor: HK.card,
    borderRadius: 20, borderWidth: 1, borderColor: HK.cardBorder,
    padding: 18,
    shadowColor: "#000", shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4, shadowRadius: 24, elevation: 8,
  },
  fieldLabel: {
    color: "rgba(255,255,255,0.80)", fontSize: 11, fontFamily: "Inter_700Bold",
    letterSpacing: 0.08 * 11, textTransform: "uppercase", marginBottom: 8, marginTop: 6,
  },
  textInput: {
    backgroundColor: HK.inputBg, borderWidth: 1, borderColor: HK.inputBdr,
    borderRadius: 18, color: HK.text, fontSize: 18,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14,
  },

  epicGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  epicBtn: {
    borderRadius: 13, paddingVertical: 13, paddingHorizontal: 10,
    alignItems: "center", justifyContent: "center",
    width: "30%", flexGrow: 1,
  },
  epicBtnText: { fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold", textAlign: "center" },

  emojiRow: { gap: 10, paddingVertical: 2, paddingBottom: 8 },
  emojiBtn: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  emojiBtnSelected: {
    backgroundColor: "rgba(255,30,30,0.18)",
    borderColor: "rgba(255,70,70,0.45)",
  },
  emojiText: { fontSize: 24 },

  footer: {
    position: "absolute", left: 0, right: 0,
    paddingHorizontal: 18, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
    backgroundColor: HK.bg,
  },
  footerBtns: { flexDirection: "row", gap: 12 },
  errorText:  { color: HK.error, fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 8 },
  cancelBtn: {
    flex: 1, backgroundColor: HK.cancelBg, borderWidth: 1, borderColor: HK.cancelBdr,
    borderRadius: 16, paddingVertical: 16, alignItems: "center",
  },
  cancelBtnText: { color: HK.text, fontSize: 16, fontWeight: "800", fontFamily: "Inter_700Bold" },
  saveBtn: {
    flex: 2,
    backgroundColor: HK.red,
    borderRadius: 16, paddingVertical: 16, alignItems: "center",
    shadowColor: HK.red, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 8,
  },
  saveBtnDisabled: { opacity: 0.42, shadowOpacity: 0 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800", fontFamily: "Inter_700Bold" },

  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: HK.overlay,
    alignItems: "center", justifyContent: "center", zIndex: 999,
  },
  spinnerWrap: {
    width: SPINNER_SIZE, height: SPINNER_SIZE,
    alignItems: "center", justifyContent: "center",
    position: "absolute",
  },
  spinnerRing: {
    width: SPINNER_SIZE, height: SPINNER_SIZE, borderRadius: SPINNER_SIZE / 2,
    borderWidth: SPINNER_STROKE,
    borderColor: "rgba(255,255,255,0.85)",
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  circleWrap: {
    width: CIRCLE_SIZE, height: CIRCLE_SIZE, borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: HK.red,
    alignItems: "center", justifyContent: "center",
    position: "absolute",
    borderWidth: 1.5, borderColor: HK.red,
  },
});
