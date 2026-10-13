import { createFileRoute } from "@tanstack/react-router";
import { Download, Monitor, Smartphone, Tv } from "lucide-react";

import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Download BUJUU — Android, Android TV & Windows" },
      { name: "description", content: "Get the BUJUU app for Android phones, Android TV / Google TV and Windows PCs." },
      { property: "og:title", content: "Download BUJUU" },
      { property: "og:description", content: "Get the BUJUU app for Android phones, Android TV and Windows." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DownloadPage,
});

const APK_URL = "https://github.com/abelmutinda9-rgb/bujuu-app/releases/download/latest/bujuu-app.apk";

const apps = [
  {
    icon: Smartphone,
    name: "Android phone & tablet",
    note: "APK — Android 7 or newer",
    href: APK_URL,
    label: "Download APK",
  },
  {
    icon: Tv,
    name: "Android TV / Google TV",
    note: "Same APK, remote-friendly",
    href: APK_URL,
    label: "Download TV APK",
  },
  {
    icon: Monitor,
    name: "Windows PC",
    note: "Windows 10 / 11, 64-bit",
    href: null,
    label: "Coming soon",
  },
];

function DownloadPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-24 lg:pt-32">
      <Logo />
      <h1 className="mt-8 text-3xl font-bold tracking-tight sm:text-4xl">Watch BUJUU everywhere</h1>
      <p className="mt-3 text-muted-foreground">
        One account, one active device. Sign in on the app the same way you do here — your subscription comes with you.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-3">
        {apps.map(({ icon: Icon, name, note, href, label }) => (
          <li key={name} className="flex flex-col rounded-2xl border border-border bg-card p-5">
            <Icon className="h-8 w-8 text-primary" />
            <p className="mt-4 font-semibold">{name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{note}</p>
            {href ? (
              <a
                href={href}
                className="mt-5 flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                download="bujuu-app.apk"
              >
                <Download className="h-4 w-4" /> {label}
              </a>
            ) : (
              <span className="mt-5 rounded-full border border-border px-4 py-2 text-center text-sm text-muted-foreground">
                {label}
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-10 rounded-xl bg-secondary/40 p-4 border border-border/50 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Android Installation Tip:</p>
        <p>
          When installing the APK, if prompted by Android, tap <strong>Settings</strong> and allow <strong>"Install unknown apps"</strong> for your browser. Once installed, BUJUU includes native Brave ad blocking and high-speed streaming.
        </p>
      </div>
    </div>
  );
}
