import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
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
import { useNotion } from "@/context/NotionContext";

// ── IR Theme ─────────────────────────────────────────────────────────────────
const IR = {
  bg:        "#0C1846",
  card:      "#0E1C4E",
  cardBorder:"rgba(255,255,255,0.10)",
  gold:      "#FE9A01",
  goldDark:  "#d97f00",
  text:      "#f2f2f7",
  textMuted: "#7a8aaa",
  inputBg:   "rgba(255,255,255,0.08)",
  inputBdr:  "rgba(255,255,255,0.25)",
  cancelBg:  "rgba(255,255,255,0.08)",
  cancelBdr: "rgba(255,255,255,0.12)",
  success:   "#40C057",
  error:     "#FF6B6B",
  divider:   "rgba(255,255,255,0.08)",
  overlay:   "rgba(12,24,70,0.75)",
};

const IR_DB_ID = "2c9b7eba35238084a6decf83993961e4";
const IR_HEADER_LOGO =
  "https://i.postimg.cc/rwCNn1YJ/4375900A-530F-472F-8D00-3C573594C990.png";

const EPIC_PALETTE: Record<string, { bg: string; border: string; text: string }> = {
  Admin:     { bg: "rgba(40,160,40,0.14)",   border: "rgba(40,160,40,0.45)",   text: "#34a834" },
  Testing:   { bg: "rgba(220,20,20,0.14)",   border: "rgba(220,20,20,0.45)",   text: "#e03131" },
  Release:   { bg: "rgba(200,200,220,0.10)", border: "rgba(200,200,220,0.35)", text: "#b0b0cc" },
  Review:    { bg: "rgba(255,200,0,0.14)",   border: "rgba(255,200,0,0.45)",   text: "#FEC800" },
  Project:   { bg: "rgba(255,200,0,0.14)",   border: "rgba(255,200,0,0.45)",   text: "#FEC800" },
  Tool:      { bg: "rgba(134,142,150,0.14)", border: "rgba(134,142,150,0.45)", text: "#8e98a2" },
  Reporting: { bg: "rgba(220,20,20,0.14)",   border: "rgba(220,20,20,0.45)",   text: "#e03131" },
  Knowledge: { bg: "rgba(40,160,40,0.14)",   border: "rgba(40,160,40,0.45)",   text: "#34a834" },
};

const EPICS_ORDER = ["Admin", "Testing", "Release", "Review", "Project", "Tool", "Reporting", "Knowledge"];
const PICKER_EMOJIS = ["🔥", "🚩", "📈", "🪛", "👀", "🧠"];

// Loader timing (ms) — matching original script
const T_FADE_IN    = 200;
const T_SPINNER_IN = 250;
const T_MIN_SPIN   = 900;   // minimum spin before transitioning
const T_POP        = 380;
const T_TICK       = 350;
const T_HOLD       = 700;
const T_FADE_OUT   = 400;

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

interface Schema {
  priType: string;
  priOptions: string[] | null;
  epicType: string;
  priorityType: string;
}

// ── Easing helpers ────────────────────────────────────────────────────────────
function easeOutBack(t: number) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export default function IRQuickAdd() {
  const insets = useSafeAreaInsets();
  const { apiKey } = useNotion();
  const { width: screenW } = useWindowDimensions();
  const isTablet  = screenW >= 768;
  const contentW  = isTablet ? Math.min(screenW * 0.62, 720) : undefined;

  const [schema, setSchema]             = useState<Schema | null>(null);
  const [schemaError, setSchemaError]   = useState<string | null>(null);
  const [title, setTitle]               = useState("");
  const [selectedEpic, setSelectedEpic] = useState<string | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [saveDisabled, setSaveDisabled] = useState(false);
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);
  const [footerH, setFooterH]           = useState(90);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Keyboard tracking
  const keyboardOffset = useRef(new Animated.Value(0)).current;

  // Input / shake
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const inputRef   = useRef<TextInput>(null);

  // Loader animated values
  const [loaderVisible, setLoaderVisible] = useState(false);
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

  // Schema fetch — with safe JSON parse + auto-retry (handles Replit cold-start)
  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    const tryFetch = async (attemptsLeft: number) => {
      try {
        const r = await fetch(`${BASE_URL}/api/notion/schema/${IR_DB_ID}`, {
          headers: { "x-notion-key": apiKey },
        });
        const text = await r.text();
        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          // Server returned HTML (likely still waking up) — retry
          if (attemptsLeft > 1 && !cancelled) {
            await new Promise((res) => setTimeout(res, 2000));
            if (!cancelled) tryFetch(attemptsLeft - 1);
          } else if (!cancelled) {
            setSchemaError("Server is starting up — pull down to retry");
          }
          return;
        }
        if (cancelled) return;
        if (data.message) throw new Error(data.message);
        setSchema(data);
      } catch (e: any) {
        if (!cancelled) setSchemaError(e.message);
      }
    };

    tryFetch(3);
    return () => { cancelled = true; };
  }, [apiKey]);

  // Shake animation
  const shake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 1,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 55, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // ── Loader ──────────────────────────────────────────────────────────────────
  const resetLoaderValues = useCallback(() => {
    overlayOpacity.setValue(0);
    spinnerOpacity.setValue(0);
    spinnerRotation.setValue(0);
    circleScale.setValue(0);
    circleOpacity.setValue(0);
    tickScale.setValue(0);
  }, [overlayOpacity, spinnerOpacity, spinnerRotation, circleScale, circleOpacity, tickScale]);

  /**
   * Starts the overlay + spinner immediately, then waits for `apiPromise` and
   * T_MIN_SPIN (whichever is longer) before transitioning to the tick or error.
   * Resolves with { success, error? } so the caller can react.
   */
  const runLoader = useCallback(
    (apiPromise: Promise<void>): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        resetLoaderValues();
        setLoaderVisible(true);

        // Capture API result while loader is animating
        let apiResult: { success: boolean; error?: string } | null = null;
        const trackedApi = apiPromise
          .then(() => { apiResult = { success: true }; })
          .catch((e: Error) => { apiResult = { success: false, error: e.message || "Something went wrong" }; });

        // Start continuous rotation immediately
        spinLoopRef.current = Animated.loop(
          Animated.timing(spinnerRotation, {
            toValue: 1,
            duration: 600,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        );
        spinLoopRef.current.start();

        // Phase 1 → 2: overlay + spinner fade in immediately
        Animated.timing(overlayOpacity, { toValue: 1, duration: T_FADE_IN, useNativeDriver: true }).start(() => {
          Animated.timing(spinnerOpacity, { toValue: 1, duration: T_SPINNER_IN, useNativeDriver: true }).start(() => {

            // Phase 3: wait for BOTH API and minimum spin time
            const minSpin = new Promise<void>((r) => setTimeout(r, T_MIN_SPIN));
            Promise.all([trackedApi, minSpin]).then(() => {
              spinLoopRef.current?.stop();

              if (apiResult?.success) {
                // Phase 4: spinner out + circle pops in
                Animated.parallel([
                  Animated.timing(spinnerOpacity, { toValue: 0, duration: T_POP, useNativeDriver: true }),
                  Animated.timing(circleOpacity,  { toValue: 1, duration: T_POP * 0.4, useNativeDriver: true }),
                  Animated.timing(circleScale, {
                    toValue: 1,
                    duration: T_POP,
                    easing: Easing.out(Easing.back(1.7)),
                    useNativeDriver: true,
                  }),
                ]).start(() => {
                  // Phase 5: tick scales in
                  Animated.timing(tickScale, {
                    toValue: 1,
                    duration: T_TICK,
                    easing: Easing.out(Easing.back(1.5)),
                    useNativeDriver: true,
                  }).start(() => {
                    // Phase 6: hold then fade out
                    setTimeout(() => {
                      Animated.timing(overlayOpacity, { toValue: 0, duration: T_FADE_OUT, useNativeDriver: true }).start(() => {
                        setLoaderVisible(false);
                        resetLoaderValues();
                        resolve({ success: true });
                      });
                    }, T_HOLD);
                  });
                });
              } else {
                // Error path: quick fade out
                Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
                  setLoaderVisible(false);
                  resetLoaderValues();
                  resolve({ success: false, error: apiResult?.error });
                });
              }
            });
          });
        });
      });
    },
    [overlayOpacity, spinnerOpacity, spinnerRotation, circleScale, circleOpacity, tickScale, resetLoaderValues]
  );

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const t = title.trim();
    if (!t) { shake(); return; }
    if (!schema || !apiKey) return;

    setSaveDisabled(true);
    setErrorMsg(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();

    // Build API promise — errors are re-thrown so runLoader can catch them
    const apiPromise = fetch(`${BASE_URL}/api/notion/pages`, {
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
    })
      .then((r) => r.json())
      .then((data) => { if (!data.success) throw new Error(data.message || "Failed"); });

    // Start loader immediately — it handles both success and error internally
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
      // No re-focus — keyboard stays dismissed
    }
    setSaveDisabled(false);
  }, [title, schema, apiKey, selectedEpic, selectedEmoji, shake, runLoader]);

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const shakeX = shakeAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-8, 0, 8] });
  const spinDeg = spinnerRotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>

      {/* Scrollable body — shrinks as keyboard rises */}
      <Animated.View style={[styles.flex, { marginBottom: keyboardOffset }]}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingTop: 8, paddingBottom: footerH + 8 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Centred max-width column on tablet */}
          <View style={{ alignSelf: "center", width: "100%", maxWidth: contentW }}>

          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image
              source={{ uri: IR_HEADER_LOGO }}
              style={[styles.logo, isTablet && styles.logoTablet]}
              resizeMode="contain"
            />
          </View>

          {/* Warnings */}
          {!apiKey && (
            <View style={styles.warningBox}>
              <Feather name="alert-circle" size={16} color={IR.gold} />
              <Text style={styles.warningText}>Add your Notion API key in the Task Board settings first.</Text>
            </View>
          )}
          {schemaError && (
            <View style={[styles.warningBox, styles.warningBoxError]}>
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
                placeholder="Add summary"
                placeholderTextColor={IR.textMuted}
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
              {EPICS_ORDER.map((epic) => {
                const isActive = selectedEpic === epic;
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
                        backgroundColor: isActive ? pal.bg : "transparent",
                        borderColor: isActive ? pal.border : "rgba(255,255,255,0.10)",
                      },
                    ]}
                  >
                    <Text style={[styles.epicBtnText, { color: isActive ? pal.text : "rgba(255,255,255,0.45)" }]}>{epic}</Text>
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
                    style={[styles.emojiBtn, isSelected && styles.emojiBtnSelected, isDimmed && { opacity: 0.3 }]}
                  >
                    <Text style={styles.emojiText}>{em}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* close tablet wrapper */}
          </View>
        </ScrollView>
      </Animated.View>

      {/* Footer — absolutely positioned, animates up with keyboard */}
      <Animated.View
        style={[styles.footer, { bottom: keyboardOffset }]}
        onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
      >
        <View style={{ alignSelf: "center", width: "100%", maxWidth: contentW }}>
        {errorMsg && (
          <Text style={styles.errorText} numberOfLines={2}>{errorMsg}</Text>
        )}
        <View style={[styles.footerBtns, { paddingBottom: keyboardVisible ? Math.max(bottomPad, 14) : Math.max(bottomPad, 20) }]}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={saveDisabled}
          >
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
        </View>{/* close footer tablet wrapper */}
      </Animated.View>

      {/* ── Loader overlay ─────────────────────────────────────────────────── */}
      {loaderVisible && (
        <Animated.View style={[styles.loaderOverlay, { opacity: overlayOpacity }]} pointerEvents="auto">
          {/* Spinner ring */}
          <Animated.View style={[styles.spinnerWrap, { opacity: spinnerOpacity, transform: [{ rotate: spinDeg }] }]}>
            <View style={styles.spinnerRing} />
          </Animated.View>

          {/* Success circle + tick */}
          <Animated.View
            style={[styles.circleWrap, { opacity: circleOpacity, transform: [{ scale: circleScale }] }]}
          >
            <Animated.View style={{ transform: [{ scale: tickScale }] }}>
              <Feather name="check" size={40} color={IR.bg} strokeWidth={3} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const SPINNER_SIZE   = 72;
const SPINNER_STROKE = 7;
const CIRCLE_SIZE    = 68;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IR.bg },
  flex: { flex: 1 },

  hamburgerBtn: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    width: 38, height: 38,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: IR.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  scrollContent: { paddingHorizontal: 18, paddingBottom: 16 },
  logoWrap: { alignItems: "center", marginBottom: 24, marginTop: 10 },
  logo: { width: 300, height: 160 },
  logoTablet: { width: 420, height: 220 },

  warningBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(254,154,1,0.10)",
    borderRadius: 10, borderWidth: 1,
    borderColor: "rgba(254,154,1,0.30)",
    padding: 12, marginBottom: 14,
  },
  warningBoxError: {
    backgroundColor: "rgba(255,107,107,0.10)",
    borderColor: "rgba(255,107,107,0.30)",
  },
  warningText: { color: IR.gold, fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },

  formCard: {
    backgroundColor: IR.card,
    borderRadius: 20, borderWidth: 1, borderColor: IR.cardBorder,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35, shadowRadius: 24, elevation: 8,
  },
  fieldLabel: {
    color: IR.text, fontSize: 10, fontFamily: "Inter_700Bold",
    letterSpacing: 0.85, textTransform: "uppercase",
    marginBottom: 8, marginTop: 6,
  },
  textInput: {
    backgroundColor: IR.inputBg, borderWidth: 1, borderColor: IR.inputBdr,
    borderRadius: 14, color: IR.text, fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14,
  },
  epicGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  epicBtn: {
    height: 40, paddingHorizontal: 14, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  epicBtnText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  emojiRow: { flexDirection: "row", gap: 8, paddingVertical: 2, paddingBottom: 6 },
  emojiBtn: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  emojiBtnSelected: {
    backgroundColor: "rgba(254,154,1,0.28)",
    borderColor: "rgba(254,154,1,0.65)",
  },
  emojiText: { fontSize: 22 },

  footer: {
    position: "absolute", left: 0, right: 0,
    paddingHorizontal: 18, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: IR.divider,
    backgroundColor: IR.bg, gap: 8,
  },
  footerBtns: { flexDirection: "row", gap: 12 },
  errorText: { color: IR.error, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  cancelBtn: {
    flex: 1, backgroundColor: IR.cancelBg,
    borderRadius: 14, borderWidth: 1, borderColor: IR.cancelBdr,
    alignItems: "center", justifyContent: "center", paddingVertical: 15,
  },
  cancelBtnText: { color: IR.text, fontSize: 15, fontFamily: "Inter_700Bold" },
  saveBtn: {
    flex: 2, backgroundColor: IR.gold, borderRadius: 14,
    alignItems: "center", justifyContent: "center", paddingVertical: 15,
    shadowColor: IR.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 6,
  },
  saveBtnDisabled: { opacity: 0.35, shadowOpacity: 0, elevation: 0 },
  saveBtnText: { color: IR.bg, fontSize: 15, fontFamily: "Inter_700Bold" },

  // ── Loader overlay ──────────────────────────────────────────────────────────
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: IR.overlay,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  spinnerWrap: {
    position: "absolute",
    width: SPINNER_SIZE,
    height: SPINNER_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  spinnerRing: {
    width: SPINNER_SIZE,
    height: SPINNER_SIZE,
    borderRadius: SPINNER_SIZE / 2,
    borderWidth: SPINNER_STROKE,
    borderColor: "rgba(255,255,255,0.85)",
    borderTopColor: "transparent",
    borderRightColor: "rgba(255,255,255,0.15)",
  },
  circleWrap: {
    position: "absolute",
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
});
