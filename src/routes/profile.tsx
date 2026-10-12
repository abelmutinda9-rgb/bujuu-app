import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { signOutSession } from "@/lib/auth";
import { CheckCircle2, Gift, Headphones, Instagram, MessageCircle, Phone, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAccount, useSession } from "@/hooks/use-account";
import { supabase } from "@/integrations/supabase/client";
import { myReferrals } from "@/lib/account.functions";
import { myWithdrawals, requestReferralWithdrawal } from "@/lib/withdrawal.functions";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GoogleButton } from "@/components/GoogleButton";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — bujuu" },
      { name: "description", content: "Check your bujuu subscription and manage this device." },
      { property: "og:title", content: "My Profile — bujuu" },
      {
        property: "og:description",
        content: "Check your bujuu subscription and manage this device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { signedIn, email, state, isPremium: active, needsTransfer, loading, refresh } = useAccount();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOutSession();
      refresh();
      toast.success("Signed out");
    } catch {
      toast.error("Could not sign out");
    }
  };

  const initial = (email ?? "U").charAt(0).toUpperCase();

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-24 lg:px-8">
        <h1 className="text-2xl font-bold">My Profile</h1>

        {!signedIn ? (
          <div className="mt-6 space-y-4 rounded-lg border border-border p-6">
            <p className="text-sm text-muted-foreground">
              Sign in with your Google account to keep your subscription across installs and see your account status.
            </p>
            <GoogleButton />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex items-center gap-4 rounded-lg border border-border p-5">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-brand/20 text-brand text-lg font-bold">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{email}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Signed in with Google
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>

            <div className="rounded-lg border border-border p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Subscription</p>
                  <div className="flex items-center gap-2 mt-1">
                    {active ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-brand" />
                        <span className="font-semibold text-brand">Active</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-muted-foreground">
                          {state?.status === "EXPIRED" ? "Expired" : "No active subscription"}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {!active && (
                  <Button size="sm" onClick={() => void navigate({ to: "/subscribe" })}>
                    Subscribe (KSh 150)
                  </Button>
                )}
              </div>

              {state?.expiresAt && (
                <p className="text-xs text-muted-foreground mt-3">
                  {active ? "Renews/expires on: " : "Expired on: "}
                  {new Date(state.expiresAt).toLocaleDateString()}
                </p>
              )}

              {state?.phone && (
                <p className="text-xs text-muted-foreground mt-1">
                  M-Pesa number: {state.phone}
                </p>
              )}
            </div>

            <InviteFriends />

            <ContactSupport />
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ContactSupport() {
  const items = [
    { label: "WhatsApp", sub: "0713767370", href: "https://wa.me/254713767370", Icon: MessageCircle, external: true },
    { label: "Instagram", sub: "@bu.j.uu", href: "https://instagram.com/bu.j.uu", Icon: Instagram, external: true },
    { label: "Phone", sub: "0713767370", href: "tel:0713767370", Icon: Phone, external: true },
  ];

  return (
    <div className="mt-6 max-w-md rounded-lg border border-border p-5">
      <div className="flex items-center gap-2">
        <Headphones className="h-5 w-5 text-brand" />
        <span className="font-semibold">Contact & Support</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Need help with your subscription or playback? Reach out anytime.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {items.map(({ label, sub, href, Icon, external }) => (
          <a
            key={label}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="flex flex-col items-center gap-1.5 rounded-md bg-secondary px-2 py-3 text-center transition-colors hover:bg-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Icon className="h-5 w-5 text-brand" />
            <span className="text-sm font-semibold">{label}</span>
            <span className="text-[11px] text-muted-foreground">{sub}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function InviteFriends() {
  const { session } = useSession();
  const userId = session?.user?.id;

  const q = useQuery({
    queryKey: ["referrals", userId],
    queryFn: async () => {
      try {
        return await myReferrals();
      } catch (err) {
        // Fallback for native Android or when remote server is unreachable
        let code = "";
        if (userId) {
          try {
            const { data: codeRow } = await supabase
              .from("referral_codes")
              .select("code")
              .eq("user_id", userId)
              .maybeSingle();
            if (codeRow?.code) code = codeRow.code;
          } catch {}

          if (!code) {
            code = userId.replace(/-/g, "").slice(0, 8).toUpperCase();
          }
        } else {
          code = "BUJUU";
        }

        let invited = 0;
        let paying = 0;
        let earned = 0;

        if (userId) {
          try {
            const { data: refs } = await supabase
              .from("referrals")
              .select("status")
              .eq("referrer_id", userId);
            if (refs) {
              invited = refs.length;
              paying = refs.filter((r) => r.status === "qualified").length;
            }
          } catch {}

          try {
            const { data: ledger } = await supabase
              .from("referral_ledger")
              .select("amount, kind")
              .eq("user_id", userId);
            if (ledger) {
              earned = ledger.reduce(
                (acc, l) => acc + (l.kind === "reward" ? l.amount : -l.amount),
                0
              );
            }
          } catch {}
        }

        return { code, invited, paying, earned, reward: 30 };
      }
    },
  });

  const isNative = typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform?.();
  const baseOrigin = isNative ? "https://lynnn.lovable.app" : window.location.origin;
  const link = q.data?.code ? `${baseOrigin}/r/${q.data.code}` : "";

  const share = async () => {
    if (!link) return;
    if (navigator.share) {
      await navigator.share({
        title: "bujuu",
        text: "Watch unlimited movies on bujuu! Use my link to join:",
        url: link,
      }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied to clipboard.");
    }
  };

  return (
    <div className="mt-6 max-w-md rounded-lg border border-border p-5">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-brand" />
        <span className="font-semibold">Invite friends</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Earn KSh {q.data?.reward ?? 30} for every friend who subscribes through your link.
      </p>
      <p className="mt-3 break-all rounded-md bg-secondary px-3 py-2 text-xs">
        {q.isLoading ? "Loading…" : link ? link : "Invite code available online."}
      </p>
      <Button className="mt-3 w-full" variant="secondary" disabled={!link} onClick={share}>
        Share link
      </Button>
      {q.data && (
        <p className="mt-3 text-xs text-muted-foreground">
          {q.data.invited} invited · {q.data.paying} subscribed · KSh {q.data.earned} earned
        </p>
      )}
      <Withdraw />
    </div>
  );
}

const STATUS_LABEL = { pending: "Pending", processing: "Processing", paid: "Paid", failed: "Failed" } as const;

function Withdraw() {
  const qc = useQueryClient();
  const fetchW = useServerFn(myWithdrawals);
  const submit = useServerFn(requestReferralWithdrawal);
  const q = useQuery({ queryKey: ["withdrawals"], queryFn: () => fetchW() });
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const d = q.data;
  if (!d) return null;
  const eligible = d.available >= d.minimum && !d.inProgress;

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await submit({ data: { phone, requestKey } });
      toast.success("Withdrawal requested.");
      setOpen(false);
      setRequestKey(crypto.randomUUID());
      await qc.invalidateQueries({ queryKey: ["withdrawals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not request the withdrawal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="text-xs text-muted-foreground">Available to withdraw</p>
      <p className="text-2xl font-bold">KSh {d.available}</p>
      <p className="text-xs text-muted-foreground">Minimum withdrawal: KSh {d.minimum}</p>
      <Button className="mt-3 w-full" disabled={!eligible} onClick={() => setOpen(true)}>
        {d.inProgress ? "Withdrawal in progress" : `Withdraw KSh ${d.available}`}
      </Button>

      {d.history.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold">Withdrawal history</p>
          <ul className="mt-2 space-y-1.5">
            {d.history.map((h) => (
              <li key={h.id} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span>KSh {h.amount} · {h.phone} · {new Date(h.createdAt).toLocaleDateString()}</span>
                  <span className={h.status === "paid" ? "text-brand" : h.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
                    {STATUS_LABEL[h.status]}
                  </span>
                </div>
                {h.failure && <p className="text-muted-foreground">{h.failure}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw referral earnings</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Amount</p>
              <p className="text-xl font-bold">KSh {d.available}</p>
            </div>
            <div>
              <label htmlFor="wd-phone" className="text-xs text-muted-foreground">M-Pesa number</label>
              <Input id="wd-phone" inputMode="tel" placeholder="07XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy || phone.trim().length < 9} onClick={confirm}>
              {busy ? "Submitting…" : "Confirm withdrawal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
