import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "anthropic_api_key";

interface AnthropicContextType {
  apiKey:    string | null;
  setApiKey: (key: string) => Promise<void>;
  clearKey:  () => Promise<void>;
}

const AnthropicContext = createContext<AnthropicContextType | null>(null);

export function AnthropicProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => { if (v) setApiKeyState(v); }).catch(() => {});
  }, []);

  const setApiKey = useCallback(async (key: string) => {
    await AsyncStorage.setItem(STORAGE_KEY, key);
    setApiKeyState(key);
  }, []);

  const clearKey = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setApiKeyState(null);
  }, []);

  return (
    <AnthropicContext.Provider value={{ apiKey, setApiKey, clearKey }}>
      {children}
    </AnthropicContext.Provider>
  );
}

export function useAnthropic() {
  const ctx = useContext(AnthropicContext);
  if (!ctx) throw new Error("useAnthropic must be used inside AnthropicProvider");
  return ctx;
}
