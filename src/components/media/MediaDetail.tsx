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
      <span className="font-semibold text-amber-400">{matchPercent(item.voteAverage)}% Match</span>
      <span className="text-zinc-500">•</span>
      <span className="text-zinc-300">{yearOf(item.releaseDate)}</span>
      <span className="text-zinc-500">•</span>
      <span className="rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-zinc-300">
        {ageRating(item.voteAverage, item.id)}
      </span>
      {runtime && (
        <>
          <span className="text-zinc-500">•</span>
          <span className="text-zinc-300">{runtime}</span>
        </>
      )}
      {data?.seasons && (
        <>
          <span className="text-zinc-500">•</span>
          <span className="text-zinc-300">{data.seasons} seasons</span>
        </>
      )}
      <span className="rounded bg-rose-950/60 border border-rose-800/40 px-1.5 py-0.5 text-[10px] font-bold text-rose-400">
        4K UHD
      </span>
    </div>
  );
}

function Hero({ item }: { item: MediaItem }) {
  const bg = backdropUrl(item.backdropPath, "w780");

  return (
    <div className="relative -mx-6 -mt-6 h-52 overflow-hidden sm:h-64">
      {bg && <img src={bg} alt={item.title} loading="lazy" className="h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
    </div>
  );
}

function Body({ item, onOpenChange }: { item: MediaItem; onOpenChange: (open: boolean) => void }) {
  const { data } = useQuery(detailsQuery(item.id, item.mediaType));
  const myList = useMyListToggle(item);

  return (
    <div className="space-y-4">
      <Hero item={item} />

      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-normal text-white">{item.title}</h2>
        <Badges item={item} />

        {/* Synopsis completely removed per user instruction */}

        {data?.genres?.length ? (
          <p className="text-xs font-semibold text-zinc-400">{data.genres.join(" • ")}</p>
        ) : null}

        <div className="flex items-center gap-3 pt-2">
          <Link
            to="/watch"
            tabIndex={0}
            search={{ tmdbId: item.id, mediaType: item.mediaType, season: 1, episode: 1 }}
            onClick={() => onOpenChange(false)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-black outline-none transition-transform hover:bg-zinc-200 focus:scale-105"
          >
            <Play className="h-4 w-4 fill-black" /> Play Now
          </Link>
          <button
            type="button"
            tabIndex={0}
            onClick={myList.onToggle}
            disabled={myList.pending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-5 py-3 text-sm font-semibold text-white outline-none transition-transform hover:bg-zinc-800 focus:scale-105"
          >
            {myList.inList ? <Check className="h-4 w-4 text-rose-500" /> : <Plus className="h-4 w-4" />}
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
        <DialogContent className="max-w-xl overflow-hidden border-zinc-800 bg-zinc-950 p-6 text-white">
          {item && (
            <>
              <DialogTitle className="sr-only">{item.title}</DialogTitle>
              <DialogDescription className="sr-only">Details for {item.title}</DialogDescription>
              <Body item={item} onOpenChange={onOpenChange} />
            </>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-zinc-800 bg-zinc-950 text-white">
        <div className="max-h-[85vh] overflow-y-auto p-6">
          {item && (
            <>
              <DrawerTitle className="sr-only">{item.title}</DrawerTitle>
              <DrawerDescription className="sr-only">Details for {item.title}</DrawerDescription>
              <Body item={item} onOpenChange={onOpenChange} />
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
