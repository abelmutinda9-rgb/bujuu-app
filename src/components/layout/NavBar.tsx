import { Link } from "@tanstack/react-router";
import { Film, Flame, Home, PanelLeftClose, Search, Tv, User, Download, Gift } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/movies", label: "Movies", icon: Film },
  { to: "/tv", label: "TV Shows", icon: Tv },
  { to: "/downloads", label: "Downloads", icon: Download },
  { to: "/promoter", label: "Promoter", icon: Gift },
  { to: "/profile", label: "Profile", icon: User },
] as const;

interface NavBarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function NavBar({ collapsed, onToggle }: NavBarProps) {
  return (
    <>
      {/* Mobile / tablet: fixed bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl lg:hidden">
        <ul className="flex items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)]">
          {items.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <Link
                to={to}
                tabIndex={0}
                activeOptions={{ exact: to === "/" }}
                activeProps={{ className: "text-rose-500 font-bold" }}
                inactiveProps={{ className: "text-zinc-400" }}
                className="flex flex-col items-center gap-1 py-2 text-[10px] font-medium outline-none transition-all focus:scale-105"
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Desktop / TV: collapsible side menu */}
      <nav
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col gap-1.5 overflow-hidden border-r border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl transition-all duration-300 ease-in-out lg:flex",
          collapsed ? "w-0 border-r-0 pt-0 opacity-0" : "w-56 pt-20 opacity-100",
        )}
        aria-hidden={collapsed}
      >
        <div className="px-3 pb-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
          Browse Catalog
        </div>
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            tabIndex={collapsed ? -1 : 0}
            activeOptions={{ exact: to === "/" }}
            activeProps={{ className: "bg-rose-500/15 text-rose-400 font-semibold border-l-2 border-rose-500" }}
            inactiveProps={{ className: "text-zinc-400 hover:text-white hover:bg-zinc-900" }}
            className="mx-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium outline-none transition-all focus:ring-2 focus:ring-rose-500"
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        ))}

        <button
          type="button"
          onClick={onToggle}
          tabIndex={collapsed ? -1 : 0}
          className="mx-2 mt-auto mb-4 flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-zinc-400 outline-none transition-all hover:bg-zinc-900 hover:text-white"
          aria-label="Collapse menu"
        >
          <PanelLeftClose className="h-4 w-4 shrink-0" />
          <span>Collapse</span>
        </button>
      </nav>
    </>
  );
}
