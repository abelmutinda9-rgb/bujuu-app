import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { readContinueWatching } from "@/lib/history";
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
  } catch {}
}

export function useMyList() {
  return useQuery({
    queryKey: ["library", "mylist"],
    queryFn: async (): Promise<WatchlistItem[]> => {
      return readLocalWatchlist();
    },
    staleTime: 1000 * 5,
  });
}

export function useMyListToggle(item: MediaItem | undefined) {
  const list = useMyList();
  const qc = useQueryClient();
  const inList = Boolean(
    item && list.data?.some((r) => r.tmdb_id === item.id && r.media_type === item.mediaType)
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
        return { inList: true };
      } else {
        const filtered = current.filter(
          (r) => !(r.tmdb_id === item.id && r.media_type === item.mediaType)
        );
        writeLocalWatchlist(filtered);
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

export function useContinueWatching() {
  return useQuery({
    queryKey: ["library", "continue-watching"],
    queryFn: async (): Promise<ContinueWatchingItem[]> => {
      const local = readContinueWatching();
      return local.map((item) => ({
        tmdb_id: item.mediaId,
        media_type: item.type,
        title: item.title,
        poster_path: item.posterPath,
        backdrop_path: null,
        season: item.season ?? 1,
        episode: item.episode ?? 1,
        watched_seconds: 0,
        duration_seconds: null,
        updated_at: new Date(item.lastWatchedAt).toISOString(),
      }));
    },
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
      const local = readContinueWatching();
      return local.map((item) => ({
        id: `wh_${item.mediaId}_${item.type}`,
        tmdb_id: item.mediaId,
        media_type: item.type,
        title: item.title,
        poster_path: item.posterPath,
        season: item.season ?? null,
        episode: item.episode ?? null,
        watched_at: new Date(item.lastWatchedAt).toISOString(),
      }));
    },
    staleTime: 1000 * 5,
  });

  const clearHistory = useMutation({
    mutationFn: async () => {
      try {
        localStorage.removeItem("bujuu_continue_watching");
      } catch {}
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
