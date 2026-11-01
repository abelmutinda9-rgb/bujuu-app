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
  const [authorized, setAuthorized] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [devices, setDevices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    totalDevices: 0,
    activeTrials: 0,
    activeSubscribers: 0,
    totalRevenue: 0,
  });

  const handleAuthorize = (e: React.FormEvent) => {
    e.preventDefault();
    // Default admin passcode gate (can be adjusted by owner)
    if (pinInput === "2608" || pinInput === "12608" || pinInput === "bujuu2026") {
      setAuthorized(true);
      toast.success("Admin authorized");
    } else {
      toast.error("Invalid Admin Passcode");
    }
  };

  useEffect(() => {
    if (authorized) {
      loadDashboardData();
    }
  }, [authorized]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch devices
      const { data: devRows } = await supabase
        .from("devices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      const devList = devRows || [];
      setDevices(devList);

      // 2. Fetch payments
      const { data: payRows } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      const payList = payRows || [];
      setPayments(payList);

      // 3. Compute stats
      const now = new Date();
      const activeTrials = devList.filter((d) => d.trial_ends_at && new Date(d.trial_ends_at) > now).length;
      const activeSubs = devList.filter((d) => d.subscription_expires_at && new Date(d.subscription_expires_at) > now).length;
      const successfulPays = payList.filter((p) => p.status === "success" || p.status === "COMPLETED");
      const rev = successfulPays.reduce((acc, curr) => acc + (Number(curr.amount) || 150), 0);

      setStats({
        totalDevices: devList.length,
        activeTrials,
        activeSubscribers: activeSubs,
        totalRevenue: rev,
      });
    } catch (err) {
      console.warn("Error loading admin stats:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGrantSubscription = async (deviceId: string) => {
    try {
      const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
      const { error } = await supabase
        .from("devices")
        .update({ subscription_expires_at: expiresAt, is_blocked: false })
        .eq("id", deviceId);

      if (error) throw error;
      toast.success("Granted 30 days VIP subscription to device");
      loadDashboardData();
    } catch (err: any) {
      toast.error(err.message || "Failed to grant subscription");
    }
  };

  const handleGrantTrial = async (deviceId: string) => {
    try {
      const trialEndsAt = new Date(Date.now() + 3 * 86400000).toISOString();
      const { error } = await supabase
        .from("devices")
        .update({ trial_ends_at: trialEndsAt, is_blocked: false })
        .eq("id", deviceId);

      if (error) throw error;
      toast.success("Granted 72 hours trial to device");
      loadDashboardData();
    } catch (err: any) {
      toast.error(err.message || "Failed to grant trial");
    }
  };

  const handleTriggerMaintenance = async () => {
    try {
      const { data, error } = await supabase.rpc("expire_stale_subscriptions");
      if (error) throw error;
      toast.success("Maintenance routine executed successfully");
      loadDashboardData();
    } catch (err: any) {
      toast.error(err.message || "Maintenance routine failed");
    }
  };

  const filteredDevices = devices.filter((d) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (d.device_id && d.device_id.toLowerCase().includes(q)) ||
      (d.recovery_token && d.recovery_token.toLowerCase().includes(q)) ||
      (d.phone && d.phone.toLowerCase().includes(q))
    );
  });

  if (!authorized) {
    return (
      <AppShell>
        <div className="min-h-[80vh] flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center space-y-5 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <Shield className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white tracking-tight">Admin Passcode</h2>
              <p className="text-xs text-zinc-400">Enter master PIN to access BUJUU Command Center</p>
            </div>
            <form onSubmit={handleAuthorize} className="space-y-3">
              <input
                type="password"
                placeholder="Enter PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                autoFocus
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-center text-sm font-bold text-white placeholder-zinc-500 focus:border-rose-500 focus:outline-none tracking-widest"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition-colors shadow-lg shadow-rose-600/30"
              >
                Unlock Command Center
              </button>
            </form>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen px-4 pt-20 pb-24 lg:px-12 max-w-7xl mx-auto space-y-8 animate-fade-in">
        {/* Header Breadcrumb */}
        <div className="space-y-2 border-b border-zinc-800/80 pb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Home
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                <Shield className="h-7 w-7 text-rose-500" />
                BUJUU Admin Command Center
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400">
                Live backend device audit, PayHero payment ledger, and server maintenance.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadDashboardData}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                onClick={handleTriggerMaintenance}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-500 transition-colors shadow-md shadow-rose-600/20"
              >
                Expire Stale Subs
              </button>
            </div>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 space-y-1 shadow-lg">
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Total Devices</span>
            <p className="text-xl sm:text-2xl font-black text-white">{stats.totalDevices}</p>
            <p className="text-[10px] text-zinc-500">Tracked in database</p>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 space-y-1 shadow-lg">
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Active 72h Trials</span>
            <p className="text-xl sm:text-2xl font-black text-amber-400">{stats.activeTrials}</p>
            <p className="text-[10px] text-zinc-500">Currently within 3 days</p>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 space-y-1 shadow-lg">
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Paid Subscribers</span>
            <p className="text-xl sm:text-2xl font-black text-emerald-400">{stats.activeSubscribers}</p>
            <p className="text-[10px] text-zinc-500">Active 30-day VIPs</p>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 space-y-1 shadow-lg">
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Verified Revenue</span>
            <p className="text-xl sm:text-2xl font-black text-white">KSh {stats.totalRevenue}</p>
            <p className="text-[10px] text-zinc-500">Confirmed PayHero M-Pesa</p>
          </div>
        </div>

        {/* Device Inspector & Search */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-rose-500" />
                Device Registry & Entitlements
              </h3>
              <p className="text-xs text-zinc-400">Search devices by recovery token, phone, or hardware ID.</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search token, phone, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900/90 text-zinc-400 border-b border-zinc-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Recovery Token</th>
                  <th className="p-3">Device / Platform</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Trial Expiry</th>
                  <th className="p-3">VIP Expiry</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredDevices.map((d) => (
                  <tr key={d.id} className="hover:bg-zinc-900/40">
                    <td className="p-3 font-mono font-bold text-rose-400">{d.recovery_token || "—"}</td>
                    <td className="p-3">
                      <div className="font-mono text-[11px] text-zinc-300 truncate max-w-[140px]" title={d.device_id}>
                        {d.device_id}
                      </div>
                      <span className="text-[10px] text-zinc-500">{d.platform || "Android"}</span>
                    </td>
                    <td className="p-3 text-zinc-300">{d.phone || "—"}</td>
                    <td className="p-3">
                      {d.trial_ends_at ? new Date(d.trial_ends_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3">
                      {d.subscription_expires_at ? (
                        <span className="text-emerald-400 font-semibold">
                          {new Date(d.subscription_expires_at).toLocaleDateString()}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleGrantSubscription(d.id)}
                        className="px-2 py-1 rounded-md bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 font-semibold text-[10px] transition-colors"
                      >
                        +30d VIP
                      </button>
                      <button
                        onClick={() => handleGrantTrial(d.id)}
                        className="px-2 py-1 rounded-md bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white border border-amber-500/30 font-semibold text-[10px] transition-colors"
                      >
                        +3d Trial
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payments Audit Table */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-5 space-y-4 shadow-xl">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-emerald-400" />
            Recent PayHero M-Pesa Payments
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900/90 text-zinc-400 border-b border-zinc-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Reference</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-zinc-500">
                      No payment records logged yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-900/40">
                      <td className="p-3 font-mono font-bold text-zinc-300">{p.reference}</td>
                      <td className="p-3 font-mono">{p.phone}</td>
                      <td className="p-3 font-bold text-emerald-400">KSh {p.amount}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === "success" || p.status === "COMPLETED"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-400">{new Date(p.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
