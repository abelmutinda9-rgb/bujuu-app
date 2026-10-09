import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { signOutSession } from "@/lib/auth";
import { CheckCircle2, Gift, Headphones, Instagram, MessageCircle, Phone, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-account";
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
  const access = state;

  return (
    <AppShell>
      <div className="px-4 pb-24 pt-24 lg:px-8">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 shrink-0 rounded-md">
            <AvatarFallback className="rounded-md bg-secondary text-lg font-semibold">
              BJ
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">
              {email ?? "bujuu viewer"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {!signedIn ? "Not signed in" : loading ? "Checking your subscription…" : active ? "Premium Active" : needsTransfer ? "Active on another device" : "No active subscription"}
            </p>
          </div>
        </div>

        <div className="mt-8 max-w-md rounded-lg border border-border p-5">
          {active ? (
            <>
              <div className="flex items-center gap-2 text-brand">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">KSh 150 plan · 30 days</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Valid until{" "}
                {access?.expiresAt ? new Date(access.expiresAt).toLocaleDateString() : "—"} · this
                device only.
              </p>
              <Button asChild variant="secondary" className="mt-5 w-full">
                <Link to="/subscribe">Renew or move device</Link>
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldAlert className="h-5 w-5" />
                <span className="font-semibold text-foreground">Watching is locked</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Pay KSh 150 with M-Pesa for 30 days of unlimited movies and shows on one device.
              </p>
              <Button asChild className="mt-5 w-full">
                <Link to="/subscribe">Unlock bujuu</Link>
              </Button>
            </>
          )}
          {!signedIn && <div className="mt-3"><GoogleButton /></div>}
          {signedIn && (
            <button
              type="button"
              onClick={() => void signOutSession(queryClient, () => void navigate({ to: "/auth", replace: true }))}
              className="mt-3 w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Sign out
            </button>
          )}
          <button
            type="button"
            onClick={refresh}
            className="mt-3 w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Refresh status
          </button>
        </div>
        {signedIn && <InviteFriends />}
        <ContactSupport />
      </div>
    </AppShell>
  );
}

function ContactSupport() {
  const items = [
    { label: "WhatsApp", sub: "0713767370", href: "https://wa.me/254713767370", Icon: MessageCircle, external: true },
    { label: "Instagram", sub: "@bu.j.uu", href: "https://instagram.com/bu.j.uu", Icon: Instagram, external: true },
    { label: "Call Us", sub: "0713767370", href: "tel:+254713767370", Icon: Phone, external: false },
  ];
  return (
    <div className="mt-6 max-w-md rounded-lg border border-border p-5">
      <div className="flex items-center gap-2">
        <Headphones className="h-5 w-5 text-brand" />
        <span className="font-semibold">Contact &amp; Support</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Need help? Reach the bujuu team directly.</p>
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
  const q = useQuery({ queryKey: ["referrals"], queryFn: () => myReferrals() });
  const link = q.data ? `${window.location.origin}/r/${q.data.code}` : "";
  const share = async () => {
    if (!link) return;
    if (navigator.share) {
      await navigator.share({ title: "bujuu", text: "Watch movies on bujuu", url: link }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied.");
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
      <p className="mt-3 break-all rounded-md bg-secondary px-3 py-2 text-xs">{link || "Loading…"}</p>
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
