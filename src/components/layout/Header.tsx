import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { NotificationBell } from "@/components/layout/NotificationBell";
import { Logo } from "@/components/Logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
        scrolled ? "bg-black/85 backdrop-blur-md border-b border-white/5" : "bg-gradient-to-b from-black/90 to-transparent",
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 lg:px-8">
        <Link to="/" className="min-w-0" aria-label="BUJUU home">
          <Logo />
        </Link>

        <div className="flex shrink-0 items-center gap-2">
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
              <Avatar className="h-8 w-8 rounded-full border border-zinc-700">
                <AvatarFallback className="rounded-full bg-rose-600 text-xs font-bold text-white">
                  BJ
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-zinc-950 border-zinc-800 text-white">
              <DropdownMenuLabel>BUJUU Cinema</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem asChild>
                <Link to="/profile">Profile & Offline Downloads</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/my-list">My List</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem asChild>
                <Link to="/movies">Movies</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/tv">TV Shows</Link>
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
