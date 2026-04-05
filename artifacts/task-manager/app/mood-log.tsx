import Svg, { Path as SvgPath } from "react-native-svg";
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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useNotion } from "@/context/NotionContext";
import { Colors } from "@/constants/colors";

// ── Constants ─────────────────────────────────────────────────────────────────
const MOOD_DB_ID = "2dfb7eba3523805bb4b1ffbe52682e4c";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

const T_FADE_IN    = 200;
const T_SPINNER_IN = 250;
const T_MIN_SPIN   = 1300;
const T_POP        = 420;
const T_TICK       = 400;
const T_HOLD       = 700;

const SP_SIZE   = 72;
const SP_STROKE = 8;
const CIR_SIZE  = 74;

type MoodItem = { label: string; emoji: string; value: string };

const MOODS: MoodItem[] = [
  { label: "Awesome",  emoji: "😁", value: "Awesome"  },
  { label: "Good",     emoji: "🙂", value: "Good"     },
  { label: "Meh",      emoji: "😐", value: "Meh"      },
  { label: "Stressed", emoji: "😤", value: "Stressed" },
  { label: "Low",      emoji: "😔", value: "Low"      },
  { label: "Tired",    emoji: "🥱", value: "Tired"    },
];

export default function MoodLog() {
  const insets  = useSafeAreaInsets();
  const { apiKey } = useNotion();

  const [selMood,      setSelMood]      = useState<MoodItem | null>(null);
  const [notes,        setNotes]        = useState("");
  const [saving,       setSaving]       = useState(false);
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [loaderVisible, setLoaderVisible] = useState(false);
  const [footerH,      setFooterH]      = useState(90);

  const kbOffset        = useRef(new Animated.Value(0)).current;
  const overlayOpacity  = useRef(new Animated.Value(0)).current;
  const spinnerOpacity  = useRef(new Animated.Value(0)).current;
  const spinnerRotation = useRef(new Animated.Value(0)).current;
  const circleScale     = useRef(new Animated.Value(0)).current;
  const circleOpacity   = useRef(new Animated.Value(0)).current;
  const tickScale       = useRef(new Animated.Value(0)).current;
  const spinLoopRef     = useRef<Animated.CompositeAnimation | null>(null);

  const topPad    = Platform.OS === "web" ? Math.max(insets.top, 67)    : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  useEffect(() => {
    const onShow = (e: any) => {
      Animated.timing(kbOffset, { toValue: e.endCoordinates.height, duration: e.duration || 250, useNativeDriver: false }).start();
    };
    const onHide = (e: any) => {
      Animated.timing(kbOffset, { toValue: 0, duration: e.duration || 200, useNativeDriver: false }).start();
    };
    const s1 = Keyboard.addListener("keyboardWillShow", onShow);
    const s2 = Keyboard.addListener("keyboardWillHide", onHide);
    const s3 = Keyboard.addListener("keyboardDidShow",  onShow);
    const s4 = Keyboard.addListener("keyboardDidHide",  onHide);
    return () => { s1.remove(); s2.remove(); s3.remove(); s4.remove(); };
  }, [kbOffset]);

  const resetLoader = useCallback(() => {
    overlayOpacity.setValue(0);  spinnerOpacity.setValue(0);
    spinnerRotation.setValue(0); circleScale.setValue(0);
    circleOpacity.setValue(0);   tickScale.setValue(0);
  }, [overlayOpacity, spinnerOpacity, spinnerRotation, circleScale, circleOpacity, tickScale]);

  const runLoader = useCallback(
    (apiPromise: Promise<void>): Promise<{ success: boolean; error?: string }> =>
      new Promise((resolve) => {
        resetLoader();
        setLoaderVisible(true);

        let apiResult: { success: boolean; error?: string } | null = null;
        const tracked = apiPromise
          .then(() => { apiResult = { success: true }; })
          .catch((e: Error) => { apiResult = { success: false, error: e.message || "Something went wrong" }; });

        spinLoopRef.current = Animated.loop(
          Animated.timing(spinnerRotation, { toValue: 1, duration: 600, easing: Easing.linear, useNativeDriver: true })
        );
        spinLoopRef.current.start();

        Animated.timing(overlayOpacity, { toValue: 1, duration: T_FADE_IN, useNativeDriver: true }).start(() => {
          Animated.timing(spinnerOpacity, { toValue: 1, duration: T_SPINNER_IN, useNativeDriver: true }).start(() => {
            const minSpin = new Promise<void>((r) => setTimeout(r, T_MIN_SPIN));
            Promise.all([tracked, minSpin]).then(() => {
              spinLoopRef.current?.stop();
              if (apiResult?.success) {
                Animated.parallel([
                  Animated.timing(spinnerOpacity, { toValue: 0, duration: T_POP,       useNativeDriver: true }),
                  Animated.timing(circleOpacity,  { toValue: 1, duration: T_POP * 0.4, useNativeDriver: true }),
                  Animated.timing(circleScale, { toValue: 1, duration: T_POP, easing: Easing.out(Easing.back(1.7)), useNativeDriver: true }),
                ]).start(() => {
                  Animated.timing(tickScale, { toValue: 1, duration: T_TICK, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }).start(() => {
                    setTimeout(() => {
                      Animated.timing(overlayOpacity, { toValue: 0, duration: 450, useNativeDriver: true }).start(() => {
                        setLoaderVisible(false); resetLoader(); resolve({ success: true });
                      });
                    }, T_HOLD);
                  });
                });
              } else {
                Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
                  setLoaderVisible(false); resetLoader(); resolve({ success: false, error: apiResult?.error });
                });
              }
            });
          });
        });
      }),
    [overlayOpacity, spinnerOpacity, spinnerRotation, circleScale, circleOpacity, tickScale, resetLoader]
  );

  const handleSave = useCallback(async () => {
    if (!selMood || saving || !apiKey) return;
    setSaving(true);
    setErrorMsg(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();

    const notesVal = notes.trim();

    const apiPromise = fetch(`${BASE_URL}/api/notion/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
      body: JSON.stringify({
        dbId:       MOOD_DB_ID,
        titleProp:  "Mood",
        titleValue: selMood.value,
        ...(notesVal ? { notesProp: "Notes", notesValue: notesVal } : {}),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success && !data.id) throw new Error(data.message || "Failed");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });

    const result = await runLoader(apiPromise);

    if (!result.success) {
      setErrorMsg(result.error || "Something went wrong");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setErrorMsg(null), 3500);
    } else {
      setSelMood(null);
      setNotes("");
    }
    setSaving(false);
  }, [selMood, notes, apiKey, saving, runLoader]);

  const spinDeg = spinnerRotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={[st.root, { paddingTop: topPad }]}>
      <ScreenHeader title="Mood Log" />

      <Animated.View style={[st.flex, { marginBottom: kbOffset }]}>
        <ScrollView
          style={st.flex}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: footerH + 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!apiKey && (
            <View style={st.warnBox}>
              <Text style={st.warnText}>Add your Notion API key in Settings first.</Text>
            </View>
          )}

          <Text style={st.fieldLabel}>How are you feeling?</Text>
          <View style={st.moodGrid}>
            {MOODS.map((m) => {
              const active = selMood?.value === m.value;
              return (
                <Pressable
                  key={m.value}
                  style={[st.moodBtn, active && st.moodBtnActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelMood(active ? null : m);
                  }}
                >
                  <Text style={st.moodEmoji}>{m.emoji}</Text>
                  <Text style={[st.moodLabel, active && st.moodLabelActive]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[st.fieldLabel, { marginTop: 24 }]}>Note</Text>
          <TextInput
            style={st.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything on your mind..."
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.primary}
            multiline
            keyboardAppearance="dark"
            editable={!saving}
          />
        </ScrollView>

        <View
          style={[st.footer, { bottom: bottomPad }]}
          onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
        >
          {errorMsg && <Text style={st.errorText}>{errorMsg}</Text>}
          <View style={st.footerBtns}>
            <TouchableOpacity style={st.cancelBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}>
              <Text style={st.cancelTx}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.saveBtn, (!selMood || saving) && st.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!selMood || saving}
            >
              <Text style={st.saveTx}>Log Mood</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {loaderVisible && (
        <Animated.View style={[st.loaderOverlay, { opacity: overlayOpacity }]} pointerEvents="auto">
          <Animated.View style={[st.spinnerWrap, { opacity: spinnerOpacity, transform: [{ rotate: spinDeg }] }]}>
            <View style={st.spinnerRing} />
          </Animated.View>
          <Animated.View style={[st.circleWrap, { opacity: circleOpacity, transform: [{ scale: circleScale }] }]}>
            <Animated.View style={{ transform: [{ scale: tickScale }] }}>
              <Svg width={52} height={52} viewBox="0 0 68 68">
                <SvgPath fill="none" stroke="#fff" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" d="M17 35.9 L26.4 47.2 L48.2 21.7" />
              </Svg>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.darkBg },
  flex: { flex: 1 },

  warnBox: {
    backgroundColor: "rgba(224,49,49,0.08)", borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(224,49,49,0.25)",
    padding: 12, marginBottom: 16,
  },
  warnText: { color: Colors.primary, fontSize: 13, fontFamily: "Inter_400Regular" },

  fieldLabel: {
    color: "#ffffff", fontSize: 10, fontFamily: "Inter_700Bold",
    letterSpacing: 1, marginBottom: 12, textTransform: "uppercase",
  },

  moodGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
  },
  moodBtn: {
    width: "30.5%",
    backgroundColor: Colors.cardBg,
    borderWidth: 2, borderColor: Colors.border,
    borderRadius: 14, paddingVertical: 10,
    alignItems: "center", gap: 5,
  },
  moodBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(224,49,49,0.12)",
  },
  moodEmoji: { fontSize: 32, lineHeight: 40 },
  moodLabel: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted, letterSpacing: 0.2,
  },
  moodLabelActive: { color: Colors.primary },

  notesInput: {
    color: Colors.textPrimary, fontSize: 15, fontFamily: "Inter_400Regular",
    lineHeight: 24, paddingVertical: 14, paddingHorizontal: 14,
    minHeight: 100, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, backgroundColor: Colors.cardBg,
    textAlignVertical: "top",
  },

  footer: {
    position: "absolute", left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.darkBg,
  },
  footerBtns: { flexDirection: "row", gap: 10 },
  errorText: { color: Colors.primary, fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 8 },

  cancelBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 13,
    backgroundColor: Colors.cardBgElevated, alignItems: "center",
  },
  cancelTx: { color: "#ffffff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  saveBtn: {
    flex: 2, paddingVertical: 15, borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  saveBtnDisabled: { opacity: 0.42 },
  saveTx: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center", justifyContent: "center", zIndex: 999,
  },
  spinnerWrap: {
    width: SP_SIZE, height: SP_SIZE,
    alignItems: "center", justifyContent: "center", position: "absolute",
  },
  spinnerRing: {
    width: SP_SIZE, height: SP_SIZE, borderRadius: SP_SIZE / 2,
    borderWidth: SP_STROKE,
    borderColor: "rgba(255,255,255,0.85)",
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  circleWrap: {
    width: CIR_SIZE, height: CIR_SIZE, borderRadius: CIR_SIZE / 2,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", position: "absolute",
    borderWidth: 1.5, borderColor: Colors.primary,
  },
});
