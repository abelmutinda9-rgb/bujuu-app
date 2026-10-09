import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { signOutSession } from "@/lib/auth";
import { Search } from "lucide-react";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useEffect, useState } from "react";

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
  const queryClient = useQueryClient();
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
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        scrolled ? "bg-black/60 backdrop-blur-md" : "bg-gradient-to-b from-black/80 to-transparent",
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 lg:px-8">
        <Link to="/" className="min-w-0" aria-label="bujuu home">
          <Logo />
        </Link>


        <div className="flex shrink-0 items-center gap-1">
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
              <Avatar className="h-8 w-8 rounded-md">
                <AvatarFallback className="rounded-md bg-secondary text-xs font-semibold text-secondary-foreground">
                  BJ
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>My account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile">My Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/movies">Movies</Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link to="/new">New &amp; Hot</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/download">Get the app</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() =>
                  void signOutSession(queryClient, () => void navigate({ to: "/auth", replace: true }))
                }
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
