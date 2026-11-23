import { supabase } from "@/integrations/supabase/client";

const DEVICE_STORAGE_KEY = "bujuu_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server-client";
  let id = window.localStorage.getItem(DEVICE_STORAGE_KEY);
  if (!id) {
    id = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try {
      window.localStorage.setItem(DEVICE_STORAGE_KEY, id);
    } catch {
      // Local storage can be unavailable in private browsing contexts.
    }
  }
  return id;
}

async function ensureAnonymousIdentity(): Promise<string | null> {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) return null;
    if (sessionData.session?.user.id) return sessionData.session.user.id;
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.warn(
        "Anonymous backend sync is unavailable until anonymous sign-in is enabled.",
        error.message,
      );
      return null;
    }
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export interface DeviceRecord {
  id?: string | undefined;
  deviceId?: string | undefined;
  tmdb_id?: number | undefined;
  media_type?: "movie" | "tv" | undefined;
  poster_path?: string | null | undefined;
  backdrop_path?: string | null | undefined;
  updated_at?: string | undefined;
  tmdbId: number;
  mediaType: "movie" | "tv";
  itemKind: "watchlist" | "continue_watching" | "history";
  title: string;
  posterPath?: string | null | undefined;
  backdropPath?: string | null | undefined;
  season?: number | undefined;
  episode?: number | undefined;
  progressSeconds?: number | undefined;
  durationSeconds?: number | null | undefined;
  updatedAt?: string | undefined;
}

export async function syncRecordToBackend(record: DeviceRecord): Promise<void> {
  try {
    const ownerId = await ensureAnonymousIdentity();
    if (!ownerId) return;
    const payload = {
      owner_id: ownerId,
      device_id: getDeviceId(),
      tmdb_id: record.tmdbId,
      media_type: record.mediaType,
      item_kind: record.itemKind,
      title: record.title,
      poster_path: record.posterPath ?? null,
      backdrop_path: record.backdropPath ?? null,
      season: record.season ?? 1,
      episode: record.episode ?? 1,
      progress_seconds: record.progressSeconds ?? 0,
      duration_seconds: record.durationSeconds ?? null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("device_library")
      .upsert(payload, { onConflict: "owner_id,tmdb_id,media_type,item_kind" });
    if (error) console.warn("Backend device library sync info:", error.message);
  } catch (e) {
    console.warn("Backend device library sync skipped:", e);
  }
}

export async function deleteRecordFromBackend(
  tmdbId: number,
  mediaType: "movie" | "tv",
  itemKind: "watchlist" | "continue_watching" | "history",
): Promise<void> {
  try {
    const ownerId = await ensureAnonymousIdentity();
    if (!ownerId) return;
    await supabase
      .from("device_library")
      .delete()
      .match({ owner_id: ownerId, tmdb_id: tmdbId, media_type: mediaType, item_kind: itemKind });
  } catch {
    // Backend delete is best-effort; local state remains available.
  }
}

export async function deleteAllRecordsFromBackend(
  itemKind: "watchlist" | "continue_watching" | "history",
): Promise<void> {
  try {
    const ownerId = await ensureAnonymousIdentity();
    if (!ownerId) return;
    await supabase
      .from("device_library")
      .delete()
      .match({ owner_id: ownerId, item_kind: itemKind });
  } catch {
    // Backend cleanup is best-effort; local history can still be cleared.
  }
}

export async function fetchRecordsFromBackend(
  itemKind: "watchlist" | "continue_watching" | "history",
): Promise<DeviceRecord[]> {
  try {
    const ownerId = await ensureAnonymousIdentity();
    if (!ownerId) return [];
    const { data, error } = await supabase
      .from("device_library")
      .select("*")
      .eq("owner_id", ownerId)
      .eq("item_kind", itemKind)
      .order("updated_at", { ascending: false });
    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id,
      deviceId: r.device_id,
      tmdb_id: r.tmdb_id,
      media_type: r.media_type as "movie" | "tv",
      itemKind: r.item_kind as DeviceRecord["itemKind"],
      title: r.title,
      poster_path: r.poster_path,
      backdrop_path: r.backdrop_path,
      season: r.season ?? undefined,
      episode: r.episode ?? undefined,
      progressSeconds: r.progress_seconds ?? undefined,
      durationSeconds: r.duration_seconds,
      updated_at: r.updated_at,
      tmdbId: r.tmdb_id,
      mediaType: r.media_type as "movie" | "tv",
      posterPath: r.poster_path,
      backdropPath: r.backdrop_path,
      updatedAt: r.updated_at,
    }));
  } catch {
    return [];
  }
}
