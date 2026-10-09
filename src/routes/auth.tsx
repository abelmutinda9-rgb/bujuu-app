import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Film, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { GoogleButton } from "@/components/GoogleButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { AFTER_KEY, safePath, signOutSession } from "@/lib/auth";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["login", "signup", "forgot"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => searchSchema.parse(search),
  component: AuthPage,
});

function AuthPage() {
  const { redirect: redirectParam, mode: initial } = Route.useSearch();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initial ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const target = safePath(redirectParam);

  const switchTo = (next: "login" | "signup" | "forgot") => {
    setMode(next);
    setError(null);
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const mail = email.trim().toLowerCase();
    if (!mail || !mail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (mode === "forgot") {
      setBusy(true);
      try {
        const { error: err } = await supabase.auth.resetPasswordForEmail(mail, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (err) throw err;
        setMessage("Password reset instructions have been sent to your email.");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to send reset email.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (err) throw err;
        if (data.session) {
          toast.success("Welcome back!");
          void navigate({ to: target });
        }
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: mail,
          password,
          options: {
            data: { full_name: fullName.trim() || undefined },
            emailRedirectTo: window.location.origin + "/auth",
          },
        });
        if (err) throw err;
        if (data.session) {
          toast.success("Account created successfully!");
          void navigate({ to: target });
        } else {
          setMessage("Account created. Please check your email to confirm your address before logging in.");
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleNativeGoogle = async () => {
    setError(null);
    try {
      sessionStorage.setItem(AFTER_KEY, target);
    } catch {
      /* ignore */
    }

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
          setError(err?.message || "Google sign-in couldn't start. Please try again.");
          return;
        }
        await Browser.open({ url: data.url, presentationStyle: "popover" });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to open Google login");
      }
      return;
    }

    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (r.error) setError("Google sign-in didn't finish. Please try again.");
  };

  const title = mode === "login" ? "Login" : mode === "signup" ? "Sign up" : "Reset password";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Film className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login" && "Enter your credentials to access your BUJUU account"}
            {mode === "signup" && "Create an account to start streaming"}
            {mode === "forgot" && "Enter your email to receive a password reset link"}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-lg bg-primary/10 p-3 text-sm text-primary">
            {message}
          </div>
        )}

        {mode !== "forgot" && (
          <>
            <GoogleButton />
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => switchTo("forgot")}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? "Login" : mode === "signup" ? "Sign up" : "Send reset link"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          {mode === "login" && (
            <p>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => switchTo("signup")}
                className="font-medium text-foreground underline hover:text-primary"
              >
                Sign up
              </button>
            </p>
          )}
          {mode === "signup" && (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchTo("login")}
                className="font-medium text-foreground underline hover:text-primary"
              >
                Log in
              </button>
            </p>
          )}
          {mode === "forgot" && (
            <p>
              Remember your password?{" "}
              <button
                type="button"
                onClick={() => switchTo("login")}
                className="font-medium text-foreground underline hover:text-primary"
              >
                Back to login
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
