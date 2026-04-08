import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
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

type SaveState = "idle" | "saving" | "ok" | "err";

export default function FootyHighlightsScreen() {
  const insets      = useSafeAreaInsets();
  const { apiKey }  = useNotion();
  const { width: screenW } = useWindowDimensions();
  const isIpad      = screenW >= 768;
  const padH        = isIpad ? 56 : 18;
  const gridGap     = isIpad ? 14 : 7;
  const logoSize    = isIpad ? 82 : 66;

  const [round,     setRound]     = useState("");
  const [player,    setPlayer]    = useState("");
  const [minute,    setMinute]    = useState("");
  const [team,      setTeam]      = useState<string | null>(null);
  const [errMsg,    setErrMsg]    = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

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
    setSaveState("saving");

    try {
      const res = await fetch(`${BASE_URL}/api/notion/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
        body: JSON.stringify({
          parent: { database_id: DB_ID },
          properties: {
            Player:   { title:    [{ text: { content: player.trim() } }] },
            Round:    { number:   parseFloat(round) },
            Team:     { select:   { name: team } },
            Minute:   { number:   parseFloat(minute) },
            Recorded: { checkbox: false },
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveState("ok");
      setTimeout(() => {
        setSaveState("idle");
        setRound(""); setPlayer(""); setMinute(""); setTeam(null);
      }, 1800);
    } catch (e: any) {
      setSaveState("err");
      setErrMsg(e?.message ?? "Save failed.");
      setTimeout(() => setSaveState("idle"), 1500);
    }
  }

  const hasSelection = !!team;

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
        <View style={[s.grid, { gap: gridGap }]}>
          {TEAMS.map(t => {
            const chosen  = team === t.name;
            const dimmed  = hasSelection && !chosen;
            return (
              <Pressable
                key={t.name}
                style={[s.teamCell, chosen && s.teamChosen, dimmed && s.teamDimmed]}
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
              keyboardType="number-pad"
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
            style={[s.saveBtn, saveState === "saving" && s.saveBusy, saveState === "ok" && s.saveOk]}
            onPress={save}
            disabled={saveState === "saving"}
          >
            {saveState === "saving" ? (
              <Text style={s.saveTx}>Saving…</Text>
            ) : saveState === "ok" ? (
              <Text style={s.saveTx}>✓ Saved</Text>
            ) : (
              <Text style={s.saveTx}>Save Highlight</Text>
            )}
          </Pressable>
        </View>
      </Animated.View>
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
  saveBusy: { opacity: 0.5 },
  saveOk:   { backgroundColor: "#1a8a3a" },
  saveTx: {
    color: "#fff", fontSize: 17, fontWeight: "700",
    letterSpacing: 0.3, fontFamily: "Inter_700Bold",
  },
});
