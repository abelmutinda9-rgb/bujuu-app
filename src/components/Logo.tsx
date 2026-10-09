import { Play } from "lucide-react";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Hide the wordmark and show only the emblem. */
  emblemOnly?: boolean;
}

export function Logo({ className, emblemOnly = false }: LogoProps) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-rose-600 to-rose-900 shadow-lg shadow-rose-600/30 sm:h-9 sm:w-9 lg:h-10 lg:w-10">
        <Play className="h-4 w-4 fill-current text-white sm:h-[18px] sm:w-[18px]" />
      </span>
      {!emblemOnly && (
        <span className="text-lg font-extrabold uppercase tracking-[0.2em] text-foreground sm:text-xl lg:text-2xl">
          bujuu
        </span>
      )}
    </span>
  );
}
