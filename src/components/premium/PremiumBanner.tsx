import { Link } from "@tanstack/react-router";
import { Crown, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";

/** Home banner inviting viewers who have not paid yet. */
export function PremiumBanner() {
  const { premium, loading } = useAccess();
  if (loading || premium) return null;

  return (
    <section className="mx-4 mt-6 rounded-xl border border-brand/40 bg-brand/10 p-5 lg:mx-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Sparkles className="h-5 w-5 text-brand" />
            Go Premium — KSh 150 for 30 days
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every movie and series, no interruptions, on one device. Pay with M-Pesa in seconds.
          </p>
        </div>
        <Button asChild>
          <Link to="/subscribe">Subscribe with M-Pesa</Link>
        </Button>
      </div>
    </section>
  );
}

/** Small badge shown wherever the viewer's status is useful. */
export function PremiumBadge({ className }: { className?: string }) {
  const { premium } = useAccess();
  if (!premium) return null;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full bg-brand/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand " +
        (className ?? "")
      }
    >
      <Crown className="h-3 w-3" /> Premium
    </span>
  );
}
