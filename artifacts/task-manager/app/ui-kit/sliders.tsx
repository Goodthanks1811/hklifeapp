import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useDrawer } from "@/context/DrawerContext";

function useSlider(initial: number, min: number, max: number, trackWidth: number) {
  const [value, setValue] = useState(initial);
  const valueRef = useRef(initial);
  const lastHaptic = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, gestureState) => {
        if (trackWidth === 0) return;
        const ratio = Math.max(0, Math.min(1, (gestureState.moveX - 24) / trackWidth));
        const newVal = Math.round(min + ratio * (max - min));
        if (newVal !== valueRef.current) {
          valueRef.current = newVal;
          setValue(newVal);
          const now = Date.now();
          if (now - lastHaptic.current > 50) {
            Haptics.selectionAsync();
            lastHaptic.current = now;
          }
        }
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  return { value, setValue, panResponder };
}

const TRACK_W = Platform.select({ web: 320, default: 300 });

function SliderTrack({
  value,
  min,
  max,
  color = Colors.primary,
  panResponder,
  label,
  showValue = true,
  formatValue,
}: {
  value: number;
  min: number;
  max: number;
  color?: string;
  panResponder: any;
  label: string;
  showValue?: boolean;
  formatValue?: (v: number) => string;
}) {
  const pct = (value - min) / (max - min);
  const displayVal = formatValue ? formatValue(value) : String(value);

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderLabelRow}>
        <Text style={styles.sliderLabel}>{label}</Text>
        {showValue && <Text style={[styles.sliderValue, { color }]}>{displayVal}</Text>}
      </View>
      <View style={[styles.track, { width: TRACK_W }]} {...panResponder.panHandlers}>
        <View style={[styles.trackFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        <View
          style={[
            styles.thumb,
            {
              left: `${pct * 100}%`,
              backgroundColor: color,
              transform: [{ translateX: -10 }],
            },
          ]}
        />
      </View>
      <View style={styles.sliderRange}>
        <Text style={styles.rangeText}>{min}</Text>
        <Text style={styles.rangeText}>{max}</Text>
      </View>
    </View>
  );
}

function Section({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

const ICON_OPTIONS = ["volume-2", "sun", "zap", "thermometer"] as const;

export default function SlidersScreen() {
  const insets = useSafeAreaInsets();
  const { toggleDrawer } = useDrawer();

  const volume = useSlider(60, 0, 100, TRACK_W!);
  const brightness = useSlider(75, 0, 100, TRACK_W!);
  const speed = useSlider(3, 1, 10, TRACK_W!);
  const red = useSlider(224, 0, 255, TRACK_W!);
  const green = useSlider(49, 0, 255, TRACK_W!);
  const blue = useSlider(49, 0, 255, TRACK_W!);
  const price = useSlider(250, 0, 1000, TRACK_W!);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const rgbColor = `rgb(${red.value},${green.value},${blue.value})`;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={toggleDrawer} style={styles.iconBtn}>
          <Feather name="menu" size={20} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>Sliders</Text>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="x" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 24 }]}
      >
        <Section title="Basic Sliders" />

        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Feather name="volume-2" size={18} color={Colors.textSecondary} />
            <Text style={styles.cardLabel}>Volume</Text>
          </View>
          <SliderTrack {...volume} min={0} max={100} label="" color={Colors.primary} showValue formatValue={(v) => `${v}%`} />
        </View>

        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Feather name="sun" size={18} color="#FAB005" />
            <Text style={styles.cardLabel}>Brightness</Text>
          </View>
          <SliderTrack {...brightness} min={0} max={100} label="" color="#FAB005" showValue formatValue={(v) => `${v}%`} />
        </View>

        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Feather name="zap" size={18} color={Colors.info} />
            <Text style={styles.cardLabel}>Speed</Text>
          </View>
          <SliderTrack {...speed} min={1} max={10} label="" color={Colors.info} showValue />
        </View>

        <Section title="RGB Color Picker" />
        <View style={styles.card}>
          <View style={styles.colorPreviewRow}>
            <View style={[styles.colorSwatch, { backgroundColor: rgbColor }]} />
            <Text style={styles.rgbText}>rgb({red.value}, {green.value}, {blue.value})</Text>
          </View>
          <SliderTrack {...red} min={0} max={255} label="R" color="#FF6B6B" showValue />
          <SliderTrack {...green} min={0} max={255} label="G" color="#40C057" showValue />
          <SliderTrack {...blue} min={0} max={255} label="B" color="#339AF0" showValue />
        </View>

        <Section title="Range Filter" />
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Feather name="dollar-sign" size={18} color={Colors.success} />
            <Text style={styles.cardLabel}>Price Range</Text>
          </View>
          <SliderTrack
            {...price}
            min={0}
            max={1000}
            label=""
            color={Colors.success}
            showValue
            formatValue={(v) => `$${v}`}
          />
          <View style={styles.rangeChips}>
            {[0, 250, 500, 750, 1000].map((v) => (
              <Pressable
                key={v}
                style={[styles.chip, price.value === v && styles.chipActive]}
                onPress={() => {
                  price.setValue(v);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[styles.chipText, price.value === v && styles.chipTextActive]}>
                  ${v}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    flex: 1,
    textAlign: "center",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scroll: { padding: 20, gap: 0 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 24,
    marginBottom: 16,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    gap: 10,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  cardLabel: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  sliderContainer: { gap: 4 },
  sliderLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sliderLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  sliderValue: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  track: {
    height: 6,
    backgroundColor: Colors.cardBgElevated,
    borderRadius: 3,
    position: "relative",
    marginVertical: 8,
    alignSelf: "flex-start",
  },
  trackFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
  },
  thumb: {
    position: "absolute",
    top: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: Colors.darkBg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  sliderRange: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rangeText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  colorPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  rgbText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  rangeChips: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 4,
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBgElevated,
  },
  chipActive: {
    borderColor: Colors.success,
    backgroundColor: "rgba(64,192,87,0.1)",
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  chipTextActive: {
    color: Colors.success,
    fontFamily: "Inter_600SemiBold",
  },
});
