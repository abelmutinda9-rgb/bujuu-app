import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Gift, Send, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useSession } from "@/hooks/use-account";
import { myReferrals } from "@/lib/account.functions";
import { myWithdrawals, requestReferralWithdrawal } from "@/lib/withdrawal.functions";
import { normalizeKenyanPhone } from "@/services/payhero";
import { toast } from "sonner";

export const Route = createFileRoute("/promoter")({
  head: () => ({
    meta: [
      { title: "Promoter & Referrals — BUJUU" },
      { name: "description", content: "View verified referral rewards and request a withdrawal." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PromoterPage,
});

function PromoterPage() {
  const { session, ready } = useSession();
  const [referrals, setReferrals] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const code = referrals?.code;
  const referralLink = code && typeof window !== "undefined" ? `${window.location.origin}/r/${code}` : "";

  const load = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [r, w] = await Promise.all([myReferrals(), myWithdrawals()]);
      setReferrals(r);
      setWallet(w);
    } catch (error: any) {
      toast.error(error?.message || "Could not load verified referral data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [session?.user.id]);

  const copyLink = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied.");
  };

  const shareWhatsApp = () => {
    if (!referralLink) return;
    const text = encodeURIComponent(`Try BUJUU: ${referralLink}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const withdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const cleanPhone = normalizeKenyanPhone(phone);
      await requestReferralWithdrawal({ data: { phone: cleanPhone, requestKey: crypto.randomUUID() } });
      toast.success("Withdrawal request submitted. Status is available in your wallet history.");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Withdrawal request could not be submitted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <main className="mx-auto min-h-screen max-w-5xl space-y-7 px-4 pb-24 pt-20 lg:px-12">
        <div className="border-b border-zinc-800 pb-5">
          <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"><ArrowLeft className="h-3.5 w-3.5"/>Home</Link>
          <h1 className="flex items-center gap-3 text-2xl font-black text-white"><Gift className="h-6 w-6 text-emerald-400"/>Referrals</h1>
          <p className="mt-1 text-sm text-zinc-400">Verified rewards and payouts are loaded from your signed-in account.</p>
        </div>
        {!ready ? <p className="text-sm text-zinc-400">Checking sign-in…</p> : !session ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">Sign in to view your personal referral code and wallet.</section>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              {[
                ["Invited", referrals?.invited ?? "—"],
                ["Paid referrals", referrals?.paying ?? "—"],
                ["Earned", wallet ? `KSh ${referrals?.earned ?? 0}` : "—"],
              ].map(([label, value]) => <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-2 text-2xl font-bold text-white">{value}</p></div>)}
            </section>
            <section className="space-y-4 rounded-2xl border border-emerald-900/60 bg-zinc-950 p-5">
              <h2 className="font-bold text-white">Your referral link</h2>
              <div className="flex flex-col gap-2 sm:flex-row"><input readOnly value={referralLink || (loading ? "Loading…" : "Unavailable")} className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200"/><button onClick={copyLink} disabled={!referralLink} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-50"><Copy className="h-4 w-4"/>Copy</button><button onClick={shareWhatsApp} disabled={!referralLink} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Send className="h-4 w-4"/>WhatsApp</button></div>
            </section>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
              <div className="mb-4 flex items-center gap-2 font-bold text-white"><Wallet className="h-4 w-4 text-emerald-400"/>Wallet</div>
              <p className="mb-4 text-sm text-zinc-400">Available: <strong className="text-white">KSh {wallet?.available ?? "—"}</strong> · Minimum: KSh {wallet?.minimum ?? 100}</p>
              <form onSubmit={withdraw} className="flex flex-col gap-2 sm:flex-row"><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="M-Pesa phone number" className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white" required/><button disabled={busy || !wallet || wallet.available < wallet.minimum || wallet.inProgress} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Submitting…" : "Request payout"}</button></form>
              <ul className="mt-4 space-y-2 text-xs text-zinc-400">{wallet?.history?.map((row: any) => <li key={row.id} className="flex justify-between border-t border-zinc-800 pt-2"><span>{row.phone} · {new Date(row.createdAt).toLocaleDateString()}</span><span>KSh {row.amount} · {row.status}</span></li>)}</ul>
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
