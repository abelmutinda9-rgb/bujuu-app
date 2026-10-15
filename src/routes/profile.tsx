import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { signOutSession } from "@/lib/auth";
import {
  CheckCircle2,
  Copy,
  Gift,
  Headphones,
  Instagram,
  MessageCircle,
  Phone,
  Share2,
  ShieldAlert,
  Smartphone,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GoogleButton } from "@/components/GoogleButton";
import { useAccount, useSession } from "@/hooks/use-account";
import { supabase } from "@/integrations/supabase/client";
import { normalizeKenyanPhone } from "@/services/payhero";
import { buildReferralUrl } from "@/config/referral";
import { myReferrals } from "@/lib/account.functions";
import { myWithdrawals, requestReferralWithdrawal } from "@/lib/withdrawal.functions";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — bujuu" },
      { name: "description", content: "Check your bujuu subscription, invite friends, and manage this device." },
      { property: "og:title", content: "My Profile — bujuu" },
      {
        property: "og:description",
        content: "Check your bujuu subscription, invite friends, and manage this device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { signedIn, email, state, isPremium: active, refresh } = useAccount();
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
              Sign in with your Google account or email to keep your subscription and see your referral earnings.
            </p>
            <GoogleButton />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => void navigate({ to: "/auth", search: { redirect: "/profile" } })}
            >
              Sign in with Email Code
            </Button>
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
                  Signed in
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
                        <span className="font-semibold text-brand">Active Premium</span>
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

            <AppUpdatesSection />
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

interface ReferralStats {
  code: string;
  invited: number;
  paying: number;
  earned: number;
  withdrawn: number;
  available: number;
  reward: number;
  history: Array<{
    id: string;
    amount: number;
    phone: string;
    status: string;
    createdAt?: string;
  }>;
}

function InviteFriends() {
  const { session } = useSession();
  const userId = session?.user?.id;

  const q = useQuery<ReferralStats>({
    queryKey: ["referrals-v2", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        return {
          code: "BUJUU",
          invited: 0,
          paying: 0,
          earned: 0,
          withdrawn: 0,
          available: 0,
          reward: 30,
          history: [],
        };
      }

      let code = "";
      let invited = 0;
      let paying = 0;
      let earned = 0;
      let available = 0;
      let withdrawn = 0;
      let history: ReferralStats["history"] = [];

      try {
        // 1. Authoritative server function
        const summary = await myReferrals();
        code = summary.code;
        invited = summary.invited;
        paying = summary.paying;
        earned = summary.earned;

        try {
          const wSummary = await myWithdrawals();
          available = wSummary.available;
          withdrawn = Math.max(0, earned - available);
          history = wSummary.history || [];
        } catch {
          available = earned;
        }
      } catch (err) {
        console.warn("myReferrals server function failed; using direct Supabase queries:", err);

        // 2. Direct Supabase query fallback (NO localStorage)
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

        try {
          const { data: refs } = await supabase
            .from("referrals")
            .select("status")
            .eq("referrer_id", userId);
          if (refs) {
            invited = refs.length;
            paying = refs.filter((r) => r.status === "qualified").length;
            earned = paying * 30;
          }
        } catch {}

        try {
          const { data: wList } = await supabase
            .from("referral_withdrawals")
            .select("id, amount, phone, status, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

          if (wList) {
            history = wList.map((w) => ({
              id: w.id,
              amount: Number(w.amount) || 0,
              phone: w.phone,
              status: w.status,
              createdAt: w.created_at,
            }));
            withdrawn = history
              .filter((w) => w.status === "paid" || w.status === "pending" || w.status === "processing")
              .reduce((sum, w) => sum + w.amount, 0);
          }
        } catch {}

        available = Math.max(0, earned - withdrawn);
      }

      return {
        code: code || "BUJUU",
        invited,
        paying,
        earned,
        withdrawn,
        available,
        reward: 30,
        history,
      };
    },
  });

  const link = q.data?.code ? buildReferralUrl(q.data.code) : "";

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied to clipboard!");
    } catch {
      toast.info(link);
    }
  };

  const shareLink = async () => {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "BUJUU — Unlimited Movies & Shows",
          text: "Watch unlimited movies and series on BUJUU! Use my referral link to get started:",
          url: link,
        });
      } catch {}
    } else {
      await copyLink();
    }
  };

  return (
    <div className="mt-6 max-w-md rounded-lg border border-border p-5">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-brand" />
        <span className="font-semibold">Invite friends & earn</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Earn <strong className="text-foreground">KSh {q.data?.reward ?? 30}</strong> in cash for every friend who subscribes through your link.
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-md bg-secondary/80 p-2 text-xs">
        <span className="flex-1 truncate font-mono">{link || "Loading link…"}</span>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={copyLink} title="Copy link">
          <Copy className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 flex gap-2">
        <Button className="flex-1" variant="secondary" disabled={!link} onClick={shareLink}>
          <Share2 className="mr-2 h-4 w-4" /> Share invite link
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-card/60 p-3 text-center border border-border/50">
        <div>
          <p className="text-lg font-bold">{q.data?.invited ?? 0}</p>
          <p className="text-[11px] text-muted-foreground">Invited</p>
        </div>
        <div>
          <p className="text-lg font-bold text-brand">{q.data?.paying ?? 0}</p>
          <p className="text-[11px] text-muted-foreground">Subscribed</p>
        </div>
        <div>
          <p className="text-lg font-bold text-green-500">KSh {q.data?.earned ?? 0}</p>
          <p className="text-[11px] text-muted-foreground">Earned</p>
        </div>
      </div>

      {userId && q.data && (
        <WithdrawSection stats={q.data} userId={userId} />
      )}
    </div>
  );
}

function WithdrawSection({ stats, userId }: { stats: ReferralStats; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const eligible = stats.available >= 30;

  const handleWithdraw = async () => {
    if (busy) return;
    setBusy(true);

    try {
      const cleanPhone = normalizeKenyanPhone(phone);

      // Attempt authoritative server withdrawal first
      try {
        await requestReferralWithdrawal({
          data: {
            phone: cleanPhone,
            requestKey: crypto.randomUUID(),
          },
        });
      } catch (serverErr: any) {
        console.warn("requestReferralWithdrawal server call failed; trying direct Supabase RPC:", serverErr);
        // Fallback to direct Supabase RPC if offline/client-only
        const { error: rpcErr } = await supabase.rpc("reserve_referral_withdrawal", {
          _user_id: userId,
          _phone: cleanPhone,
          _request_key: `${userId}:${Date.now()}`,
          _min: 30,
        });
        if (rpcErr) throw rpcErr;
      }

      toast.success("Withdrawal requested successfully for KSh " + stats.available);

      // Also provide WhatsApp link for direct disbursement assistance
      const msg = encodeURIComponent(
        `Hello BUJUU Support! I have requested a referral withdrawal of KSh ${stats.available} for my account (${userId.slice(0, 8)}) to M-Pesa number ${cleanPhone}.`
      );
      window.open(`https://wa.me/254713767370?text=${msg}`, "_blank");

      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["referrals-v2"] });
    } catch (e: any) {
      toast.error(e?.message || "Could not process withdrawal request.");
    } finally {
      setBusy(false);
    }
  };

  const history = stats.history || [];

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Available to withdraw</p>
          <p className="text-xl font-bold text-green-500">KSh {stats.available}</p>
        </div>
        <Button
          size="sm"
          disabled={!eligible}
          onClick={() => setOpen(true)}
          className="bg-brand hover:bg-brand/90"
        >
          <Wallet className="mr-1.5 h-4 w-4" /> Withdraw
        </Button>
      </div>

      {stats.available < 30 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Minimum withdrawal is KSh 30 (1 paying friend).
        </p>
      )}

      {history.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground">Recent withdrawal requests</p>
          <div className="mt-2 space-y-1.5">
            {history.slice(0, 3).map((h) => (
              <div key={h.id} className="flex justify-between items-center text-xs rounded bg-secondary/50 px-2 py-1.5">
                <span>KSh {h.amount} · {h.phone}</span>
                <span className="font-medium text-amber-500 capitalize">{h.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Referral Earnings</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-secondary/50 p-3 text-sm">
              <p className="text-muted-foreground">Available balance:</p>
              <p className="text-2xl font-bold text-green-500">KSh {stats.available}</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-sm font-medium">
                M-Pesa Phone Number
              </label>
              <Input
                id="phone"
                placeholder="0712 345 678 or 254..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Earnings will be sent directly to this M-Pesa number.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={busy || !phone.trim() || stats.available < 30}
              className="bg-brand hover:bg-brand/90"
            >
              {busy ? "Submitting..." : `Withdraw KSh ${stats.available}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AppUpdatesSection() {
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    versionName: string;
    versionCode: number;
    apkUrl: string;
    releaseNotes: string;
    isNewer: boolean;
  } | null>(null);

  const checkUpdates = async () => {
    setChecking(true);
    try {
      const res = await fetch("/version.json?t=" + Date.now());
      if (!res.ok) throw new Error("Could not fetch version info");
      const data = await res.json();
      const currentCode = 4; // v1.3
      const isNewer = Number(data.versionCode) > currentCode;
      setUpdateInfo({
        versionName: data.versionName || "1.3",
        versionCode: Number(data.versionCode) || 4,
        apkUrl: data.apkUrl || "https://github.com/abelmutinda9-rgb/bujuu-app/releases/download/latest/bujuu-app.apk",
        releaseNotes: data.releaseNotes || "",
        isNewer,
      });
      if (!isNewer) {
        toast.success("BUJUU is up to date (v1.3)");
      } else {
        toast.info("New version available: v" + data.versionName);
      }
    } catch {
      toast.error("Could not check for updates. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mt-6 max-w-md rounded-lg border border-border p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">BUJUU App Version</p>
          <p className="text-xs text-muted-foreground">Installed: v1.3 (Build 4)</p>
        </div>
        <Button size="sm" variant="outline" disabled={checking} onClick={checkUpdates}>
          {checking ? "Checking..." : "Check for updates"}
        </Button>
      </div>

      {updateInfo && updateInfo.isNewer && (
        <div className="mt-4 rounded-md bg-secondary/80 p-3 text-xs">
          <p className="font-semibold text-foreground">Update Available: v{updateInfo.versionName}</p>
          <p className="text-muted-foreground mt-1">{updateInfo.releaseNotes}</p>
          <a
            href={updateInfo.apkUrl}
            download="bujuu-app.apk"
            className="mt-3 inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Download & Update APK
          </a>
        </div>
      )}
    </div>
  );
}
