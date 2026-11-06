import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Copy, Film, Gift, Headphones, History, Instagram, MessageCircle, Phone, Shield, ShieldAlert, Smartphone, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { GoogleButton } from "@/components/GoogleButton";
import { PinModal } from "@/components/PinModal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/context/profile-context";
import { useAccount, useSession } from "@/hooks/use-account";
import { useDeviceTrial } from "@/hooks/use-device-trial";
import { useWatchHistory } from "@/hooks/use-library";
import { buildReferralUrl } from "@/config/referral";
import { myReferrals } from "@/lib/account.functions";
import { myWithdrawals, requestReferralWithdrawal } from "@/lib/withdrawal.functions";
import { normalizeKenyanPhone } from "@/services/payhero";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

type LocalProfile = { id: string; name: string; avatarColor: string; isKids: boolean };
const PROFILE_KEY = "bujuu_profiles";
const colors = ["#be123c", "#7c3aed", "#0369a1", "#15803d"];
function readProfiles(): LocalProfile[] {
  try { const data = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "[]"); return Array.isArray(data) ? data : []; } catch { return []; }
}

function ProfilePage() {
  const { profile, isKids, switchProfile, pin, setParentPin } = useProfile();
  const { signedIn, email, state, isPremium, refresh } = useAccount();
  const trial = useDeviceTrial();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<LocalProfile[]>(readProfiles);
  const [activeProfileId, setActiveProfileId] = useState(() => { try { return localStorage.getItem("bujuu_active_profile_id") ?? "owner"; } catch { return "owner"; } });
  const [pinInput, setPinInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const family = (() => { try { return localStorage.getItem("bujuu_subscription_plan") === "family"; } catch { return false; } })();
  const maximum = family ? 4 : 1;
  const switchTo = (target: LocalProfile | { id: string; name: string; isKids: boolean }) => {
    if (target.isKids) {
      setActiveProfileId(target.id); try { localStorage.setItem("bujuu_active_profile_id", target.id); } catch {}
      switchProfile("kids");
      return;
    }
    if (isKids && pin) { switchProfile("adult"); return; }
    setActiveProfileId(target.id); try { localStorage.setItem("bujuu_active_profile_id", target.id); } catch {}
    switchProfile("adult");
  };
  const saveProfiles = (next: LocalProfile[]) => { setProfiles(next); try { localStorage.setItem(PROFILE_KEY, JSON.stringify(next)); } catch {} };
  const addProfile = () => {
    if (!nameInput.trim() || profiles.length + 1 >= maximum) return;
    const next = [...profiles, { id: crypto.randomUUID(), name: nameInput.trim(), avatarColor: colors[profiles.length % colors.length], isKids: false }];
    saveProfiles(next); setNameInput("");
  };
  const { session } = useSession();
  const history = useWatchHistory();
  return <AppShell><main className="mx-auto max-w-3xl space-y-6 px-4 pb-24 pt-24 text-white lg:px-8">
    <header><p className="text-xs font-bold uppercase tracking-[0.25em] text-rose-500">Account</p><h1 className="mt-2 text-3xl font-bold">Profiles & Wallet</h1></header>
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex items-center justify-between"><div><h2 className="font-bold">Who's watching?</h2><p className="mt-1 text-xs text-zinc-400">{family ? "Family plan · up to 4 profiles" : "Solo plan · 1 profile"}</p></div><span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-400">{isKids ? "Kids" : "Adult"} active</span></div>
      <div className="mt-4 flex flex-wrap gap-4">
        <button onClick={() => switchTo({ id: "owner", name: email?.split("@")[0] ?? "You", isKids: false })} className="flex w-24 flex-col items-center gap-2"><span className={`grid h-16 w-16 place-items-center rounded-xl text-xl font-black ${activeProfileId === "owner" ? "ring-2 ring-rose-500" : ""}`} style={{ backgroundColor: colors[0] }}>{(email ?? "U").charAt(0).toUpperCase()}</span><span className="truncate text-xs">{email?.split("@")[0] ?? "You"}</span></button>
        {profiles.map((item) => <button key={item.id} onClick={() => switchTo(item)} className="flex w-24 flex-col items-center gap-2"><span className={`grid h-16 w-16 place-items-center rounded-xl text-xl font-black ${activeProfileId === item.id ? "ring-2 ring-rose-500" : ""}`} style={{ backgroundColor: item.avatarColor }}>{item.name.charAt(0).toUpperCase()}</span><span className="truncate text-xs">{item.name}{item.isKids ? " · Kids" : ""}</span></button>)}
      </div>
      {family && profiles.length + 1 < maximum && <div className="mt-4 flex gap-2"><Input value={nameInput} onChange={(event) => setNameInput(event.target.value)} placeholder="New profile name" className="border-zinc-800 bg-black"/><Button onClick={addProfile} className="bg-rose-600">Add profile</Button></div>}
      <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" className="border-zinc-700" onClick={() => switchTo({ id: "kids", name: "Kids", isKids: true })}>Switch to Kids Mode</Button><Button variant="outline" className="border-zinc-700" onClick={() => { const name = window.prompt("Name this profile"); if (!name?.trim()) return; const next = profiles.map((item) => item.id === activeProfileId ? { ...item, name: name.trim() } : item); saveProfiles(next); }}>Rename selected</Button></div>
      <div className="mt-5 border-t border-zinc-800 pt-4"><div className="flex items-center gap-2 text-sm font-semibold"><Shield className="h-4 w-4 text-amber-400"/>Kids Mode PIN</div><div className="mt-2 flex gap-2"><Input type="password" inputMode="numeric" maxLength={4} value={pinInput} onChange={(event) => setPinInput(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={pin ? "PIN configured" : "Set 4-digit PIN"} className="border-zinc-800 bg-black"/><Button onClick={() => { if (pinInput.length !== 4) return toast.error("PIN must be exactly 4 digits"); setParentPin(pinInput); setPinInput(""); toast.success("Kids PIN saved"); }} className="bg-rose-600">Save PIN</Button></div><p className="mt-2 text-xs text-zinc-500">Leaving Kids Mode prompts for this PIN.</p></div>
    </section>
    <PinModal />

    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><div className="flex items-center gap-2"><Gift className="h-5 w-5 text-rose-500"/><h2 className="font-bold">Referral Wallet</h2></div><ReferralWallet userId={session?.user.id} active={isPremium} /></section>

    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><div className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-rose-500"/><h2 className="font-bold">Subscription</h2></div><p className="mt-3 text-sm text-zinc-300">{trial.status === "active" ? "Active subscription" : trial.status === "trial" ? `${trial.daysRemaining} trial days remaining` : "Trial expired"}</p><p className="mt-1 text-xs text-zinc-500">{state?.expiresAt ? `Expires ${new Date(state.expiresAt).toLocaleDateString()}` : "Solo: KSh 150/month · Family: KSh 450/month"}</p><Button className="mt-4 bg-rose-600" onClick={() => void navigate({ to: "/subscribe" })}>Manage subscription</Button></section>

    {!signedIn ? <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-sm text-zinc-300">Sign in to manage referrals and subscription.</p><GoogleButton/><Button variant="outline" className="w-full border-zinc-700" onClick={() => void navigate({ to: "/auth", search: { redirect: "/profile" } })}>Sign in with email</Button></section> : <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><div className="flex items-center gap-3"><Avatar><AvatarFallback className="bg-rose-950 text-rose-300">{(email ?? "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar><div><p className="font-semibold">{email}</p><p className="text-xs text-zinc-500">Signed in</p></div><Button variant="outline" className="ml-auto border-zinc-700" onClick={async () => { await (await import("@/lib/auth")).signOutSession(); refresh(); }}>Sign out</Button></div></section>}

    {history.data?.length ? <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><div className="flex items-center gap-2"><History className="h-4 w-4 text-rose-500"/><h2 className="font-bold">Watch History</h2></div>{history.data.slice(0, 8).map((item) => <p key={item.id} className="mt-2 flex items-center gap-2 text-sm text-zinc-300"><Film className="h-4 w-4 text-zinc-500"/>{item.title}</p>)}<Button variant="ghost" className="mt-3 text-zinc-400" onClick={() => history.clearHistory.mutate()}><Trash2 className="mr-2 h-4 w-4"/>Clear history</Button></section> : null}
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><div className="flex items-center gap-2"><Headphones className="h-5 w-5 text-rose-500"/><h2 className="font-bold">Support</h2></div><div className="mt-3 flex gap-4 text-sm text-zinc-400"><a href="https://wa.me/254713767370" className="flex items-center gap-1"><MessageCircle className="h-4 w-4"/>WhatsApp</a><a href="https://instagram.com/bu.j.uu" className="flex items-center gap-1"><Instagram className="h-4 w-4"/>Instagram</a><a href="tel:0713767370" className="flex items-center gap-1"><Phone className="h-4 w-4"/>Phone</a></div></section>
  </main></AppShell>;
}

function ReferralWallet({ userId, active }: { userId?: string; active: boolean }) {
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const stats = useQuery({ queryKey: ["referral-wallet", userId], enabled: Boolean(userId), queryFn: async () => {
    const [referrals, withdrawals] = await Promise.all([myReferrals(), myWithdrawals()]);
    return { ...referrals, available: withdrawals.available, history: withdrawals.history };
  }});
  const link = stats.data?.code ? buildReferralUrl(stats.data.code) : "";
  const copy = async () => { if (!link) return; await navigator.clipboard.writeText(link); toast.success("Invite link copied"); };
  const withdraw = async () => {
    if (!phone.trim() || !userId || !stats.data || busy) return;
    setBusy(true);
    try {
      const cleaned = normalizeKenyanPhone(phone);
      await requestReferralWithdrawal({ data: { phone: cleaned, requestKey: crypto.randomUUID() } });
      setPhone("");
      toast.success("Withdrawal request submitted");
      await qc.invalidateQueries({ queryKey: ["referral-wallet", userId] });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to request withdrawal"); }
    finally { setBusy(false); }
  };
  if (!userId) return <p className="mt-3 text-sm text-zinc-400">Sign in to view your invite code and wallet.</p>;
  return <div className="mt-4 space-y-4">
    <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-black p-3"><div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-wider text-zinc-500">Invite link</p><p className="truncate font-mono text-sm text-white">{link || (stats.isLoading ? "Loading…" : "Unavailable")}</p></div><Button size="icon" variant="outline" aria-label="Copy invite link" disabled={!link} onClick={() => void copy()} className="border-zinc-700"><Copy className="h-4 w-4"/></Button></div>
    <div className="grid grid-cols-3 gap-2 text-center">{[["Friends Invited", stats.data?.invited ?? 0], ["Total Commission Earned", `KSh ${stats.data?.earned ?? 0}`], ["Wallet Balance", `KSh ${stats.data?.available ?? 0}`]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-black p-3"><p className="text-sm font-bold text-white">{value}</p><p className="mt-1 text-[10px] text-zinc-500">{label}</p></div>)}</div>
    <p className="text-xs text-zinc-400">KSh 20 commission per paying invitee. Referrers must have an active BUJUU subscription to withdraw.</p>
    <div className="space-y-2 border-t border-zinc-800 pt-4"><label htmlFor="mpesa-phone" className="text-sm font-semibold">Withdraw to M-Pesa</label><Input id="mpesa-phone" autoComplete="off" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0712 345 678" className="border-zinc-800 bg-black"/><p className="text-xs text-zinc-500">Phone number is used to request the payout and is not retained in this form.</p><Button onClick={() => void withdraw()} disabled={busy || !active || (stats.data?.available ?? 0) < 100 || !phone.trim()} className="w-full bg-rose-600 hover:bg-rose-500"><Wallet className="mr-2 h-4 w-4"/>{busy ? "Submitting…" : `Withdraw KSh ${stats.data?.available ?? 0}`}</Button>{(stats.data?.available ?? 0) < 100 && <p className="text-xs text-zinc-500">Minimum withdrawal is KSh 100</p>}{!active && <p className="text-xs text-amber-400">An active subscription is required to withdraw.</p>}</div>
  </div>;
}
