import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import logo from "@/assets/bujuu-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — BUJUU" },
      { name: "description", content: "Choose a new password for your BUJUU account." },
      { property: "og:title", content: "Set a new password — BUJUU" },
      { property: "og:description", content: "Choose a new password for your BUJUU account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError("This reset link has expired. Request a new one from the login page.");
    void navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-paper text-paper-foreground">
      <header className="bg-ink px-7 pb-16 pt-14">
        <img src={logo.url} alt="BUJUU" className="mx-auto h-auto w-44" />
      </header>
      <form onSubmit={submit} className="mx-auto max-w-xl space-y-5 px-7 pt-10">
        <h1 className="text-4xl tracking-tight">New password</h1>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-14 w-full rounded-2xl border-2 border-transparent bg-paper-field px-5 outline-none focus:border-paper-foreground"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button disabled={busy} className="flex h-14 w-full items-center justify-center rounded-full bg-ink text-ink-foreground">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save password"}
        </button>
      </form>
    </div>
  );
}
