import { Link } from "@tanstack/react-router";
import { Film, Flame, Home, PanelLeftClose, Search, Tv, User } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/movies", label: "Movies", icon: Film },
  { to: "/tv", label: "TV Shows", icon: Tv },
  { to: "/new", label: "New & Hot", icon: Flame },
  { to: "/profile", label: "My Profile", icon: User },
] as const;


interface NavBarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function NavBar({ collapsed, onToggle }: NavBarProps) {
  return (
    <>
      {/* Mobile / tablet: fixed bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-black/80 backdrop-blur-md lg:hidden">
        <ul className="flex items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
          {items.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <Link
                to={to}
                tabIndex={0}
                activeOptions={{ exact: to === "/" }}
                activeProps={{ className: "text-foreground" }}
                inactiveProps={{ className: "text-muted-foreground" }}
                className="flex flex-col items-center gap-1 py-2 text-[10px] font-medium outline-none transition-transform focus:scale-105 focus:ring-4 focus:ring-brand"
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Desktop / TV: collapsible side menu */}
      <nav
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col gap-1 overflow-hidden border-r border-border bg-sidebar/80 backdrop-blur-md transition-all duration-300 ease-in-out lg:flex",
          collapsed ? "w-0 border-r-0 pt-0 opacity-0" : "w-56 pt-20 opacity-100",
        )}
        aria-hidden={collapsed}
      >
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            tabIndex={collapsed ? -1 : 0}
            activeOptions={{ exact: to === "/" }}
            activeProps={{ className: "bg-white/10 text-foreground" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className="mx-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium outline-none transition-all hover:bg-white/5 focus:ring-4 focus:ring-brand"
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        ))}

        <button
          type="button"
          onClick={onToggle}
          tabIndex={collapsed ? -1 : 0}
          className="mx-2 mt-auto mb-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground outline-none transition-all hover:bg-white/5 focus:ring-4 focus:ring-brand"
          aria-label="Collapse menu"
        >
          <PanelLeftClose className="h-5 w-5 shrink-0" />
          <span>Collapse</span>
        </button>
      </nav>
    </>
  );
}
