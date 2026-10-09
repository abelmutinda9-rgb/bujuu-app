import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Play, Plus } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useMyListToggle } from "@/hooks/use-library";
import { useIsDesktop } from "@/hooks/use-media-query";
import {
  ageRating,
  backdropUrl,
  detailsQuery,
  formatRuntime,
  matchPercent,
  yearOf,
  type MediaItem,
} from "@/services/tmdb";

interface MediaDetailProps {
  item: MediaItem | null;
  onOpenChange: (open: boolean) => void;
}

function Badges({ item }: { item: MediaItem }) {
  const { data } = useQuery(detailsQuery(item.id, item.mediaType));
  const runtime = formatRuntime(data?.runtimeMinutes ?? null);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold text-white">{matchPercent(item.voteAverage)}% Match</span>
      <span className="text-muted-foreground">{yearOf(item.releaseDate)}</span>
      <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">
        {ageRating(item.voteAverage, item.id)}
      </span>
      {runtime && <span className="text-muted-foreground">{runtime}</span>}
      {data?.seasons && <span className="text-muted-foreground">{data.seasons} seasons</span>}
      <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">HD</span>
      <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">4K</span>
    </div>
  );
}

function Hero({ item }: { item: MediaItem }) {
  const bg = backdropUrl(item.backdropPath, "w780");

  return (
    <div className="relative -mx-6 -mt-6 h-48 overflow-hidden sm:h-64">
      {bg && <img src={bg} alt={item.title} loading="lazy" className="h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

function Body({ item }: { item: MediaItem }) {
  const { data } = useQuery(detailsQuery(item.id, item.mediaType));
  const myList = useMyListToggle(item);

  return (
    <div className="space-y-4">
      <Hero item={item} />

      <div className="space-y-3">
        <h2 className="text-xl font-bold">{item.title}</h2>
        <Badges item={item} />
        <p className="text-sm leading-relaxed text-muted-foreground">
          {item.overview || "No description available."}
        </p>
        {data?.genres?.length ? (
          <p className="text-xs text-muted-foreground">{data.genres.join(" • ")}</p>
        ) : null}

        <div className="flex items-center gap-3 pt-1">
          <Link
            to="/watch"
            tabIndex={0}
            search={{ tmdbId: item.id, mediaType: item.mediaType, season: 1, episode: 1 }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-white px-6 py-2.5 text-sm font-semibold text-black outline-none transition-transform hover:opacity-85 focus:scale-105 focus:ring-4 focus:ring-brand"
          >
            <Play className="h-4 w-4 fill-black" /> Play
          </Link>
          <button
            type="button"
            tabIndex={0}
            onClick={myList.onToggle}
            disabled={myList.pending}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-white/15 px-5 py-2.5 text-sm font-semibold text-white outline-none transition-transform hover:bg-white/25 focus:scale-105 focus:ring-4 focus:ring-brand"
          >
            {myList.inList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {myList.inList ? "In My List" : "My List"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MediaDetail({ item, onOpenChange }: MediaDetailProps) {
  const isDesktop = useIsDesktop();
  const open = item !== null;

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl overflow-hidden border-border bg-background p-6">
          {item && (
            <>
              <DialogTitle className="sr-only">{item.title}</DialogTitle>
              <DialogDescription className="sr-only">Details for {item.title}</DialogDescription>
              <Body item={item} />
            </>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-border bg-background">
        <div className="max-h-[85vh] overflow-y-auto p-6">
          {item && (
            <>
              <DrawerTitle className="sr-only">{item.title}</DrawerTitle>
              <DrawerDescription className="sr-only">Details for {item.title}</DrawerDescription>
              <Body item={item} />
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
