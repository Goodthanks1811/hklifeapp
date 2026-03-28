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

export type SectionKey = "reports" | "life" | "apps" | "footy" | "tools" | "knowledge" | "uikit";

export const SECTION_LABELS: Record<SectionKey, string> = {
  reports:   "Reports",
  life:      "Life",
  apps:      "Apps",
  footy:     "Footy",
  tools:     "Tools",
  knowledge: "Knowledge",
  uikit:     "UI Kit",
};

export const SECTION_ORDER: SectionKey[] = [
  "reports", "life", "apps", "footy", "tools", "knowledge", "uikit",
];

export const ALL_ITEMS: Record<SectionKey, MenuItem[]> = {
  life: [
    { label: "Life Admin",  icon: "clipboard",   route: "/life/life-admin",  description: "Tasks & life admin"   },
    { label: "Investigate", icon: "search",       route: "/life/investigate", description: "Things to look into" },
    { label: "To Buy",      icon: "shopping-bag", route: "/life/to-buy",      description: "Shopping list"        },
    { label: "Music",       icon: "music",        route: "/life/music",       description: "Songs & playlists"    },
    { label: "Reference",   icon: "bookmark",     route: "/life/reference",   description: "Reference items"      },
    { label: "To Read",     icon: "book-open",    route: "/life/to-read",     description: "Reading list"         },
  ],
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

// Flat lookup: label → canonical section
export function findItemCanonicalSection(label: string): SectionKey | null {
  for (const key of SECTION_ORDER) {
    if (ALL_ITEMS[key].some((i) => i.label === label)) return key;
  }
  return null;
}

// Flat lookup: label → MenuItem (wherever it canonically lives)
export function findItem(label: string): MenuItem | null {
  for (const key of SECTION_ORDER) {
    const found = ALL_ITEMS[key].find((i) => i.label === label);
    if (found) return found;
  }
  return null;
}

// ── Storage types ─────────────────────────────────────────────────────────────
type SectionConfig = {
  order:  string[];
  hidden: string[];
};

type DrawerConfig = Partial<Record<SectionKey, SectionConfig>> & {
  sectionOrder?:   SectionKey[];
  hiddenSections?: SectionKey[];
  movedItems?:     Record<string, SectionKey>; // label → destination section (override)
};

const STORAGE_KEY = "drawer_config_v1";

// ── Context ───────────────────────────────────────────────────────────────────
interface DrawerConfigCtx {
  ready:              boolean;
  getSectionOrder:    () => SectionKey[];
  isSectionHidden:    (key: SectionKey) => boolean;
  toggleSectionHidden:(key: SectionKey) => void;
  getAllItems:         (key: SectionKey) => MenuItem[];
  getVisible:         (key: SectionKey) => MenuItem[];
  isHidden:           (key: SectionKey, label: string) => boolean;
  toggleHidden:       (key: SectionKey, label: string) => void;
  moveUp:             (key: SectionKey, label: string) => void;
  moveDown:           (key: SectionKey, label: string) => void;
  moveSectionUp:      (key: SectionKey) => void;
  moveSectionDown:    (key: SectionKey) => void;
  moveItemToSection:  (fromSection: SectionKey, label: string, toSection: SectionKey) => void;
}

const DrawerConfigContext = createContext<DrawerConfigCtx>({
  ready:               false,
  getSectionOrder:     () => SECTION_ORDER,
  isSectionHidden:     () => false,
  toggleSectionHidden: () => {},
  getAllItems:          (k) => ALL_ITEMS[k],
  getVisible:          (k) => ALL_ITEMS[k],
  isHidden:            () => false,
  toggleHidden:        () => {},
  moveUp:              () => {},
  moveDown:            () => {},
  moveSectionUp:       () => {},
  moveSectionDown:     () => {},
  moveItemToSection:   () => {},
});

// ── Helper: apply saved order, appending unseen items at end ──────────────────
function resolveOrder(allItems: MenuItem[], cfg: SectionConfig | undefined): MenuItem[] {
  if (!cfg) return allItems;
  const out: MenuItem[] = [];
  const seen = new Set<string>();
  for (const label of cfg.order) {
    const item = allItems.find((i) => i.label === label);
    if (item) { out.push(item); seen.add(label); }
  }
  for (const item of allItems) {
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
      if (raw) { try { setConfig(JSON.parse(raw)); } catch {} }
      setReady(true);
    });
  }, []);

  const persist = useCallback((next: DrawerConfig) => {
    setConfig(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const getSectionConfig = useCallback((key: SectionKey): SectionConfig => {
    return config[key] ?? { order: ALL_ITEMS[key].map((i) => i.label), hidden: [] };
  }, [config]);

  // ── Section visibility ──────────────────────────────────────────────────────
  const getSectionOrder = useCallback((): SectionKey[] => {
    const saved = config.sectionOrder;
    if (!saved) return SECTION_ORDER;
    const seen  = new Set(saved);
    const extra = SECTION_ORDER.filter((k) => !seen.has(k));
    return [...saved, ...extra];
  }, [config]);

  const isSectionHidden = useCallback((key: SectionKey): boolean => {
    return (config.hiddenSections ?? []).includes(key);
  }, [config]);

  const toggleSectionHidden = useCallback((key: SectionKey) => {
    const current = config.hiddenSections ?? [];
    const already = current.includes(key);
    const next    = already ? current.filter((k) => k !== key) : [...current, key];
    persist({ ...config, hiddenSections: next });
  }, [config, persist]);

  // ── Items per section (respecting cross-section moves) ─────────────────────
  const getAllItems = useCallback((key: SectionKey): MenuItem[] => {
    const movedItems = config.movedItems ?? {};

    // Canonical items not moved away from this section
    const canonical = ALL_ITEMS[key].filter((item) => {
      const dest = movedItems[item.label];
      return dest === undefined || dest === key;
    });

    // Items from other sections moved HERE
    const immigrated: MenuItem[] = [];
    for (const origKey of SECTION_ORDER) {
      if (origKey === key) continue;
      for (const item of ALL_ITEMS[origKey]) {
        if (movedItems[item.label] === key) immigrated.push(item);
      }
    }

    return resolveOrder([...canonical, ...immigrated], config[key]);
  }, [config]);

  const getVisible = useCallback((key: SectionKey): MenuItem[] => {
    const hiddenSet = new Set(getSectionConfig(key).hidden);
    return getAllItems(key).filter((item) => !hiddenSet.has(item.label));
  }, [config, getAllItems, getSectionConfig]);

  // ── Item visibility ─────────────────────────────────────────────────────────
  const isHidden = useCallback((key: SectionKey, label: string): boolean => {
    return getSectionConfig(key).hidden.includes(label);
  }, [getSectionConfig]);

  const toggleHidden = useCallback((key: SectionKey, label: string) => {
    const cfg    = getSectionConfig(key);
    const already = cfg.hidden.includes(label);
    const nextHidden = already
      ? cfg.hidden.filter((l) => l !== label)
      : [...cfg.hidden, label];
    persist({ ...config, [key]: { ...cfg, hidden: nextHidden } });
  }, [config, getSectionConfig, persist]);

  // ── Item reorder within section ─────────────────────────────────────────────
  const moveUp = useCallback((key: SectionKey, label: string) => {
    const ordered = getAllItems(key);
    const idx     = ordered.findIndex((i) => i.label === label);
    if (idx <= 0) return;
    const next = [...ordered];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    const cfg = getSectionConfig(key);
    persist({ ...config, [key]: { ...cfg, order: next.map((i) => i.label) } });
  }, [config, getAllItems, getSectionConfig, persist]);

  const moveDown = useCallback((key: SectionKey, label: string) => {
    const ordered = getAllItems(key);
    const idx     = ordered.findIndex((i) => i.label === label);
    if (idx < 0 || idx >= ordered.length - 1) return;
    const next = [...ordered];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    const cfg = getSectionConfig(key);
    persist({ ...config, [key]: { ...cfg, order: next.map((i) => i.label) } });
  }, [config, getAllItems, getSectionConfig, persist]);

  // ── Section reorder ─────────────────────────────────────────────────────────
  const getSectionOrderFn = getSectionOrder; // alias to avoid lint confusion

  const moveSectionUp = useCallback((key: SectionKey) => {
    const order = getSectionOrderFn();
    const idx   = order.indexOf(key);
    if (idx <= 0) return;
    const next = [...order];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    persist({ ...config, sectionOrder: next });
  }, [config, getSectionOrderFn, persist]);

  const moveSectionDown = useCallback((key: SectionKey) => {
    const order = getSectionOrderFn();
    const idx   = order.indexOf(key);
    if (idx < 0 || idx >= order.length - 1) return;
    const next = [...order];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    persist({ ...config, sectionOrder: next });
  }, [config, getSectionOrderFn, persist]);

  // ── Move item to a different section ────────────────────────────────────────
  const moveItemToSection = useCallback(
    (fromSection: SectionKey, label: string, toSection: SectionKey) => {
      if (fromSection === toSection) return;

      const movedItems     = { ...(config.movedItems ?? {}) };
      const originalSection = findItemCanonicalSection(label) ?? fromSection;

      // If moving back to canonical home, remove the override
      if (toSection === originalSection) {
        delete movedItems[label];
      } else {
        movedItems[label] = toSection;
      }

      // Remove label from fromSection's order & hidden lists
      const fromCfg   = getSectionConfig(fromSection);
      const newFrom   = {
        order:  fromCfg.order.filter((l) => l !== label),
        hidden: fromCfg.hidden.filter((l) => l !== label),
      };

      // Append label to toSection's order (if not already there)
      const toCfg   = getSectionConfig(toSection);
      const newTo   = {
        ...toCfg,
        order: toCfg.order.includes(label) ? toCfg.order : [...toCfg.order, label],
      };

      persist({
        ...config,
        movedItems,
        [fromSection]: newFrom,
        [toSection]:   newTo,
      });
    },
    [config, getSectionConfig, persist],
  );

  return (
    <DrawerConfigContext.Provider value={{
      ready,
      getSectionOrder,
      isSectionHidden,
      toggleSectionHidden,
      getAllItems,
      getVisible,
      isHidden,
      toggleHidden,
      moveUp,
      moveDown,
      moveSectionUp,
      moveSectionDown,
      moveItemToSection,
    }}>
      {children}
    </DrawerConfigContext.Provider>
  );
}

export function useDrawerConfig() {
  return useContext(DrawerConfigContext);
}
