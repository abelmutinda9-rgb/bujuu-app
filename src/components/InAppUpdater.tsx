import { useState, useEffect } from "react";
import { Download, RefreshCw, X } from "lucide-react";

interface ReleaseInfo {
  version: string;
  versionCode: number;
  apkUrl: string;
  notes: string;
}

export function InAppUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState<ReleaseInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only check if running on native Android
    if (typeof window === "undefined" || !(window as any).BujuuNative) return;

    const currentCode = (window as any).BujuuNative.getAppVersionCode?.() ?? 10;

    // Check latest release from GitHub
    fetch("https://api.github.com/repos/abelmutinda9-rgb/bujuu-app/releases/latest")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const tag = data.tag_name || "";
        // Match version number e.g. v2.0 or 2.0
        const match = tag.match(/v?(\d+)\.(\d+)/);
        let latestCode = 0;
        if (match) {
          latestCode = parseInt(match[1], 10) * 10 + parseInt(match[2], 10);
        }
        
        // Find apk asset download url
        const apkAsset = (data.assets || []).find((a: any) =>
          a.name.toLowerCase().endsWith(".apk")
        );

        if (apkAsset && (latestCode > currentCode || data.id > 0)) {
          // If tag has higher version
          if (latestCode > currentCode) {
            setUpdateAvailable({
              version: data.tag_name,
              versionCode: latestCode,
              apkUrl: apkAsset.browser_download_url,
              notes: data.body || "New performance improvements, all genres, and bug fixes.",
            });
          }
        }
      })
      .catch(() => {
        /* ignore offline check */
      });
  }, []);

  if (!updateAvailable || dismissed) return null;

  const handleUpdate = () => {
    setDownloading(true);
    // Start native download via window location or DownloadManager
    window.location.href = updateAvailable.apkUrl;
    setTimeout(() => {
      setDownloading(false);
      setDismissed(true);
    }, 4000);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border border-rose-500/30 bg-zinc-950/95 p-5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600/20 text-rose-500">
            <RefreshCw className={`h-5 w-5 ${downloading ? "animate-spin" : ""}`} />
          </div>
          <div>
            <h4 className="font-semibold text-white">Update Available</h4>
            <p className="text-xs text-zinc-400">BUJUU {updateAvailable.version}</p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-zinc-300 line-clamp-2">
        {updateAvailable.notes}
      </p>

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleUpdate}
          disabled={downloading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white shadow-lg transition-transform hover:bg-rose-500 active:scale-95 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Downloading..." : "Update Now"}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          Later
        </button>
      </div>
    </div>
  );
}
