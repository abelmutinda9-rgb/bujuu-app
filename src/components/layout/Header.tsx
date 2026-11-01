import { Link, useNavigate } from "@tanstack/react-router";
import { Search, Baby, UserCheck, Sparkles, Download, Shield, Crown } from "lucide-react";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useEffect, useState } from "react";

import { Logo } from "@/components/Logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useProfile } from "@/context/profile-context";
import { useDeviceTrial } from "@/hooks/use-device-trial";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { profile, isKids, switchProfile } = useProfile();
  const trial = useDeviceTrial();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-300",
        scrolled ? "bg-black/90 backdrop-blur-xl border-b border-zinc-800/60 shadow-xl" : "bg-gradient-to-b from-black/95 via-black/60 to-transparent",
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Link to="/" className="min-w-0" aria-label="bujuu home">
            <Logo />
          </Link>

          {isKids && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
              <Baby className="h-3 w-3" />
              Kids Mode
            </span>
          )}

          {/* Real-time VIP / Trial pill */}
          <Link
            to="/subscribe"
            className={cn(
              "hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all shadow-sm",
              trial.status === "active"
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                : trial.status === "trial"
                  ? "bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25"
                  : "bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500/30 animate-pulse"
            )}
          >
            <Crown className="h-3.5 w-3.5" />
            {trial.status === "active" ? (
              <span>VIP Active ({trial.daysRemaining}d)</span>
            ) : trial.status === "trial" ? (
              <span>Trial: {trial.daysRemaining}d left</span>
            ) : (
              <span>Upgrade to VIP</span>
            )}
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/search"
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-300 transition-colors hover:text-white hover:bg-zinc-800"
          >
            <Search className="h-4 w-4" />
          </Link>

          <Link
            to="/downloads"
            aria-label="Downloads"
            className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-300 transition-colors hover:text-white hover:bg-zinc-800"
            title="Downloads & Offline Library"
          >
            <Download className="h-4 w-4" />
          </Link>

          <NotificationBell />

          {/* Profile Switcher & Options Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl p-1 transition-colors hover:bg-zinc-800/80 focus:outline-none"
              >
                <Avatar className="h-8 w-8 border border-zinc-700">
                  <AvatarFallback
                    className={cn(
                      "font-black text-xs",
                      isKids ? "bg-amber-500 text-black" : "bg-rose-600 text-white"
                    )}
                  >
                    {isKids ? "K" : "A"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56 bg-zinc-950 border-zinc-800 p-1.5 shadow-2xl">
              <DropdownMenuLabel className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2 py-1">
                Active Profile
              </DropdownMenuLabel>

              <DropdownMenuItem
                onClick={() => switchProfile("adult")}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs font-semibold cursor-pointer",
                  !isKids ? "bg-rose-500/20 text-rose-400 font-bold" : "text-zinc-300 hover:bg-zinc-900"
                )}
              >
                <UserCheck className="h-4 w-4" />
                <span>Adult (Full Catalog)</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => switchProfile("kids")}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs font-semibold cursor-pointer",
                  isKids ? "bg-amber-500/20 text-amber-400 font-bold" : "text-zinc-300 hover:bg-zinc-900"
                )}
              >
                <Baby className="h-4 w-4" />
                <span>Kids (Safe & Filtered)</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-zinc-800 my-1" />

              <DropdownMenuItem
                onClick={() => navigate({ to: "/subscribe" })}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-900 cursor-pointer"
              >
                <Crown className="h-4 w-4 text-amber-400" />
                <span>Subscription Plan</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => navigate({ to: "/promoter" })}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-900 cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span>Promoter & Referrals</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => navigate({ to: "/downloads" })}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-900 cursor-pointer"
              >
                <Download className="h-4 w-4 text-rose-400" />
                <span>Offline Downloads</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-zinc-800 my-1" />

              <DropdownMenuItem
                onClick={() => navigate({ to: "/admin" })}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-900 cursor-pointer"
              >
                <Shield className="h-4 w-4 text-zinc-400" />
                <span>Admin Command Center</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
