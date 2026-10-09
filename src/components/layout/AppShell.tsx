import { useState, type ReactNode } from "react";

import { useDpadNavigation } from "@/hooks/use-dpad";
import { cn } from "@/lib/utils";

import { Header } from "./Header";
import { NavBar } from "./NavBar";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  useDpadNavigation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <NavBar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main
        className={cn(
          "w-full pb-24 transition-all duration-300 ease-in-out lg:pb-12",
          collapsed ? "lg:pl-0" : "lg:pl-56",
        )}
      >
        {children}
      </main>

      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand menu"
          tabIndex={0}
          className="fixed bottom-4 left-4 z-50 hidden h-10 w-10 place-items-center rounded-full bg-black/70 text-foreground outline-none backdrop-blur-md transition-transform hover:bg-black/90 focus:scale-105 focus:ring-4 focus:ring-brand lg:grid"
        >
          <span className="text-lg leading-none">›</span>
        </button>
      )}
    </div>
  );
}
