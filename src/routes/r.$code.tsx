import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

import { rememberReferral } from "@/hooks/use-account";
import { DOWNLOAD_SITE_URL } from "@/config/referral";

export const Route = createFileRoute("/r/$code")({
  head: () => ({
    meta: [
      { title: "You're invited to bujuu" },
      { name: "description", content: "A friend invited you to watch movies and shows on bujuu." },
      { property: "og:title", content: "You're invited to bujuu" },
      { property: "og:description", content: "A friend invited you to watch movies and shows on bujuu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Invite,
});

function Invite() {
  const { code } = Route.useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!code) return;
    const clean = code.trim().toUpperCase();
    if (/^[A-Za-z0-9]{3,16}$/.test(clean)) {
      rememberReferral(clean);
    }

    // If running inside native Android app, simply navigate home
    if (Capacitor.isNativePlatform()) {
      void navigate({ to: "/", replace: true });
      return;
    }

    // If accessed on web outside the download site, redirect to the download site preserving the code
    const targetBase = DOWNLOAD_SITE_URL.replace(/\/+$/, "");
    if (typeof window !== "undefined" && !window.location.origin.includes(new URL(targetBase).host)) {
      window.location.href = `${targetBase}/r/${encodeURIComponent(clean)}`;
      return;
    }

    void navigate({ to: "/", replace: true });
  }, [code, navigate]);

  return null;
}
