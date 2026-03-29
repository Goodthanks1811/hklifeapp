import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const KEY = "@hk_header_image_v1";

export type ResizeMode = "cover" | "contain" | "center" | "stretch";

interface State {
  uri:        string | null;
  resizeMode: ResizeMode;
  offsetX:    number;
  offsetY:    number;
}

interface Ctx extends State {
  update: (partial: Partial<State>) => void;
  clear:  () => void;
}

const DEFAULT: State = { uri: null, resizeMode: "cover", offsetX: 0, offsetY: 0 };

const HeaderImageCtx = createContext<Ctx>({ ...DEFAULT, update: () => {}, clear: () => {} });

export function HeaderImageProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(DEFAULT);
  const stateRef          = useRef(state);
  stateRef.current        = state;

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(raw => { if (raw) setState({ ...DEFAULT, ...JSON.parse(raw) }); })
      .catch(() => {});
  }, []);

  const update = useCallback((partial: Partial<State>) => {
    const next = { ...stateRef.current, ...partial };
    setState(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const clear = useCallback(() => {
    const next = { ...DEFAULT };
    setState(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  return (
    <HeaderImageCtx.Provider value={{ ...state, update, clear }}>
      {children}
    </HeaderImageCtx.Provider>
  );
}

export function useHeaderImage() {
  return useContext(HeaderImageCtx);
}
