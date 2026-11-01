import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Shield, KeyRound, Smartphone, CreditCard, RefreshCw, Search, CheckCircle2, XCircle, ArrowLeft, AlertTriangle, Users, HardDrive, Lock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Command Center — BUJUU" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <AppShell>
      <main className="mx-auto flex min-h-[75vh] max-w-2xl items-center px-4 pt-20 pb-24">
        <section className="w-full space-y-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-7 text-center shadow-2xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-white">Admin tools are locked</h1>
          <p className="text-sm leading-6 text-zinc-400">
            BUJUU does not yet have a verified server-side admin role configured. I’ve disabled client-side PIN access and direct database controls so account and payment data can’t be exposed or altered from the browser.
          </p>
          <Link to="/" className="inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700">
            <ArrowLeft className="h-4 w-4" /> Back to BUJUU
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
