import { createFileRoute } from "@tanstack/react-router";
import { Film, Headphones, History, Instagram, MessageCircle, Phone, Shield, Sparkles, Trash2, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PinModal } from "@/components/PinModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/context/profile-context";
import { useWatchHistory } from "@/hooks/use-library";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

type LocalProfile = { id: string; name: string; avatarColor: string; isKids: boolean };
const PROFILE_KEY = "bujuu_profiles";
const colors = ["#be123c", "#7c3aed", "#0369a1", "#15803d"];

function readProfiles(): LocalProfile[] {
  try {
    const data = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function ProfilePage() {
  const { isKids, switchProfile, pin, setParentPin } = useProfile();
  const [profiles, setProfiles] = useState<LocalProfile[]>(readProfiles);
  const [activeProfileId, setActiveProfileId] = useState(() => {
    try {
      return localStorage.getItem("bujuu_active_profile_id") ?? "owner";
    } catch {
      return "owner";
    }
  });
  const [pinInput, setPinInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const history = useWatchHistory();

  const switchTo = (target: LocalProfile | { id: string; name: string; isKids: boolean }) => {
    if (target.isKids) {
      setActiveProfileId(target.id);
      try {
        localStorage.setItem("bujuu_active_profile_id", target.id);
      } catch {}
      switchProfile("kids");
      return;
    }
    if (isKids && pin) {
      switchProfile("adult");
      return;
    }
    setActiveProfileId(target.id);
    try {
      localStorage.setItem("bujuu_active_profile_id", target.id);
    } catch {}
    switchProfile("adult");
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
        avatarColor: colors[profiles.length % colors.length] ?? "#be123c",
        isKids: false,
      },
    ];
    saveProfiles(next);
    setNameInput("");
    toast.success("Profile added");
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl space-y-6 px-4 pb-24 pt-24 text-white lg:px-8">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-rose-500">
            Cinema Experience
          </p>
          <h1 className="mt-2 text-3xl font-bold">Profiles & Settings</h1>
        </header>

        {/* Profiles Section */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg">Who's watching?</h2>
              <p className="mt-1 text-xs text-zinc-400">Personalized profiles for family & kids</p>
            </div>
            <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-400">
              {isKids ? "Kids Mode Active" : "Adult Mode Active"}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-4">
            <button
              onClick={() => switchTo({ id: "owner", name: "You", isKids: false })}
              className="flex w-24 flex-col items-center gap-2"
            >
              <span
                className={`grid h-16 w-16 place-items-center rounded-2xl text-xl font-black transition-all ${
                  activeProfileId === "owner" ? "ring-2 ring-rose-500 scale-105" : "opacity-80"
                }`}
                style={{ backgroundColor: colors[0] }}
              >
                Y
              </span>
              <span className="truncate text-xs font-medium">You</span>
            </button>

            {profiles.map((item) => (
              <button
                key={item.id}
                onClick={() => switchTo(item)}
                className="flex w-24 flex-col items-center gap-2"
              >
                <span
                  className={`grid h-16 w-16 place-items-center rounded-2xl text-xl font-black transition-all ${
                    activeProfileId === item.id ? "ring-2 ring-rose-500 scale-105" : "opacity-80"
                  }`}
                  style={{ backgroundColor: item.avatarColor }}
                >
                  {item.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate text-xs font-medium">
                  {item.name}
                  {item.isKids ? " · Kids" : ""}
                </span>
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
              <Button onClick={addProfile} className="bg-rose-600 hover:bg-rose-500">
                Add profile
              </Button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-zinc-700 bg-zinc-900 text-xs"
              onClick={() => switchTo({ id: "kids", name: "Kids", isKids: true })}
            >
              Switch to Kids Mode
            </Button>
            <Button
              variant="outline"
              className="border-zinc-700 bg-zinc-900 text-xs"
              onClick={() => {
                const name = window.prompt("Rename this profile:");
                if (!name?.trim()) return;
                const next = profiles.map((item) =>
                  item.id === activeProfileId ? { ...item, name: name.trim() } : item
                );
                saveProfiles(next);
              }}
            >
              Rename selected
            </Button>
          </div>

          {/* Kids Mode PIN */}
          <div className="mt-6 border-t border-zinc-800 pt-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="h-4 w-4 text-amber-400" />
              Kids Mode PIN Protection
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinInput}
                onChange={(event) =>
                  setPinInput(event.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder={pin ? "PIN configured" : "Set 4-digit PIN"}
                className="border-zinc-800 bg-black text-white"
              />
              <Button
                onClick={() => {
                  if (pinInput.length !== 4) { toast.error("PIN must be exactly 4 digits"); return; }
                  setParentPin(pinInput);
                  setPinInput("");
                  toast.success("Kids PIN saved");
                }}
                className="bg-rose-600 hover:bg-rose-500"
              >
                Save PIN
              </Button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">Leaving Kids Mode prompts for this PIN.</p>
          </div>
        </section>

        <PinModal />

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
            <h2 className="font-bold text-lg">Help & Support</h2>
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
