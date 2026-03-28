const primary = "#E03131";
const primaryDark = "#C92A2A";
const primaryDim = "#FF6B6B";
const black = "#0A0A0A";
const darkBg = "#111111";
const cardBg = "#1A1A1A";
const cardBgElevated = "#222222";
const border = "#2A2A2A";
const borderLight = "#333333";
const textPrimary = "#FFFFFF";
const textSecondary = "#A0A0A0";
const textMuted = "#666666";
const success = "#40C057";
const warning = "#FD7E14";
const info = "#339AF0";

export const Colors = {
  primary,
  primaryDark,
  primaryDim,
  black,
  darkBg,
  cardBg,
  cardBgElevated,
  border,
  borderLight,
  textPrimary,
  textSecondary,
  textMuted,
  success,
  warning,
  info,
  categories: {
    "Not started": "#555555",
    "In Progress": "#FD7E14",
    "Done": "#40C057",
    "Backlog": "#339AF0",
    "Cancelled": "#868E96",
  } as Record<string, string>,
};

export default Colors;
