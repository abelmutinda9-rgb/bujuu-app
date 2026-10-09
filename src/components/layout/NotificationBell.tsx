import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { listNotifications, markNotificationsRead } from "@/lib/notifications.functions";

export function NotificationBell() {
  const [signedIn, setSignedIn] = useState(false);
  const qc = useQueryClient();
  const list = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationsRead);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(Boolean(s)));
    return () => data.subscription.unsubscribe();
  }, []);

  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => list(),
    enabled: signedIn,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const read = useMutation({
    mutationFn: () => markRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const items = q.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <Popover onOpenChange={(open) => open && unread > 0 && read.mutate()}>
      <PopoverTrigger
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative grid h-9 w-9 place-items-center rounded-full text-foreground/90 transition-colors hover:bg-white/10"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b border-border px-4 py-3 text-sm font-semibold">Notifications</p>
        {!signedIn ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            <Link to="/auth" className="font-medium text-foreground underline">Sign in</Link> to see your notifications.
          </p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">You're all caught up.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {items.map((n) => (
              <li key={n.id} className="border-b border-border/50 px-4 py-3 last:border-0">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground/70">
                  {new Date(n.created_at).toLocaleString("en-KE")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
