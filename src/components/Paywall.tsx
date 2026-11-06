import { useAccount } from "@/hooks/use-account";
import { useDeviceTrial } from "@/hooks/use-device-trial";
import { useNavigate } from "@tanstack/react-router";

export type PlaybackGate = "loading" | "signin" | "pay" | "open";

export function usePlaybackGate() {
  const account = useAccount();
  const trial = useDeviceTrial();
  const gate: PlaybackGate = account.loading || trial.isLoading
    ? "loading"
    : trial.canStream || (account.isPremium && account.state?.status === "ACTIVE")
      ? "open"
      : account.signedIn ? "pay" : "signin";
  return { gate, refresh: account.refresh, trial, account };
}

export function Paywall({ gate, onPaid }: { gate: Exclude<PlaybackGate, "loading" | "open">; onPaid: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/95 p-5 text-center" role="dialog" aria-modal="true" aria-labelledby="paywall-title">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-rose-500">BUJUU</p>
        <h1 id="paywall-title" className="text-2xl font-bold text-white">{gate === "signin" ? "Sign in to continue" : "Your subscription is required"}</h1>
        <p className="text-sm text-zinc-400">{gate === "signin" ? "Your free trial has ended. Sign in to manage your BUJUU subscription." : "Choose a BUJUU plan to keep watching."}</p>
        <button type="button" className="w-full rounded-xl bg-rose-600 px-4 py-3 font-bold text-white hover:bg-rose-500" onClick={() => void navigate({ to: gate === "signin" ? "/auth" : "/subscribe", search: { redirect: typeof window === "undefined" ? "/" : window.location.pathname + window.location.search } })}>
          {gate === "signin" ? "Sign in" : "View subscription plans"}
        </button>
        <button type="button" onClick={onPaid} className="text-xs text-zinc-500 underline underline-offset-4">Refresh access status</button>
      </div>
    </div>
  );
}
