import { syncRecordToBackend } from "./device-backend";

export type ContinueMediaType = "movie" | "tv";

export interface ContinueWatchingEntry {
  mediaId: number;
  type: ContinueMediaType;
  title: string;
  posterPath: string | null;
  season?: number | undefined;
  episode?: number | undefined;
  watchedSeconds?: number | undefined;
  durationSeconds?: number | undefined;
  lastWatchedAt: number;
}

const STORAGE_KEY = "bujuu_continue_watching";
const MAX_ENTRIES = 20;

export function readContinueWatching(): ContinueWatchingEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is ContinueWatchingEntry =>
        Boolean(
          entry &&
          typeof entry.mediaId === "number" &&
          (entry.type === "movie" || entry.type === "tv") &&
          typeof entry.title === "string" &&
          typeof entry.lastWatchedAt === "number",
        ),
      )
      .sort((a, b) => b.lastWatchedAt - a.lastWatchedAt)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function saveContinueWatching(
  entry: Omit<ContinueWatchingEntry, "lastWatchedAt">,
): ContinueWatchingEntry[] {
  const next: ContinueWatchingEntry = { ...entry, lastWatchedAt: Date.now() };
  const list = [
    next,
    ...readContinueWatching().filter((item) => item.mediaId !== entry.mediaId),
  ].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("bujuu:continue-watching", { detail: list }));
  } catch {
    // Local storage can be unavailable in private browsing contexts.
  }

  // Sync to backend device library
  void syncRecordToBackend({
    tmdbId: entry.mediaId,
    mediaType: entry.type,
    itemKind: "continue_watching",
    title: entry.title,
    posterPath: entry.posterPath,
    season: entry.season,
    episode: entry.episode,
    progressSeconds: entry.watchedSeconds ?? 0,
    durationSeconds: entry.durationSeconds ?? null,
  });

  return list;
}
