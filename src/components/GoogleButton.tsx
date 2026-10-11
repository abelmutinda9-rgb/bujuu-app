import { Capacitor } from "@capacitor/core";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export function GoogleButton() {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleGoogleLogin() {
    try {
      sessionStorage.setItem("bujuu.after", window.location.pathname + window.location.search);
    } catch {
      /* ignore */
    }
    setBusy(true);

    if (Capacitor.isNativePlatform()) {
      try {
        await GoogleAuth.initialize();
        const googleUser = await GoogleAuth.signIn();

        const idToken = googleUser?.authentication?.idToken;
        if (!idToken) {
          throw new Error("No ID token returned from Google Sign-In.");
        }

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken,
        });

        if (error) {
          toast.error(error.message || "Failed to sign in with Google.");
          setBusy(false);
          return;
        }

        if (data.session) {
          toast.success("Signed in successfully!");
          const target = sessionStorage.getItem("bujuu.after") || "/";
          void navigate({ to: target });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("canceled") || msg.includes("12501")) {
          // User canceled the sign-in prompt
        } else {
          toast.error(msg || "Google Sign-In failed.");
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) {
        toast.error("Google sign-in didn't finish. Please try again.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
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
