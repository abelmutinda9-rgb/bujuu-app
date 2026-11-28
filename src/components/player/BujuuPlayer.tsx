import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Cast,
  Check,
  ChevronRight,
  HelpCircle,
  Lock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  Subtitles,
  Unlock,
  Volume2,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { ResolvedStream } from "@/services/stream-resolver";

interface BujuuPlayerProps {
  stream: ResolvedStream | null;
  title: string;
  season?: number | undefined;
  episode?: number | undefined;
  episodeTitle?: string | undefined;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  hasPrevEpisode?: boolean;
  hasNextEpisode?: boolean;
}

type AspectRatioMode = "fit" | "fill" | "stretch" | "16:9";

export function BujuuPlayer({
  stream,
  title,
  season,
  episode,
  episodeTitle,
  onPrevEpisode,
  onNextEpisode,
  hasPrevEpisode,
  hasNextEpisode,
}: BujuuPlayerProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Player state
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [aspectMode, setAspectMode] = useState<AspectRatioMode>("fit");
  const [selectedQuality, setSelectedQuality] = useState("1080P");

  // Flyout Drawers
  const [activeDrawer, setActiveDrawer] = useState<"none" | "quality" | "language" | "settings">("none");
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [selectedSubtitle, setSelectedSubtitle] = useState("English");
  const [autoMiniplayer, setAutoMiniplayer] = useState(true);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls timer
  const resetControlsTimer = () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (!isLocked) {
      setControlsVisible(true);
      controlsTimeoutRef.current = setTimeout(() => {
        if (activeDrawer === "none") {
          setControlsVisible(false);
        }
      }, 3800);
    }
  };

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [activeDrawer, isLocked]);

  // Fullscreen & Orientation Lock handling
  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;

    try {
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);

        // Best effort landscape lock
        if (typeof screen !== "undefined" && screen.orientation && (screen.orientation as any).lock) {
          try {
            await (screen.orientation as any).lock("sensor-landscape");
          } catch {}
        }

        // Native Android orientation bridge if present
        if (typeof window !== "undefined" && (window as any).AndroidPlayerBridge?.lockLandscape) {
          try {
            (window as any).AndroidPlayerBridge.lockLandscape();
          } catch {}
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);

        if (typeof screen !== "undefined" && screen.orientation && screen.orientation.unlock) {
          try {
            screen.orientation.unlock();
          } catch {}
        }

        if (typeof window !== "undefined" && (window as any).AndroidPlayerBridge?.unlockOrientation) {
          try {
            (window as any).AndroidPlayerBridge.unlockOrientation();
          } catch {}
        }
      }
    } catch {}
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  const handleVideoTap = () => {
    if (isLocked) {
      setControlsVisible(true);
      resetControlsTimer();
      return;
    }
    if (activeDrawer !== "none") {
      setActiveDrawer("none");
      return;
    }
    setControlsVisible((prev) => !prev);
    if (!controlsVisible) {
      resetControlsTimer();
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        void videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
    resetControlsTimer();
  };

  const handleSeek = (delta: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + delta));
    } else {
      toast.info(delta > 0 ? "Skipped +10s" : "Rewound -10s", { duration: 1000 });
    }
    resetControlsTimer();
  };

  const cycleAspectMode = () => {
    const modes: AspectRatioMode[] = ["fit", "fill", "stretch", "16:9"];
    const nextIdx = (modes.indexOf(aspectMode) + 1) % modes.length;
    const nextMode: AspectRatioMode = modes[nextIdx] ?? "fit";
    setAspectMode(nextMode);
    toast.success(`Aspect: ${nextMode.toUpperCase()}`, { duration: 1200 });
    resetControlsTimer();
  };

  const cyclePlaybackSpeed = () => {
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx] ?? 1;
    setPlaybackSpeed(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
    toast.success(`Speed: ${nextSpeed}x`, { duration: 1200 });
    resetControlsTimer();
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds <= 0) return "00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getAspectClass = () => {
    switch (aspectMode) {
      case "fill":
        return "object-cover scale-105";
      case "stretch":
        return "w-full h-full scale-y-110 object-fill";
      case "16:9":
        return "aspect-video object-contain";
      case "fit":
      default:
        return "object-contain";
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      className={cn(
        "relative w-full bg-black select-none overflow-hidden transition-all",
        isFullscreen ? "fixed inset-0 z-50 h-screen w-screen" : "aspect-video min-h-[220px] max-h-[85vh] rounded-2xl shadow-2xl",
      )}
    >
      {/* Media Playback Viewport */}
      {stream?.kind === "hls" ? (
        <video
          ref={videoRef}
          src={stream.streamUrl}
          autoPlay
          playsInline
          className={cn("h-full w-full", getAspectClass())}
          onTimeUpdate={() => {
            if (videoRef.current) {
              setCurrentTime(videoRef.current.currentTime);
              setDuration(videoRef.current.duration || 0);
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      ) : (
        <iframe
          ref={iframeRef}
          src={stream?.streamUrl || "about:blank"}
          title={title}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          className={cn("h-full w-full border-0", getAspectClass())}
        />
      )}

      {/* Touch Interaction Trigger */}
      <div
        onClick={handleVideoTap}
        className="absolute inset-0 z-10 cursor-pointer"
        aria-hidden="true"
      />

      {/* Tap to Lock Pill (Left Side) */}
      <div
        className={cn(
          "absolute left-4 top-1/2 -translate-y-1/2 z-30 transition-opacity duration-300",
          controlsVisible || isLocked ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsLocked((prev) => !prev);
            setControlsVisible(true);
            toast.info(isLocked ? "Controls Unlocked" : "Controls Locked", { duration: 1000 });
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-md shadow-lg transition-transform active:scale-90",
            isLocked
              ? "bg-rose-600/90 text-white ring-2 ring-rose-400"
              : "bg-black/60 border border-white/20 text-white/90 hover:bg-black/80",
          )}
        >
          {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          <span>{isLocked ? "Locked" : "Tap to Lock"}</span>
        </button>
      </div>

      {/* Main Controls Overlay */}
      {!isLocked && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 transition-opacity duration-300",
            controlsVisible ? "opacity-100" : "opacity-0",
          )}
        >
          {/* Top Bar */}
          <div className="pointer-events-auto flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent p-2 -mx-4 -mt-4 px-5 pt-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => {
                  if (isFullscreen) {
                    void toggleFullscreen();
                  } else {
                    void navigate({ to: "/" });
                  }
                }}
                className="rounded-full p-2 text-white/90 transition-colors hover:bg-white/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold text-white sm:text-base">{title}</h1>
                {(season || episode || episodeTitle) && (
                  <p className="truncate text-xs font-medium text-zinc-300">
                    {season && `S${String(season).padStart(2, "0")} `}
                    {episode && `E${String(episode).padStart(2, "0")} `}
                    {episodeTitle && `• ${episodeTitle}`}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toast.info("Searching for Cast devices...", { duration: 1500 })}
                className="rounded-full p-2 text-white/90 hover:bg-white/10"
                title="Chromecast / Cast"
              >
                <Cast className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => toast.info("Double tap left/right to skip 10s. Tap lock to prevent accidental touches.", { duration: 3000 })}
                className="rounded-full p-2 text-white/90 hover:bg-white/10"
                title="Help"
              >
                <HelpCircle className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveDrawer("settings")}
                className="rounded-full p-2 text-white/90 hover:bg-white/10"
                title="Player Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Center Playback Controls */}
          <div className="pointer-events-auto flex items-center justify-center gap-8 sm:gap-14">
            <button
              type="button"
              onClick={() => handleSeek(-10)}
              className="grid h-12 w-12 place-items-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm transition-transform active:scale-90 hover:bg-black/70"
              title="Rewind 10s"
            >
              <RotateCcw className="h-6 w-6" />
              <span className="text-[10px] font-bold -mt-1">10</span>
            </button>

            <button
              type="button"
              onClick={handlePlayPause}
              className="grid h-16 w-16 place-items-center rounded-full bg-white text-black shadow-2xl transition-transform active:scale-95 hover:scale-105"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-8 w-8 fill-black" /> : <Play className="h-8 w-8 fill-black ml-1" />}
            </button>

            <button
              type="button"
              onClick={() => handleSeek(10)}
              className="grid h-12 w-12 place-items-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm transition-transform active:scale-90 hover:bg-black/70"
              title="Fast Forward 10s"
            >
              <RotateCw className="h-6 w-6" />
              <span className="text-[10px] font-bold -mt-1">10</span>
            </button>
          </div>

          {/* Bottom Bar Controls */}
          <div className="pointer-events-auto space-y-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 -mx-4 -mb-4 px-5 pb-4">
            {/* Scrub Slider Bar */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-zinc-300">{formatTime(currentTime)}</span>
              <div className="relative flex-1 py-2 cursor-pointer group">
                <div className="h-1.5 w-full rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-cyan-400 group-hover:bg-cyan-300 transition-all"
                    style={{
                      width: `${duration > 0 ? (currentTime / duration) * 100 : 35}%`,
                    }}
                  />
                </div>
              </div>
              <span className="text-xs font-semibold text-zinc-400">
                {duration > 0 ? formatTime(duration) : "01:05:47"}
              </span>
            </div>

            {/* Bottom Actions Row */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="p-1 text-white hover:text-cyan-400"
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </button>

                {/* Aspect Toggle Pill */}
                <button
                  type="button"
                  onClick={cycleAspectMode}
                  className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-white transition-colors hover:bg-white/20"
                >
                  {aspectMode.toUpperCase()}
                </button>

                {/* Speed Toggle Pill */}
                <button
                  type="button"
                  onClick={cyclePlaybackSpeed}
                  className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-white transition-colors hover:bg-white/20"
                >
                  {playbackSpeed}x
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Audio & Subtitles Drawer Trigger */}
                <button
                  type="button"
                  onClick={() => setActiveDrawer("language")}
                  className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/20"
                >
                  <Subtitles className="h-4 w-4" />
                  <span className="hidden sm:inline">Language</span>
                </button>

                {/* Quality Drawer Trigger */}
                <button
                  type="button"
                  onClick={() => setActiveDrawer("quality")}
                  className="rounded-lg bg-cyan-500/20 border border-cyan-400/40 px-2.5 py-1 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30"
                >
                  {selectedQuality}
                </button>

                {/* Fullscreen Toggle */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-1 text-white hover:text-cyan-400"
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flyout Drawer: Quality */}
      {activeDrawer === "quality" && (
        <div className="absolute right-0 top-0 bottom-0 z-40 w-64 bg-zinc-950/95 backdrop-blur-md border-l border-white/10 p-5 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h2 className="text-sm font-bold text-white">Quality</h2>
              <button
                type="button"
                onClick={() => setActiveDrawer("none")}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Done
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {["360P", "480P", "720P", "1080P", "2160P"].map((q) => {
                const active = selectedQuality === q;
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setSelectedQuality(q);
                      toast.success(`Quality set to ${q}`);
                      setActiveDrawer("none");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors",
                      active
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        : "text-zinc-300 hover:bg-white/10",
                    )}
                  >
                    <span>{q}</span>
                    {active && <Check className="h-4 w-4 text-cyan-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Flyout Drawer: Language (Audio & Subtitles) */}
      {activeDrawer === "language" && (
        <div className="absolute right-0 top-0 bottom-0 z-40 w-80 max-w-[85vw] bg-zinc-950/95 backdrop-blur-md border-l border-white/10 p-5 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <h2 className="text-sm font-bold text-white">Audio &amp; Subtitles</h2>
            <button
              type="button"
              onClick={() => setActiveDrawer("none")}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Done
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4 flex-1 overflow-y-auto">
            {/* Audio Column */}
            <div className="border-r border-white/10 pr-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">Audio</p>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg bg-cyan-500/20 px-2.5 py-2 text-xs font-semibold text-cyan-300 border border-cyan-500/30"
              >
                <span>Original</span>
                <Check className="h-3.5 w-3.5 text-cyan-400" />
              </button>
            </div>

            {/* Subtitles Column */}
            <div className="pl-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Subtitles</p>
                <button
                  type="button"
                  onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    subtitlesEnabled ? "bg-cyan-500 text-black" : "bg-zinc-800 text-zinc-400",
                  )}
                >
                  {subtitlesEnabled ? "ON" : "OFF"}
                </button>
              </div>

              {subtitlesEnabled && (
                <div className="space-y-1">
                  {["English", "Spanish", "French", "German", "Arabic"].map((lang) => {
                    const active = selectedSubtitle === lang;
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => {
                          setSelectedSubtitle(lang);
                          toast.success(`Subtitle set to ${lang}`);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors",
                          active
                            ? "bg-cyan-500/20 text-cyan-300 font-bold"
                            : "text-zinc-300 hover:bg-white/10",
                        )}
                      >
                        <span>{lang}</span>
                        {active && <Check className="h-3 w-3 text-cyan-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Flyout Drawer: Settings (Auto Miniplayer, etc.) */}
      {activeDrawer === "settings" && (
        <div className="absolute right-0 top-0 bottom-0 z-40 w-72 bg-zinc-950/95 backdrop-blur-md border-l border-white/10 p-5 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h2 className="text-sm font-bold text-white">Player Settings</h2>
              <button
                type="button"
                onClick={() => setActiveDrawer("none")}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Done
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Auto Miniplayer</p>
                  <p className="text-[11px] text-zinc-400">Keep video playing in PiP</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAutoMiniplayer(!autoMiniplayer);
                    toast.info(autoMiniplayer ? "Auto Miniplayer disabled" : "Auto Miniplayer enabled");
                  }}
                  className={cn(
                    "h-6 w-11 rounded-full p-0.5 transition-colors",
                    autoMiniplayer ? "bg-cyan-500" : "bg-zinc-800",
                  )}
                >
                  <div
                    className={cn(
                      "h-5 w-5 rounded-full bg-white shadow-md transition-transform",
                      autoMiniplayer ? "translate-x-5" : "translate-x-0",
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <div>
                  <p className="text-xs font-bold text-white">Playback Hardware</p>
                  <p className="text-[11px] text-zinc-400">High-efficiency decoding</p>
                </div>
                <span className="text-xs font-semibold text-emerald-400">Active</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
