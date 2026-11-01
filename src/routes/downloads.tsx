import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Download, Film, HardDrive, Play, Trash2, ArrowLeft, Tv, CheckCircle2, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  getOfflineDownloads,
  removeOfflineDownload,
  clearAllOfflineDownloads,
  getDeviceStorageEstimate,
  formatBytes,
  type OfflineMediaItem,
} from "@/services/downloads";
import { posterUrl } from "@/services/tmdb";
import { toast } from "sonner";

export const Route = createFileRoute("/downloads")({
  head: () => ({
    meta: [
      { title: "Downloads & Offline Library — BUJUU" },
      { name: "description", content: "Watch downloaded movies and TV series offline with zero internet on BUJUU." },
    ],
  }),
  component: DownloadsPage,
});

function DownloadsPage() {
  const [downloads, setDownloads] = useState<OfflineMediaItem[]>([]);
  const [storage, setStorage] = useState<{
    usedBytes: number;
    totalBytes: number;
    bujuuDownloadsBytes: number;
    percentageUsed: number;
  }>({ usedBytes: 0, totalBytes: 64 * 1024 * 1024 * 1024, bujuuDownloadsBytes: 0, percentageUsed: 0 });
  const [filter, setFilter] = useState<"all" | "movie" | "tv">("all");
  const [activePlayerItem, setActivePlayerItem] = useState<OfflineMediaItem | null>(null);
  const navigate = useNavigate();

  const loadData = () => {
    setDownloads(getOfflineDownloads());
    getDeviceStorageEstimate().then(setStorage);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = (id: string, title: string) => {
    removeOfflineDownload(id);
    loadData();
    toast.success(`Removed "${title}" from downloads`);
  };

  const handleClearAll = () => {
    if (downloads.length === 0) return;
    if (confirm("Are you sure you want to delete all offline downloads?")) {
      clearAllOfflineDownloads();
      loadData();
      toast.success("Cleared all offline downloads");
    }
  };

  const filteredItems = downloads.filter((item) => {
    if (filter === "all") return true;
    return item.mediaType === filter;
  });

  return (
    <AppShell>
      <div className="min-h-screen px-4 pt-20 pb-24 lg:px-12 max-w-7xl mx-auto space-y-8 animate-fade-in">
        {/* Header Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Home
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Download className="h-7 w-7 text-rose-500" />
              Downloads & Offline Library
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              Watch your favorite movies and shows offline on flights, road trips, or without mobile data.
            </p>
          </div>

          {downloads.length > 0 && (
            <button
              onClick={handleClearAll}
              className="self-start sm:self-center inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-zinc-800 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear All ({downloads.length})
            </button>
          )}
        </div>

        {/* Device Storage Status Bar */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4 sm:p-5 backdrop-blur-md shadow-lg space-y-3">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="flex items-center gap-2 font-medium text-zinc-300">
              <HardDrive className="h-4 w-4 text-rose-400" />
              Device Storage
            </span>
            <span className="text-zinc-400">
              <strong className="text-white font-semibold">{formatBytes(storage.bujuuDownloadsBytes)}</strong> used by BUJUU • {formatBytes(storage.totalBytes - storage.usedBytes)} free
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-800/80 overflow-hidden flex">
            <div
              className="bg-rose-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(3, (storage.bujuuDownloadsBytes / (storage.totalBytes || 1)) * 100))}%` }}
              title="BUJUU Downloads"
            />
            <div
              className="bg-zinc-600 transition-all duration-500"
              style={{ width: `${Math.max(0, storage.percentageUsed - ((storage.bujuuDownloadsBytes / (storage.totalBytes || 1)) * 100))}%` }}
              title="Other Apps & System"
            />
          </div>
        </div>

        {/* Filter Chips */}
        {downloads.length > 0 && (
          <div className="flex items-center gap-2">
            {[
              { id: "all", label: "All Items", count: downloads.length },
              { id: "movie", label: "Movies", count: downloads.filter((d) => d.mediaType === "movie").length },
              { id: "tv", label: "TV Shows", count: downloads.filter((d) => d.mediaType === "tv").length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  filter === tab.id
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                    : "bg-zinc-900/80 text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        )}

        {/* Media Downloads List / Empty State */}
        {downloads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/40 space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-500 border border-zinc-800 shadow-inner">
              <Download className="h-8 w-8" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-lg font-bold text-white">No downloaded movies yet</h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                When you tap Download on any title (or use Server 4 VidVault), it will appear here ready to watch with zero internet.
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/30 active:scale-95"
            >
              <Film className="h-4 w-4" />
              Browse Trending Movies
            </Link>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-sm">
            No {filter === "movie" ? "movies" : "TV series"} downloaded.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/60 shadow-lg hover:border-zinc-700 transition-all"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-950">
                  <img
                    src={posterUrl(item.backdropPath || item.posterPath, "w780")}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 border border-white/10 text-[10px] font-bold text-rose-400 uppercase tracking-wider backdrop-blur-sm">
                    {item.quality || "1080p"}
                  </span>
                  <span className="absolute bottom-2 right-2 text-[11px] font-medium text-zinc-300 bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm">
                    {item.fileSizeFormatted}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-4 justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-white text-sm line-clamp-1 group-hover:text-rose-400 transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      {item.mediaType === "tv" && item.season
                        ? `Season ${item.season}, Episode ${item.episode}`
                        : "Feature Film"} • Downloaded {new Date(item.downloadedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/60">
                    <button
                      onClick={() => {
                        if (item.localUri || item.downloadUrl) {
                          setActivePlayerItem(item);
                        } else {
                          navigate({ to: "/watch", search: { tmdbId: item.tmdbId, type: item.mediaType } });
                        }
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors shadow-sm"
                    >
                      <Play className="h-3.5 w-3.5 fill-black" />
                      Watch Offline
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.title)}
                      className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-zinc-800 transition-colors"
                      title="Delete download"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Offline Video Player Modal */}
        {activePlayerItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
            <div className="w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Play className="h-4 w-4 text-rose-500" />
                  Playing Offline: {activePlayerItem.title}
                </h3>
                <button
                  onClick={() => setActivePlayerItem(null)}
                  className="rounded-lg p-1 text-zinc-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-black flex items-center justify-center">
                <video
                  src={activePlayerItem.localUri || activePlayerItem.downloadUrl}
                  controls
                  autoPlay
                  className="h-full w-full"
                >
                  Your browser does not support offline video playback.
                </video>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
