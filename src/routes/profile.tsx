import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, Film, HardDrive, Headphones, History, Instagram, MessageCircle, Phone, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWatchHistory } from "@/hooks/use-library";
import { useOfflineDownloads } from "@/hooks/use-offline-downloads";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

type LocalProfile = { id: string; name: string; avatarColor: string };
const PROFILE_KEY = "bujuu_profiles_v2";
const colors = ["#e11d48", "#7c3aed", "#0284c7", "#16a34a"];

function readProfiles(): LocalProfile[] {
  try {
    const data = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "[]");
    return Array.isArray(data) && data.length > 0
      ? data
      : [{ id: "owner", name: "You", avatarColor: "#e11d48" }];
  } catch {
    return [{ id: "owner", name: "You", avatarColor: "#e11d48" }];
  }
}

function ProfilePage() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<LocalProfile[]>(readProfiles);
  const [activeProfileId, setActiveProfileId] = useState(() => {
    try {
      return localStorage.getItem("bujuu_active_profile_id") ?? "owner";
    } catch {
      return "owner";
    }
  });
  const [nameInput, setNameInput] = useState("");
  const history = useWatchHistory();
  const { downloads, removeDownload, clearAllDownloads } = useOfflineDownloads();

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? { id: "owner", name: "You", avatarColor: "#e11d48" };

  const switchTo = (target: LocalProfile) => {
    setActiveProfileId(target.id);
    try {
      localStorage.setItem("bujuu_active_profile_id", target.id);
    } catch {}
  };

  const saveProfiles = (next: LocalProfile[]) => {
    setProfiles(next);
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    } catch {}
  };

  const addProfile = () => {
    if (!nameInput.trim() || profiles.length >= 4) return;
    const next = [
      ...profiles,
      {
        id: crypto.randomUUID(),
        name: nameInput.trim(),
        avatarColor: (colors[profiles.length % colors.length] as string) || "#e11d48",
      },
    ];
    saveProfiles(next);
    setNameInput("");
    toast.success("Profile added");
  };

  const playDownloadedItem = (tmdbId: number, mediaType: "movie" | "tv", season?: number, episode?: number) => {
    void navigate({
      to: "/watch",
      search: {
        tmdbId,
        mediaType,
        season: season ?? 1,
        episode: episode ?? 1,
      },
    });
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl space-y-6 px-4 pb-28 pt-24 text-white lg:px-8">
        <header>
          <p className="text-xs font-bold uppercase tracking-widest text-rose-500">
            Cinema Experience
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-normal">Profile &amp; Downloads</h1>
        </header>

        {/* Profiles Section */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg">Profiles</h2>
              <p className="mt-1 text-xs text-zinc-400">Manage user profiles on this device</p>
            </div>
            <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-400">
              Active: {activeProfile.name}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-4">
            {profiles.map((item) => (
              <button
                key={item.id}
                onClick={() => switchTo(item)}
                className="flex w-20 flex-col items-center gap-2"
              >
                <span
                  className={`grid h-14 w-14 place-items-center rounded-2xl text-lg font-black transition-all ${
                    activeProfileId === item.id ? "ring-2 ring-rose-500 scale-105 shadow-lg shadow-rose-950/40" : "opacity-75 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: item.avatarColor }}
                >
                  {item.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate text-xs font-medium">{item.name}</span>
              </button>
            ))}
          </div>

          {profiles.length < 4 && (
            <div className="mt-6 flex gap-2">
              <Input
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                placeholder="New profile name"
                className="border-zinc-800 bg-black text-white"
              />
              <Button onClick={addProfile} className="bg-rose-600 hover:bg-rose-500 text-white font-semibold">
                Add profile
              </Button>
            </div>
          )}
        </section>

        {/* In-App Offline Downloads Manager */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <HardDrive className="h-5 w-5 text-emerald-400" />
              <div>
                <h2 className="font-bold text-lg">In-App Offline Downloads</h2>
                <p className="text-xs text-zinc-400">
                  {downloads.length} {downloads.length === 1 ? "title" : "titles"} ready for offline viewing
                </p>
              </div>
            </div>
            {downloads.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-zinc-400 hover:text-rose-400"
                onClick={clearAllDownloads}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Clear All
              </Button>
            )}
          </div>

          {downloads.length === 0 ? (
            <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-10 text-center">
              <Download className="h-8 w-8 text-zinc-600 mb-2" />
              <p className="text-sm font-semibold text-zinc-400">No downloaded titles yet</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                Tap the Download button on any movie or series episode to save it for offline playback.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {downloads.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl bg-zinc-900/70 border border-zinc-800/80 p-3 text-sm text-zinc-200"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400">
                      <Film className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">
                        {item.title}
                        {item.season && item.episode ? ` • S${item.season} E${item.episode}` : ""}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {item.quality} • {item.fileSize}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => playDownloadedItem(item.tmdbId, item.mediaType, item.season, item.episode)}
                      className="bg-white hover:bg-zinc-200 text-black font-bold h-8 px-3 rounded-lg flex items-center gap-1.5"
                    >
                      <Play className="h-3.5 w-3.5 fill-black" />
                      Play
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDownload(item.id)}
                      className="h-8 w-8 text-zinc-400 hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Watch History */}
        {history.data && history.data.length > 0 && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-rose-500" />
                <h2 className="font-bold text-lg">Watch History</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-zinc-400 hover:text-rose-400"
                onClick={() => history.clearHistory.mutate()}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Clear
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {history.data.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl bg-black/60 p-3 text-sm text-zinc-300"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Film className="h-4 w-4 shrink-0 text-rose-500" />
                    <span className="truncate">{item.title}</span>
                  </div>
                  <span className="text-xs text-zinc-500 uppercase">{item.media_type}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Support Section */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-rose-500" />
            <h2 className="font-bold text-lg">Help &amp; Support</h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-zinc-400">
            <a
              href="https://wa.me/254713767370"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-white"
            >
              <MessageCircle className="h-4 w-4 text-emerald-400" />
              WhatsApp
            </a>
            <a
              href="https://instagram.com/bu.j.uu"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-white"
            >
              <Instagram className="h-4 w-4 text-pink-400" />
              Instagram
            </a>
            <a href="tel:0713767370" className="flex items-center gap-1.5 hover:text-white">
              <Phone className="h-4 w-4 text-blue-400" />
              Phone
            </a>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
