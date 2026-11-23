import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Expand,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture,
  Play,
  RotateCcw,
  RotateCw,
  Server,
  Subtitles,
  Unlock,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { type ResolvedStream, SERVER_COUNT, SERVER_LABELS } from "@/services/stream-resolver";

export type AspectRatioMode = "fit" | "fill" | "stretch" | "zoom";

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

export function BujuuPlayer({
  title,
  season,
  episode,
  stream,
  loading,
  onNextServer,
  onSelectServer,
  onBack,
  onProgress,
  initialTime = 0,
}: BujuuPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [aspectMode, setAspectMode] = useState<AspectRatioMode>("fit");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsLocked, setControlsLocked] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [activeQuality, setActiveQuality] = useState<number>(-1);
  const [availableQualities, setAvailableQualities] = useState<{ id: number; label: string }[]>([]);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showServerMenu, setShowServerMenu] = useState(false);
  const [showSubtitlesMenu, setShowSubtitlesMenu] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!controlsLocked) {
      hideTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
        setShowQualityMenu(false);
        setShowServerMenu(false);
        setShowSubtitlesMenu(false);
      }, 3500);
    }
  }, [controlsLocked]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  useEffect(() => {
    if (!stream || stream.kind !== "hls" || !videoRef.current) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    let hls: Hls | null = null;
    setIsBuffering(true);

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 90 });
      hlsRef.current = hls;
      hls.loadSource(stream.streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setIsBuffering(false);
        setAvailableQualities(
          data.levels.map((lvl, id) => ({
            id,
            label: lvl.height ? `${lvl.height}p` : `Level ${id + 1}`,
          })),
        );
        if (initialTime > 0) video.currentTime = initialTime;
        void video
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) onNextServer();
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = stream.streamUrl;
      const onLoaded = () => {
        setIsBuffering(false);
        if (initialTime > 0) video.currentTime = initialTime;
        void video
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      };
      video.addEventListener("loadedmetadata", onLoaded, { once: true });
    }

    return () => {
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
    };
  }, [stream, initialTime, onNextServer]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const current = video.currentTime;
    const dur = video.duration || 0;
    setCurrentTime(current);
    setDuration(dur);
    if (video.buffered.length > 0) {
      try {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      } catch {
        // Some browser APIs can reject media metadata reads.
      }
    }
    onProgress?.(Math.floor(current), Math.floor(dur));
  };

  const handleTogglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
    resetHideTimer();
  };

  const handleSeek = (newTime: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, newTime));
    setCurrentTime(newTime);
    resetHideTimer();
  };

  const handleSkip = (seconds: number) => {
    if (videoRef.current) handleSeek(videoRef.current.currentTime + seconds);
  };

  const handleSelectQuality = (levelIndex: number) => {
    setActiveQuality(levelIndex);
    if (hlsRef.current) hlsRef.current.currentLevel = levelIndex;
    setShowQualityMenu(false);
    toast.success(
      levelIndex === -1
        ? "Quality set to Auto"
        : `Quality set to ${availableQualities.find((q) => q.id === levelIndex)?.label}`,
    );
  };

  const handleToggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen?.();
        setIsFullscreen(true);
        try {
          if (screen.orientation && "lock" in screen.orientation) {
            await (
              screen.orientation as ScreenOrientation & {
                lock: (orientation: string) => Promise<void>;
              }
            ).lock("landscape");
          }
        } catch {
          // Orientation lock is unavailable in some browser contexts.
        }
      } else {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
        try {
          screen.orientation?.unlock?.();
        } catch {
          // Orientation unlock is best-effort.
        }
      }
    } catch (e) {
      console.warn("Fullscreen request error:", e);
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const handleTogglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await videoRef.current.requestPictureInPicture?.();
    } catch {
      toast.error("Picture-in-picture is not supported on this browser or stream.");
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds <= 0) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
      ? `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`
      : `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const aspectClasses: Record<AspectRatioMode, string> = {
    fit: "object-contain",
    fill: "object-cover",
    stretch: "object-fill",
    zoom: "object-cover scale-125",
  };

  const cycleAspectMode = () => {
    const modes: AspectRatioMode[] = ["fit", "fill", "stretch", "zoom"];
    const next = modes[(modes.indexOf(aspectMode) + 1) % modes.length] ?? "fit";
    setAspectMode(next);
    toast.info(`Aspect mode: ${next.toUpperCase()}`);
    resetHideTimer();
  };

  return (
    <div
      ref={containerRef}
      className={`group relative w-full overflow-hidden bg-black select-none ${
        isFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen"
          : "aspect-video max-h-[70vh] rounded-2xl shadow-2xl ring-1 ring-white/10"
      }`}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      onClick={resetHideTimer}
    >
      {stream?.kind === "hls" ? (
        <video
          ref={videoRef}
          className={`h-full w-full transition-transform duration-200 ${aspectClasses[aspectMode]}`}
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
          }}
          onPause={() => setIsPlaying(false)}
          onClick={handleTogglePlay}
        />
      ) : stream?.kind === "embed" ? (
        <iframe
          key={stream.streamUrl}
          src={stream.streamUrl}
          title={title}
          className="h-full w-full border-0"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          onLoad={() => setIsBuffering(false)}
        />
      ) : null}

      {(loading || isBuffering) && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs">
          <Loader2 className="h-12 w-12 animate-spin text-rose-500 drop-shadow-lg" />
          <p className="mt-3 text-xs font-semibold tracking-wider text-white uppercase drop-shadow">
            {loading ? "Connecting stream…" : "Buffering…"}
          </p>
        </div>
      )}

      {controlsLocked ? (
        <div className="absolute top-4 right-4 z-40">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setControlsLocked(false);
              resetHideTimer();
            }}
            className="h-11 w-11 rounded-full bg-black/80 text-rose-500 backdrop-blur-md border border-rose-500/40"
          >
            <Lock className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        <div
          className={`pointer-events-none absolute inset-0 z-30 flex flex-col justify-between transition-opacity duration-300 ${
            controlsVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Top Bar */}
          <div className="pointer-events-auto flex items-center justify-between bg-gradient-to-b from-black/90 via-black/40 to-transparent p-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (isFullscreen) void handleToggleFullscreen();
                  else if (onBack) onBack();
                  else window.history.back();
                }}
                className="h-9 w-9 rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-white/20"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="truncate text-sm sm:text-base font-bold text-white drop-shadow">
                  {title}
                </h1>
                {typeof season === "number" && (
                  <p className="text-[11px] font-medium text-zinc-300 drop-shadow">
                    Season {season} · Episode {episode ?? 1}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowServerMenu((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/10 hover:bg-white/20 transition"
              >
                {stream?.kind === "hls" ? (
                  <>
                    <Zap className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Direct HD</span>
                  </>
                ) : (
                  <>
                    <Server className="h-3.5 w-3.5 text-rose-500" />
                    <span className="truncate max-w-[100px]">
                      {stream?.providerName || "Server"}
                    </span>
                  </>
                )}
                <ChevronDown className="h-3 w-3 text-zinc-400" />
              </button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setControlsLocked(true);
                  toast.info("Controls locked. Tap padlock to unlock.");
                }}
                title="Lock controls"
                className="h-9 w-9 rounded-full bg-black/60 text-zinc-300 backdrop-blur-md hover:bg-white/20 hover:text-white"
              >
                <Unlock className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Center Play/Pause & Skip */}
          <div className="pointer-events-auto flex items-center justify-center gap-8 sm:gap-14">
            <button
              type="button"
              onClick={() => handleSkip(-10)}
              className="flex flex-col items-center gap-1 text-white/90 hover:text-white transition active:scale-90"
              aria-label="Skip backward 10 seconds"
            >
              <div className="grid h-11 w-11 place-items-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 hover:bg-white/20">
                <RotateCcw className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold tracking-tight">10s</span>
            </button>

            <button
              type="button"
              onClick={handleTogglePlay}
              className="grid h-16 w-16 sm:h-[72px] sm:w-[72px] place-items-center rounded-full bg-rose-600 text-white shadow-2xl transition hover:scale-105 active:scale-95"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="h-8 w-8 fill-white" />
              ) : (
                <Play className="h-8 w-8 fill-white translate-x-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSkip(10)}
              className="flex flex-col items-center gap-1 text-white/90 hover:text-white transition active:scale-90"
              aria-label="Skip forward 10 seconds"
            >
              <div className="grid h-11 w-11 place-items-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 hover:bg-white/20">
                <RotateCw className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold tracking-tight">10s</span>
            </button>
          </div>

          {/* Bottom Bar: Scrubber + Actions */}
          <div className="pointer-events-auto bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 pb-3">
            {stream?.kind === "hls" && (
              <div className="mb-2 flex items-center gap-3">
                <span className="text-xs font-mono font-medium text-white/90">
                  {formatTime(currentTime)}
                </span>
                <div
                  className="relative flex-1 h-3 flex items-center cursor-pointer group/bar"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    handleSeek(((e.clientX - rect.left) / rect.width) * duration);
                  }}
                >
                  <div className="h-1.5 w-full rounded-full bg-white/20 overflow-hidden relative group-hover/bar:h-2 transition-all">
                    <div
                      className="absolute inset-y-0 left-0 bg-white/40"
                      style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 bg-rose-600 rounded-full"
                      style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-mono font-medium text-zinc-400">
                  {formatTime(duration)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cycleAspectMode}
                  className="flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/20 transition uppercase"
                  title="Aspect ratio"
                >
                  <Expand className="h-3.5 w-3.5 text-zinc-300" />
                  <span>{aspectMode}</span>
                </button>

                {stream?.kind === "hls" && availableQualities.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowQualityMenu((prev) => !prev)}
                    className="flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/20 transition"
                  >
                    <span>
                      {activeQuality === -1
                        ? "Auto"
                        : availableQualities.find((q) => q.id === activeQuality)?.label}
                    </span>
                    <ChevronDown className="h-3 w-3 text-zinc-400" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowSubtitlesMenu((prev) => !prev)}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold backdrop-blur-md transition ${
                    subtitlesEnabled
                      ? "bg-rose-950/60 text-rose-400 border border-rose-500/30"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                  title="Subtitles"
                >
                  <Subtitles className="h-3.5 w-3.5" />
                  <span>CC</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {stream?.kind === "hls" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleTogglePiP}
                    className="h-8 w-8 rounded-full bg-white/10 text-white hover:bg-white/20"
                    title="Picture in picture"
                  >
                    <PictureInPicture className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleFullscreen}
                  className="h-8 w-8 rounded-full bg-white/10 text-white hover:bg-white/20"
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Server selector drawer modal */}
      {showServerMenu && (
        <div className="absolute inset-x-0 bottom-0 z-40 max-h-72 overflow-y-auto rounded-t-2xl bg-zinc-950/95 p-4 backdrop-blur-xl border-t border-zinc-800 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h2 className="text-sm font-bold text-white">Stream Sources</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowServerMenu(false)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Close
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                onSelectServer(-1);
                setShowServerMenu(false);
              }}
              className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-xs font-semibold transition ${
                stream?.kind === "hls"
                  ? "bg-emerald-950/40 border-emerald-500 text-emerald-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <span>⚡ Direct HD</span>
              {stream?.kind === "hls" && <Check className="h-4 w-4" />}
            </button>
            {Array.from({ length: SERVER_COUNT }).map((_, idx) => {
              const label = SERVER_LABELS[idx] || `Server ${idx + 1}`;
              const current = stream?.kind === "embed" && stream.serverIndex === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onSelectServer(idx);
                    setShowServerMenu(false);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-xs font-semibold transition ${
                    current
                      ? "bg-rose-950/40 border-rose-500 text-white"
                      : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  <span className="truncate">{label}</span>
                  {current && <Check className="h-4 w-4 text-rose-500" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quality menu */}
      {showQualityMenu && (
        <div className="absolute bottom-16 left-4 z-40 w-44 rounded-xl bg-zinc-950/95 p-2 backdrop-blur-xl border border-zinc-800 shadow-2xl">
          <p className="px-2 py-1 text-[11px] font-bold text-zinc-400 uppercase">Video quality</p>
          <button
            type="button"
            onClick={() => handleSelectQuality(-1)}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              activeQuality === -1 ? "bg-rose-600 text-white" : "text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <span>Auto</span>
            {activeQuality === -1 && <Check className="h-3.5 w-3.5" />}
          </button>
          {availableQualities.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => handleSelectQuality(q.id)}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                activeQuality === q.id
                  ? "bg-rose-600 text-white"
                  : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <span>{q.label}</span>
              {activeQuality === q.id && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}

      {/* Subtitles menu */}
      {showSubtitlesMenu && (
        <div className="absolute bottom-16 left-24 z-40 w-48 rounded-xl bg-zinc-950/95 p-2.5 backdrop-blur-xl border border-zinc-800 shadow-2xl">
          <p className="px-2 py-1 text-[11px] font-bold text-zinc-400 uppercase">Subtitles</p>
          <button
            type="button"
            onClick={() => {
              setSubtitlesEnabled(true);
              setShowSubtitlesMenu(false);
              toast.info("Subtitle tracks from this source are controlled by its player.");
            }}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              subtitlesEnabled ? "bg-rose-600 text-white" : "text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <span>English (if available)</span>
            {subtitlesEnabled && <Check className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setSubtitlesEnabled(false);
              setShowSubtitlesMenu(false);
              toast.info("Subtitle tracks from embedded sources are controlled by their player.");
            }}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              !subtitlesEnabled ? "bg-rose-600 text-white" : "text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <span>Off</span>
            {!subtitlesEnabled && <Check className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}
