import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Film, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/downloads")({
  head: () => ({ meta: [
    { title: "Downloads — BUJUU" },
    { name: "description", content: "BUJUU offline downloads availability." },
  ] }),
  component: DownloadsPage,
});

function DownloadsPage() {
  return <AppShell>
    <main className="mx-auto flex min-h-[80vh] max-w-3xl flex-col justify-center px-5 pb-24 pt-24">
      <Link to="/" className="mb-8 inline-flex w-fit items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft className="h-4 w-4"/> Back to BUJUU</Link>
      <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-8 text-center shadow-2xl sm:p-12">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10 text-rose-300"><Download className="h-7 w-7"/></div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-300">Offline library</p>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Downloads aren’t available yet</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-400">BUJUU currently can’t verify or manage downloadable files from its streaming sources. This page won’t show simulated downloads or claim a title is saved when it isn’t.</p>
        <div className="mx-auto mt-6 flex max-w-xl items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"/>
          <p className="text-xs leading-5 text-zinc-400">A real offline library needs a permitted downloadable source, native file storage, and server-managed download authorization. Playback and subscription records remain server-checked; downloaded video bytes, when supported, must reside on the device for offline viewing.</p>
        </div>
        <Link to="/" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-200"><Film className="h-4 w-4"/> Browse BUJUU</Link>
      </section>
    </main>
  </AppShell>;
}
