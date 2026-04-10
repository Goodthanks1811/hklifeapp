import { Feather } from "@expo/vector-icons";
import Svg, { Path as SvgPath } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { isTablet, useDrawer } from "@/context/DrawerContext";
import { useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import { Colors } from "@/constants/colors";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useNotion } from "@/context/NotionContext";


// ── Constants ─────────────────────────────────────────────────────────────────
const LIFE_DB_ID   = "2c8b7eba3523802abbe2e934df42a4e2";
const ITEM_H       = 52;
const ITEM_GAP     = 8;
const SLOT_H       = ITEM_H + ITEM_GAP;
const HIDDEN_EMOJI  = "👎";
const DEFAULT_EMOJI = "-";
const FULL_PICKER  = ["🔥","🚩","👀","🧠","💳","💰","🎧","📌","📕","🏡","🖥️"];

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

// ── Slug config ───────────────────────────────────────────────────────────────
type SlugConfig = { title: string; catValue: string; emojis: string[]; sortEmojis?: string[]; showEpic?: boolean };
const SLUG_MAP: Record<string, SlugConfig> = {
  "life-admin":  { title: "Life Admin",  catValue: "\uD83D\uDCDD Life Admin",       emojis: ["🔥","🖥️","🏡"] },
  "investigate": { title: "Investigate", catValue: "\uD83D\uDD0E To Investigate",   emojis: ["🔥","🚩","👀","🧠"] },
  "to-buy":      { title: "To Buy",      catValue: "\uD83D\uDCB0 To Buy",           emojis: ["🔥","💳","💰"] },
  "music":       { title: "Music",       catValue: "\uD83C\uDFA7 Music",            emojis: ["🎧"] },
  "reference":   { title: "Reference",   catValue: "\uD83D\uDCCC Reference",        emojis: ["📌"] },
  "to-read":     { title: "To Read",     catValue: "\uD83D\uDCD5 Read",             emojis: ["📕"] },
  "automation":  {
    title: "Development",
    catValue: "⚡️Development",
    emojis:     ["🔥","🚆","🏡","👀","💡","👎"],
    sortEmojis: ["-","🔥","🚆","🏡","👀","💡"],
    showEpic: true,
  },
};
const ALL_CATS      = Object.values(SLUG_MAP).map(c => c.catValue);
const EPIC_CAT_VALUE = Object.values(SLUG_MAP).find(c => c.showEpic)?.catValue ?? "";

// Map from catValue → the emojis that belong to that section
const CAT_EMOJI_MAP: Record<string, string[]> = Object.fromEntries(
  Object.values(SLUG_MAP).map(c => [c.catValue, c.emojis])
);

// ── Epic pill colours — dark-tinted bg + coloured text ────────────────────────
// Each slot: [bg, border, text]
const EPIC_COLOUR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  "Enhancement": { bg: "rgba(64,192,87,0.14)",   border: "rgba(64,192,87,0.40)",   text: "#40C057" },
  "HK Life":     { bg: "rgba(224,49,49,0.14)",   border: "rgba(224,49,49,0.40)",   text: "#E03131" },
  "IR App":      { bg: "rgba(51,154,240,0.14)",  border: "rgba(51,154,240,0.40)",  text: "#339AF0" },
  "General":     { bg: "rgba(134,142,150,0.14)", border: "rgba(134,142,150,0.40)", text: "#868E96" },
  "New App":     { bg: "rgba(250,176,5,0.14)",   border: "rgba(250,176,5,0.40)",   text: "#FAB005" },
};
const EPIC_FALLBACK = { bg: "rgba(134,142,150,0.12)", border: "rgba(134,142,150,0.30)", text: "#868E96" };
function epicColor(epic: string): { bg: string; border: string; text: string } {
  return EPIC_COLOUR_MAP[epic] ?? EPIC_FALLBACK;
}


// ── Loader timing (ms) ────────────────────────────────────────────────────────
const T_FADE_IN    = 200;
const T_SPINNER_IN = 250;
const T_MIN_SPIN   = 2000;
const T_POP        = 420;
const T_TICK       = 400;
const T_HOLD       = 700;

// ── Types ─────────────────────────────────────────────────────────────────────
interface LifeTask { id: string; title: string; emoji: string; sortOrder: number | null; url: string | null; epic?: string | null; fileLinks?: Array<{ name: string; url: string }> | null; }
interface Schema   { priType: string; priOptions: string[] | null; categoryType: string; epicOptions?: string[] | null; epicType?: string; referenceType?: string; referencePropertyName?: string | null; }

const norm  = (e: string) => e.replace(/[\uFE00-\uFE0F\u200D\u20E3]/g, "").trim();
const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));
// A static zero-value used for the dragged row so it never dims itself
const ZERO_ANIM = new Animated.Value(0);

// ── Epics that exist in Notion but should not appear in the picker ────────────
const BLOCKED_EPICS   = new Set(["Redesign", "Spike", "Redesign / Rebuild"]);
const EPIC_ORDER      = ["HK Life", "IR App", "Enhancement", "New App", "General"];
const filterEpics = (opts: string[] | null | undefined): string[] => {
  const allowed = (opts ?? []).filter(e => !BLOCKED_EPICS.has(e));
  return [...allowed].sort((a, b) => {
    const ai = EPIC_ORDER.indexOf(a);
    const bi = EPIC_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
};

// ── Inline markdown helpers ───────────────────────────────────────────────────
type MdSeg = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; code?: boolean };
function parseInline(raw: string): MdSeg[] {
  const segs: MdSeg[] = [];
  const re = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(__(.+?)__)|(`(.+?)`)|([^*_`]+)/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if      (m[1]) segs.push({ text: m[2],  bold: true });
    else if (m[3]) segs.push({ text: m[4],  italic: true });
    else if (m[5]) segs.push({ text: m[6],  underline: true });
    else if (m[7]) segs.push({ text: m[8],  code: true });
    else if (m[9]) segs.push({ text: m[9] });
  }
  return segs.length > 0 ? segs : [{ text: raw }];
}

function RichLine({ text, style, flex }: { text: string; style: any; flex?: number }) {
  const segs = parseInline(text);
  return (
    <Text style={flex != null ? [style, { flex }] : style}>
      {segs.map((seg, i) => (
        <Text key={i} style={{
          fontFamily: seg.bold ? "Inter_700Bold" : undefined,
          fontStyle:  seg.italic ? "italic" : "normal",
          textDecorationLine: seg.underline ? "underline" : "none",
          backgroundColor: seg.code ? "rgba(255,255,255,0.09)" : undefined,
        }}>{seg.text}</Text>
      ))}
    </Text>
  );
}

function RichBodyView({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  return (
    <View style={{ gap: 1 }}>
      {lines.map((line, i) => {
        if (!line.trim())
          return <View key={i} style={{ height: 6 }} />;
        if (/^---+$/.test(line.trim()))
          return <View key={i} style={{ height: 1, backgroundColor: Colors.border, marginVertical: 6 }} />;
        if (/^# /.test(line))
          return <RichLine key={i} text={line.slice(2)} style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 28, marginTop: 10, marginBottom: 2 }} />;
        if (/^## /.test(line))
          return <RichLine key={i} text={line.slice(3)} style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 24, marginTop: 8, marginBottom: 2 }} />;
        if (/^### /.test(line))
          return <RichLine key={i} text={line.slice(4)} style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.82)", lineHeight: 22, marginTop: 6, marginBottom: 1 }} />;
        if (/^- /.test(line))
          return (
            <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", paddingLeft: 2 }}>
              <Text style={{ color: "#fff", fontSize: 16, lineHeight: 24, marginTop: 1 }}>•</Text>
              <RichLine text={line.slice(2)} style={{ fontSize: 16, color: "#fff", lineHeight: 24 }} flex={1} />
            </View>
          );
        if (/^\d+\. /.test(line)) {
          const mm = line.match(/^(\d+)\. (.*)/);
          const num = mm?.[1] ?? "1"; const rest = mm?.[2] ?? line;
          return (
            <View key={i} style={{ flexDirection: "row", gap: 6, alignItems: "flex-start", paddingLeft: 2 }}>
              <Text style={{ color: Colors.textMuted, fontSize: 16, lineHeight: 24, minWidth: 18 }}>{num}.</Text>
              <RichLine text={rest} style={{ fontSize: 16, color: "#fff", lineHeight: 24 }} flex={1} />
            </View>
          );
        }
        return <RichLine key={i} text={line} style={{ fontSize: 16, color: "#fff", lineHeight: 24 }} />;
      })}
    </View>
  );
}

// ── Formatting toolbar ────────────────────────────────────────────────────────
function FormattingToolbar({ onFormat, link, onLinkChange, viewLink }: {
  onFormat: (id: string) => void;
  link?: string;
  onLinkChange?: (v: string) => void;
  viewLink?: string;
}) {
  const btns: Array<{ id: string; label: string; isBold?: boolean; isUnder?: boolean }> = [
    { id: "h1",        label: "H1", isBold: true },
    { id: "h2",        label: "H2", isBold: true },
    { id: "h3",        label: "H3" },
    { id: "bold",      label: "B",  isBold: true },
    { id: "underline", label: "U",  isUnder: true },
    { id: "bullet",    label: "•" },
  ];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.02)", paddingHorizontal: 10, paddingVertical: 9, gap: 4 }}>
      {btns.map(btn => (
        <Pressable
          key={btn.id}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onFormat(btn.id); }}
          style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.07)", minWidth: 36, alignItems: "center" }}
        >
          <Text style={{ color: Colors.textPrimary, fontSize: 13, fontFamily: btn.isBold ? "Inter_700Bold" : "Inter_500Medium", textDecorationLine: btn.isUnder ? "underline" : "none" }}>
            {btn.label}
          </Text>
        </Pressable>
      ))}
      {viewLink ? (
        <Pressable
          onPress={() => Linking.openURL(viewLink)}
          hitSlop={8}
          style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(224,49,49,0.12)", borderWidth: 1, borderColor: "rgba(224,49,49,0.35)", marginLeft: 8 }}
        >
          <Feather name="external-link" size={12} color={Colors.primary} />
          <Text style={{ color: Colors.primary, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Open</Text>
        </Pressable>
      ) : null}
      {onLinkChange !== undefined && (
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 5, paddingLeft: 6, borderLeftWidth: 1, borderLeftColor: Colors.border, marginLeft: 2 }}>
          <Text style={{ fontSize: 14 }}>🔗</Text>
          <TextInput
            value={link ?? ""}
            onChangeText={onLinkChange}
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.primary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            keyboardAppearance="dark"
            style={{ flex: 1, color: Colors.textPrimary, fontSize: 12, fontFamily: "Inter_400Regular", paddingTop: 9, paddingBottom: 5, paddingHorizontal: 10, backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 10 }}
          />
        </View>
      )}
    </View>
  );
}

// ── Shared formatting logic ───────────────────────────────────────────────────
function applyFormat(type: string, notes: string, sel: { start: number; end: number }): string {
  const { start, end } = sel;
  let lineStart = start;
  while (lineStart > 0 && notes[lineStart - 1] !== "\n") lineStart--;

  const wrapSel = (pre: string, suf: string, ph: string) => {
    const selected = start !== end ? notes.slice(start, end) : ph;
    return notes.slice(0, start) + pre + selected + suf + notes.slice(end);
  };

  const togglePrefix = (prefix: string) => {
    const lineText = notes.slice(lineStart);
    const m = lineText.match(/^(#{1,3} |- |\d+\. )/);
    if (m?.[1] === prefix) return notes.slice(0, lineStart) + notes.slice(lineStart + m[1].length);
    if (m) return notes.slice(0, lineStart) + prefix + notes.slice(lineStart + m[1].length);
    return notes.slice(0, lineStart) + prefix + notes.slice(lineStart);
  };

  switch (type) {
    case "h1": return togglePrefix("# ");
    case "h2": return togglePrefix("## ");
    case "h3": return togglePrefix("### ");
    case "bold": return wrapSel("**", "**", "bold");
    case "underline": return wrapSel("__", "__", "underline");
    case "bullet": {
      const lineText = notes.slice(lineStart);
      if (lineText.startsWith("- ")) return notes.slice(0, lineStart) + notes.slice(lineStart + 2);
      const prefix = (end > 0 && notes[end - 1] !== "\n") ? "\n- " : "- ";
      return notes.slice(0, end) + prefix + notes.slice(end);
    }
    default: return notes;
  }
}

// ── Inline popovers (emoji + epic) ────────────────────────────────────────────
type EmojiAnchor = { taskId: string; x: number; y: number; w: number; h: number };
type EpicAnchor  = { taskId: string; x: number; y: number; w: number; h: number };

function InlineEmojiPicker({ anchor, emojis, currentEmoji, onSelect, onClose }: {
  anchor:        EmojiAnchor | null;
  emojis:        string[];
  currentEmoji:  string | null;
  onSelect:      (e: string) => void;
  onClose:       () => void;
}) {
  const { width: sw, height: sh } = useWindowDimensions();
  if (!anchor) return null;

  // exclude whichever emoji is already on the task
  const options  = currentEmoji
    ? emojis.filter(e => norm(e) !== norm(currentEmoji))
    : emojis;

  if (options.length === 0) return null;

  const cellSize = 40;
  const gap      = 6;
  const pad      = 8;
  const popW     = options.length * cellSize + (options.length - 1) * gap + pad * 2;
  const popH     = cellSize + pad * 2;

  const rightX = anchor.x + anchor.w + 6;
  const leftX  = Math.min(rightX + popW > sw ? anchor.x - popW - 6 : rightX, sw - popW - 8);
  // centre the popover vertically on the tapped emoji button
  const topY   = Math.min(
    Math.max(8, anchor.y + anchor.h / 2 - popH / 2),
    sh - popH - 20
  );

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[s.emojiPopover, { top: topY, left: leftX, width: popW }]}>
        {options.map(e => (
          <Pressable
            key={e}
            style={({ pressed }) => [s.emojiPopCell, pressed && s.emojiPopCellPressed]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(e);
              onClose();
            }}
          >
            <Text style={s.emojiPopText}>{e}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

// ── Inline epic picker (vertical list, opens to the left of the tapped pill) ──
function InlineEpicPicker({ anchor, epicOptions, currentEpic, onSelect, onClose }: {
  anchor:      EpicAnchor | null;
  epicOptions: string[];
  currentEpic: string | null | undefined;
  onSelect:    (taskId: string, epic: string) => void;
  onClose:     () => void;
}) {
  const { width: sw, height: sh } = useWindowDimensions();
  if (!anchor || !epicOptions.length) return null;

  const rowH  = 34;
  const pad   = 6;
  const gap   = 5;
  const popW  = 170;
  const popH  = epicOptions.length * rowH + (epicOptions.length - 1) * gap + pad * 2;

  // Sit to the LEFT of the tapped pill
  const leftX = Math.max(4, anchor.x - popW - 6);
  const topY  = Math.min(anchor.y - 4, sh - popH - 20);

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[s.epicPopover, { top: topY, left: leftX, width: popW }]}>
        {epicOptions.map(ep => {
          const ec       = epicColor(ep);
          const selected = ep === currentEpic;
          return (
            <Pressable
              key={ep}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(anchor.taskId, ep);
                onClose();
              }}
              style={[s.epicPopRow, {
                backgroundColor: ec.bg,
                borderColor:     ec.border,
              }]}
            >
              <Text style={[s.epicPopText, { color: ec.text }]}>{ep}</Text>
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

// ── Detail sheet (bottom sheet, like QuickAddSheet) ────────────────────────────
const DS_SPINNER_SIZE   = 72;
const DS_SPINNER_STROKE = 8;
const DS_CIRCLE_SIZE    = 74;

function DetailSheet({ task, catEmojis, catEmojiMap, body, bodyLoading, onClose, onSave, onEmojiChange, onEpicChange, onCatChange, epicOptions, catValue, allCategories, categoryType, isTablet }: {
  task:           LifeTask | null;
  catEmojis:      string[];
  catEmojiMap:    Record<string, string[]>;
  body:           string | null;
  bodyLoading:    boolean;
  onClose:        () => void;
  onSave:         (id: string, title: string, notes: string, newCat: string | null) => Promise<void>;
  onEmojiChange:  (id: string, emoji: string) => void;
  onEpicChange?:  (id: string, epic: string) => void;
  onCatChange?:   (id: string, cat: string) => void;
  epicOptions?:   string[] | null;
  catValue:       string;
  allCategories:  string[];
  categoryType?:  string;
  isTablet:       boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(0.93)).current;
  const slideAnim = useRef(new Animated.Value(600)).current;
  const bgAnim    = useRef(new Animated.Value(0)).current;
  const kbAnim    = useRef(new Animated.Value(0)).current;
  const [kbVisible, setKbVisible] = useState(false);
  const insets    = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [title,       setTitle]      = useState("");
  const [notes,       setNotes]      = useState("");
  const [localEpic,   setLocalEpic]  = useState<string | null>(null);
  const [localCat,    setLocalCat]   = useState<string>(catValue);
  const [editingBody, setEditingBody] = useState(false);
  const selRef       = useRef({ start: 0, end: 0 });
  const notesRef     = useRef<TextInput>(null);
  const prevNotesRef = useRef(notes);

  // Smart body change handler — auto-continues bullet lists on Enter,
  // and removes an empty bullet when Enter is pressed a second time.
  const handleBodyChange = useCallback((newText: string) => {
    const prev = prevNotesRef.current;
    prevNotesRef.current = newText;

    if (newText.length === prev.length + 1) {
      const insertIdx = selRef.current.start; // cursor pos before the keystroke
      if (insertIdx >= 0 && insertIdx < newText.length && newText[insertIdx] === "\n") {
        // Find the start of the line the cursor was on (in the previous text)
        let lineStart = insertIdx;
        while (lineStart > 0 && prev[lineStart - 1] !== "\n") lineStart--;
        const currentLine = prev.slice(lineStart, insertIdx);

        if (currentLine === "- ") {
          // Empty bullet → exit list: strip "- " + swallow the new \n
          const result = prev.slice(0, lineStart) + newText.slice(insertIdx + 1);
          prevNotesRef.current = result;
          setNotes(result);
          return;
        }
        if (currentLine.startsWith("- ")) {
          // Filled bullet → continue with new bullet
          const result = newText.slice(0, insertIdx + 1) + "- " + newText.slice(insertIdx + 1);
          prevNotesRef.current = result;
          setNotes(result);
          return;
        }
      }
    }

    setNotes(newText);
  }, []);
  const visible = !!task;

  const handleFormat = useCallback((type: string) => {
    setEditingBody(true);
    setNotes(prev => applyFormat(type, prev, selRef.current));
  }, []);

  // Emojis for the currently-selected category (HIDDEN_EMOJI always appended)
  const displayEmojis = useMemo(() => {
    const base = catEmojiMap[localCat] ?? catEmojis;
    const withoutHidden = base.filter(e => norm(e) !== norm(HIDDEN_EMOJI));
    return [...withoutHidden, HIDDEN_EMOJI];
  }, [catEmojiMap, localCat, catEmojis]);

  const handleCatChange = useCallback((cat: string) => {
    setLocalCat(cat);
    // Clear epic selection when leaving Development category
    if (cat !== EPIC_CAT_VALUE) setLocalEpic(null);
    // Optimistically update the list immediately — same pattern as emoji/epic
    if (task) onCatChange?.(task.id, cat);
  }, [task, onCatChange]);

  // ── Loader anims ──────────────────────────────────────────────────────────
  const [loaderVisible,   setLoaderVisible]   = useState(false);
  const overlayOpacity  = useRef(new Animated.Value(0)).current;
  const spinnerOpacity  = useRef(new Animated.Value(0)).current;
  const spinnerRotation = useRef(new Animated.Value(0)).current;
  const circleScale     = useRef(new Animated.Value(0)).current;
  const circleOpacity   = useRef(new Animated.Value(0)).current;
  const tickScale       = useRef(new Animated.Value(0)).current;
  const spinLoopRef     = useRef<Animated.CompositeAnimation | null>(null);
  const openCloseRef    = useRef<Animated.CompositeAnimation | null>(null);
  const spinDeg = spinnerRotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  // ── Keyboard avoidance ────────────────────────────────────────────────────
  useEffect(() => {
    const onShow = (e: any) => { setKbVisible(true);  Animated.timing(kbAnim, { toValue: e.endCoordinates.height, duration: e.duration || 250, useNativeDriver: false }).start(); };
    const onHide = (e: any) => { setKbVisible(false); Animated.timing(kbAnim, { toValue: 0,                       duration: e.duration || 200, useNativeDriver: false }).start(); };
    const s1 = Keyboard.addListener("keyboardWillShow", onShow);
    const s2 = Keyboard.addListener("keyboardWillHide", onHide);
    const s3 = Keyboard.addListener("keyboardDidShow",  onShow);
    const s4 = Keyboard.addListener("keyboardDidHide",  onHide);
    return () => { s1.remove(); s2.remove(); s3.remove(); s4.remove(); };
  }, [kbAnim]);

  // Sync notes from body prop whenever sheet opens or body loads
  useEffect(() => {
    if (visible) {
      const val = body ?? "";
      prevNotesRef.current = val;
      setNotes(val);
      setEditingBody(false);
    }
  }, [visible, body]);

  // Auto-focus TextInput when switching to edit mode
  useEffect(() => {
    if (editingBody) {
      setTimeout(() => notesRef.current?.focus(), 80);
    }
  }, [editingBody]);

  // Sync localEpic when sheet opens
  useEffect(() => {
    if (visible) setLocalEpic(task?.epic ?? null);
  }, [visible, task?.epic]);

  useEffect(() => {
    if (visible) setLocalCat(catValue);
  }, [visible, catValue]);

  // ── Open / close animation ────────────────────────────────────────────────
  // useLayoutEffect runs before the first paint so animated values are at
  // their correct starting position the moment the Modal becomes visible —
  // eliminates the one-frame flicker when quickly re-opening after close.
  // openCloseRef lets us stop any in-flight close animation before resetting.
  useLayoutEffect(() => {
    openCloseRef.current?.stop();
    if (visible) {
      setTitle(task!.title);
      setEditingBody(false);
      scaleAnim.setValue(0.92);
      slideAnim.setValue(500);
      bgAnim.setValue(0);
      if (isTablet) {
        openCloseRef.current = Animated.parallel([
          Animated.timing(scaleAnim, { toValue: 1,   duration: 220, useNativeDriver: false, easing: Easing.out(Easing.back(1.2)) }),
          Animated.timing(bgAnim,    { toValue: 1,   duration: 200, useNativeDriver: false }),
        ]);
        openCloseRef.current.start();
      } else {
        // Phone: run separately so slideAnim can use native driver (no JS-thread competition)
        const slide = Animated.timing(slideAnim, { toValue: 0,   duration: 280, useNativeDriver: true,  easing: Easing.bezier(0.25, 1, 0.5, 1) });
        const bg    = Animated.timing(bgAnim,    { toValue: 1,   duration: 200, useNativeDriver: false });
        openCloseRef.current = { stop: () => { slide.stop(); bg.stop(); } } as any;
        slide.start(); bg.start();
      }
    } else {
      if (isTablet) {
        openCloseRef.current = Animated.parallel([
          Animated.timing(scaleAnim, { toValue: 0.92, duration: 160, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
          Animated.timing(bgAnim,    { toValue: 0,    duration: 160, useNativeDriver: false }),
        ]);
        openCloseRef.current.start();
      } else {
        const slide = Animated.timing(slideAnim, { toValue: 500,  duration: 200, useNativeDriver: true,  easing: Easing.in(Easing.quad) });
        const bg    = Animated.timing(bgAnim,    { toValue: 0,    duration: 160, useNativeDriver: false });
        openCloseRef.current = { stop: () => { slide.stop(); bg.stop(); } } as any;
        slide.start(); bg.start();
      }
    }
  }, [visible]);

  const dismiss = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const resetLoader = useCallback(() => {
    overlayOpacity.setValue(0);  spinnerOpacity.setValue(0);
    spinnerRotation.setValue(0); circleScale.setValue(0);
    circleOpacity.setValue(0);   tickScale.setValue(0);
  }, []);

  const runLoader = useCallback(
    (apiPromise: Promise<void>) =>
      new Promise<void>((resolve) => {
        resetLoader();
        setLoaderVisible(true);
        const tracked = apiPromise.then(() => {}).catch(() => {});

        spinLoopRef.current = Animated.loop(
          Animated.timing(spinnerRotation, { toValue: 1, duration: 600, easing: Easing.linear, useNativeDriver: true })
        );
        spinLoopRef.current.start();

        Animated.timing(overlayOpacity, { toValue: 1, duration: T_FADE_IN, useNativeDriver: true }).start(() => {
          Animated.timing(spinnerOpacity, { toValue: 1, duration: T_SPINNER_IN, useNativeDriver: true }).start(() => {
            const minSpin = new Promise<void>((r) => setTimeout(r, T_MIN_SPIN));
            Promise.all([tracked, minSpin]).then(() => {
              spinLoopRef.current?.stop();
              Animated.parallel([
                Animated.timing(spinnerOpacity, { toValue: 0, duration: T_POP,       useNativeDriver: true }),
                Animated.timing(circleOpacity,  { toValue: 1, duration: T_POP * 0.4, useNativeDriver: true }),
                Animated.timing(circleScale,    { toValue: 1, duration: T_POP, easing: Easing.out(Easing.back(1.7)), useNativeDriver: true }),
              ]).start(() => {
                Animated.timing(tickScale, { toValue: 1, duration: T_TICK, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }).start(() => {
                  setTimeout(() => {
                    const afterClose = () => { setLoaderVisible(false); resetLoader(); dismiss(); resolve(); };
                    if (isTablet) {
                      Animated.parallel([
                        Animated.timing(bgAnim,    { toValue: 0,    duration: 500, useNativeDriver: false }),
                        Animated.timing(scaleAnim, { toValue: 0.94, duration: 480, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
                      ]).start(afterClose);
                    } else {
                      let done = 0;
                      const check = () => { if (++done === 2) afterClose(); };
                      Animated.timing(bgAnim,    { toValue: 0,   duration: 500, useNativeDriver: false }).start(check);
                      Animated.timing(slideAnim, { toValue: 500, duration: 480, useNativeDriver: true,  easing: Easing.in(Easing.quad) }).start(check);
                    }
                  }, T_HOLD);
                });
              });
            });
          });
        });
      }),
    [resetLoader, dismiss, isTablet]
  );

  const handleSave = useCallback(() => {
    if (!task) return;
    Keyboard.dismiss();
    const changedCat = localCat !== catValue ? localCat : null;
    runLoader(onSave(task.id, title.trim(), notes.trim(), changedCat));
  }, [task, title, notes, localCat, catValue, onSave, runLoader]);

  const bg    = bgAnim.interpolate({ inputRange: [0, 1], outputRange: ["rgba(0,0,0,0)", "rgba(0,0,0,0.88)"] });
  const cardW = Math.min(740, screenW * 0.90);
  const maxCardH = screenH * 0.92;

  // ── Shared inner content ────────────────────────────────────────────────
  const sheetContent = (
    <>
      {/* Title */}
      <Text style={s.dsFieldLabel}>Summary</Text>
      <TextInput
        style={[s.dsTitleInput, { lineHeight: 26 }]}
        value={title}
        onChangeText={setTitle}
        multiline
        placeholder="Task name…"
        placeholderTextColor={Colors.textMuted}
        selectionColor={Colors.primary}
        keyboardAppearance="dark"
      />

      {/* Category row */}
      {allCategories.length > 0 && (
        <View style={[s.dsMetaRow, { marginTop: 8, marginBottom: 0 }]}>
          {allCategories.map(cat => {
            const selected = cat === localCat;
            return (
              <Pressable
                key={`cat-${cat}`}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleCatChange(cat); }}
                style={[s.dsCatChip, selected && s.dsCatChipActive, isTablet && { paddingHorizontal: 16, height: 46 }]}
              >
                <Text style={[s.dsCatText, selected && s.dsCatTextActive, isTablet && { fontSize: 14 }]}>{cat}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Epic row — only visible when the selected category is Development */}
      {epicOptions && epicOptions.length > 0 && localCat === EPIC_CAT_VALUE && (
        <View style={[s.dsMetaRow, { marginTop: 8 }]}>
          {epicOptions.map(ep => {
            const selected = ep === localEpic;
            const ec = epicColor(ep);
            return (
              <Pressable
                key={`epic-${ep}`}
                onPress={() => {
                  if (!task) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setLocalEpic(ep);
                  onEpicChange?.(task.id, ep);
                }}
                style={[s.dsEpicChip, { backgroundColor: selected ? ec.bg : "transparent", borderColor: selected ? ec.border : Colors.border }, isTablet && { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }]}
              >
                <Text style={[s.dsEpicText, { color: selected ? ec.text : Colors.textSecondary }, isTablet && { fontSize: 14 }]}>{ep}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

    </>
  );

  const loaderOverlay = loaderVisible ? (
    <Animated.View style={[s.dsLoader, { opacity: overlayOpacity }]} pointerEvents="auto">
      <Animated.View style={[s.dsSpinnerWrap, { opacity: spinnerOpacity, transform: [{ rotate: spinDeg }] }]}>
        <View style={s.dsSpinnerRing} />
      </Animated.View>
      <Animated.View style={[s.dsCircleWrap, { opacity: circleOpacity, transform: [{ scale: circleScale }] }]}>
        <Animated.View style={{ transform: [{ scale: tickScale }] }}>
          <Svg width={68} height={68} viewBox="0 0 68 68">
            <SvgPath fill="none" stroke="#000" strokeWidth={9.5} strokeLinecap="round" strokeLinejoin="round" d="M17 35.9 L26.4 47.2 L48.2 21.7" />
          </Svg>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  ) : null;

  const bodySection = (
    <>
      {/* Emoji row — just above formatting bar */}
      {displayEmojis.length > 0 && (
        <View style={[s.dsMetaRow, { marginTop: 12, marginBottom: 4, paddingHorizontal: 20 }]}>
          {displayEmojis.map((e, i) => {
            const selected = norm(task?.emoji ?? "") === norm(e);
            return (
              <Pressable
                key={`emoji-${i}`}
                onPress={() => { if (task) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onEmojiChange(task.id, e); } }}
                style={[s.dsEmojiChip, selected && s.dsEmojiChipActive]}
              >
                <Text style={s.dsEmojiText}>{e}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <FormattingToolbar
        onFormat={handleFormat}
        viewLink={task?.url ?? task?.fileLinks?.[0]?.url ?? undefined}
      />
      <ScrollView style={s.dsBodyScroll} bounces showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[s.dsBodyInner, { paddingTop: 10 }]}>
          {editingBody ? (
            <TextInput
              ref={notesRef}
              style={[s.dsNotesInput, bodyLoading && { opacity: 0.35 }]}
              value={notes}
              onChangeText={handleBodyChange}
              onSelectionChange={e => { selRef.current = e.nativeEvent.selection; }}
              onBlur={() => setEditingBody(false)}
              multiline
              editable={!bodyLoading}
              placeholder="Tap to add notes…"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primary}
              keyboardAppearance="dark"
              textAlignVertical="top"
            />
          ) : (
            <Pressable
              onPress={() => !bodyLoading && setEditingBody(true)}
              style={{ minHeight: 80, opacity: bodyLoading ? 0.35 : 1 }}
            >
              {notes.trim() ? (
                <RichBodyView markdown={notes} />
              ) : (
                <Text style={{ color: Colors.textMuted, fontSize: 15, fontFamily: "Inter_400Regular" }}>
                  Tap to add notes…
                </Text>
              )}
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View style={s.dsDivider} />
      <View style={s.dsActions}>
        <Pressable style={s.dsCancelBtn} onPress={dismiss}>
          <Text style={s.dsCancelTx}>Close</Text>
        </Pressable>
        <TouchableOpacity activeOpacity={0.8} style={s.dsUpdateBtn} onPress={handleSave}>
          <Feather name="check" size={15} color="#fff" />
          <Text style={s.dsUpdateTx}>Save</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <Animated.View style={[s.overlay, isTablet && s.overlayCenter, { backgroundColor: bg }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />

        {isTablet ? (
          // ── iPad: centered modal card ─────────────────────────────
          <Animated.View style={[s.dsCard, { width: cardW, maxHeight: maxCardH, marginBottom: kbAnim, transform: [{ scale: scaleAnim }], opacity: bgAnim }]}>
            <View style={s.dsCardTop}>
              {sheetContent}
            </View>
            {bodySection}
            {loaderOverlay}
          </Animated.View>
        ) : (
          // ── Phone: bottom sheet ───────────────────────────────────
          // Outer view slides in on native driver. Inner sheet raises its bottom
          // anchor above the keyboard so the title/header never goes off-screen.
          <Animated.View style={{ flex: 1, transform: [{ translateY: slideAnim }] }} pointerEvents="box-none">
            <Animated.View style={[s.sheet, {
              paddingBottom: kbVisible ? 4 : insets.bottom + 4,
              bottom: kbAnim,
              maxHeight: Animated.subtract(screenH - insets.top - 16, kbAnim),
            }]}>
              <View style={s.handle} />
              {sheetContent}
              {bodySection}
              {loaderOverlay}
            </Animated.View>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

// ── Quick-add sheet ────────────────────────────────────────────────────────────
function QuickAddSheet({ visible, catEmojis, catEmojiMap, catValue, allCategories, showEpic, epicOptions, schema, apiKey, onAdded, onClose, isTablet }: {
  visible: boolean; catEmojis: string[]; catEmojiMap: Record<string, string[]>; catValue: string;
  allCategories: string[];
  showEpic?: boolean; epicOptions?: string[];
  schema: Schema | null; apiKey: string | null;
  onAdded: (task: LifeTask) => void; onClose: () => void;
  isTablet: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(0.93)).current;
  const slideAnim = useRef(new Animated.Value(500)).current;
  const bgAnim    = useRef(new Animated.Value(0)).current;
  const kbAnim    = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const [kbVisible, setKbVisible] = useState(false);
  const insets    = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [title,        setTitle]       = useState("");
  const [selEmoji,     setSelEmoji]    = useState<string | null>(null);
  const [localCat,     setLocalCat]    = useState<string>(catValue);
  const [selEpic,      setSelEpic]     = useState<string | null>(null);
  const [loaderVisible, setLoaderVisible] = useState(false);
  const titleInputRef = useRef<TextInput>(null);

  // Emojis for the currently-selected category
  const displayEmojis = useMemo(() => {
    return catEmojiMap[localCat] ?? catEmojis;
  }, [catEmojiMap, localCat, catEmojis]);

  const handleCatChangeQA = useCallback((cat: string) => {
    setLocalCat(cat);
    // Clear epic selection when switching away from the epic-enabled category
    if (cat !== EPIC_CAT_VALUE) setSelEpic(null);
    // If the currently-selected emoji doesn't belong to the new category, clear it
    setSelEmoji(prev => {
      if (!prev) return null;
      const newEmojis = catEmojiMap[cat] ?? [];
      return newEmojis.some(e => norm(e) === norm(prev)) ? prev : null;
    });
  }, [catEmojiMap]);

  // Loader animation refs — identical to DetailSheet
  const overlayOpacity  = useRef(new Animated.Value(0)).current;
  const spinnerOpacity  = useRef(new Animated.Value(0)).current;
  const spinnerRotation = useRef(new Animated.Value(0)).current;
  const circleScale     = useRef(new Animated.Value(0)).current;
  const circleOpacity   = useRef(new Animated.Value(0)).current;
  const tickScale       = useRef(new Animated.Value(0)).current;
  const spinLoopRef     = useRef<Animated.CompositeAnimation | null>(null);
  const spinDeg = spinnerRotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 55, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 55, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 50, useNativeDriver: false }),
    ]).start();
  };

  // Keyboard avoidance
  useEffect(() => {
    const onShow = (e: any) => { setKbVisible(true);  Animated.timing(kbAnim, { toValue: e.endCoordinates.height, duration: e.duration || 250, useNativeDriver: false }).start(); };
    const onHide = (e: any) => { setKbVisible(false); Animated.timing(kbAnim, { toValue: 0,                       duration: e.duration || 200, useNativeDriver: false }).start(); };
    const s1 = Keyboard.addListener("keyboardWillShow", onShow);
    const s2 = Keyboard.addListener("keyboardWillHide", onHide);
    const s3 = Keyboard.addListener("keyboardDidShow",  onShow);
    const s4 = Keyboard.addListener("keyboardDidHide",  onHide);
    return () => { s1.remove(); s2.remove(); s3.remove(); s4.remove(); };
  }, [kbAnim]);

  useEffect(() => {
    if (visible) {
      setTitle(""); setSelEmoji(null); setLocalCat(catValue); setSelEpic(null); setLoaderVisible(false);
      setTimeout(() => titleInputRef.current?.focus(), 50);
      scaleAnim.setValue(0.93);
      slideAnim.setValue(500);
      if (isTablet) {
        Animated.parallel([
          Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: false, tension: 120, friction: 14 }),
          Animated.timing(bgAnim, { toValue: 1, duration: 220, useNativeDriver: false }),
        ]).start();
      } else {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 90, friction: 13 }).start();
        Animated.timing(bgAnim,   { toValue: 1, duration: 220, useNativeDriver: false }).start();
      }
    } else {
      if (isTablet) {
        Animated.parallel([
          Animated.timing(scaleAnim, { toValue: 0.93, duration: 180, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
          Animated.timing(bgAnim,    { toValue: 0,    duration: 190, useNativeDriver: false }),
        ]).start();
      } else {
        Animated.timing(slideAnim, { toValue: 500, duration: 240, useNativeDriver: true,  easing: Easing.in(Easing.quad) }).start();
        Animated.timing(bgAnim,    { toValue: 0,   duration: 190, useNativeDriver: false }).start();
      }
    }
  }, [visible]);

  const dismiss = useCallback(() => { Keyboard.dismiss(); onClose(); }, [onClose]);

  const resetLoader = useCallback(() => {
    overlayOpacity.setValue(0); spinnerOpacity.setValue(0);
    spinnerRotation.setValue(0); circleScale.setValue(0);
    circleOpacity.setValue(0);  tickScale.setValue(0);
  }, []);

  const runLoader = useCallback(
    (apiPromise: Promise<void>) =>
      new Promise<void>((resolve) => {
        resetLoader();
        setLoaderVisible(true);
        const tracked = apiPromise.then(() => {}).catch(() => {});
        spinLoopRef.current = Animated.loop(
          Animated.timing(spinnerRotation, { toValue: 1, duration: 600, easing: Easing.linear, useNativeDriver: true })
        );
        spinLoopRef.current.start();
        Animated.timing(overlayOpacity, { toValue: 1, duration: T_FADE_IN, useNativeDriver: true }).start(() => {
          Animated.timing(spinnerOpacity, { toValue: 1, duration: T_SPINNER_IN, useNativeDriver: true }).start(() => {
            const minSpin = new Promise<void>((r) => setTimeout(r, T_MIN_SPIN));
            Promise.all([tracked, minSpin]).then(() => {
              spinLoopRef.current?.stop();
              Animated.parallel([
                Animated.timing(spinnerOpacity, { toValue: 0, duration: T_POP,       useNativeDriver: true }),
                Animated.timing(circleOpacity,  { toValue: 1, duration: T_POP * 0.4, useNativeDriver: true }),
                Animated.timing(circleScale,    { toValue: 1, duration: T_POP, easing: Easing.out(Easing.back(1.7)), useNativeDriver: true }),
              ]).start(() => {
                Animated.timing(tickScale, { toValue: 1, duration: T_TICK, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }).start(() => {
                  setTimeout(() => {
                    const afterClose = () => { setLoaderVisible(false); resetLoader(); dismiss(); resolve(); };
                    if (isTablet) {
                      Animated.parallel([
                        Animated.timing(bgAnim,    { toValue: 0,    duration: 500, useNativeDriver: false }),
                        Animated.timing(scaleAnim, { toValue: 0.94, duration: 480, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
                      ]).start(afterClose);
                    } else {
                      let done = 0;
                      const check = () => { if (++done === 2) afterClose(); };
                      Animated.timing(bgAnim,    { toValue: 0,   duration: 500, useNativeDriver: false }).start(check);
                      Animated.timing(slideAnim, { toValue: 500, duration: 480, useNativeDriver: true,  easing: Easing.in(Easing.quad) }).start(check);
                    }
                  }, T_HOLD);
                });
              });
            });
          });
        });
      }),
    [resetLoader, dismiss, isTablet]
  );

  const handleSave = useCallback(() => {
    const t = title.trim();
    if (!t) { triggerShake(); return; }
    if (!apiKey || loaderVisible) return;
    const emoji = selEmoji ?? DEFAULT_EMOJI;
    const payload: any = {
      dbId: LIFE_DB_ID, title: t, category: localCat,
      emoji, priType: schema?.priType ?? "select",
      priOptions: schema?.priOptions ?? null,
      categoryType: schema?.categoryType ?? "select",
      ...(localCat === EPIC_CAT_VALUE && selEpic ? { epic: selEpic, epicType: schema?.epicType ?? "select" } : {}),
    };
    console.log("[handleSave] payload:", JSON.stringify(payload));
    console.log("[handleSave] schema:", JSON.stringify(schema));
    const apiPromise = fetch(`${BASE_URL}/api/notion/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
      body: JSON.stringify(payload),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.id) throw new Error("no id");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onAdded({ id: data.id, title: t, emoji, sortOrder: null, url: null, epic: selEpic ?? null });
      });
    runLoader(apiPromise);
  }, [title, selEmoji, localCat, selEpic, apiKey, schema, loaderVisible, runLoader, onAdded]);

  const bg      = bgAnim.interpolate({ inputRange: [0,1], outputRange: ["rgba(0,0,0,0)","rgba(0,0,0,0.88)"] });
  const cardW   = Math.min(740, screenW * 0.90);

  const qaLoaderOverlay = loaderVisible ? (
    <Animated.View style={[s.dsLoader, { opacity: overlayOpacity }]} pointerEvents="auto">
      <Animated.View style={[s.dsSpinnerWrap, { opacity: spinnerOpacity, transform: [{ rotate: spinDeg }] }]}>
        <View style={s.dsSpinnerRing} />
      </Animated.View>
      <Animated.View style={[s.dsCircleWrap, { opacity: circleOpacity, transform: [{ scale: circleScale }] }]}>
        <Animated.View style={{ transform: [{ scale: tickScale }] }}>
          <Svg width={68} height={68} viewBox="0 0 68 68">
            <SvgPath fill="none" stroke="#000" strokeWidth={9.5} strokeLinecap="round" strokeLinejoin="round" d="M17 35.9 L26.4 47.2 L48.2 21.7" />
          </Svg>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  ) : null;

  // ── Inner content (shared between phone/tablet) ───────────────────────────
  const innerContent = (
    <>
      {/* Title — extra paddingBottom ensures emojis don't crowd it */}
      <Text style={s.dsFieldLabel}>Summary</Text>
      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        <TextInput
          ref={titleInputRef}
          style={s.dsTitleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Add summary"
          placeholderTextColor={Colors.textMuted}
          selectionColor={Colors.primary}
          returnKeyType="done"
          onSubmitEditing={handleSave}
          keyboardAppearance="dark"
        />
      </Animated.View>

      {/* Category row — always shown */}
      {allCategories.length > 0 && (
        <View style={[s.dsMetaRow, { marginTop: 16 }]}>
          {allCategories.map(cat => {
            const selected = cat === localCat;
            return (
              <Pressable
                key={`qa-cat-${cat}`}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleCatChangeQA(cat); }}
                style={[s.dsCatChip, selected && s.dsCatChipActive, isTablet && { paddingHorizontal: 16, height: 46 }]}
              >
                <Text style={[s.dsCatText, selected && s.dsCatTextActive, isTablet && { fontSize: 14 }]}>{cat}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Epic row — shown when Development category is selected */}
      {epicOptions && epicOptions.length > 0 && localCat === EPIC_CAT_VALUE && (
        <View style={[s.dsMetaRow, { marginTop: 8 }]}>
          {epicOptions.map(ep => {
            const noneSelected = selEpic === null;
            const isSelected   = noneSelected || ep === selEpic;
            const isDimmed     = !noneSelected && ep !== selEpic;
            const colours      = EPIC_COLOUR_MAP[ep] ?? { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.15)", text: "#ccc" };
            return (
              <Pressable
                key={`qa-ep-${ep}`}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelEpic(ep === selEpic ? null : ep); }}
                style={[s.dsEpicChip, {
                  backgroundColor: colours.bg,
                  borderColor:     colours.border,
                  opacity:         isDimmed ? 0.4 : 1,
                }, isTablet && { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }]}
              >
                <Text style={[s.dsEpicText, { color: colours.text }, isTablet && { fontSize: 14 }]}>{ep}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Emoji row — just above formatting bar */}
      {displayEmojis.length > 0 && (
        <View style={[s.dsMetaRow, { marginTop: 16 }]}>
          {displayEmojis.map((e, i) => {
            const selected = norm(selEmoji ?? "") === norm(e);
            return (
              <Pressable
                key={`qa-emoji-${i}`}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelEmoji(e); }}
                style={[s.dsEmojiChip, selected && s.dsEmojiChipActive]}
              >
                <Text style={s.dsEmojiText}>{e}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={[s.dsDivider, { marginTop: 16 }]} />

      {/* Buttons */}
      <View style={s.dsActions}>
        <Pressable style={s.dsCancelBtn} onPress={dismiss}>
          <Text style={s.dsCancelTx}>Close</Text>
        </Pressable>
        <TouchableOpacity activeOpacity={0.8} style={s.dsUpdateBtn} onPress={handleSave}>
          <Feather name="plus" size={15} color="#fff" />
          <Text style={s.dsUpdateTx}>Add Task</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <Animated.View style={[s.overlay, isTablet && s.overlayCenter, { backgroundColor: bg }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />

        {isTablet ? (
          // ── iPad: centered card ───────────────────────────────────
          <Animated.View style={[s.dsCard, { width: cardW, maxHeight: screenH * 0.92, marginBottom: kbAnim, transform: [{ scale: scaleAnim }], opacity: bgAnim }]}>
            <View style={[s.dsCardTop, { paddingTop: 28, paddingBottom: 20, paddingHorizontal: 26 }]}>
              {innerContent}
            </View>
            {qaLoaderOverlay}
          </Animated.View>
        ) : (
          // ── Phone: bottom sheet ───────────────────────────────────
          <Animated.View style={{ flex: 1, transform: [{ translateY: slideAnim }] }} pointerEvents="box-none">
            <Animated.View style={[s.sheet, {
              paddingBottom: kbVisible ? 4 : insets.bottom + 4,
              bottom: kbAnim,
              maxHeight: Animated.subtract(screenH - insets.top - 16, kbAnim),
            }]}>
              <View style={s.handle} />
              {innerContent}
              {qaLoaderOverlay}
            </Animated.View>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

// ── List loader ───────────────────────────────────────────────────────────────
function ListLoader() {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, []);
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <View style={sc.center}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <View style={{
          width: 48, height: 48, borderRadius: 24,
          borderWidth: 5,
          borderColor: Colors.primary,
          borderTopColor: "rgba(224,49,49,0.15)",
        }} />
      </Animated.View>
    </View>
  );
}

// ── Task row ──────────────────────────────────────────────────────────────────
function TaskRow({ task, isDragging, dimValue, onEmojiPress, onEpicPress, onPress, onLongPress, onChecked, onDelete, onStartDelete, onSwipeOpen, onSwipeClose, showEpic, epicOptions }: {
  task:            LifeTask;
  isDragging:      boolean;
  dimValue:        Animated.Value;
  onEmojiPress:    (pageX: number, pageY: number, w: number, h: number) => void;
  onPress:         () => void;
  onLongPress:     () => void;
  onChecked:       () => void;
  onDelete:        () => void;
  onStartDelete?:  (collapseDuration: number) => void;
  onSwipeOpen?:    (close: () => void) => void;
  onSwipeClose?:   () => void;
  showEpic?:       boolean;
  epicOptions?:    string[] | null;
  onEpicPress?:    (pageX: number, pageY: number, w: number, h: number) => void;
}) {
  const swipeableRef  = useRef<Swipeable>(null);
  const emojiBtnRef   = useRef<View>(null);
  const epicPillRef   = useRef<View>(null);
  const checkScale    = useRef(new Animated.Value(0)).current;
  const opacityAnim   = useRef(new Animated.Value(1)).current;
  const rowHeight     = useRef(new Animated.Value(ITEM_H)).current;
  const rowScale        = useRef(new Animated.Value(1)).current;
  const pressOverlay    = useRef(new Animated.Value(0)).current;
  const deletingRef     = useRef(false);
  const isRevealedRef   = useRef(false);
  const [checked, setChecked] = useState(false);

  const onPressIn = useCallback(() => {
    Animated.timing(pressOverlay, { toValue: 0.28, duration: 60, useNativeDriver: true }).start();
  }, [pressOverlay]);
  const onPressOut = useCallback(() => {
    Animated.timing(pressOverlay, { toValue: 0, duration: 130, useNativeDriver: true }).start();
  }, [pressOverlay]);

  const triggerDelete = useCallback(() => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    swipeableRef.current?.close();
    // Notify parent immediately so it can slide sibling rows simultaneously
    onStartDelete?.(260);
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 220, useNativeDriver: false }),
      Animated.timing(rowHeight,   { toValue: 0, duration: 260, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
    ]).start(() => onDelete());
  }, [onDelete, onStartDelete, rowHeight]);

  const handleCheck = () => {
    if (checked) return;
    setChecked(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.spring(checkScale, { toValue: 1, useNativeDriver: false, tension: 240, friction: 8 }).start();
    // Notify parent after the tick pause so siblings slide in sync with the collapse
    setTimeout(() => {
      onStartDelete?.(340);
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 0, duration: 380, useNativeDriver: false }),
        Animated.timing(rowHeight,   { toValue: 0, duration: 340, useNativeDriver: false, easing: Easing.in(Easing.quad) }),
      ]).start(() => onChecked());
    }, 320);
  };

  const handleRowTap = (action: () => void) => {
    if (isRevealedRef.current) {
      swipeableRef.current?.close();
    } else {
      action();
    }
  };

  const combinedOpacity = Animated.multiply(
    opacityAnim,
    dimValue.interpolate({ inputRange: [0, 1], outputRange: [1, 0.22] })
  );

  const renderRightActions = useCallback(() => (
    <View style={sc.deleteZone}>
      <Pressable style={sc.deleteAction} onPress={triggerDelete}>
        <Feather name="trash-2" size={20} color="#fff" />
      </Pressable>
    </View>
  ), [triggerDelete]);

  return (
    <Animated.View style={[sc.rowOuter, { height: rowHeight, opacity: combinedOpacity }]}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootLeft={false}
        overshootRight={false}
        rightThreshold={28}
        friction={1.5}
        enabled={!isDragging && !deletingRef.current}
        onSwipeableWillOpen={() => { pressOverlay.setValue(0); }}
        onSwipeableOpen={() => {
          isRevealedRef.current = true;
          onSwipeOpen?.(() => swipeableRef.current?.close());
        }}
        onSwipeableClose={() => { isRevealedRef.current = false; onSwipeClose?.(); }}
        containerStyle={{ borderRadius: 14, overflow: "hidden" }}
      >
        <Animated.View style={[sc.rowWrap, isDragging && sc.rowDragging]}>
          {/* Emoji */}
          <Pressable
            ref={emojiBtnRef}
            onPress={() => handleRowTap(() => {
              (emojiBtnRef.current as any)?.measure((_fx: number, _fy: number, w: number, h: number, px: number, py: number) => {
                onEmojiPress(px, py, w, h);
              });
            })}
            hitSlop={6}
            style={sc.emojiBtn}
          >
            <Text style={sc.rowEmoji}>{task.emoji === DEFAULT_EMOJI ? "—" : task.emoji}</Text>
          </Pressable>

          {/* Name — fills full row height so tap target = entire row, not just text */}
          <Pressable
            style={{ flex: 1, alignSelf: "stretch", justifyContent: "center" }}
            onPress={() => { onPressOut(); handleRowTap(onPress); }}
            onLongPress={onLongPress}
            delayLongPress={200}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
          >
            <Text style={sc.rowTitle} numberOfLines={2}>{task.title}</Text>
          </Pressable>

          {/* Epic pill — tappable when epicOptions are loaded */}
          {showEpic && task.epic ? (() => {
            const ec        = epicColor(task.epic);
            const canChange = !!(onEpicPress && epicOptions?.length);
            return (
              <Pressable
                ref={epicPillRef}
                disabled={!canChange}
                onPress={() => handleRowTap(() => {
                  (epicPillRef.current as any)?.measure((_fx: number, _fy: number, w: number, h: number, px: number, py: number) => {
                    onEpicPress!(px, py, w, h);
                  });
                })}
                hitSlop={6}
              >
                <View style={[sc.epicPill, { backgroundColor: ec.bg, borderColor: ec.border }]}>
                  <Text style={[sc.epicPillText, { color: ec.text }]}>{task.epic}</Text>
                </View>
              </Pressable>
            );
          })() : null}

          {/* Checkbox */}
          <Pressable onPress={() => handleRowTap(handleCheck)} hitSlop={8} style={sc.checkBtn}>
            <Animated.View style={[sc.checkBox, checked && sc.checkBoxDone]}>
              <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                <Feather name="check" size={12} color="#fff" />
              </Animated.View>
            </Animated.View>
          </Pressable>

          {/* Press-feedback overlay — sits on top, never makes background transparent */}
          <Animated.View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: "#000",
              borderRadius: 14,
              opacity: pressOverlay,
            }}
          />
        </Animated.View>
      </Swipeable>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function LifeTaskScreen() {
  const { slug, add }     = useLocalSearchParams<{ slug: string; add?: string }>();
  const config            = SLUG_MAP[slug ?? ""] ?? null;
  const insets            = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const isTablet          = screenW >= 768;
  const { apiKey }        = useNotion();
  const { isOpen: drawerOpen, closeDrawer, openDrawerToSection } = useDrawer();

  const topPad    = Platform.OS === "web" ? Math.max(insets.top, 67)    : insets.top;
  const bottomPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  // ── Emoji index helper (component-level so drag + sort + add share same logic) ─
  const emojiIdxFn = useCallback((e: string) => {
    const orderEmojis = config?.sortEmojis ?? config?.emojis ?? [];
    const ne = norm(e);
    if (ne === norm(DEFAULT_EMOJI)) {
      const di = orderEmojis.findIndex(ce => ce === DEFAULT_EMOJI || ce === "-");
      if (di !== -1) return di;
    }
    let i = orderEmojis.findIndex(ce => norm(ce) === ne);
    if (i !== -1) return i;
    i = orderEmojis.findIndex(ce => {
      const nc = norm(ce);
      return ne.startsWith(nc) || nc.startsWith(ne);
    });
    return i === -1 ? 999 : i;
  }, [config]);

  // ── Data ────────────────────────────────────────────────────────────────────
  const [tasks,      setTasks]      = useState<LifeTask[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [schema,     setSchema]     = useState<Schema | null>(null);
  const tasksRef = useRef<LifeTask[]>([]);
  tasksRef.current = tasks;

  const fetchTasks = useCallback(async (silent = false) => {
    if (!apiKey || !config) return;
    if (!silent) setLoading(true); setError(null);
    try {
      const enc = encodeURIComponent(config.catValue);
      const r   = await fetch(`${BASE_URL}/api/notion/life-tasks?category=${enc}`, {
        headers: { "x-notion-key": apiKey },
      });
      const data = await r.json();
      if (data.tasks) {
        const allowList = config.sortEmojis ?? FULL_PICKER;
        const filtered = (data.tasks as LifeTask[]).filter(t => {
          // Always hide the explicit hidden-emoji marker
          if (norm(t.emoji) === norm(HIDDEN_EMOJI)) return false;
          // Keep items with no emoji assigned (default "-")
          if (t.emoji === DEFAULT_EMOJI || t.emoji === "") return true;
          // For sections with sortEmojis, only show those emoji groups; otherwise allow full picker
          return allowList.some(e => norm(e) === norm(t.emoji));
        });
        // Sort: emoji group first, then sortOrder within group, then alphabetical
        filtered.sort((a, b) => {
          const ei = emojiIdxFn(a.emoji) - emojiIdxFn(b.emoji);
          if (ei !== 0) return ei;
          const aOrd = a.sortOrder ?? 9999;
          const bOrd = b.sortOrder ?? 9999;
          if (aOrd !== bOrd) return aOrd - bOrd;
          return a.title.localeCompare(b.title);
        });
        setTasks(filtered);
        // Reset position anims
        filtered.forEach((t, i) => {
          if (!posAnims.current[t.id]) {
            posAnims.current[t.id] = new Animated.Value(i * SLOT_H);
            addedAnims.current[t.id] = Animated.add(posAnims.current[t.id], panY);
          } else {
            posAnims.current[t.id].setValue(i * SLOT_H);
          }
        });
      } else {
        setError(data.message ?? "Failed to load");
      }
    } catch (e: any) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [apiKey, config]);

  useEffect(() => {
    fetchTasks();
    if (!apiKey) return;
    fetch(`${BASE_URL}/api/notion/schema/${LIFE_DB_ID}`, { headers: { "x-notion-key": apiKey }, cache: "no-store" })
      .then(r => r.json())
      .then(d => setSchema({ priType: d.priType, priOptions: d.priOptions, categoryType: d.categoryType, epicOptions: d.epicOptions ?? null, epicType: d.epicType ?? "select", referenceType: d.referenceType ?? "url", referencePropertyName: d.referencePropertyName ?? null }))
      .catch(() => setSchema({ priType: "select", priOptions: null, categoryType: "select", epicOptions: null, epicType: "select", referenceType: "url", referencePropertyName: null }));
  }, [fetchTasks]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTasks(true);
    setRefreshing(false);
  }, [fetchTasks]);

  // ── Active swipe tracking — only one row open at a time ─────────────────────
  const activeSwipeClose = useRef<(() => void) | null>(null);
  const [swipedTaskId, setSwipedTaskId] = useState<string | null>(null);

  const handleSwipeOpen = useCallback((id: string, close: () => void) => {
    activeSwipeClose.current?.();   // close previous open row
    activeSwipeClose.current = close;
    setSwipedTaskId(id);
  }, []);

  const handleSwipeClose = useCallback(() => {
    setSwipedTaskId(null);
  }, []);

  const closeActiveSwipe = useCallback(() => {
    activeSwipeClose.current?.();
    activeSwipeClose.current = null;
    setSwipedTaskId(null);
  }, []);

  // ── Drag & drop ──────────────────────────────────────────────────────────────
  const posAnims         = useRef<Record<string, Animated.Value>>({});
  const addedAnims       = useRef<Record<string, ReturnType<typeof Animated.add>>>({});
  const containerRef     = useRef<View>(null);
  const containerTopRef  = useRef(0);
  const scrollOffsetRef  = useRef(0);
  const startScrollRef   = useRef(0);   // scroll at drag-start — needed for accurate relY
  const isDraggingRef    = useRef(false);
  const draggingIdxRef   = useRef(-1);
  const hoverIdxRef      = useRef(-1);
  const dragOccurredRef  = useRef(false);
  const panY             = useRef(new Animated.Value(0)).current;
  const dimAnim          = useRef(new Animated.Value(0)).current;   // 0=normal, 1=all-rows-dimmed
  const [dragActiveIdx, setDragActiveIdx] = useState(-1);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  tasks.forEach((t, i) => {
    if (!posAnims.current[t.id]) {
      posAnims.current[t.id] = new Animated.Value(i * SLOT_H);
      addedAnims.current[t.id] = Animated.add(posAnims.current[t.id], panY);
    }
  });

  const animatePositions = useCallback((dragIdx: number, hoverIdx: number) => {
    const cur = tasksRef.current;
    cur.forEach((t, i) => {
      if (i === dragIdx) return;
      let target = i;
      if (dragIdx < hoverIdx && i > dragIdx && i <= hoverIdx) target = i - 1;
      else if (dragIdx > hoverIdx && i >= hoverIdx && i < dragIdx) target = i + 1;
      posAnims.current[t.id]?.stopAnimation();
      Animated.timing(posAnims.current[t.id], {
        toValue: target * SLOT_H, duration: 110, useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }).start();
    });
  }, []);

  const startDrag = useCallback((idx: number) => {
    isDraggingRef.current   = true;
    draggingIdxRef.current  = idx;
    hoverIdxRef.current     = idx;
    dragOccurredRef.current = true;
    setDragActiveIdx(idx);
    setScrollEnabled(false);
    panY.setValue(0);
    // Dim all other rows
    Animated.timing(dimAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startScrollRef.current = scrollOffsetRef.current;
    containerRef.current?.measure((_x, _y, _w, _h, _px, py) => {
      containerTopRef.current = py;
    });
  }, [dimAnim]);

  const endDrag = useCallback(() => {
    const di = draggingIdxRef.current;
    const hi = hoverIdxRef.current;
    isDraggingRef.current  = false;
    draggingIdxRef.current = -1;
    hoverIdxRef.current    = -1;
    panY.setValue(0);
    setScrollEnabled(true);
    // Restore row brightness
    Animated.timing(dimAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();

    if (di >= 0 && hi >= 0 && di !== hi) {
      setTasks(prev => {
        const next = [...prev];
        const [moved] = next.splice(di, 1);
        next.splice(hi, 0, moved);
        next.forEach((t, i) => posAnims.current[t.id]?.setValue(i * SLOT_H));
        // Persist sort order
        syncSortOrders(next);
        return next;
      });
    } else {
      tasksRef.current.forEach((t, i) => posAnims.current[t.id]?.setValue(i * SLOT_H));
    }
    setDragActiveIdx(-1);
    setTimeout(() => { dragOccurredRef.current = false; }, 80);
  }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => isDraggingRef.current,
    onPanResponderMove: (_, gs) => {
      if (!isDraggingRef.current) return;
      const di  = draggingIdxRef.current;
      const len = tasksRef.current.length;
      panY.setValue(gs.dy);
      // Use absolute finger Y for accurate zone — much more precise than dy-based calculation
      // relY: finger position within the scroll-content coordinate space.
      // containerTopRef was measured at startScrollRef, so we subtract that baseline.
      const relY     = gs.moveY - containerTopRef.current + (scrollOffsetRef.current - startScrollRef.current);
      const newHover = clamp(0, len - 1, Math.floor(relY / SLOT_H));
      if (newHover !== hoverIdxRef.current) {
        hoverIdxRef.current = newHover;
        animatePositions(di, newHover);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    onPanResponderEnd:       () => endDrag(),
    onPanResponderTerminate: () => endDrag(),
  }), [animatePositions, endDrag]);

  // Banded sort orders: emoji group 0 → 100s, group 1 → 200s, etc.
  // So "top of group" always works: new item gets (groupBase - 1).
  const syncSortOrders = useCallback((ordered: LifeTask[]) => {
    if (!apiKey) return;
    const groupCounters: Record<number, number> = {};
    ordered.forEach(t => {
      const gi = emojiIdxFn(t.emoji);
      if (groupCounters[gi] === undefined) groupCounters[gi] = 0;
      const newOrder = (gi + 1) * 100 + groupCounters[gi];
      groupCounters[gi]++;
      fetch(`${BASE_URL}/api/notion/life-tasks/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
        body: JSON.stringify({ sortOrder: newOrder }),
      }).catch(() => {});
    });
  }, [apiKey, emojiIdxFn]);

  // Reset: sort all tasks by emoji group then title, assign fresh banded sort orders
  const handleResetOrder = useCallback(async () => {
    if (!apiKey) return;
    const ordered = [...tasksRef.current].sort((a, b) => {
      const ei = emojiIdxFn(a.emoji) - emojiIdxFn(b.emoji);
      if (ei !== 0) return ei;
      return a.title.localeCompare(b.title);
    });
    const groupCounters: Record<number, number> = {};
    const updated = ordered.map(t => {
      const gi = emojiIdxFn(t.emoji);
      if (groupCounters[gi] === undefined) groupCounters[gi] = 0;
      const newOrder = (gi + 1) * 100 + groupCounters[gi];
      groupCounters[gi]++;
      return { ...t, sortOrder: newOrder };
    });
    setTasks(updated);
    updated.forEach((t, i) => posAnims.current[t.id]?.setValue(i * SLOT_H));
    await Promise.all(updated.map(t =>
      fetch(`${BASE_URL}/api/notion/life-tasks/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
        body: JSON.stringify({ sortOrder: t.sortOrder }),
      }).catch(() => {})
    ));
  }, [apiKey, emojiIdxFn]);

  // ── Task actions ─────────────────────────────────────────────────────────────
  const [detailTask,   setDetailTask]   = useState<LifeTask | null>(null);
  const [pageBody,     setPageBody]     = useState<string | null>(null);
  const [bodyLoading,  setBodyLoading]  = useState(false);
  const [emojiAnchor,  setEmojiAnchor]  = useState<EmojiAnchor | null>(null);
  const [epicAnchor,   setEpicAnchor]   = useState<EpicAnchor  | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const hasAutoOpened = useRef(false);
  useEffect(() => {
    if (add === "true" && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      setShowQuickAdd(true);
    }
  }, [add]);

  const openDetail = useCallback((task: LifeTask) => {
    if (dragOccurredRef.current) return;
    setDetailTask(task);
    setPageBody(null);
    setBodyLoading(true);
    if (apiKey) {
      fetch(`${BASE_URL}/api/notion/page-blocks/${task.id}`, {
        headers: { "x-notion-key": apiKey },
      })
        .then(r => r.json())
        .then(d => { setPageBody(d.body || null); setBodyLoading(false); })
        .catch(() => setBodyLoading(false));
    }
  }, [apiKey]);

  const handleSaveTitle = useCallback((id: string, title: string, notes: string, newCat: string | null): Promise<void> => {
    if (!apiKey) return Promise.resolve();
    setTasks(prev => prev.map(t => t.id === id ? { ...t, title, ...(newCat ? { category: newCat } : {}) } : t));
    const taskPatch: any = { title };
    if (newCat) { taskPatch.category = newCat; taskPatch.categoryType = schema?.categoryType ?? "select"; }
    return Promise.all([
      fetch(`${BASE_URL}/api/notion/life-tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
        body: JSON.stringify(taskPatch),
      }),
      fetch(`${BASE_URL}/api/notion/page-blocks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
        body: JSON.stringify({ body: notes }),
      }),
    ]).then(() => {}).catch(() => {});
  }, [apiKey, schema?.categoryType]);

  // Re-sort tasks and animate each row to its new slot — shared by emoji + cat changes
  const resortAndAnimate = useCallback((next: LifeTask[]) => {
    next.sort((a, b) => {
      const ei = emojiIdxFn(a.emoji) - emojiIdxFn(b.emoji);
      if (ei !== 0) return ei;
      const aOrd = a.sortOrder ?? 9999;
      const bOrd = b.sortOrder ?? 9999;
      if (aOrd !== bOrd) return aOrd - bOrd;
      return a.title.localeCompare(b.title);
    });
    next.forEach((t, i) => {
      const anim = posAnims.current[t.id];
      if (anim) {
        anim.stopAnimation();
        Animated.spring(anim, {
          toValue: i * SLOT_H,
          useNativeDriver: true,
          tension: 150,
          friction: 16,
        }).start();
      }
    });
    return next;
  }, [emojiIdxFn]);

  const handleCatOptimistic = useCallback((id: string, category: string) => {
    // Task moved to a different slug — remove it from this list with animation
    if (config && category !== config.catValue) {
      setTasks(prev => {
        const next = prev.filter(t => t.id !== id);
        next.forEach((t, i) => {
          const anim = posAnims.current[t.id];
          if (anim) {
            anim.stopAnimation();
            Animated.spring(anim, { toValue: i * SLOT_H, useNativeDriver: true, tension: 150, friction: 16 }).start();
          }
        });
        return next;
      });
    }
  }, [config]);

  const handleEmojiChange = useCallback((id: string, emoji: string) => {
    if (!apiKey) return;
    if (norm(emoji) === norm(HIDDEN_EMOJI)) {
      // Thumbs down — optimistically remove the item immediately
      setTasks(prev => {
        const next = prev.filter(t => t.id !== id);
        next.forEach((t, i) => {
          posAnims.current[t.id]?.stopAnimation();
          posAnims.current[t.id]?.setValue(i * SLOT_H);
        });
        return next;
      });
      setDetailTask(null);
    } else {
      setTasks(prev => resortAndAnimate(prev.map(t => t.id === id ? { ...t, emoji } : t)));
      setDetailTask(prev => prev?.id === id ? { ...prev, emoji } : prev);
    }
    fetch(`${BASE_URL}/api/notion/life-tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
      body: JSON.stringify({ emoji }),
    }).catch(() => {});
    setEmojiAnchor(null);
  }, [apiKey, resortAndAnimate]);

  const handleEpicChange = useCallback((id: string, epic: string) => {
    if (!apiKey) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, epic } : t));
    setDetailTask(prev => prev?.id === id ? { ...prev, epic } : prev);
    setEpicAnchor(null);
    fetch(`${BASE_URL}/api/notion/life-tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
      body: JSON.stringify({ epic }),
    }).catch(() => {});
  }, [apiKey]);

  const handleCheckOff = useCallback((id: string) => {
    if (!apiKey) return;
    setTasks(prev => {
      const next = prev.filter(t => t.id !== id);
      // Snap to exact positions (animation already ran via handleStartDelete)
      next.forEach((t, i) => {
        posAnims.current[t.id]?.stopAnimation();
        posAnims.current[t.id]?.setValue(i * SLOT_H);
      });
      return next;
    });
    fetch(`${BASE_URL}/api/notion/life-tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
      body: JSON.stringify({ done: true }),
    }).catch(() => {});
  }, [apiKey]);

  // Called the moment the row starts its delete/checkoff animation —
  // slides rows below up in sync so there's no jump when state is updated.
  const handleStartDelete = useCallback((id: string, collapseDuration: number) => {
    const cur = tasksRef.current;
    const deletedIdx = cur.findIndex(t => t.id === id);
    if (deletedIdx === -1) return;
    cur.forEach((t, i) => {
      if (i <= deletedIdx) return;
      const anim = posAnims.current[t.id];
      if (!anim) return;
      anim.stopAnimation();
      Animated.timing(anim, {
        toValue: (i - 1) * SLOT_H,
        duration: collapseDuration,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }).start();
    });
  }, []);

  const handleDelete = useCallback((id: string) => {
    setTasks(prev => {
      const next = prev.filter(t => t.id !== id);
      // Snap to exact final positions (animation already ran via handleStartDelete)
      next.forEach((t, i) => {
        posAnims.current[t.id]?.stopAnimation();
        posAnims.current[t.id]?.setValue(i * SLOT_H);
      });
      return next;
    });
    if (apiKey) {
      fetch(`${BASE_URL}/api/notion/life-tasks/${id}`, {
        method: "DELETE",
        headers: { "x-notion-key": apiKey },
      }).catch(() => {});
    }
  }, [apiKey]);

  const handleQuickAdded = useCallback((task: LifeTask) => {
    setTasks(prev => {
      // Find the minimum sortOrder in the same emoji group and go one below it
      const gi        = emojiIdxFn(task.emoji);
      const groupBase = (gi + 1) * 100;
      const groupTasks = prev.filter(t => emojiIdxFn(t.emoji) === gi);
      const minOrder  = groupTasks.length > 0
        ? Math.min(...groupTasks.map(t => t.sortOrder ?? groupBase + 50))
        : groupBase;
      const newOrder  = minOrder - 1;

      const updatedTask = { ...task, sortOrder: newOrder };

      // Persist new sort order
      if (apiKey) {
        fetch(`${BASE_URL}/api/notion/life-tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-notion-key": apiKey },
          body: JSON.stringify({ sortOrder: newOrder }),
        }).catch(() => {});
      }

      // Re-sort: emoji group first, then sortOrder within group
      const next = [...prev, updatedTask];
      next.sort((a, b) => {
        const ei = emojiIdxFn(a.emoji) - emojiIdxFn(b.emoji);
        if (ei !== 0) return ei;
        const aOrd = a.sortOrder ?? 9999;
        const bOrd = b.sortOrder ?? 9999;
        return aOrd - bOrd;
      });
      next.forEach((t, i) => {
        if (!posAnims.current[t.id]) {
          posAnims.current[t.id] = new Animated.Value(i * SLOT_H);
          addedAnims.current[t.id] = Animated.add(posAnims.current[t.id], panY);
        } else {
          posAnims.current[t.id].setValue(i * SLOT_H);
        }
      });
      return next;
    });
  }, [apiKey, emojiIdxFn]);

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!config) {
    return (
      <View style={[sc.root, { paddingTop: topPad }]}>
        <ScreenHeader title="Not found" />
        <View style={sc.center}><Text style={sc.errorText}>Unknown section</Text></View>
      </View>
    );
  }

  const pickerTask = emojiAnchor ? tasks.find(t => t.id === emojiAnchor.taskId) ?? null : null;

  const [resetting, setResetting] = useState(false);
  const onResetPress = useCallback(async () => {
    if (resetting) return;
    setResetting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await handleResetOrder();
    setResetting(false);
  }, [resetting, handleResetOrder]);


  return (
    <View style={sc.root}>

      {/* ── Gradient header ───────────────────────────────────────────────────── */}
      <View style={[sc.gradHeader, { paddingTop: (Platform.OS === "web" ? Math.max(insets.top, 52) : insets.top) + 8, paddingBottom: isTablet ? 58 : 36 }]}>
        <LinearGradient
          colors={[
            "rgba(224,49,49,0.90)",
            "rgba(215,42,42,0.74)",
            "rgba(190,28,28,0.56)",
            "rgba(145,16,16,0.38)",
            "rgba(90,8,8,0.20)",
            "rgba(35,3,3,0.08)",
            "#0f0f0f",
          ]}
          locations={[0, 0.18, 0.36, 0.54, 0.70, 0.85, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={sc.gradNav}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); drawerOpen ? closeDrawer() : openDrawerToSection("life"); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={sc.gradIconGhost}
          >
            <Feather name="menu" size={26} color="rgba(255,255,255,0.92)" />
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>
        <Text style={sc.gradTitle}>{config.title}</Text>
      </View>

      {/* ── List ─────────────────────────────────────────────────────────────── */}
      {loading ? (
        <ListLoader />
      ) : error ? (
        <View style={sc.center}>
          <Text style={sc.errorText}>{error}</Text>
          <Pressable onPress={fetchTasks} style={sc.retryBtn}>
            <Text style={sc.retryTx}>Retry</Text>
          </Pressable>
        </View>
      ) : tasks.length === 0 ? (
        <View style={sc.center}>
          <Text style={sc.mutedText}>Nothing here yet</Text>
        </View>
      ) : (
        <ScrollView
          style={{ marginTop: -8 }}
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}
          onScroll={e => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: bottomPad + 100, paddingTop: 12 }}
          onScrollBeginDrag={closeActiveSwipe}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          <View
              ref={containerRef}
              {...panResponder.panHandlers}
              style={{ height: Math.max(tasks.length, 1) * SLOT_H + 16, marginHorizontal: 16, marginTop: 8 }}
            >
              {/* Tap-anywhere-to-cancel overlay — sits above non-dragging rows (z:1) but below the dragging row (z:100) */}
              {dragActiveIdx !== -1 && (
                <Pressable
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
                  onPress={() => endDrag()}
                />
              )}
              {tasks.map((task, idx) => {
                const isDragging = dragActiveIdx === idx;
                const posAnim    = posAnims.current[task.id] ?? new Animated.Value(idx * SLOT_H);
                const translateY = isDragging
                  ? (addedAnims.current[task.id] ?? posAnim)
                  : posAnim;
                return (
                  <Animated.View
                    key={task.id}
                    style={[
                      sc.absItem,
                      { top: 0, zIndex: isDragging ? 100 : swipedTaskId === task.id ? 10 : 1, transform: [{ translateY }] },
                    ]}
                  >
                    <TaskRow
                      task={task}
                      isDragging={isDragging}
                      dimValue={isDragging ? ZERO_ANIM : dimAnim}
                      onEmojiPress={(px, py, w, h) => setEmojiAnchor({ taskId: task.id, x: px, y: py, w, h })}
                      onEpicPress={config?.showEpic ? (px, py, w, h) => setEpicAnchor({ taskId: task.id, x: px, y: py, w, h }) : undefined}
                      onPress={() => openDetail(task)}
                      onLongPress={() => startDrag(idx)}
                      onChecked={() => handleCheckOff(task.id)}
                      onDelete={() => handleDelete(task.id)}
                      onStartDelete={(d) => handleStartDelete(task.id, d)}
                      onSwipeOpen={(close) => handleSwipeOpen(task.id, close)}
                      onSwipeClose={handleSwipeClose}
                      showEpic={config?.showEpic}
                      epicOptions={config?.showEpic ? filterEpics(schema?.epicOptions) : null}
                    />
                  </Animated.View>
                );
              })}
            </View>
        </ScrollView>
      )}

      {/* ── FAB ──────────────────────────────────────────────────────────────── */}
      <Pressable
        onPress={() => setShowQuickAdd(true)}
        style={({ pressed }) => [sc.fab, pressed && { opacity: 0.82 }]}
      >
        <Feather name="plus" size={22} color="#fff" />
      </Pressable>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      <DetailSheet
        task={detailTask}
        catEmojis={[...(config?.emojis ?? []).filter(e => norm(e) !== norm(HIDDEN_EMOJI)), HIDDEN_EMOJI]}
        catEmojiMap={CAT_EMOJI_MAP}
        body={pageBody}
        bodyLoading={bodyLoading}
        onClose={() => setDetailTask(null)}
        onSave={handleSaveTitle}
        onEmojiChange={handleEmojiChange}
        onEpicChange={handleEpicChange}
        onCatChange={handleCatOptimistic}
        epicOptions={filterEpics(schema?.epicOptions)}
        catValue={config?.catValue ?? ""}
        allCategories={ALL_CATS}
        categoryType={schema?.categoryType}
        isTablet={isTablet}
      />

      <InlineEmojiPicker
        anchor={emojiAnchor}
        emojis={[...config.emojis.filter(e => norm(e) !== norm(HIDDEN_EMOJI)), HIDDEN_EMOJI]}
        currentEmoji={pickerTask?.emoji ?? null}
        onSelect={(e) => { if (pickerTask) handleEmojiChange(pickerTask.id, e); }}
        onClose={() => setEmojiAnchor(null)}
      />

      <InlineEpicPicker
        anchor={epicAnchor}
        epicOptions={filterEpics(schema?.epicOptions)}
        currentEpic={epicAnchor ? (tasks.find(t => t.id === epicAnchor.taskId)?.epic ?? null) : null}
        onSelect={handleEpicChange}
        onClose={() => setEpicAnchor(null)}
      />

      <QuickAddSheet
        visible={showQuickAdd}
        catEmojis={FULL_PICKER}
        catEmojiMap={CAT_EMOJI_MAP}
        catValue={config.catValue}
        allCategories={ALL_CATS}
        showEpic={!!config?.showEpic}
        epicOptions={filterEpics(schema?.epicOptions)}
        schema={schema}
        apiKey={apiKey}
        onAdded={handleQuickAdded}
        onClose={() => setShowQuickAdd(false)}
        isTablet={isTablet}
      />
    </View>
  );
}

// ── Shared sheet styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay:        { flex: 1 },
  overlayCenter:  { justifyContent: "center", alignItems: "center" },

  // ── Sheet base (no absolute positioning — used for tablet-centred detail sheet)
  sheetBase: {
    backgroundColor: "#0b0b0c", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 20, paddingTop: 0,
  },

  // ── Phone bottom sheet (absolute, anchored to bottom) ───────────────────
  sheet: {
    backgroundColor: "#0b0b0c", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 20, paddingTop: 0,
    position: "absolute", left: 0, right: 0, bottom: 0,
  },
  handle: { width: 38, height: 5, borderRadius: 3, backgroundColor: Colors.border, alignSelf: "center", marginTop: 10, marginBottom: 18 },
  sheetTitle: { color: Colors.textPrimary, fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 20 },

  // ── Inline emoji popover ─────────────────────────────────────────────────
  emojiPopover: {
    position: "absolute",
    backgroundColor: Colors.cardBg,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    padding: 10, flexDirection: "row", flexWrap: "nowrap", gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },

  // ── Epic picker popover (vertical list, to the left) ────────────────────
  epicPopover: {
    position: "absolute",
    backgroundColor: "#0b0b0c",
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    padding: 6, gap: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  epicPopRow: {
    paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8, borderWidth: 1,
  },
  epicPopDot:  { width: 6, height: 6, borderRadius: 3 },
  epicPopText: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2, textAlign: "center" },
  emojiPopCell: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: Colors.cardBgElevated,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  emojiPopCellPressed: { borderColor: Colors.primary, backgroundColor: "rgba(224,49,49,0.15)" },
  emojiPopText: { fontSize: 24 },

  // ── Detail card (centered modal) ─────────────────────────────────────────
  dsCard: {
    backgroundColor: "#0b0b0c",
    borderRadius: 22, borderWidth: 1, borderColor: Colors.border,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.55, shadowRadius: 44, elevation: 24,
  },
  dsCardTop: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },
  dsTitleInput: {
    color: Colors.textPrimary, fontSize: 15, fontFamily: "Inter_600SemiBold",
    paddingTop: 10, paddingBottom: 13, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 10,
  },
  dsMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  dsEmojiChip: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.cardBgElevated,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border,
  },
  dsEmojiChipActive: { borderColor: Colors.primary, backgroundColor: "rgba(224,49,49,0.15)" },
  dsEmojiText: { fontSize: 20 },
  dsEpicChip: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  dsEpicText: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4 },
  dsCatChip: {
    height: 40, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: "transparent",
    alignItems: "center", justifyContent: "center",
  },
  dsCatChipActive: { backgroundColor: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.35)" },
  dsCatText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textMuted, letterSpacing: 0.2 },
  dsCatTextActive: { color: Colors.textPrimary },
  dsDivider: { height: 1, backgroundColor: Colors.border },
  dsBodyScroll: { flexShrink: 1 },
  dsBodyInner: { paddingHorizontal: 20, paddingVertical: 18 },
  dsSectionLabel: { color: Colors.textMuted, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1, marginBottom: 10 },
  dsNotesInput: {
    color: Colors.textPrimary, fontSize: 15, fontFamily: "Inter_400Regular",
    lineHeight: 24, paddingVertical: 0, minHeight: 80,
  },
  dsBodyText: { color: Colors.textSecondary, fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22, marginBottom: 4 },
  dsBodyPlaceholder: { color: Colors.textMuted, fontSize: 15, fontFamily: "Inter_400Regular", fontStyle: "italic", marginBottom: 4 },
  dsUrlText: { color: Colors.primary, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, textDecorationLine: "underline" },
  dsLinkRow:    { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  dsLinkEmoji:  { fontSize: 15, lineHeight: 20 },
  dsLinkLabel:  { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.primary, textDecorationLine: "underline", lineHeight: 18 },
  dsUrlChip:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: "rgba(90,165,255,0.12)", borderWidth: 1, borderColor: "rgba(90,165,255,0.3)" },
  dsUrlChipTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#5aa5ff" },
  dsLinkField: { paddingHorizontal: 16, paddingTop: 6, gap: 5 },
  dsLinkFieldLabel: { color: Colors.textSecondary, fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, paddingHorizontal: 4 },
  dsLinkFieldInput: {
    backgroundColor: Colors.cardBgElevated, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, color: Colors.textPrimary, fontSize: 13, fontFamily: "Inter_400Regular",
    paddingHorizontal: 12, paddingVertical: 10,
  },
  dsFieldLabel: { color: "#ffffff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" },
  dsActions: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  dsCancelBtn: { flex: 1, paddingVertical: 15, borderRadius: 13, backgroundColor: Colors.cardBgElevated, alignItems: "center" },
  dsCancelTx: { color: "#ffffff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  dsUpdateBtn: { flex: 2, paddingVertical: 15, borderRadius: 13, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  dsUpdateTx: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  // ── Detail card loader ───────────────────────────────────────────────────
  dsLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center", justifyContent: "center", borderRadius: 22, zIndex: 999,
  },
  dsSpinnerWrap: {
    width: DS_SPINNER_SIZE, height: DS_SPINNER_SIZE,
    alignItems: "center", justifyContent: "center", position: "absolute",
  },
  dsSpinnerRing: {
    width: DS_SPINNER_SIZE, height: DS_SPINNER_SIZE, borderRadius: DS_SPINNER_SIZE / 2,
    borderWidth: DS_SPINNER_STROKE,
    borderColor: "#ff1e1e",
    borderTopColor: "rgba(255,30,30,0.15)",
  },
  dsCircleWrap: {
    width: DS_CIRCLE_SIZE, height: DS_CIRCLE_SIZE, borderRadius: DS_CIRCLE_SIZE / 2,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", position: "absolute",
    borderWidth: 1.5, borderColor: Colors.primary,
  },

  qaInput: {
    backgroundColor: Colors.cardBgElevated, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight,
    color: Colors.textPrimary, fontSize: 16, fontFamily: "Inter_400Regular",
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16,
  },
  qaEmojiRow: { flexDirection: "row", gap: 10, marginBottom: 20, flexWrap: "wrap" },
  qaEmoji: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.cardBgElevated,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border,
  },
  qaEmojiActive: { borderColor: Colors.primary, backgroundColor: "rgba(224,49,49,0.15)" },
  qaEmojiText: { fontSize: 20 },
  qaAddBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 15,
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6,
  },
  qaAddBtnTx: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});

// ── Screen styles ──────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  root:  { flex: 1, backgroundColor: "#0b0b0c" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  mutedText: { color: Colors.textMuted, fontSize: 15, fontFamily: "Inter_400Regular" },
  errorText: { color: Colors.primary, fontSize: 14, fontFamily: "Inter_500Medium" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.cardBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  retryTx: { color: Colors.textPrimary, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  resetBtn: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  headerBanner: { height: 160, overflow: "hidden", backgroundColor: "#000" },
  headerBannerImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },

  gradHeader: {
    paddingHorizontal: 20, paddingBottom: 56,
    backgroundColor: "#0f0f0f",
  },
  gradNav: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  gradIconBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(26,26,26,0.55)",
    alignItems: "center", justifyContent: "center",
  },
  gradIconGhost: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  gradTitle: {
    fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff",
    textAlign: "center", marginBottom: 4,
    textShadowColor: "rgba(224,49,49,0.45)",
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24,
  },
  gradSub: { fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: "Inter_400Regular", textAlign: "center" },

  countRow: { paddingHorizontal: 16, paddingVertical: 8 },
  countText: { fontSize: 12, color: Colors.textMuted, fontFamily: "Inter_500Medium" },

  absItem: { position: "absolute", left: 0, right: 0, height: ITEM_H },

  rowOuter: { height: ITEM_H },
  deleteZone: {
    width: 88, height: ITEM_H,
    paddingVertical: 10, paddingHorizontal: 8,
    justifyContent: "center", alignItems: "stretch",
  },
  deleteAction: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },

  rowWrap: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0f0f0f", borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14, height: ITEM_H,
  },
  rowDragging: {
    backgroundColor: Colors.cardBgElevated,
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 18, elevation: 18,
  },
  emojiBtn:  { minWidth: 36, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  rowEmoji:  { fontSize: 24 },
  rowTitle:  { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_600SemiBold", lineHeight: 21, paddingBottom: 4 },
  checkBtn:  { padding: 10, margin: -6 },
  checkBox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: "#5a5a5a",
    alignItems: "center", justifyContent: "center", backgroundColor: "transparent",
  },
  checkBoxDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  epicPill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1,
  },
  epicPillText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2, textAlign: "center",
  },

  fab: {
    position: "absolute", bottom: 32, right: 20,
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 8,
  },
});
