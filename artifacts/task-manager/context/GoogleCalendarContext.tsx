import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from "react";

WebBrowser.maybeCompleteAuthSession();

// ── Constants ─────────────────────────────────────────────────────────────────
const IOS_CLIENT_ID = "282558278089-o57471aniechfolmfsvhbfghiljct4d6.apps.googleusercontent.com";
const SCOPES        = ["openid", "profile", "email", "https://www.googleapis.com/auth/calendar"];
const TOKEN_KEY     = "@hklife_gcal_token";
const EXPIRY_KEY    = "@hklife_gcal_expiry";
const REFRESH_KEY   = "@hklife_gcal_refresh";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GCalendarInfo {
  id: string;
  summary: string;
}

export interface GCalEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end:   { dateTime?: string; date?: string };
  calendarId: string;
  calendarSummary: string;
}

interface GoogleCalendarContextValue {
  isConnected:  boolean;
  isLoading:    boolean;
  signIn:       () => void;
  signOut:      () => Promise<void>;
  fetchCalendars: () => Promise<GCalendarInfo[]>;
  fetchEvents:  (calIds: string[], from: Date, to: Date) => Promise<GCalEvent[]>;
}

// ── Context ───────────────────────────────────────────────────────────────────
const GoogleCalendarContext = createContext<GoogleCalendarContextValue>({
  isConnected:    false,
  isLoading:      true,
  signIn:         () => {},
  signOut:        async () => {},
  fetchCalendars: async () => [],
  fetchEvents:    async () => [],
});

export function useGoogleCalendar() {
  return useContext(GoogleCalendarContext);
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function GoogleCalendarProvider({ children }: { children: React.ReactNode }) {
  const [accessToken,  setAccessToken]  = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: IOS_CLIENT_ID,
    scopes: SCOPES,
  });

  // ── Load persisted token on mount ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedExpiry, storedRefresh] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(EXPIRY_KEY),
          AsyncStorage.getItem(REFRESH_KEY),
        ]);
        if (storedToken && storedExpiry) {
          const expiry = parseInt(storedExpiry, 10);
          if (Date.now() < expiry - 60_000) {
            setAccessToken(storedToken);
            setRefreshToken(storedRefresh);
          } else if (storedRefresh) {
            await refreshAccessToken(storedRefresh);
          }
        }
      } catch {}
      setIsLoading(false);
    })();
  }, []);

  // ── Handle OAuth response ──────────────────────────────────────────────────
  useEffect(() => {
    if (response?.type === "success") {
      const auth = (response as any).authentication;
      if (auth?.accessToken) {
        persistToken(auth.accessToken, auth.expiresIn ?? 3600, auth.refreshToken ?? null);
      }
    }
  }, [response]);

  // ── Token helpers ─────────────────────────────────────────────────────────
  const persistToken = async (token: string, expiresIn: number, refresh: string | null) => {
    const expiry = Date.now() + expiresIn * 1000;
    await AsyncStorage.setItem(TOKEN_KEY,   token);
    await AsyncStorage.setItem(EXPIRY_KEY,  String(expiry));
    if (refresh) await AsyncStorage.setItem(REFRESH_KEY, refresh);
    setAccessToken(token);
    if (refresh) setRefreshToken(refresh);
  };

  const refreshAccessToken = async (refresh: string) => {
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id:     IOS_CLIENT_ID,
          grant_type:    "refresh_token",
          refresh_token: refresh,
        }).toString(),
      });
      const data = await res.json();
      if (data.access_token) {
        await persistToken(data.access_token, data.expires_in ?? 3600, null);
        return data.access_token as string;
      }
    } catch {}
    return null;
  };

  // Ensure a valid token before any API call
  const getValidToken = useCallback(async (): Promise<string | null> => {
    if (!accessToken) return null;
    const stored = await AsyncStorage.getItem(EXPIRY_KEY);
    if (stored && Date.now() >= parseInt(stored, 10) - 60_000) {
      const rt = refreshToken ?? await AsyncStorage.getItem(REFRESH_KEY);
      if (rt) return refreshAccessToken(rt);
      setAccessToken(null);
      return null;
    }
    return accessToken;
  }, [accessToken, refreshToken]);

  // ── Public actions ─────────────────────────────────────────────────────────
  const signIn  = useCallback(() => { promptAsync(); }, [promptAsync]);

  const signOut = useCallback(async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, EXPIRY_KEY, REFRESH_KEY]);
    setAccessToken(null);
    setRefreshToken(null);
  }, []);

  // ── Google Calendar API helpers ───────────────────────────────────────────
  const fetchCalendars = useCallback(async (): Promise<GCalendarInfo[]> => {
    const token = await getValidToken();
    if (!token) return [];
    try {
      const res  = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { if (res.status === 401) setAccessToken(null); return []; }
      const data = await res.json();
      return (data.items ?? []).map((c: any) => ({ id: c.id, summary: c.summary ?? "" }));
    } catch { return []; }
  }, [getValidToken]);

  const fetchEvents = useCallback(async (
    calIds: string[], from: Date, to: Date,
  ): Promise<GCalEvent[]> => {
    const token = await getValidToken();
    if (!token || !calIds.length) return [];

    const timeMin = from.toISOString();
    const timeMax = to.toISOString();

    const results = await Promise.all(
      calIds.map(async (calId) => {
        try {
          const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?` +
            new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
          const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) { if (res.status === 401) setAccessToken(null); return []; }
          const data = await res.json();
          const summary = (data.summary ?? calId) as string;
          return (data.items ?? []).map((ev: any) => ({
            id:              ev.id,
            summary:         ev.summary ?? "",
            start:           ev.start,
            end:             ev.end,
            calendarId:      calId,
            calendarSummary: summary,
          } as GCalEvent));
        } catch { return []; }
      }),
    );
    return results.flat();
  }, [getValidToken]);

  return (
    <GoogleCalendarContext.Provider value={{
      isConnected: !!accessToken,
      isLoading,
      signIn,
      signOut,
      fetchCalendars,
      fetchEvents,
    }}>
      {children}
    </GoogleCalendarContext.Provider>
  );
}
