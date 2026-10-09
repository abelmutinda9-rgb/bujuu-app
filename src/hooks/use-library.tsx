import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useSession } from "@/hooks/use-account";
import { continueWatching, myList, toggleMyList } from "@/lib/library.functions";
import type { MediaItem } from "@/services/tmdb";

export function useMyList() {
  const { session } = useSession();
  const fetchList = useServerFn(myList);
  return useQuery({
    queryKey: ["library", "mylist", session?.user.id],
    queryFn: () => fetchList(),
    enabled: Boolean(session),
    staleTime: 60_000,
  });
}

export function useContinueWatching() {
  const { session } = useSession();
  const fetchRows = useServerFn(continueWatching);
  return useQuery({
    queryKey: ["library", "continue", session?.user.id],
    queryFn: () => fetchRows(),
    enabled: Boolean(session),
    staleTime: 30_000,
  });
}

/** Toggle a title in My List; guests are sent to sign in. */
export function useMyListToggle(item: MediaItem | undefined) {
  const { session } = useSession();
  const list = useMyList();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toggle = useServerFn(toggleMyList);
  const inList = Boolean(
    item && list.data?.some((r) => r.tmdb_id === item.id && r.media_type === item.mediaType),
  );
  const mutation = useMutation({
    mutationFn: () =>
      toggle({
        data: {
          tmdbId: item!.id,
          mediaType: item!.mediaType,
          title: item!.title,
          posterPath: item!.posterPath,
          backdropPath: item!.backdropPath,
          add: !inList,
        },
      }),
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
