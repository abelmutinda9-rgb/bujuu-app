import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { useSession } from "@/hooks/use-account";
import { supabase } from "@/integrations/supabase/client";
import type { MediaItem } from "@/services/tmdb";

export function useMyList() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ["library", "mylist", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("watchlist")
        .select("tmdb_id, media_type, title, poster_path, backdrop_path, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        console.warn("Could not load My List:", error);
        return [];
      }
      return data ?? [];
    },
    enabled: Boolean(session && userId),
    staleTime: 60_000,
  });
}

export function useContinueWatching() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ["library", "continue", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("playback_progress")
        .select("tmdb_id, media_type, title, poster_path, backdrop_path, season, episode, watched_seconds, duration_seconds, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) {
        console.warn("Could not load Continue Watching:", error);
        return [];
      }
      return data ?? [];
    },
    enabled: Boolean(session && userId),
    staleTime: 30_000,
  });
}

/** Toggle a title in My List; guests are sent to sign in. */
export function useMyListToggle(item: MediaItem | undefined) {
  const { session } = useSession();
  const list = useMyList();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const inList = Boolean(
    item && list.data?.some((r) => r.tmdb_id === item.id && r.media_type === item.mediaType),
  );
  const mutation = useMutation({
    mutationFn: async () => {
      const userId = session?.user.id;
      if (!userId || !item) return { inList: false };
      if (!inList) {
        const { error } = await supabase.from("watchlist").upsert(
          {
            user_id: userId,
            tmdb_id: item.id,
            media_type: item.mediaType,
            title: item.title,
            poster_path: item.posterPath,
            backdrop_path: item.backdropPath,
          },
          { onConflict: "user_id,tmdb_id,media_type", ignoreDuplicates: true },
        );
        if (error) throw error;
        return { inList: true };
      } else {
        const { error } = await supabase
          .from("watchlist")
          .delete()
          .eq("user_id", userId)
          .eq("tmdb_id", item.id)
          .eq("media_type", item.mediaType);
        if (error) throw error;
        return { inList: false };
      }
    },
    onSuccess: (r) => {
      toast(r.inList ? "Added to My List" : "Removed from My List");
      void qc.invalidateQueries({ queryKey: ["library", "mylist"] });
    },
    onError: () => toast.error("Could not update My List."),
  });
  const onToggle = () => {
    if (!item) return;
    if (!session) {
      void navigate({ to: "/auth", search: { redirect: window.location.pathname } as never });
      return;
    }
    mutation.mutate();
  };
  return { inList, onToggle, pending: mutation.isPending };
}
