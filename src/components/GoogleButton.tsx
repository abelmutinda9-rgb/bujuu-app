import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export function GoogleButton() {
  const [busy, setBusy] = useState(false);

  async function handleGoogleLogin() {
    try {
      sessionStorage.setItem("bujuu.after", window.location.pathname + window.location.search);
    } catch {
      /* ignore */
    }
    setBusy(true);

    if (Capacitor.isNativePlatform()) {
      try {
        const { data, error: err } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: "bujuu://auth/callback",
            skipBrowserRedirect: true,
          },
        });
        if (err || !data.url) {
          toast.error(err?.message || "Google sign-in couldn't start.");
          setBusy(false);
          return;
        }
        await Browser.open({ url: data.url, presentationStyle: "popover" });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to open Google login");
        setBusy(false);
      }
      return;
    }

    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) {
      toast.error("Google sign-in didn't finish. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Button
      className="w-full"
      disabled={busy}
      onClick={() => void handleGoogleLogin()}
    >
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Continue with Google
    </Button>
  );
}
