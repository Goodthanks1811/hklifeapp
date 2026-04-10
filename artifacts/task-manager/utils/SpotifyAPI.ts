import { getStoredTokens, refreshAccessToken, clearStoredTokens } from "./SpotifyAuth";

export type SpotifyPlaylist = {
  id:         string;
  name:       string;
  trackCount: number;
  imageUrl:   string | null;
};

export type SpotifyTrack = {
  id:         string;
  uri:        string;
  title:      string;
  artist:     string;
  durationMs: number;
};

async function getToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  return tokens?.accessToken ?? null;
}

async function apiFetch(path: string, retried = false): Promise<any> {
  const token = await getToken();
  if (!token) throw new Error("not_authenticated");

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 && !retried) {
    const { refreshToken } = (await getStoredTokens()) ?? {};
    if (!refreshToken) { await clearStoredTokens(); throw new Error("not_authenticated"); }
    const refreshed = await refreshAccessToken(refreshToken);
    if (!refreshed) { await clearStoredTokens(); throw new Error("not_authenticated"); }
    return apiFetch(path, true);
  }

  if (!res.ok) throw new Error(`spotify_api_error:${res.status}`);
  return res.json();
}

export async function getUserPlaylists(): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = [];
  let url: string | null = "/me/playlists?limit=50";

  while (url) {
    const path = url.startsWith("/") ? url : url.replace("https://api.spotify.com/v1", "");
    const data = await apiFetch(path);
    for (const item of data.items ?? []) {
      if (!item) continue;
      playlists.push({
        id:         item.id,
        name:       item.name,
        trackCount: item.tracks?.total ?? 0,
        imageUrl:   item.images?.[0]?.url ?? null,
      });
    }
    url = data.next ?? null;
    if (url) url = url.replace("https://api.spotify.com/v1", "");
  }

  return playlists;
}

export async function getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  let url: string | null = `/playlists/${playlistId}/tracks?limit=100&fields=next,items(track(id,uri,name,duration_ms,artists))`;

  while (url) {
    const path = url.startsWith("/") ? url : url.replace("https://api.spotify.com/v1", "");
    const data = await apiFetch(path);
    for (const item of data.items ?? []) {
      const t = item?.track;
      if (!t || !t.id) continue;
      tracks.push({
        id:         t.id,
        uri:        t.uri,
        title:      t.name ?? "Unknown",
        artist:     (t.artists ?? []).map((a: any) => a.name).filter(Boolean).join(", "),
        durationMs: t.duration_ms ?? 0,
      });
    }
    url = data.next ?? null;
    if (url) url = url.replace("https://api.spotify.com/v1", "");
  }

  return tracks;
}
