import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Path as SvgPath } from "react-native-svg";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useNotion } from "@/context/NotionContext";

const DB_ID  = "2d0b7eba3523806d96f1e5c22ef094c1";
const MAX_W  = 800;
const BG     = "#0a0a0a";
const CARD   = "#111111";
const BORDER = "#1f1f1f";
const RED    = "#E03131";
const TEXT   = "#f2f2f7";
const MUTED  = "#555";
const INPUT  = "#161616";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

const T_FADE_IN    = 200;
const T_SPINNER_IN = 250;
const T_MIN_SPIN   = 2000;
const T_POP        = 420;
const T_TICK       = 400;
const T_HOLD       = 700;
const T_FADE_OUT   = 450;
const SPINNER_SIZE   = 72;
const SPINNER_STROKE = 8;
const CIRCLE_SIZE    = 74;

const TEAMS = [
  { name: "Broncos",    logo: require("../assets/images/nrl/Broncos.webp") },
  { name: "Bulldogs",   logo: require("../assets/images/nrl/Bulldogs.webp") },
  { name: "Cowboys",    logo: require("../assets/images/nrl/Cowboys.webp") },
  { name: "Dolphins",   logo: require("../assets/images/nrl/Dolphins.webp") },
  { name: "Dragons",    logo: require("../assets/images/nrl/Dragons.webp") },
  { name: "Eels",       logo: require("../assets/images/nrl/Eels.webp") },
  { name: "Knights",    logo: require("../assets/images/nrl/Knights.webp") },
  { name: "Panthers",   logo: require("../assets/images/nrl/Panthers.webp") },
  { name: "Rabbitohs",  logo: require("../assets/images/nrl/Rabbitohs.webp") },
  { name: "Raiders",    logo: require("../assets/images/nrl/Raiders.webp") },
  { name: "Roosters",   logo: require("../assets/images/nrl/Roosters.webp") },
  { name: "Sea Eagles", logo: require("../assets/images/nrl/Sea Eagles.webp") },
  { name: "Sharks",     logo: require("../assets/images/nrl/Sharks.webp") },
  { name: "Storm",      logo: require("../assets/images/nrl/Storm.webp") },
  { name: "Tigers",     logo: require("../assets/images/nrl/Wests Tigers.webp") },
  { name: "Titans",     logo: require("../assets/images/nrl/Titans.webp") },
  { name: "Warriors",   logo: require("../assets/images/nrl/Warriors.webp") },
];

export default function FootyHighlightsScreen() {
  const insets      = useSafeAreaInsets();
  const { apiKey }  = useNotion();
  const { width: screenW } = useWindowDimensions();
  const isIpad      = screenW >= 768;
  const padH        = isIpad ? 56 : 18;
  const gridGap     = isIpad ? 14 : 7;
  const logoSize    = isIpad ? 96 : 66;

  const [round,        setRound]        = useState("");
  const [player,       setPlayer]       = useState("");
  const [minute,       setMinute]       = useState("");
  const [team,         setTeam]         = useState<string | null>(null);
  const [errMsg,       setErrMsg]       = useState<string | null>(null);
  const [saveDisabled, setSaveDisabled] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(false);

  const overlayOpacity  = useRef(new Animated.Value(0)).current;
  const spinnerOpacity  = useRef(new Animated.Value(0)).current;
  const spinnerRotation = useRef(new Animated.Value(0)).current;
  const circleScale     = useRef(new Animated.Value(0)).current;
  const circleOpacity   = useRef(new Animated.Value(0)).current;
  const tickScale       = useRef(new Animated.Value(0)).current;
  const spinLoopRef     = useRef<Animated.CompositeAnimation | null>(null);

  const scrollRef    = useRef<ScrollView>(null);
  const playerRef    = useRef<TextInput>(null);
  const inputFocused = useRef(false);
  const kbVisible    = useRef(false);
  const kbHeight     = useRef(0);
  const inputKbAnim  = useRef(new Animated.Value(0)).current;

  function focusInput() {
    inputFocused.current = true;
    if (!kbVisible.current) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 320);
    }
  }
  function blurInput() {
    inputFocused.current = false;
  }

  useFocusEffect(useCallback(() => {
    const show = Keyboard.addListener("keyboardWillShow", e => {
      kbVisible.current = true;
      if (inputFocused.current && kbHeight.current === 0) {
        kbHeight.current = e.endCoordinates.height;
        Animated.timing(inputKbAnim, { toValue: e.endCoordinates.height, duration: 260, useNativeDriver: false }).start();
      }
    });
    const hide = Keyboard.addListener("keyboardWillHide", () => {
      kbVisible.current = false;
      kbHeight.current  = 0;
      Animated.timing(inputKbAnim, { toValue: 0, duration: 220, useNativeDriver: false }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, []));

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
          .catch((e: Error) => { apiResult = { success: false, error: e.message || "Save failed." }; });

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

  function toggleTeam(name: string) {
    setTeam(prev => prev === name ? null : name);
    setErrMsg(null);
    setTimeout(() => playerRef.current?.focus(), 100);
  }

  async function save() {
    setErrMsg(null);
    if (!round.trim())  return setErrMsg("Enter a round number.");
    if (!team)          return setErrMsg("Select a team.");
    if (!player.trim()) return setErrMsg("Enter a player name.");
    if (!minute.trim()) return setErrMsg("Enter a minute.");
    if (!apiKey)        return setErrMsg("Notion key not configured.");

    Keyboard.dismiss();
    setSaveDisabled(true);

    const result = await runLoader(
      fetch(`${BASE_URL}/api/notion/footy-highlight`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
        body: JSON.stringify({
          dbId:     DB_ID,
          player:   player.trim(),
          round:    round.trim(),
          team,
          minute:   minute.trim(),
          recorded: false,
        }),
      }).then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
      })
    );

    setSaveDisabled(false);
    if (result.success) {
      setRound(""); setPlayer(""); setMinute(""); setTeam(null);
    } else {
      setErrMsg(result.error ?? "Save failed.");
    }
  }

  const hasSelection = !!team;
  const spinDeg = spinnerRotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Footy Highlights" />

      <Animated.ScrollView
        ref={scrollRef as any}
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingBottom: 32, maxWidth: MAX_W, alignSelf: "center" as const, width: "100%", paddingHorizontal: padH }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Round */}
        <Text style={s.label}>Round</Text>
        <TextInput
          style={s.input}
          value={round}
          onChangeText={t => { setRound(t); setErrMsg(null); }}
          keyboardType="number-pad"
          placeholder="e.g. 12"
          placeholderTextColor={MUTED}
          returnKeyType="done"
        />

        {/* Team grid */}
        <Text style={[s.label, { marginTop: 20 }]}>Team</Text>
        <View style={[s.grid, { gap: gridGap, justifyContent: isIpad ? "space-evenly" : "flex-start" }]}>
          {TEAMS.map(t => {
            const chosen  = team === t.name;
            const dimmed  = hasSelection && !chosen;
            return (
              <Pressable
                key={t.name}
                style={[s.teamCell, isIpad && { width: 160, flexGrow: 0 }, chosen && s.teamChosen, dimmed && s.teamDimmed]}
                onPress={() => toggleTeam(t.name)}
              >
                <Image source={t.logo} style={[s.teamLogo, { width: logoSize, height: logoSize }]} contentFit="contain" cachePolicy="memory-disk" transition={0} />
              </Pressable>
            );
          })}
        </View>

        {/* Player + Minute row */}
        <View style={s.row}>
          <View style={s.flex1}>
            <Text style={s.label}>Player</Text>
            <TextInput
              ref={playerRef}
              style={s.input}
              value={player}
              onChangeText={t => { setPlayer(t); setErrMsg(null); }}
              placeholder="Name"
              placeholderTextColor={MUTED}
              autoCorrect={false}
              returnKeyType="done"
              onFocus={focusInput}
              onBlur={blurInput}
            />
          </View>
          <View style={s.minuteWrap}>
            <Text style={s.label}>Minute</Text>
            <TextInput
              style={s.input}
              value={minute}
              onChangeText={t => { setMinute(t); setErrMsg(null); }}
              keyboardType="default"
              placeholder="0"
              placeholderTextColor={MUTED}
              returnKeyType="done"
              onFocus={focusInput}
              onBlur={blurInput}
            />
          </View>
        </View>

        {/* Error */}
        {errMsg ? (
          <View style={s.errBar}>
            <Feather name="alert-circle" size={14} color="#ff6060" />
            <Text style={s.errTx}>{errMsg}</Text>
          </View>
        ) : null}

      </Animated.ScrollView>

      {/* Save button — floats above keyboard */}
      <Animated.View style={[s.saveWrap, { paddingBottom: Animated.add(inputKbAnim, insets.bottom + 12) as any }]}>
        <View style={[s.saveInner, { paddingHorizontal: padH }]}>
          <Pressable
            style={[s.saveBtn, saveDisabled && s.saveBtnDisabled]}
            onPress={save}
            disabled={saveDisabled}
          >
            <Text style={s.saveTx}>Save Highlight</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Loader overlay */}
      {loaderVisible && (
        <Animated.View style={[s.loaderOverlay, { opacity: overlayOpacity }]} pointerEvents="auto">
          <Animated.View style={[s.spinnerWrap, { opacity: spinnerOpacity, transform: [{ rotate: spinDeg }] }]}>
            <View style={s.spinnerRing} />
          </Animated.View>
          <Animated.View style={[s.circleWrap, { opacity: circleOpacity, transform: [{ scale: circleScale }] }]}>
            <Animated.View style={{ transform: [{ scale: tickScale }] }}>
              <Svg width={68} height={68} viewBox="0 0 68 68">
                <SvgPath fill="none" stroke="#000" strokeWidth={9.5} strokeLinecap="round" strokeLinejoin="round" d="M17 35.9 L26.4 47.2 L48.2 21.7" />
              </Svg>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: BG },
  scroll:  { flex: 1 },
  content: { paddingTop: 8 },

  label: {
    fontSize: 11, fontWeight: "600", color: TEXT,
    textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8,
    fontFamily: "Inter_600SemiBold",
  },
  input: {
    backgroundColor: INPUT, borderWidth: 1, borderColor: BORDER,
    borderRadius: 10, color: TEXT, fontSize: 16,
    padding: 14, fontFamily: "Inter_400Regular",
  },

  grid: {
    flexDirection: "row", flexWrap: "wrap", gap: 7,
  },
  teamCell: {
    width: "30%", flexGrow: 1,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    borderRadius: 10, paddingVertical: 4, paddingHorizontal: 1,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  teamChosen: {
    borderColor: RED, borderWidth: 1.5,
    backgroundColor: "rgba(224,49,49,0.08)",
  },
  teamDimmed: { opacity: 0.22 },
  teamLogo: { width: 66, height: 66 },

  row:        { flexDirection: "row", gap: 12, marginTop: 20 },
  flex1:      { flex: 1 },
  minuteWrap: { width: 90 },

  errBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,30,30,0.1)", borderWidth: 1,
    borderColor: "rgba(255,30,30,0.25)", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 16,
  },
  errTx: { fontSize: 13, color: "#ff6060", fontFamily: "Inter_400Regular", flex: 1 },

  saveWrap: {
    paddingTop: 12,
    backgroundColor: BG, borderTopWidth: 1, borderTopColor: BORDER,
  },
  saveInner: {
    maxWidth: MAX_W, alignSelf: "center", width: "100%",
  },
  saveBtn: {
    backgroundColor: RED, borderRadius: 12,
    paddingVertical: 16, alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.42 },
  saveTx: {
    color: "#fff", fontSize: 17, fontWeight: "700",
    letterSpacing: 0.3, fontFamily: "Inter_700Bold",
  },

  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,10,10,0.78)",
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
    borderColor: "#ff1e1e",
    borderTopColor: "rgba(255,30,30,0.15)",
  },
  circleWrap: {
    width: CIRCLE_SIZE, height: CIRCLE_SIZE, borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: RED,
    alignItems: "center", justifyContent: "center",
    position: "absolute",
    borderWidth: 1.5, borderColor: RED,
  },
});
