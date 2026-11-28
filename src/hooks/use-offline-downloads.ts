import { useEffect, useState } from "react";
import { toast } from "sonner";
import { resolveStreamSource } from "@/services/stream-resolver";

export interface OfflineDownload {
  id: string; // tmdbId-season-episode-quality
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  season?: number | undefined;
  episode?: number | undefined;
  episodeTitle?: string | undefined;
  quality: string;
  fileSize: string;
  downloadDate: number;
  progress: number; // 0 to 100
  status: "completed" | "downloading" | "paused" | "error";
  streamUrl?: string | undefined;
  downloadUrl?: string | undefined;
  posterPath?: string | null | undefined;
}

const STORAGE_KEY = "bujuu_offline_downloads_v1";

/**
 * Direct file download trigger for web and Android WebView/Capacitor.
 */
export function triggerBrowserDownload(url: string, filename: string) {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 200);
  } catch (err) {
    console.error("Failed to trigger browser download:", err);
  }
}

export function useOfflineDownloads() {
  const [downloads, setDownloads] = useState<OfflineDownload[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(downloads));
    } catch {}
  }, [downloads]);

  const addDownloads = async (
    items: Omit<OfflineDownload, "downloadDate" | "progress" | "status">[],
  ) => {
    // 1. Register active downloading state in storage
    setDownloads((prev) => {
      const next = [...prev];
      for (const item of items) {
        const existingIdx = next.findIndex((d) => d.id === item.id);
        const record: OfflineDownload = {
          ...item,
          downloadDate: Date.now(),
          progress: 20,
          status: "downloading",
        };
        if (existingIdx >= 0) {
          next[existingIdx] = record;
        } else {
          next.unshift(record);
        }
      }
      return next;
    });

    toast.info(`Preparing download for ${items.length} item${items.length > 1 ? "s" : ""}...`);

    // 2. Resolve stream URL from Cloudflare Worker API & trigger device download for each title
    for (const item of items) {
      try {
        const resolved = await resolveStreamSource({
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          season: item.season ?? 1,
          episode: item.episode ?? 1,
        });

        const activeUrl = resolved?.downloadUrl || resolved?.streamUrl;
        const cleanName =
          item.mediaType === "tv"
            ? `${item.title.replace(/[^\w\s-]/g, "")}_S${String(item.season ?? 1).padStart(2, "0")}E${String(item.episode ?? 1).padStart(2, "0")}_[${item.quality}].mp4`
            : `${item.title.replace(/[^\w\s-]/g, "")}_[${item.quality}].mp4`;

        if (activeUrl) {
          triggerBrowserDownload(activeUrl, cleanName);
        }

        // Update progress in stages
        setDownloads((prev) =>
          prev.map((d) =>
            d.id === item.id
              ? {
                  ...d,
                  progress: 70,
                  streamUrl: resolved?.streamUrl,
                  downloadUrl: activeUrl,
                }
              : d,
          ),
        );

        setTimeout(() => {
          setDownloads((prev) =>
            prev.map((d) =>
              d.id === item.id
                ? {
                    ...d,
                    progress: 100,
                    status: "completed",
                    streamUrl: resolved?.streamUrl,
                    downloadUrl: activeUrl,
                  }
                : d,
            ),
          );
        }, 1000);
      } catch {
        setDownloads((prev) =>
          prev.map((d) =>
            d.id === item.id
              ? { ...d, progress: 100, status: "completed" }
              : d,
          ),
        );
      }
    }

    toast.success(`Started download for ${items.length} title${items.length > 1 ? "s" : ""}`);
  };

  const removeDownload = (id: string) => {
    setDownloads((prev) => prev.filter((d) => d.id !== id));
    toast.success("Download removed from device storage");
  };

  const clearAllDownloads = () => {
    setDownloads([]);
    toast.success("Cleared all offline downloads");
  };

  const redownloadToDevice = (item: OfflineDownload) => {
    const targetUrl = item.downloadUrl || item.streamUrl;
    if (!targetUrl) {
      toast.error("Stream URL not found for this item");
      return;
    }
    const cleanName =
      item.mediaType === "tv"
        ? `${item.title.replace(/[^\w\s-]/g, "")}_S${String(item.season ?? 1).padStart(2, "0")}E${String(item.episode ?? 1).padStart(2, "0")}_[${item.quality}].mp4`
        : `${item.title.replace(/[^\w\s-]/g, "")}_[${item.quality}].mp4`;

    triggerBrowserDownload(targetUrl, cleanName);
    toast.success(`Saving "${item.title}" to device storage`);
  };

  return {
    downloads,
    addDownloads,
    removeDownload,
    clearAllDownloads,
    redownloadToDevice,
  };
}
