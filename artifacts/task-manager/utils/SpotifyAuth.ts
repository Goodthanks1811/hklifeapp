import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

const APP_SCHEME   = process.env.APP_VARIANT === "development" ? "hk-life-app-dev" : "hk-life-app";
const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: APP_SCHEME, path: "spotify-callback" });
const SCOPES       = [
  "user-read-private",
  "user-read-email",
  "playlist-read-private",
  "playlist-read-collaborative",
  "app-remote-control",
  "streaming",
];

const DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.spotify.com/authorize",
  tokenEndpoint:         "https://accounts.spotify.com/api/token",
};

const STORAGE_ACCESS_TOKEN  = "spotify_access_token";
const STORAGE_REFRESH_TOKEN = "spotify_refresh_token";
const STORAGE_EXPIRES_AT    = "spotify_expires_at";
export const STORAGE_CLIENT_ID       = "spotify_client_id";

// ── Client ID (read from Settings at runtime, env var as fallback) ─────────────
export async function getSpotifyClientId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_CLIENT_ID);
    if (stored?.trim()) return stored.trim();
  } catch {}
  return process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? "";
}

// ── Token storage ─────────────────────────────────────────────────────────────

export async function getStoredTokens(): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const [at, rt, expiresAt] = await Promise.all([
      AsyncStorage.getItem(STORAGE_ACCESS_TOKEN),
      AsyncStorage.getItem(STORAGE_REFRESH_TOKEN),
      AsyncStorage.getItem(STORAGE_EXPIRES_AT),
    ]);
    if (!at || !rt) return null;

    const exp = expiresAt ? parseInt(expiresAt, 10) : 0;
    if (Date.now() < exp - 60_000) {
      return { accessToken: at, refreshToken: rt };
    }
    return refreshAccessToken(rt);
  } catch {
    return null;
  }
}

async function storeTokens(accessToken: string, refreshToken: string, expiresIn: number) {
  const expiresAt = Date.now() + expiresIn * 1000;
  await Promise.all([
    AsyncStorage.setItem(STORAGE_ACCESS_TOKEN,  accessToken),
    AsyncStorage.setItem(STORAGE_REFRESH_TOKEN, refreshToken),
    AsyncStorage.setItem(STORAGE_EXPIRES_AT,    String(expiresAt)),
  ]);
}

export async function clearStoredTokens() {
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_ACCESS_TOKEN),
    AsyncStorage.removeItem(STORAGE_REFRESH_TOKEN),
    AsyncStorage.removeItem(STORAGE_EXPIRES_AT),
  ]);
}

// ── Token refresh ─────────────────────────────────────────────────────────────

// Forces a token refresh regardless of the stored expiry timestamp.
// Use this when the server returns 403/401 but the token appears valid locally —
// Spotify can revoke or invalidate tokens without changing the expiry claim.
export async function forceRefreshTokens(): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const rt = await AsyncStorage.getItem(STORAGE_REFRESH_TOKEN);
    if (!rt) return null;
    return refreshAccessToken(rt);
  } catch {
    return null;
  }
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const clientId = await getSpotifyClientId();
    const body = new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
      client_id:     clientId,
    });
    const res = await fetch(DISCOVERY.tokenEndpoint!, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
    });
    if (!res.ok) return null;
    const json       = await res.json();
    const newRefresh = json.refresh_token ?? refreshToken;
    await storeTokens(json.access_token, newRefresh, json.expires_in ?? 3600);
    return { accessToken: json.access_token, refreshToken: newRefresh };
  } catch {
    return null;
  }
}

// ── OAuth PKCE flow via expo-auth-session ─────────────────────────────────────

export type SpotifyAuthResult =
  | { type: "success"; accessToken: string; refreshToken: string }
  | { type: "error";   error: string }
  | { type: "dismiss" };

export async function authenticateSpotify(): Promise<SpotifyAuthResult> {
  const clientId = await getSpotifyClientId();
  if (!clientId) {
    return { type: "error", error: "Spotify Client ID not set. Add it in Settings → Music → Spotify." };
  }

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes:      SCOPES,
    redirectUri: REDIRECT_URI,
    usePKCE:     true,
  });

  await request.makeAuthUrlAsync(DISCOVERY);

  const result = await request.promptAsync(DISCOVERY);

  if (result.type === "dismiss" || result.type === "cancel") {
    return { type: "dismiss" };
  }

  if (result.type === "error") {
    return { type: "error", error: result.error?.description ?? "Authentication error" };
  }

  if (result.type !== "success" || !result.params.code) {
    return { type: "error", error: "No authorization code returned" };
  }

  return exchangeCode(result.params.code, request.codeVerifier ?? "", clientId);
}

async function exchangeCode(code: string, verifier: string, clientId: string): Promise<SpotifyAuthResult> {
  try {
    const body = new URLSearchParams({
      grant_type:    "authorization_code",
      code,
      redirect_uri:  REDIRECT_URI,
      client_id:     clientId,
      code_verifier: verifier,
    });
    const res = await fetch(DISCOVERY.tokenEndpoint!, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
    });
    if (!res.ok) {
      const err = await res.text();
      return { type: "error", error: err };
    }
    const json = await res.json();
    await storeTokens(json.access_token, json.refresh_token, json.expires_in ?? 3600);
    return { type: "success", accessToken: json.access_token, refreshToken: json.refresh_token };
  } catch (e: any) {
    return { type: "error", error: e?.message ?? String(e) };
  }
}
