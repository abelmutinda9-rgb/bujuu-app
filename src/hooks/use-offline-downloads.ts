import { useEffect, useState } from "react";
import { toast } from "sonner";

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
  progress: number; // 100 is completed
  status: "completed" | "downloading" | "paused";
  localUrl?: string | undefined;
  posterPath?: string | null | undefined;
}

const STORAGE_KEY = "bujuu_offline_downloads_v1";

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

  const addDownloads = (newItems: Omit<OfflineDownload, "downloadDate" | "progress" | "status">[]) => {
    setDownloads((prev) => {
      const next = [...prev];
      for (const item of newItems) {
        const existingIdx = next.findIndex((d) => d.id === item.id);
        const record: OfflineDownload = {
          ...item,
          downloadDate: Date.now(),
          progress: 100,
          status: "completed",
        };
        if (existingIdx >= 0) {
          next[existingIdx] = record;
        } else {
          next.unshift(record);
        }
      }
      return next;
    });
    toast.success(`Started download for ${newItems.length} item${newItems.length > 1 ? "s" : ""}`);
  };

  const removeDownload = (id: string) => {
    setDownloads((prev) => prev.filter((d) => d.id !== id));
    toast.success("Download removed from device storage");
  };

  const clearAllDownloads = () => {
    setDownloads([]);
    toast.success("Cleared all offline downloads");
  };

  return {
    downloads,
    addDownloads,
    removeDownload,
    clearAllDownloads,
  };
}
