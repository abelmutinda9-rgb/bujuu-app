import { createFileRoute } from "@tanstack/react-router";
import { Monitor, Smartphone, Tv } from "lucide-react";

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

const apps = [
  { icon: Smartphone, name: "Android phone & tablet", note: "APK — Android 7 or newer", href: null as string | null },
  { icon: Tv, name: "Android TV / Google TV", note: "Same APK, remote-friendly", href: null },
  { icon: Monitor, name: "Windows PC", note: "Windows 10 / 11, 64-bit", href: null },
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
        {apps.map(({ icon: Icon, name, note, href }) => (
          <li key={name} className="flex flex-col rounded-2xl border border-border bg-card p-5">
            <Icon className="h-8 w-8 text-primary" />
            <p className="mt-4 font-semibold">{name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{note}</p>
            {href ? (
              <a href={href} className="mt-5 rounded-full bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground">
                Download
              </a>
            ) : (
              <span className="mt-5 rounded-full border border-border px-4 py-2 text-center text-sm text-muted-foreground">
                Coming soon
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-10 text-sm text-muted-foreground">
        On Android, allow "Install unknown apps" for your browser when prompted. Apps update automatically from BUJUU.
      </p>
    </div>
  );
}
