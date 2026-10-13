import { Capacitor } from "@capacitor/core";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, Film, KeyRound, Loader2, Mail, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { GoogleButton } from "@/components/GoogleButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { safePath } from "@/lib/auth";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["login", "signup", "forgot", "otp"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => searchSchema.parse(search),
  component: AuthPage,
});

function AuthPage() {
  const { redirect: redirectParam, mode: initial } = Route.useSearch();
  const navigate = useNavigate();

  // Auth method: "otp" (email 6-digit code) or "password"
  const [authMethod, setAuthMethod] = useState<"otp" | "password">(initial === "otp" ? "otp" : "password");
  // Sub-modes for password flow: "login" | "signup" | "forgot"
  const [passwordMode, setPasswordMode] = useState<"login" | "signup" | "forgot">(
    initial === "signup" ? "signup" : initial === "forgot" ? "forgot" : "login"
  );

  // OTP flow state
  const [otpStep, setOtpStep] = useState<"request" | "verify">("request");
  const [otpCode, setOtpCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Form inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const target = safePath(redirectParam);

  // Universal session listener: whenever a session is active or created, automatically go to the target/homepage
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        void navigate({ to: target, replace: true });
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION")) {
        void navigate({ to: target, replace: true });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate, target]);

  // Cooldown timer for resending OTP
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const clearAlerts = () => {
    setError(null);
    setMessage(null);
  };

  // 1. Send OTP 6-digit code
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    clearAlerts();

    const mail = email.trim().toLowerCase();
    if (!mail || !mail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: mail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: Capacitor.isNativePlatform()
            ? "bujuu://auth/callback"
            : window.location.origin + "/auth",
        },
      });
      if (err) throw err;

      setOtpStep("verify");
      setCooldown(60);
      setMessage(`We've sent a 6-digit confirmation code to ${mail}. Please check your inbox or spam folder.`);
      toast.success("Verification code sent!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send verification code.");
    } finally {
      setBusy(false);
    }
  };

  // 2. Verify OTP 6-digit code
  const handleVerifyOtp = async (codeToVerify?: string) => {
    clearAlerts();
    const token = (codeToVerify ?? otpCode).trim();
    const mail = email.trim().toLowerCase();

    if (token.length !== 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    setBusy(true);
    try {
      const { data, error: err } = await supabase.auth.verifyOtp({
        email: mail,
        token,
        type: "email",
      });
      if (err) throw err;

      if (data.session) {
        toast.success("Signed in successfully!");
        void navigate({ to: target, replace: true });
      } else {
        setError("Could not establish session. Please try again.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid or expired code.");
    } finally {
      setBusy(false);
    }
  };

  // 3. Password flow (Login, Signup, Forgot)
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    const mail = email.trim().toLowerCase();
    if (!mail || !mail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (passwordMode === "forgot") {
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
      if (passwordMode === "login") {
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email: mail,
          password,
        });
        if (err) throw err;
        if (data.session) {
          toast.success("Welcome back!");
          void navigate({ to: target, replace: true });
        }
      } else {
        // Sign up
        const { data, error: err } = await supabase.auth.signUp({
          email: mail,
          password,
          options: {
            data: { full_name: fullName.trim() || undefined },
            emailRedirectTo: Capacitor.isNativePlatform()
              ? "bujuu://auth/callback"
              : window.location.origin + "/auth",
          },
        });
        if (err) throw err;

        if (data.session) {
          toast.success("Account created successfully!");
          void navigate({ to: target, replace: true });
          return;
        }

        // If email confirmation is required, attempt immediate login in case auto-confirmed
        const { data: loginAttempt } = await supabase.auth.signInWithPassword({
          email: mail,
          password,
        });
        if (loginAttempt?.session) {
          toast.success("Account created and signed in!");
          void navigate({ to: target, replace: true });
          return;
        }

        // If session still not returned, offer instant 6-digit code verification
        setMessage(
          "Account created! Check your email to confirm, or click below to receive a 6-digit code."
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Film className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            {authMethod === "otp"
              ? otpStep === "verify"
                ? "Enter 6-digit code"
                : "Sign in with Email Code"
              : passwordMode === "login"
                ? "Welcome back"
                : passwordMode === "signup"
                  ? "Create your account"
                  : "Reset password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {authMethod === "otp"
              ? otpStep === "verify"
                ? `Enter the code sent to ${email}`
                : "We'll send a 6-digit login code to your inbox"
              : passwordMode === "login"
                ? "Enter your credentials to access BUJUU"
                : passwordMode === "signup"
                  ? "Sign up to start streaming unlimited movies"
                  : "Enter your email to receive a password reset link"}
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

        {/* Google One-Tap Sign In */}
        <GoogleButton />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        {/* Method Switcher Tabs: Email Code vs Password */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setAuthMethod("otp");
              clearAlerts();
            }}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 transition-all ${
              authMethod === "otp"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            Email Code (OTP)
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod("password");
              clearAlerts();
            }}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 transition-all ${
              authMethod === "password"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Password
          </button>
        </div>

        {/* FLOW A: OTP CODE */}
        {authMethod === "otp" && (
          <div className="space-y-4">
            {otpStep === "request" ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="otpEmail">Email address</Label>
                  <Input
                    id="otpEmail"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Send 6-digit Code
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center space-y-3">
                  <Label>Verification Code</Label>
                  <InputOTP
                    maxLength={6}
                    value={otpCode}
                    onChange={(val) => {
                      setOtpCode(val);
                      if (val.length === 6) {
                        void handleVerifyOtp(val);
                      }
                    }}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                  <p className="text-xs text-muted-foreground">
                    Check your inbox and spam folder for the 6-digit code.
                  </p>
                </div>

                <Button
                  onClick={() => void handleVerifyOtp()}
                  className="w-full"
                  disabled={busy || otpCode.length !== 6}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Verify & Go to Homepage
                </Button>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep("request");
                      setOtpCode("");
                      clearAlerts();
                    }}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    <ArrowLeft className="h-3 w-3" /> Change email
                  </button>

                  <button
                    type="button"
                    disabled={cooldown > 0 || busy}
                    onClick={() => void handleSendOtp()}
                    className="flex items-center gap-1 hover:text-foreground disabled:opacity-50"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FLOW B: PASSWORD (LOGIN / SIGNUP / FORGOT) */}
        {authMethod === "password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {passwordMode === "signup" && (
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

            {passwordMode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {passwordMode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordMode("forgot");
                        clearAlerts();
                      }}
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
                    autoComplete={passwordMode === "login" ? "current-password" : "new-password"}
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
              {passwordMode === "login"
                ? "Sign in"
                : passwordMode === "signup"
                  ? "Sign up"
                  : "Send reset link"}
            </Button>

            {/* Quick switcher between Login and Signup */}
            <div className="text-center text-sm text-muted-foreground pt-1">
              {passwordMode === "login" && (
                <p>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordMode("signup");
                      clearAlerts();
                    }}
                    className="font-medium text-foreground underline hover:text-primary"
                  >
                    Sign up
                  </button>
                </p>
              )}
              {passwordMode === "signup" && (
                <p>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordMode("login");
                      clearAlerts();
                    }}
                    className="font-medium text-foreground underline hover:text-primary"
                  >
                    Sign in
                  </button>
                </p>
              )}
              {passwordMode === "forgot" && (
                <p>
                  Remember your password?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordMode("login");
                      clearAlerts();
                    }}
                    className="font-medium text-foreground underline hover:text-primary"
                  >
                    Back to login
                  </button>
                </p>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
