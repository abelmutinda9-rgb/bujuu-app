import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, ChevronDown, Maximize2, Minimize2, RotateCw, Server, Zap } from "lucide-react";
import { toast } from "sonner";

import { type ResolvedStream, SERVER_COUNT, SERVER_LABELS } from "@/services/stream-resolver";
import { getRemoteProviders, type StreamProvider } from "@/services/remote-config";

interface BujuuPlayerProps {
  title: string;
  season?: number | undefined;
  episode?: number | undefined;
  stream: ResolvedStream | null;
  loading: boolean;
  onNextServer: () => void;
  onSelectServer: (serverIndex: number) => void;
  onBack?: () => void;
  onProgress?: (progressSeconds: number, durationSeconds: number) => void;
  initialTime?: number;
}

const TOP_FIVE_SERVERS = [
  { index: 0, label: "Server 1", badge: "Fast" },
  { index: 1, label: "Server 2", badge: "HD" },
  { index: 2, label: "Server 3", badge: "Multi" },
  { index: 3, label: "Server 4", badge: "Backup" },
  { index: 4, label: "Server 5", badge: "Classic" },
];

export function BujuuPlayer({
  title,
  season,
  episode,
  stream,
  loading,
  onNextServer,
  onSelectServer,
  onBack,
}: BujuuPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMoreServers, setShowMoreServers] = useState(false);
  const [remoteProviders, setRemoteProviders] = useState<StreamProvider[]>([]);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Sync remote providers
  useEffect(() => {
    void getRemoteProviders().then((list) => {
      if (list && list.length > 0) setRemoteProviders(list);
    });
  }, []);

  // Handle Fullscreen & Auto-Landscape
  const handleFullscreenChange = useCallback(() => {
    const isNowFullscreen = !!document.fullscreenElement;
    setIsFullscreen(isNowFullscreen);

    if (isNowFullscreen) {
      try {
        if (typeof window !== "undefined" && (window.screen?.orientation as any)?.lock) {
          (window.screen.orientation as any).lock("landscape").catch(() => {});
        }
      } catch {
        // Ignore devices that don't support orientation locking
      }
    } else {
      try {
        if (typeof window !== "undefined" && (window.screen?.orientation as any)?.unlock) {
          (window.screen.orientation as any).unlock();
        }
      } catch {
        // Ignore
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, [handleFullscreenChange]);

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        }
        if ((window.screen?.orientation as any)?.lock) {
          await (window.screen.orientation as any).lock("landscape").catch(() => {});
        }
      } catch {
        toast.info("Entering fullscreen");
      }
    } else {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        if ((window.screen?.orientation as any)?.unlock) {
          (window.screen.orientation as any).unlock();
        }
      } catch {
        // Ignore
      }
    }
  };

  const handleRotateLandscape = () => {
    try {
      if ((window.screen?.orientation as any)?.lock) {
        (window.screen.orientation as any).lock("landscape").catch(() => {
          toast.info("Rotate your device to landscape");
        });
      } else {
        toast.info("Rotate your device to landscape");
      }
    } catch {
      toast.info("Rotate your device to landscape");
    }
  };

  const currentServerIndex = stream?.serverIndex ?? 0;
  const currentProviderName =
    remoteProviders[currentServerIndex]?.name ||
    stream?.providerName ||
    `Server ${currentServerIndex + 1}`;

  return (
    <div className="w-full bg-black select-none">
      {/* 1. TOP HEADER BAR */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-950/90 border-b border-zinc-900 text-white">
        <div className="flex items-center gap-3 overflow-hidden">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to browse"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white transition focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          <div className="min-w-0">
            <h1 className="truncate text-xs sm:text-sm font-bold text-white tracking-tight">
              {title}
            </h1>
            {season && episode ? (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Season {season} • Episode {episode}
              </p>
            ) : (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Full Movie • HD
              </p>
            )}
          </div>
        </div>

        {/* Top Right Quick Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRotateLandscape}
            title="Rotate to Landscape"
            className="flex items-center gap-1 rounded-lg bg-zinc-900 px-2 py-1 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
          >
            <RotateCw className="h-3.5 w-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Rotate</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white transition focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* 2. DOCKED 16:9 NATIVE IFRAME VIDEO FRAME */}
      <div
        ref={containerRef}
        className="relative aspect-video w-full bg-black overflow-hidden border-b border-zinc-900"
      >
        {stream ? (
          <iframe
            ref={iframeRef}
            key={stream.streamUrl}
            src={stream.streamUrl}
            title={title}
            className="h-full w-full border-0 bg-black"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer"
            allowFullScreen
            onLoad={() => setIframeLoaded(true)}
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-zinc-950 text-zinc-500">
            <p className="text-xs font-semibold">Loading video stream…</p>
          </div>
        )}
      </div>

      {/* 3. 1-TAP SERVER SELECTOR BAR */}
      <div className="bg-zinc-950 px-3 py-2.5 border-b border-zinc-900">
        <div className="flex items-center justify-between gap-2 pb-2">
          <div className="flex items-center gap-2">
            <Server className="h-3.5 w-3.5 text-rose-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Active Server:
            </span>
            <span className="text-xs font-bold text-white bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              {currentProviderName}
            </span>
          </div>

          <button
            type="button"
            onClick={onNextServer}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-bold text-rose-400 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition"
          >
            <Zap className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
            <span>Try Next Server</span>
          </button>
        </div>

        {/* Horizontal Pill Row of Top 5 Servers */}
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pt-0.5">
          {TOP_FIVE_SERVERS.map((srv) => {
            const isSelected = currentServerIndex === srv.index;
            return (
              <button
                key={srv.index}
                type="button"
                onClick={() => onSelectServer(srv.index)}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold transition shrink-0 ${
                  isSelected
                    ? "bg-rose-600 text-white shadow-md shadow-rose-950/40"
                    : "bg-zinc-900/90 text-zinc-300 hover:bg-zinc-800 border border-zinc-800/80"
                }`}
              >
                <span>{srv.label}</span>
                <span
                  className={`text-[9px] font-semibold px-1 py-0.2 rounded uppercase ${
                    isSelected ? "bg-black/30 text-white" : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {srv.badge}
                </span>
              </button>
            );
          })}

          {/* More Servers Dropdown Toggle */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowMoreServers((v) => !v)}
              className={`flex items-center gap-1 h-8 px-3 rounded-xl text-xs font-bold transition ${
                currentServerIndex >= 5
                  ? "bg-rose-600 text-white"
                  : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800/80"
              }`}
            >
              <span>{currentServerIndex >= 5 ? `Server ${currentServerIndex + 1}` : "+ More"}</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {showMoreServers && (
              <div className="absolute left-0 bottom-full mb-2 z-50 w-48 rounded-xl bg-zinc-950 p-1.5 shadow-2xl border border-zinc-800 space-y-1">
                {Array.from({ length: SERVER_COUNT - 5 }).map((_, i) => {
                  const sIdx = i + 5;
                  const label =
                    remoteProviders[sIdx]?.name || SERVER_LABELS[sIdx] || `Server ${sIdx + 1}`;
                  const isSel = currentServerIndex === sIdx;
                  return (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => {
                        onSelectServer(sIdx);
                        setShowMoreServers(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                        isSel
                          ? "bg-rose-600 text-white font-bold"
                          : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
