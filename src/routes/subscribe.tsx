import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { CheckCircle2, Loader2, Mail, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccount } from "@/hooks/use-account";
import { supabase } from "@/integrations/supabase/client";
import { GoogleButton } from "@/components/GoogleButton";
import { mySubscriptionPayment, startSubscription, transferDevice } from "@/lib/account.functions";

export const Route = createFileRoute("/subscribe")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Unlock bujuu — KSh 150 for 30 days" },
      {
        name: "description",
        content:
          "Pay KSh 150 with M-Pesa for 30 days of unlimited movies and shows on bujuu, on one device.",
      },
      { property: "og:title", content: "Unlock bujuu — KSh 150 for 30 days" },
      {
        property: "og:description",
        content: "Pay KSh 150 with M-Pesa for 30 days of unlimited movies and shows on bujuu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SubscribePage,
});

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function TransferCard({ email, onDone }: { email: string; onDone: () => void }) {
  const { creds } = useAccount();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) {
      toast.error("Couldn't send the code. Please wait a minute and try again.");
      return;
    }
    setSent(true);
    toast.success(`We emailed a code to ${email}.`);
  };

  const verify = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
      if (error) throw new Error("That code is wrong or has expired.");
      await transferDevice({ data: { ...creds!, platform: navigator.userAgent.slice(0, 120) } });
      toast.success("This device can now watch. The other device has been signed out of playback.");
      onDone();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 space-y-3 rounded-lg border border-border p-5">
      <h2 className="text-sm font-semibold">Watch on this device instead?</h2>
      <p className="text-xs text-muted-foreground">
        Your subscription is active on another device. Confirm with a code sent to {email} to move it
        here. Your 30 days stay exactly the same.
      </p>
      {!sent ? (
        <Button variant="secondary" className="w-full" disabled={busy || !creds} onClick={send}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="mr-2 h-4 w-4" /> Email me a code</>}
        </Button>
      ) : (
        <>
          <Input inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button className="w-full" disabled={busy || code.trim().length < 6} onClick={verify}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Move it here"}
          </Button>
        </>
      )}
    </div>
  );
}

function SubscribePage() {
  const { redirect } = useSearch({ from: "/subscribe" });
  const navigate = useNavigate();
  const { signedIn, email, creds, state, isPremium, needsTransfer, loading, refresh } = useAccount();

  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    if (state?.phone && !phone) setPhone(state.phone.replace(/^254/, "0"));
  }, [state?.phone, phone]);

  const pay = useMutation({
    mutationFn: () => startSubscription({ data: { ...creds!, phone } }),
    onSuccess: (data) => {
      setReference(data.reference);
      setWaiting(true);
      toast.success("Check your phone and enter your M-Pesa PIN.");
    },
    onError: (error) => toast.error(errorText(error)),
  });

  // Poll until the backend has verified the payment with PayHero.
  useEffect(() => {
    if (!waiting || !reference || !creds) return;
    let cancelled = false;
    const started = Date.now();

    const tick = async () => {
      if (cancelled) return;
      try {
        const result = await mySubscriptionPayment({ data: { ...creds, reference } });
        if (result.isPremium) {
          setWaiting(false);
          refresh();
          if (!doneRef.current) {
            doneRef.current = true;
            toast.success("Premium active. Enjoy bujuu.");
            if (redirect) void navigate({ to: redirect });
          }
          return;
        }
        if (result.paymentStatus === "failed") {
          setWaiting(false);
          toast.error("That payment didn't go through. You can try again.");
          return;
        }
      } catch {
        /* keep polling */
      }
      if (Date.now() - started > 180_000) {
        setWaiting(false);
        toast.error("We didn't see the payment yet. If you paid, it will show here shortly.");
        return;
      }
      window.setTimeout(() => void tick(), 4000);
    };

    const id = window.setTimeout(() => void tick(), 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [waiting, reference, creds, refresh, redirect, navigate]);

  return (
    <AppShell>
      <div className="mx-auto max-w-md px-4 pb-24 pt-24 lg:px-8">
        <h1 className="text-2xl font-bold">
          {isPremium ? "Your subscription" : "Unlock everything on bujuu"}
        </h1>

        {!signedIn ? (
          <div className="mt-6 space-y-3 rounded-lg border border-border p-5">
            <p className="text-sm text-muted-foreground">
              KSh 150 for 30 days. All movies and shows, one device at a time. Sign in to continue.
            </p>
            <GoogleButton />
          </div>
        ) : loading ? (
          <div className="mt-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : isPremium ? (
          <div className="mt-6 rounded-lg border border-border p-5">
            <div className="flex items-center gap-2 text-brand">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">Premium Active</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {email} · valid until{" "}
              {state?.expiresAt ? new Date(state.expiresAt).toLocaleDateString() : "—"}
            </p>
            <Button className="mt-5 w-full" onClick={() => void navigate({ to: redirect ?? "/" })}>
              Start watching
            </Button>
          </div>
        ) : needsTransfer && email ? (
          <TransferCard email={email} onDone={() => { refresh(); if (redirect) void navigate({ to: redirect }); }} />
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {state?.status === "EXPIRED" ? "Your 30 days have ended. " : ""}
              KSh 150 for 30 days. All movies and shows, one device at a time.
            </p>

            <div className="mt-6 space-y-3 rounded-lg border border-border p-5">
              <label className="text-sm font-medium" htmlFor="phone">
                M-Pesa number
              </label>
              <Input
                id="phone"
                inputMode="tel"
                placeholder="0712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={waiting}
              />
              <Button
                className="w-full"
                disabled={!creds || pay.isPending || waiting || phone.length < 9}
                onClick={() => pay.mutate()}
              >
                {waiting || pay.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {waiting ? "Waiting for your payment…" : "Sending request…"}
                  </>
                ) : (
                  <>
                    <Smartphone className="mr-2 h-4 w-4" /> Pay KSh 150
                  </>
                )}
              </Button>
              {waiting && (
                <p className="text-xs text-muted-foreground">
                  Enter your M-Pesa PIN on your phone. This screen updates by itself.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
