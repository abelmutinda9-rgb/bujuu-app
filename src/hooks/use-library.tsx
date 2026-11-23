import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { readContinueWatching, saveContinueWatching } from "@/lib/history";
import {
  deleteAllRecordsFromBackend,
  deleteRecordFromBackend,
  fetchRecordsFromBackend,
  syncRecordToBackend,
} from "@/lib/device-backend";
import type { MediaItem } from "@/services/tmdb";

export interface WatchlistItem {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  created_at: string;
}

const WATCHLIST_STORAGE_KEY = "bujuu_watchlist";

function readLocalWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalWatchlist(list: WatchlistItem[]): void {
  try {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Local storage can be unavailable in private browsing contexts.
  }
}

export function useMyList() {
  return useQuery({
    queryKey: ["library", "mylist"],
    queryFn: async (): Promise<WatchlistItem[]> => {
      const local = readLocalWatchlist();
      // Attempt backend merge
      try {
        const backendRecords = await fetchRecordsFromBackend("watchlist");
        if (backendRecords && backendRecords.length > 0) {
          const map = new Map<string, WatchlistItem>();
          local.forEach((item) => map.set(`${item.media_type}_${item.tmdb_id}`, item));
          backendRecords.forEach((r) => {
            const key = `${r.media_type}_${r.tmdb_id}`;
            if (!map.has(key)) {
              map.set(key, {
                tmdb_id: r.tmdb_id!,
                media_type: r.media_type!,
                title: r.title,
                poster_path: r.poster_path ?? null,
                backdrop_path: r.backdrop_path ?? null,
                created_at: r.updated_at ?? new Date().toISOString(),
              });
            }
          });
          const merged = Array.from(map.values());
          writeLocalWatchlist(merged);
          return merged;
        }
      } catch {
        // Keep locally saved items available if the backend is unavailable.
      }
      return local;
    },
    staleTime: 1000 * 5,
  });
}

export function useMyListToggle(item: MediaItem | undefined) {
  const list = useMyList();
  const qc = useQueryClient();
  const inList = Boolean(
    item && list.data?.some((r) => r.tmdb_id === item.id && r.media_type === item.mediaType),
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!item) return { inList: false };
      const current = readLocalWatchlist();
      const exists = current.some((r) => r.tmdb_id === item.id && r.media_type === item.mediaType);

      if (!exists) {
        const newItem: WatchlistItem = {
          tmdb_id: item.id,
          media_type: item.mediaType,
          title: item.title,
          poster_path: item.posterPath,
          backdrop_path: item.backdropPath,
          created_at: new Date().toISOString(),
        };
        writeLocalWatchlist([newItem, ...current]);
        void syncRecordToBackend({
          tmdbId: item.id,
          mediaType: item.mediaType,
          itemKind: "watchlist",
          title: item.title,
          posterPath: item.posterPath,
          backdropPath: item.backdropPath,
        });
        return { inList: true };
      } else {
        const filtered = current.filter(
          (r) => !(r.tmdb_id === item.id && r.media_type === item.mediaType),
        );
        writeLocalWatchlist(filtered);
        void deleteRecordFromBackend(item.id, item.mediaType, "watchlist");
        return { inList: false };
      }
    },
    onSuccess: (r) => {
      toast.success(r.inList ? "Added to My List" : "Removed from My List");
      void qc.invalidateQueries({ queryKey: ["library", "mylist"] });
    },
    onError: () => toast.error("Could not update My List."),
  });

  const onToggle = () => {
    if (!item) return;
    mutation.mutate();
  };

  return { inList, onToggle, pending: mutation.isPending };
}

export interface ContinueWatchingItem {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  season: number;
  episode: number;
  watched_seconds: number;
  duration_seconds: number | null;
  updated_at: string;
}

async function getCombinedContinueWatching(): Promise<ContinueWatchingItem[]> {
  const local = readContinueWatching();
  const byKey = new Map<string, ContinueWatchingItem>();
  local.forEach((item) => {
    byKey.set(`${item.type}_${item.mediaId}`, {
      tmdb_id: item.mediaId,
      media_type: item.type,
      title: item.title,
      poster_path: item.posterPath,
      backdrop_path: null,
      season: item.season ?? 1,
      episode: item.episode ?? 1,
      watched_seconds: item.watchedSeconds ?? 0,
      duration_seconds: item.durationSeconds ?? null,
      updated_at: new Date(item.lastWatchedAt).toISOString(),
    });
  });

  const backendRecords = await fetchRecordsFromBackend("continue_watching");
  backendRecords.forEach((record) => {
    const key = `${record.mediaType}_${record.tmdbId}`;
    const remote: ContinueWatchingItem = {
      tmdb_id: record.tmdbId,
      media_type: record.mediaType,
      title: record.title,
      poster_path: record.posterPath ?? null,
      backdrop_path: record.backdropPath ?? null,
      season: record.season ?? 1,
      episode: record.episode ?? 1,
      watched_seconds: record.progressSeconds ?? 0,
      duration_seconds: record.durationSeconds ?? null,
      updated_at: record.updatedAt ?? new Date().toISOString(),
    };
    const localVersion = byKey.get(key);
    if (!localVersion || Date.parse(remote.updated_at) > Date.parse(localVersion.updated_at)) {
      byKey.set(key, remote);
    }
  });

  return Array.from(byKey.values()).sort(
    (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at),
  );
}

export function useContinueWatching() {
  return useQuery({
    queryKey: ["library", "continue-watching"],
    queryFn: getCombinedContinueWatching,
    staleTime: 1000 * 5,
  });
}

export interface WatchHistoryItem {
  id: string;
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
  season: number | null;
  episode: number | null;
  watched_at: string;
}

export function useWatchHistory() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["library", "watch-history"],
    queryFn: async (): Promise<WatchHistoryItem[]> => {
      const entries = await getCombinedContinueWatching();
      return entries.map((item) => ({
        id: `wh_${item.tmdb_id}_${item.media_type}`,
        tmdb_id: item.tmdb_id,
        media_type: item.media_type,
        title: item.title,
        poster_path: item.poster_path,
        season: item.season,
        episode: item.episode,
        watched_at: item.updated_at,
      }));
    },
    staleTime: 1000 * 5,
  });

  const clearHistory = useMutation({
    mutationFn: async () => {
      try {
        localStorage.removeItem("bujuu_continue_watching");
      } catch {
        // Clearing local history is best-effort.
      }
      await deleteAllRecordsFromBackend("continue_watching");
    },
    onSuccess: () => {
      toast.success("Watch history cleared");
      void qc.invalidateQueries({ queryKey: ["library", "watch-history"] });
      void qc.invalidateQueries({ queryKey: ["library", "continue-watching"] });
    },
    onError: () => toast.error("Could not clear watch history"),
  });

  return { ...query, clearHistory };
}
