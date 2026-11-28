import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Download, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useOfflineDownloads } from "@/hooks/use-offline-downloads";
import { seasonQuery } from "@/services/tmdb";

export interface DownloadEpisode {
  id: number;
  episode_number: number;
  name: string;
  runtime?: number | null | undefined;
}

export interface DownloadSeason {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
}

interface DownloadSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  posterPath?: string | null | undefined;
  seasons?: DownloadSeason[] | undefined;
  currentSeason?: number;
  episodes?: DownloadEpisode[] | undefined;
  onSelectSeason?: (seasonNum: number) => void;
}

const QUALITIES = [
  { label: "360P", sizeFactor: 0.4 },
  { label: "480P", sizeFactor: 0.65 },
  { label: "1080P", sizeFactor: 1.0 },
  { label: "2160P", sizeFactor: 2.2 },
];

export function DownloadSheet({
  open,
  onOpenChange,
  title,
  tmdbId,
  mediaType,
  posterPath,
  seasons = [],
  currentSeason = 1,
  episodes = [],
  onSelectSeason,
}: DownloadSheetProps) {
  const isDesktop = useIsDesktop();
  const { addDownloads } = useOfflineDownloads();
  const [selectedQuality, setSelectedQuality] = useState("1080P");
  const [selectedSeason, setSelectedSeason] = useState(currentSeason);
  const [selectedEpisodes, setSelectedEpisodes] = useState<Set<number>>(() => new Set([1]));

  // Dynamically query episodes for the selected season if in TV mode
  const seasonEpQuery = useQuery(
    seasonQuery(tmdbId, selectedSeason, mediaType === "tv" && open),
  );

  const effectiveEpisodes = useMemo(() => {
    if (mediaType === "movie") {
      return [
        {
          id: tmdbId,
          episode_number: 1,
          name: title,
          runtime: 124,
        },
      ];
    }

    if (seasonEpQuery.data && seasonEpQuery.data.length > 0) {
      return seasonEpQuery.data.map((e) => ({
        id: e.episodeNumber,
        episode_number: e.episodeNumber,
        name: e.name,
        runtime: 45,
      }));
    }

    if (episodes.length > 0 && selectedSeason === currentSeason) {
      return episodes;
    }

    return Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      episode_number: i + 1,
      name: `Episode ${i + 1}`,
      runtime: 45,
    }));
  }, [mediaType, tmdbId, title, seasonEpQuery.data, episodes, selectedSeason, currentSeason]);

  const qualityFactor = QUALITIES.find((q) => q.label === selectedQuality)?.sizeFactor ?? 1.0;

  const toggleEpisode = (epNum: number) => {
    setSelectedEpisodes((prev) => {
      const next = new Set(prev);
      if (next.has(epNum)) {
        next.delete(epNum);
      } else {
        next.add(epNum);
      }
      return next;
    });
  };

  const isAllSelected = effectiveEpisodes.length > 0 && selectedEpisodes.size === effectiveEpisodes.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedEpisodes(new Set());
    } else {
      setSelectedEpisodes(new Set(effectiveEpisodes.map((e) => e.episode_number)));
    }
  };

  const handleSeasonChange = (sNum: number) => {
    setSelectedSeason(sNum);
    setSelectedEpisodes(new Set([1]));
    onSelectSeason?.(sNum);
  };

  const handleStartDownload = () => {
    if (selectedEpisodes.size === 0) {
      toast.error("Please select at least one item to download");
      return;
    }

    const itemsToSave = effectiveEpisodes
      .filter((e) => selectedEpisodes.has(e.episode_number))
      .map((e) => {
        const approxSizeMb = Math.round((e.runtime ? e.runtime * 12 : 600) * qualityFactor);
        const sizeStr = approxSizeMb > 1024 ? `${(approxSizeMb / 1024).toFixed(1)} GB` : `${approxSizeMb} MB`;
        return {
          id: `${tmdbId}-${mediaType === "tv" ? selectedSeason : 0}-${e.episode_number}-${selectedQuality}`,
          tmdbId,
          mediaType,
          title,
          season: mediaType === "tv" ? selectedSeason : undefined,
          episode: mediaType === "tv" ? e.episode_number : undefined,
          episodeTitle: e.name,
          quality: selectedQuality,
          fileSize: sizeStr,
          posterPath,
        };
      });

    void addDownloads(itemsToSave);
    onOpenChange(false);
  };

  const content = (
    <div className="flex flex-col max-h-[85vh] bg-[#0c0d10] text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <h2 className="text-xl font-bold tracking-normal">Download</h2>
          <p className="text-xs text-zinc-400 mt-0.5">High-speed offline playback</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-full p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="overflow-y-auto px-6 py-4 space-y-5 flex-1">
        {/* Dropdowns Row: Audio & Season */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-200"
            >
              <span>Original Audio</span>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
            </button>
          </div>

          {mediaType === "tv" && seasons.length > 0 && (
            <div className="relative">
              <select
                aria-label="Select season"
                value={selectedSeason}
                onChange={(e) => handleSeasonChange(Number(e.target.value))}
                className="appearance-none rounded-xl bg-zinc-900 border border-zinc-800 pl-3.5 pr-8 py-2 text-xs font-semibold text-zinc-200 outline-none cursor-pointer"
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.season_number} className="bg-zinc-950 text-white">
                    {s.name || `Season ${String(s.season_number).padStart(2, "0")}`}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            </div>
          )}
        </div>

        {/* Quality Selector Pills */}
        <div>
          <p className="text-xs font-medium text-zinc-400 mb-2">Quality</p>
          <div className="grid grid-cols-4 gap-2">
            {QUALITIES.map((q) => {
              const active = selectedQuality === q.label;
              return (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setSelectedQuality(q.label)}
                  className={`rounded-xl py-2 text-xs font-bold transition-all ${
                    active
                      ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/30"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Episodes Checklist */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-400">
              {mediaType === "tv" ? `Episodes (Season ${selectedSeason})` : "Title"}
            </p>
            {seasonEpQuery.isFetching && (
              <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                <Loader2 className="h-3 w-3 animate-spin text-cyan-400" /> Loading episodes...
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            {effectiveEpisodes.map((ep) => {
              const isSelected = selectedEpisodes.has(ep.episode_number);
              const approxSizeMb = Math.round((ep.runtime ? ep.runtime * 12 : 600) * qualityFactor);
              const sizeStr = approxSizeMb > 1024 ? `${(approxSizeMb / 1024).toFixed(1)} GB` : `${approxSizeMb} MB`;
              const durationStr = ep.runtime
                ? `${Math.floor(ep.runtime / 60).toString().padStart(2, "0")}:${(ep.runtime % 60).toString().padStart(2, "0")}:00`
                : "00:45:00";

              return (
                <button
                  key={ep.episode_number}
                  type="button"
                  onClick={() => toggleEpisode(ep.episode_number)}
                  className={`flex w-full items-center justify-between rounded-xl p-3 text-left transition-colors ${
                    isSelected
                      ? "bg-zinc-800/80 border border-cyan-500/40"
                      : "bg-zinc-900/50 border border-zinc-800/50 hover:bg-zinc-800/40"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-all ${
                        isSelected
                          ? "border-cyan-400 bg-cyan-400 text-black"
                          : "border-zinc-600 bg-transparent"
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">
                        {mediaType === "tv" ? `${String(ep.episode_number).padStart(2, "0")} ` : ""}
                        {ep.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-[11px] text-zinc-400">
                    <span>{sizeStr}</span>
                    <span className="text-zinc-600">•</span>
                    <span>{durationStr}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="flex items-center justify-between border-t border-white/10 bg-[#090a0d] px-6 py-4">
        <button
          type="button"
          onClick={toggleSelectAll}
          className="flex items-center gap-2 text-xs font-semibold text-zinc-300 hover:text-white"
        >
          <div
            className={`grid h-4 w-4 place-items-center rounded border ${
              isAllSelected ? "border-cyan-400 bg-cyan-400 text-black" : "border-zinc-600"
            }`}
          >
            {isAllSelected && <Check className="h-3 w-3 stroke-[3]" />}
          </div>
          <span>Select All</span>
        </button>

        <button
          type="button"
          onClick={handleStartDownload}
          disabled={selectedEpisodes.size === 0}
          className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-xs font-bold text-black shadow-lg shadow-emerald-500/30 transition-transform active:scale-95 disabled:opacity-40"
        >
          <Download className="h-4 w-4 stroke-[2.5]" />
          <span>Download ({selectedEpisodes.size})</span>
        </button>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg overflow-hidden border-zinc-800 bg-[#0c0d10] p-0 text-white">
          <DialogTitle className="sr-only">Download Media</DialogTitle>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-zinc-800 bg-[#0c0d10] text-white p-0">
        <DrawerTitle className="sr-only">Download Media</DrawerTitle>
        {content}
      </DrawerContent>
    </Drawer>
  );
}
