/**
 * BUJUU Offline Media Download Manager
 * Tracks downloaded movies and episodes on device, local media storage, and offline playback.
 */

export interface OfflineMediaItem {
  id: string;
  tmdbId: number;
  title: string;
  posterPath: string;
  backdropPath?: string;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  quality: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  downloadUrl?: string;
  localUri?: string;
  status: "completed" | "downloading" | "paused" | "failed";
  progress: number;
  downloadedAt: string;
}

const STORAGE_KEY = "bujuu_offline_downloads_registry";

export function getOfflineDownloads(): OfflineMediaItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOfflineDownload(item: OfflineMediaItem): void {
  if (typeof window === "undefined") return;
  try {
    const current = getOfflineDownloads().filter((i) => i.id !== item.id);
    current.unshift(item);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn("Failed to save offline download item:", err);
  }
}

export function removeOfflineDownload(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const updated = getOfflineDownloads().filter((i) => i.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to remove offline download item:", err);
  }
}

export function clearAllOfflineDownloads(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export async function getDeviceStorageEstimate(): Promise<{
  usedBytes: number;
  totalBytes: number;
  bujuuDownloadsBytes: number;
  percentageUsed: number;
}> {
  let usedBytes = 0;
  let totalBytes = 64 * 1024 * 1024 * 1024; // Default 64 GB baseline

  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usedBytes = estimate.usage || 0;
      totalBytes = estimate.quota || totalBytes;
    } catch {}
  }

  const downloads = getOfflineDownloads();
  const bujuuDownloadsBytes = downloads.reduce((acc, curr) => acc + (curr.fileSizeBytes || 0), 0);

  const percentageUsed = Math.min(100, Math.round((usedBytes / totalBytes) * 100));

  return {
    usedBytes,
    totalBytes,
    bujuuDownloadsBytes,
    percentageUsed,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 MB";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
