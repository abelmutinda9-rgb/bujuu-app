import { Link, useNavigate } from "@tanstack/react-router";
import { Search, Baby, UserCheck } from "lucide-react";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useEffect, useState } from "react";

import { Logo } from "@/components/Logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useProfile } from "@/context/profile-context";

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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        scrolled ? "bg-black/80 backdrop-blur-md" : "bg-gradient-to-b from-black/80 to-transparent",
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 lg:px-8">
        <div className="flex items-center gap-2">
          <Link to="/" className="min-w-0" aria-label="bujuu home">
            <Logo />
          </Link>
          {isKids && (
            <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-black shadow-sm">
              KIDS
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Quick Profile Toggle */}
          <button
            type="button"
            tabIndex={0}
            onClick={() => switchProfile(isKids ? "adult" : "kids")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all outline-none focus:ring-2 focus:ring-rose-500",
              isKids
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                : "bg-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-700"
            )}
            title={isKids ? "Switch to Adult profile" : "Switch to Kids profile"}
          >
            {isKids ? <Baby className="h-3.5 w-3.5 text-amber-400" /> : <UserCheck className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isKids ? "Kids Mode" : "Adult Mode"}</span>
          </button>

          <Link
            to="/search"
            aria-label="Search"
            className="grid h-9 w-9 place-items-center rounded-full text-foreground/90 transition-colors hover:bg-white/10"
          >
            <Search className="h-5 w-5" />
          </Link>
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Profile menu" className="ml-1 outline-none">
              <Avatar className="h-8 w-8 rounded-md border border-zinc-700">
                <AvatarFallback className={cn("rounded-md text-xs font-bold", isKids ? "bg-amber-500 text-black" : "bg-rose-600 text-white")}>
                  {isKids ? "KD" : "AD"}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-zinc-900 border-zinc-800 text-white">
              <DropdownMenuLabel className="flex justify-between items-center">
                <span>Profile</span>
                <span className="text-[10px] text-zinc-400 font-normal uppercase">{profile}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onClick={() => switchProfile(isKids ? "adult" : "kids")}>
                {isKids ? "Switch to Adult Profile" : "Switch to Kids Profile"}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/profile">Profile & Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/subscribe">Subscription & Restore</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem asChild>
                <Link to="/movies">Movies</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/new">New &amp; Hot</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
