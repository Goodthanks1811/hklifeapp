import { Feather } from "@expo/vector-icons";
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
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useNotion } from "@/context/NotionContext";
import { Colors } from "@/constants/colors";

// ── Constants ─────────────────────────────────────────────────────────────────
const LIFE_DB_ID = "2c8b7eba3523802abbe2e934df42a4e2";

type CatConfig = { label: string; catValue: string; emojis: string[] };
const CATS: CatConfig[] = [
  { label: "Life Admin",  catValue: "\uD83D\uDCDD Life Admin",     emojis: ["🔥", "🖥️", "🏡"] },
  { label: "Investigate", catValue: "\uD83D\uDD0E To Investigate", emojis: ["🔥", "🚩", "👀", "🧠"] },
  { label: "To Buy",      catValue: "\uD83D\uDCB0 To Buy",         emojis: ["🔥", "💳", "💰"] },
  { label: "Music",       catValue: "\uD83C\uDFA7 Music",          emojis: ["🎧"] },
  { label: "Reference",   catValue: "\uD83D\uDCCC Reference",      emojis: ["📌"] },
  { label: "To Read",     catValue: "\uD83D\uDCD5 Read",           emojis: ["📕"] },
  { label: "Development", catValue: "⚡️Development",              emojis: ["🔥", "🚆", "🏡", "👀", "💡"] },
];

const EPIC_COLOUR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  "Enhancement": { bg: "rgba(64,192,87,0.14)",   border: "rgba(64,192,87,0.40)",   text: "#40C057" },
  "HK Life":     { bg: "rgba(224,49,49,0.14)",   border: "rgba(224,49,49,0.40)",   text: "#E03131" },
  "IR App":      { bg: "rgba(51,154,240,0.14)",  border: "rgba(51,154,240,0.40)",  text: "#339AF0" },
  "General":     { bg: "rgba(134,142,150,0.14)", border: "rgba(134,142,150,0.40)", text: "#868E96" },
  "New App":     { bg: "rgba(250,176,5,0.14)",   border: "rgba(250,176,5,0.40)",   text: "#FAB005" },
};
const EPIC_OPTIONS = ["HK Life", "IR App", "Enhancement", "New App", "General"];

const DEV_CAT_VALUE = "⚡️Development";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

// Loader timing (ms)
const T_FADE_IN    = 200;
const T_SPINNER_IN = 250;
const T_MIN_SPIN   = 2000;
const T_POP        = 420;
const T_TICK       = 400;
const T_HOLD       = 700;

const DS_SPINNER_SIZE   = 72;
const DS_SPINNER_STROKE = 8;
const DS_CIRCLE_SIZE    = 74;

interface Schema {
  priType: string;
  priOptions: string[] | null;
  epicType: string;
  categoryType: string;
}

export default function HKQuickAdd() {
  const insets  = useSafeAreaInsets();
  const { apiKey } = useNotion();
  const { width: screenW } = useWindowDimensions();
  const isTablet = screenW >= 768;

  const [schema,       setSchema]       = useState<Schema | null>(null);
  const [schemaError,  setSchemaError]  = useState<string | null>(null);
  const [title,        setTitle]        = useState("");
  const [notes,        setNotes]        = useState("");
  const [selCat,       setSelCat]       = useState<CatConfig>(CATS[CATS.length - 1]);
  const [selEpic,      setSelEpic]      = useState<string | null>(null);
  const [selEmoji,     setSelEmoji]     = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [loaderVisible, setLoaderVisible] = useState(false);
  const [footerH,      setFooterH]      = useState(90);
  const [kbVisible,    setKbVisible]    = useState(false);

  const kbOffset        = useRef(new Animated.Value(0)).current;
  const shakeAnim       = useRef(new Animated.Value(0)).current;
  const overlayOpacity  = useRef(new Animated.Value(0)).current;
  const spinnerOpacity  = useRef(new Animated.Value(0)).current;
  const spinnerRotation = useRef(new Animated.Value(0)).current;
  const circleScale     = useRef(new Animated.Value(0)).current;
  const circleOpacity   = useRef(new Animated.Value(0)).current;
  const tickScale       = useRef(new Animated.Value(0)).current;
  const spinLoopRef     = useRef<Animated.CompositeAnimation | null>(null);

  const topPad    = Platform.OS === "web" ? Math.max(insets.top, 67)    : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const isDev = selCat.catValue === DEV_CAT_VALUE;

  // Keyboard listeners
  useEffect(() => {
    const onShow = (e: any) => {
      setKbVisible(true);
      Animated.timing(kbOffset, { toValue: e.endCoordinates.height, duration: e.duration || 250, useNativeDriver: false }).start();
    };
    const onHide = (e: any) => {
      setKbVisible(false);
      Animated.timing(kbOffset, { toValue: 0, duration: e.duration || 200, useNativeDriver: false }).start();
    };
    const s1 = Keyboard.addListener("keyboardWillShow", onShow);
    const s2 = Keyboard.addListener("keyboardWillHide", onHide);
    const s3 = Keyboard.addListener("keyboardDidShow",  onShow);
    const s4 = Keyboard.addListener("keyboardDidHide",  onHide);
    return () => { s1.remove(); s2.remove(); s3.remove(); s4.remove(); };
  }, [kbOffset]);

  // Schema fetch
  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    const tryFetch = async (left: number) => {
      try {
        const r    = await fetch(`${BASE_URL}/api/notion/schema/${LIFE_DB_ID}`, { headers: { "x-notion-key": apiKey } });
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
    const t = title.trim();
    if (!t) { shake(); return; }
    if (!schema || !apiKey) return;

    setSaving(true);
    setErrorMsg(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();

    const payload: any = {
      dbId:         LIFE_DB_ID,
      title:        t,
      category:     selCat.catValue,
      emoji:        selEmoji ?? "-",
      priType:      schema.priType,
      priOptions:   schema.priOptions,
      categoryType: schema.categoryType ?? "select",
      ...(isDev && selEpic ? { epic: selEpic, epicType: schema.epicType ?? "select" } : {}),
    };

    const apiPromise = fetch(`${BASE_URL}/api/notion/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success && !data.id) throw new Error(data.message || "Failed");
        const n = notes.trim();
        if (n && data.id) {
          fetch(`${BASE_URL}/api/notion/page-blocks/${data.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
            body: JSON.stringify({ body: n }),
          }).catch(() => {});
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });

    const result = await runLoader(apiPromise);

    if (!result.success) {
      setErrorMsg(result.error || "Something went wrong");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setErrorMsg(null), 3500);
    } else {
      setTitle("");
      setNotes("");
      setSelEpic(null);
      setSelEmoji(null);
    }
    setSaving(false);
  }, [title, notes, schema, apiKey, selCat, selEmoji, selEpic, isDev, shake, runLoader]);

  const handleClose = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); };

  const shakeX  = shakeAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-8, 0, 8] });
  const spinDeg = spinnerRotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={[st.root, { paddingTop: topPad }]}>
      <ScreenHeader title="HK Quick Add" />

      <Animated.View style={[st.flex, { marginBottom: kbOffset }]}>
        <ScrollView
          style={st.flex}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: footerH + 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* API key warning */}
          {!apiKey && (
            <View style={st.warnBox}>
              <Feather name="alert-circle" size={16} color={Colors.primary} />
              <Text style={st.warnText}>Add your Notion API key in Settings first.</Text>
            </View>
          )}
          {schemaError && (
            <View style={st.warnBox}>
              <Feather name="alert-circle" size={16} color={Colors.primary} />
              <Text style={st.warnText}>{schemaError}</Text>
            </View>
          )}

          {/* Summary */}
          <Text style={st.fieldLabel}>Summary</Text>
          <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
            <TextInput
              style={st.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Add summary"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              keyboardAppearance="dark"
              editable={!saving}
            />
          </Animated.View>

          {/* Category chips */}
          <Text style={[st.sectionLabel, { marginTop: 20 }]}>Category</Text>
          <View style={st.metaRow}>
            {CATS.map((cat) => {
              const active = cat.catValue === selCat.catValue;
              return (
                <Pressable
                  key={cat.catValue}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelCat(cat);
                    setSelEmoji(null);
                    if (cat.catValue !== DEV_CAT_VALUE) setSelEpic(null);
                  }}
                  style={[st.chip, active && st.chipActive]}
                >
                  <Text style={[st.chipText, active && st.chipTextActive]}>{cat.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Epic chips — only for Development */}
          {isDev && (
            <>
              <Text style={[st.sectionLabel, { marginTop: 16 }]}>Epic</Text>
              <View style={st.metaRow}>
                {EPIC_OPTIONS.map((ep) => {
                  const selected = ep === selEpic;
                  const colours  = EPIC_COLOUR_MAP[ep] ?? { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.15)", text: "#ccc" };
                  return (
                    <Pressable
                      key={ep}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelEpic(selected ? null : ep); }}
                      style={[st.epicChip, { backgroundColor: selected ? colours.bg : "transparent", borderColor: selected ? colours.border : Colors.border }]}
                    >
                      <Text style={[st.epicText, { color: selected ? colours.text : Colors.textMuted }]}>{ep}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* Emoji picker */}
          {selCat.emojis.length > 0 && (
            <>
              <Text style={[st.sectionLabel, { marginTop: 16 }]}>Emoji</Text>
              <View style={st.metaRow}>
                {selCat.emojis.map((em) => {
                  const selected = selEmoji === em;
                  return (
                    <Pressable
                      key={em}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelEmoji(selected ? null : em); }}
                      style={[st.emojiChip, selected && st.emojiChipActive]}
                    >
                      <Text style={st.emojiText}>{em}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* Divider */}
          <View style={[st.divider, { marginTop: 20 }]} />

          {/* Notes */}
          <TextInput
            style={st.notesInput}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Add notes…"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.primary}
            keyboardAppearance="dark"
            textAlignVertical="top"
            editable={!saving}
          />

          <View style={st.divider} />
        </ScrollView>
      </Animated.View>

      {/* Footer */}
      <Animated.View
        style={[st.footer, { bottom: kbOffset }]}
        onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
      >
        {errorMsg && <Text style={st.errorText} numberOfLines={2}>{errorMsg}</Text>}
        <View style={[st.footerBtns, { paddingBottom: kbVisible ? 10 : Math.max(bottomPad, 20) }]}>
          <Pressable style={st.cancelBtn} onPress={handleClose} disabled={saving}>
            <Text style={st.cancelTx}>Close</Text>
          </Pressable>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[st.addBtn, (!schema || saving) && st.addBtnDisabled]}
            onPress={handleSave}
            disabled={!schema || saving}
          >
            <Feather name="plus" size={15} color="#fff" />
            <Text style={st.addTx}>Add Task</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Loader overlay */}
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

// ── Styles ─────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.darkBg },
  flex: { flex: 1 },

  warnBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(224,49,49,0.08)", borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(224,49,49,0.25)",
    padding: 12, marginBottom: 16,
  },
  warnText: { color: Colors.primary, fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },

  fieldLabel: {
    color: "#ffffff", fontSize: 22, fontFamily: "Inter_700Bold",
    paddingBottom: 10, alignSelf: "stretch", textAlign: "left",
  },
  sectionLabel: {
    color: Colors.textMuted, fontSize: 10, fontFamily: "Inter_700Bold",
    letterSpacing: 1, marginBottom: 8, textTransform: "uppercase",
  },

  titleInput: {
    color: Colors.textPrimary, fontSize: 15, fontFamily: "Inter_600SemiBold",
    paddingTop: 10, paddingBottom: 13, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 10,
  },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  chip: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: "transparent",
  },
  chipActive:     { backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.35)" },
  chipText:       { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textMuted, letterSpacing: 0.2 },
  chipTextActive: { color: Colors.textPrimary },

  epicChip: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  epicText: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4 },

  emojiChip: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: Colors.cardBgElevated,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
  emojiChipActive: { borderColor: Colors.primary, backgroundColor: "rgba(224,49,49,0.15)" },
  emojiText: { fontSize: 22 },

  divider: { height: 1, backgroundColor: Colors.border },

  notesInput: {
    color: Colors.textPrimary, fontSize: 15, fontFamily: "Inter_400Regular",
    lineHeight: 24, paddingVertical: 14, minHeight: 100,
  },

  footer: {
    position: "absolute", left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.darkBg,
  },
  footerBtns: { flexDirection: "row", gap: 10 },
  errorText:  { color: Colors.primary, fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 8 },

  cancelBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 13,
    backgroundColor: Colors.cardBgElevated, alignItems: "center",
  },
  cancelTx: { color: "#ffffff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  addBtn: {
    flex: 2, paddingVertical: 15, borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  addBtnDisabled: { opacity: 0.42 },
  addTx: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center", justifyContent: "center", zIndex: 999,
  },
  spinnerWrap: {
    width: DS_SPINNER_SIZE, height: DS_SPINNER_SIZE,
    alignItems: "center", justifyContent: "center", position: "absolute",
  },
  spinnerRing: {
    width: DS_SPINNER_SIZE, height: DS_SPINNER_SIZE, borderRadius: DS_SPINNER_SIZE / 2,
    borderWidth: DS_SPINNER_STROKE,
    borderColor: "rgba(255,255,255,0.85)",
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  circleWrap: {
    width: DS_CIRCLE_SIZE, height: DS_CIRCLE_SIZE, borderRadius: DS_CIRCLE_SIZE / 2,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", position: "absolute",
    borderWidth: 1.5, borderColor: Colors.primary,
  },
});
