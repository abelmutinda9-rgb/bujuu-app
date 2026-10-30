import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { CheckCircle2, Copy, KeyRound, Loader2, ShieldCheck, Smartphone, Sparkles, Tv } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDeviceTrial } from "@/hooks/use-device-trial";
import { checkPaymentStatus, normalizeKenyanPhone, requestStkPush } from "@/services/payhero";

export const Route = createFileRoute("/subscribe")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Unlock bujuu — KSh 150 for 30 days" },
      {
        name: "description",
        content: "Pay KSh 150 with M-Pesa for 30 days of unlimited movies and shows on bujuu, on one device.",
      },
      { property: "og:title", content: "Unlock bujuu — KSh 150 for 30 days" },
      { property: "og:description", content: "Pay KSh 150 with M-Pesa for 30 days of unlimited movies and shows on bujuu." },
    ],
  }),
  component: SubscribePage,
});

function SubscribePage() {
  const search = useSearch({ from: "/subscribe" });
  const navigate = useNavigate();
  const trial = useDeviceTrial();

  const [activeTab, setActiveTab] = useState<"pay" | "restore">("pay");
  const [phone, setPhone] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  
  const [waiting, setWaiting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [successData, setSuccessData] = useState<{ recoveryToken: string; expiresAt?: string } | null>(null);
  
  const [restoring, setRestoring] = useState(false);
  const pollTimerRef = useRef<number | null>(null);

  const target = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/";

  // Handle PayHero STK Push
  const handleStartPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanPhone = normalizeKenyanPhone(phone);
      setWaiting(true);
      setStatusMessage("Sending M-Pesa prompt to your phone…");

      const res = await requestStkPush({
        phone: cleanPhone,
        deviceId: trial.deviceId,
      });

      setStatusMessage("Enter your M-Pesa PIN on your phone…");
      toast.success("M-Pesa STK prompt sent to " + cleanPhone);

      // Start authoritative polling
      let attempts = 0;
      const maxAttempts = 24; // 2 minutes (every 5s)
      const poll = async () => {
        attempts++;
        try {
          const statusRes = await checkPaymentStatus(res.reference);
          if (statusRes.status === "SUCCESS") {
            setStatusMessage("Payment confirmed! Activating 30-day pass…");
            const dbRes = await trial.confirmPayment(res.reference, cleanPhone, statusRes.raw);
            const token = (dbRes as any)?.recovery_token || "BUJ-" + trial.deviceId.slice(0, 6).toUpperCase();
            setSuccessData({
              recoveryToken: token,
              expiresAt: (dbRes as any)?.subscription_expires_at,
            });
            setWaiting(false);
            toast.success("Subscription activated for 30 days!");
            return;
          }
          if (statusRes.status === "FAILED") {
            setWaiting(false);
            setStatusMessage("");
            toast.error("Payment was cancelled or failed. Please try again.");
            return;
          }
        } catch (err) {
          console.warn("Poll status check error:", err);
        }

        if (attempts < maxAttempts) {
          pollTimerRef.current = window.setTimeout(poll, 5000);
        } else {
          setWaiting(false);
          setStatusMessage("");
          toast.error("Payment confirmation timed out. If M-Pesa deducted your money, please use the restore tab.");
        }
      };

      pollTimerRef.current = window.setTimeout(poll, 4000);
    } catch (err: any) {
      setWaiting(false);
      setStatusMessage("");
      toast.error(err?.message || "Failed to start M-Pesa payment. Check your phone number.");
    }
  };

  // Handle Transfer / Restore via Recovery Code
  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryInput.trim()) {
      toast.error("Please enter your recovery code.");
      return;
    }
    setRestoring(true);
    try {
      const res = await trial.transferSubscription(recoveryInput.trim());
      toast.success("Subscription successfully restored to this device!");
      setSuccessData({
        recoveryToken: res.recovery_token || recoveryInput.trim(),
        expiresAt: res.subscription_expires_at,
      });
    } catch (err: any) {
      toast.error(err?.message || "Invalid or expired recovery code.");
    } finally {
      setRestoring(false);
    }
  };

  const copyToken = () => {
    if (successData?.recoveryToken) {
      navigator.clipboard.writeText(successData.recoveryToken);
      toast.success("Recovery code copied to clipboard!");
    }
  };

  return (
    <AppShell>
      <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="text-center space-y-2 mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-500">
              <Sparkles className="h-3.5 w-3.5" /> 30 Days Unlimited Access
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Unlock BUJUU
            </h1>
            <p className="text-sm text-zinc-400">
              Zero ads, 4K streaming, multi-server playback on Android phones and Smart TVs.
            </p>
          </div>

          {/* Success Screen */}
          {successData ? (
            <div className="space-y-6 text-center animate-in fade-in zoom-in-95">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">Payment Confirmed!</h3>
                <p className="text-sm text-zinc-400">
                  Your device now has 30 days of unlimited access.
                </p>
              </div>

              {/* Recovery Code Box */}
              <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                    Your Device Recovery Code
                  </span>
                  <button
                    onClick={copyToken}
                    className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                </div>
                <div className="font-mono text-2xl font-black tracking-widest text-white">
                  {successData.recoveryToken}
                </div>
                <p className="text-[11px] text-zinc-400">
                  Save this code! If you reinstall the app or switch to another TV or phone, you can enter this code to transfer your subscription.
                </p>
              </div>

              <Button
                onClick={() => void navigate({ to: target as any })}
                className="w-full h-12 text-base font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-600/30"
              >
                Start Watching Now
              </Button>
            </div>
          ) : (
            <>
              {/* Tab Selector */}
              <div className="flex rounded-xl bg-zinc-950/80 p-1 mb-6 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setActiveTab("pay")}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "pay"
                      ? "bg-rose-600 text-white shadow"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Pay with M-Pesa (KSh 150)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("restore")}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "restore"
                      ? "bg-rose-600 text-white shadow"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Transfer / Restore Code
                </button>
              </div>

              {/* Tab 1: Pay with M-Pesa */}
              {activeTab === "pay" && (
                <form onSubmit={handleStartPayment} className="space-y-5">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-400">30-Day Plan</span>
                      <span className="font-bold text-white text-base">KSh 150</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t border-zinc-800/80 pt-2 text-xs text-zinc-400">
                      <span>Device Protection</span>
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> 1 Active Screen
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                      <Smartphone className="h-4 w-4 text-rose-500" /> Safaricom / Airtel Phone Number
                    </label>
                    <Input
                      type="tel"
                      placeholder="e.g. 0712345678 or 0112345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={waiting}
                      className="h-12 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl text-base"
                      required
                    />
                  </div>

                  {waiting && (
                    <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 flex items-center gap-3 text-rose-400 text-xs">
                      <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                      <div className="space-y-0.5">
                        <p className="font-semibold">{statusMessage}</p>
                        <p className="text-[11px] text-zinc-400">Do not close this screen until PIN is entered.</p>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={waiting}
                    className="w-full h-12 text-base font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-600/30"
                  >
                    {waiting ? "Waiting for M-Pesa PIN…" : "Pay KSh 150 with M-Pesa"}
                  </Button>
                </form>
              )}

              {/* Tab 2: Restore via Recovery Code */}
              {activeTab === "restore" && (
                <form onSubmit={handleRestore} className="space-y-5">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-2 text-xs text-zinc-400">
                    <div className="flex items-center gap-2 text-white font-semibold">
                      <Tv className="h-4 w-4 text-rose-500" /> Transfer to TV or New Phone
                    </div>
                    <p>
                      Enter the 8-character recovery code issued when you paid. This transfers your remaining 30-day access to this device and disconnects the previous device.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                      <KeyRound className="h-4 w-4 text-rose-500" /> Recovery Code (e.g. BUJ-7F12B8)
                    </label>
                    <Input
                      type="text"
                      placeholder="BUJ-XXXXXX"
                      value={recoveryInput}
                      onChange={(e) => setRecoveryInput(e.target.value.toUpperCase())}
                      disabled={restoring}
                      className="h-12 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl text-base font-mono uppercase tracking-wider"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={restoring}
                    className="w-full h-12 text-base font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-600/30"
                  >
                    {restoring ? "Transferring…" : "Transfer to This Device"}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
