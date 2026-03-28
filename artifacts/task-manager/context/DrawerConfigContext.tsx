import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ── Menu data (single source of truth) ────────────────────────────────────────
export type MenuItem = {
  label:       string;
  icon:        string;
  route:       string | null;
  description: string;
};

export type SectionKey = "reports" | "apps" | "footy" | "tools" | "knowledge" | "uikit";

export const SECTION_LABELS: Record<SectionKey, string> = {
  reports:   "Reports",
  apps:      "Apps",
  footy:     "Footy",
  tools:     "Tools",
  knowledge: "Knowledge",
  uikit:     "UI Kit",
};

export const SECTION_ORDER: SectionKey[] = [
  "reports", "apps", "footy", "tools", "knowledge", "uikit",
];

export const ALL_ITEMS: Record<SectionKey, MenuItem[]> = {
  reports: [
    { label: "Mood Report",   icon: "activity",  route: "/mood-report",  description: "Monthly mood charts" },
    { label: "My Workload",   icon: "bar-chart", route: "/my-workload",  description: "Created vs done"     },
    { label: "March Sleep",   icon: "moon",      route: "/march-sleep",  description: "Feb 28 – Mar 27"    },
    { label: "Review Digest", icon: "file-text", route: null,            description: "Coming soon"         },
  ],
  apps: [
    { label: "Mi Nena", icon: "heart", route: "/mi-nena", description: "Photo & video gallery" },
  ],
  footy: [
    { label: "Schedule", icon: "calendar", route: "/nrl-schedule", description: "NRL fixtures & ladder" },
  ],
  tools: [
    { label: "IR Quick Add",   icon: "zap",         route: "/ir-quick-add",   description: "Add to Notion DB"        },
    { label: "HK Quick Add",   icon: "plus-circle", route: "/hk-quick-add",   description: "HK Automation task add"  },
    { label: "Life Quick Add", icon: "sun",         route: "/life-quick-add", description: "Life tasks to Notion"    },
    { label: "Photo Slider",   icon: "image",       route: "/photo-slider",   description: "Compare & export photos" },
  ],
  knowledge: [
    { label: "Coming soon", icon: "clock", route: null, description: "In development" },
  ],
  uikit: [
    { label: "Buttons",        icon: "square",  route: "/ui-kit/buttons", description: "Styles & states"   },
    { label: "Sliders",        icon: "sliders", route: "/ui-kit/sliders", description: "Custom controls"   },
    { label: "Drag & Reorder", icon: "list",    route: "/ui-kit/reorder", description: "Hold to drag"      },
    { label: "Loaders",        icon: "loader",  route: "/ui-kit/loaders", description: "Save states"       },
    { label: "Modals",         icon: "layers",  route: "/ui-kit/modals",  description: "Overlays & alerts" },
  ],
};

// ── Storage types ─────────────────────────────────────────────────────────────
type SectionConfig = {
  order:  string[];
  hidden: string[];
};

type DrawerConfig = Partial<Record<SectionKey, SectionConfig>>;

const STORAGE_KEY = "drawer_config_v1";

// ── Context ───────────────────────────────────────────────────────────────────
interface DrawerConfigCtx {
  ready:        boolean;
  getAllItems:   (key: SectionKey) => MenuItem[];
  getVisible:   (key: SectionKey) => MenuItem[];
  isHidden:     (key: SectionKey, label: string) => boolean;
  toggleHidden: (key: SectionKey, label: string) => void;
  moveUp:       (key: SectionKey, label: string) => void;
  moveDown:     (key: SectionKey, label: string) => void;
}

const DrawerConfigContext = createContext<DrawerConfigCtx>({
  ready:        false,
  getAllItems:   (k) => ALL_ITEMS[k],
  getVisible:   (k) => ALL_ITEMS[k],
  isHidden:     () => false,
  toggleHidden: () => {},
  moveUp:       () => {},
  moveDown:     () => {},
});

// ── Helper: get items in saved order, appending any new canonical items ────────
function resolveOrder(canonical: MenuItem[], cfg: SectionConfig | undefined): MenuItem[] {
  if (!cfg) return canonical;
  const out: MenuItem[] = [];
  const seen = new Set<string>();
  for (const label of cfg.order) {
    const item = canonical.find((i) => i.label === label);
    if (item) { out.push(item); seen.add(label); }
  }
  for (const item of canonical) {
    if (!seen.has(item.label)) out.push(item);
  }
  return out;
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function DrawerConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<DrawerConfig>({});
  const [ready,  setReady]  = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setConfig(JSON.parse(raw)); } catch {}
      }
      setReady(true);
    });
  }, []);

  const persist = useCallback((next: DrawerConfig) => {
    setConfig(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const getSectionConfig = useCallback((key: SectionKey): SectionConfig => {
    if (config[key]) return config[key]!;
    return { order: ALL_ITEMS[key].map((i) => i.label), hidden: [] };
  }, [config]);

  const getAllItems = useCallback((key: SectionKey): MenuItem[] => {
    return resolveOrder(ALL_ITEMS[key], config[key]);
  }, [config]);

  const getVisible = useCallback((key: SectionKey): MenuItem[] => {
    const ordered = resolveOrder(ALL_ITEMS[key], config[key]);
    const cfg     = getSectionConfig(key);
    const hiddenSet = new Set(cfg.hidden);
    return ordered.filter((item) => !hiddenSet.has(item.label));
  }, [config, getSectionConfig]);

  const isHidden = useCallback((key: SectionKey, label: string): boolean => {
    return getSectionConfig(key).hidden.includes(label);
  }, [getSectionConfig]);

  const toggleHidden = useCallback((key: SectionKey, label: string) => {
    const cfg = getSectionConfig(key);
    const already = cfg.hidden.includes(label);
    const nextHidden = already
      ? cfg.hidden.filter((l) => l !== label)
      : [...cfg.hidden, label];
    persist({ ...config, [key]: { ...cfg, hidden: nextHidden } });
  }, [config, getSectionConfig, persist]);

  const moveUp = useCallback((key: SectionKey, label: string) => {
    const ordered = getAllItems(key);
    const idx = ordered.findIndex((i) => i.label === label);
    if (idx <= 0) return;
    const next = [...ordered];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    const cfg = getSectionConfig(key);
    persist({ ...config, [key]: { ...cfg, order: next.map((i) => i.label) } });
  }, [config, getAllItems, getSectionConfig, persist]);

  const moveDown = useCallback((key: SectionKey, label: string) => {
    const ordered = getAllItems(key);
    const idx = ordered.findIndex((i) => i.label === label);
    if (idx < 0 || idx >= ordered.length - 1) return;
    const next = [...ordered];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    const cfg = getSectionConfig(key);
    persist({ ...config, [key]: { ...cfg, order: next.map((i) => i.label) } });
  }, [config, getAllItems, getSectionConfig, persist]);

  return (
    <DrawerConfigContext.Provider value={{
      ready, getAllItems, getVisible, isHidden, toggleHidden, moveUp, moveDown,
    }}>
      {children}
    </DrawerConfigContext.Provider>
  );
}

export function useDrawerConfig() {
  return useContext(DrawerConfigContext);
}
