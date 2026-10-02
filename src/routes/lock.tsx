import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Lock, Unlock, TrendingUp, Clock, Wallet, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/lock")({
  head: () => ({
    meta: [
      { title: "ZiiDi Lock — Earn 7% Daily | ZiiDi Trader" },
      { name: "description", content: "Lock your available balance and earn daily interest." },
      { property: "og:title", content: "ZiiDi Lock — Earn 7% Daily | ZiiDi Trader" },
      { property: "og:description", content: "Lock your available balance and earn daily interest on ZiiDi Trader." },
      { property: "og:url", content: "/lock" },
    ],
    links: [{ rel: "canonical", href: "/lock" }],
  }),
  component: LockPage,
});

type Settings = {
  min_amount: number;
  max_amount: number;
  lock_period_hours: number;
  daily_rate: number;
};
type Deposit = {
  id: string;
  principal: number;
  daily_rate: number;
  lock_period_hours: number;
  locked_at: string;
  unlock_at: string;
  released_at: string | null;
  interest_credited: number;
  status: "active" | "released";
};

function LockPage() {
  const { user, profile } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [amount, setAmount] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = async () => {
    const { data: s } = await supabase.from("lock_settings").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (s) setSettings(s as Settings);
    if (user) {
      const { data: d } = await supabase.from("lock_deposits").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setDeposits((d ?? []) as Deposit[]);
    }
  };

  const refreshBalance = async () => {
    if (!user) return;
    await load();
  };

  useEffect(() => { load(); }, [user]);
  useEffect(() => { const t = setInterval(() => setTick((v) => v + 1), 1000); return () => clearInterval(t); }, []);

  const balance = profile?.balance ?? 0;
  const active = deposits.filter((d) => d.status === "active");
  const activeTotal = active.reduce((s, d) => s + Number(d.principal), 0);
  const projectedInterest = active.reduce((s, d) => {
    const days = (Date.now() - new Date(d.locked_at).getTime()) / 86400000;
    return s + Number(d.principal) * Number(d.daily_rate) * days;
  }, 0);

  const handleLock = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n <= 0) { toast.error("Enter a valid amount"); return; }
    if (settings && n > balance) { toast.error("Insufficient balance"); return; }
    setBusy("lock");
    const { error } = await supabase.rpc("lock_funds", { _amount: n });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Funds locked successfully");
    try {
      const { notify } = await import("@/lib/notify");
      const { data: u } = await supabase.auth.getUser();
      await notify(u.user?.id, "lock", "ZiiDi Lock activated",
        `KES ${n.toLocaleString()} has been locked and is now earning ${(settings ? settings.daily_rate * 100 : 7).toFixed(1)}% daily interest.`,
        { details: [
          { label: "Principal locked", value: `KES ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          { label: "Daily interest", value: `${(settings ? settings.daily_rate * 100 : 7).toFixed(1)}%` },
          { label: "Lock period", value: `${settings?.lock_period_hours ?? 24} hours` },
          { label: "Date", value: new Date().toLocaleString() },
        ] });
    } catch {}
    setAmount("");
    await refreshBalance();
  };

  const handleUnlock = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("unlock_funds", { _lock_id: id });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Funds released to your balance");
    try {
      const { notify } = await import("@/lib/notify");
      const { data: u } = await supabase.auth.getUser();
      await notify(u.user?.id, "lock", "ZiiDi Lock released",
        "Your locked funds plus accrued daily interest have been released to your available balance.",
        { reference: id.slice(0, 8).toUpperCase(), details: [
          { label: "Lock reference", value: id.slice(0, 8).toUpperCase() },
          { label: "Status", value: "Released to balance" },
          { label: "Date", value: new Date().toLocaleString() },
        ] });
    } catch {}
    await refreshBalance();
  };

  const rate = settings ? (settings.daily_rate * 100).toFixed(1) : "7.0";
  const period = settings?.lock_period_hours ?? 24;

  return (
    <div className="space-y-6 font-body">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      {/* Hero — original ZiiDi Lock orange card */}
      <div className="relative overflow-hidden rounded-3xl bg-[#F37021] p-6 sm:p-8 text-white shadow-lg">
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-black/5 blur-2xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Lock className="h-5 w-5" />
            </div>
            <span className="font-heading font-bold text-xl tracking-tight">ZiiDi Lock</span>
          </div>

          <h1 className="font-heading text-3xl sm:text-4xl font-bold leading-tight mb-3">
            Earn {rate}% daily on locked funds
          </h1>
          <p className="text-white/90 text-base sm:text-lg max-w-2xl leading-relaxed">
            Move part of your available balance into ZiiDi Lock. Funds stay locked for {period}h and earn interest every second. Buying, selling and investing continue as normal.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat label="Available balance" value={`KES ${balance.toLocaleString()}`} />
            <Stat label="Locked (principal)" value={`KES ${activeTotal.toLocaleString()}`} />
            <Stat label="Interest accruing" value={`+KES ${projectedInterest.toFixed(2)}`} />
          </div>
        </div>
      </div>


      <form onSubmit={handleLock} className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-base font-semibold font-heading">
          <Wallet className="h-5 w-5 text-primary" /> Lock funds now
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Min KES {Number(settings?.min_amount ?? 100).toLocaleString()} • Max KES {Number(settings?.max_amount ?? 10000000).toLocaleString()} • Lock period {period}h
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="number"
            min={settings?.min_amount ?? 100}
            max={settings?.max_amount ?? 10000000}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (KES)"
            className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-lg focus:ring-2 focus:ring-primary/20 outline-hidden transition-shadow"
          />
          <button
            type="submit"
            disabled={busy === "lock"}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-transform active:scale-[0.98]"
          >
            <Lock className="h-4 w-4" /> {busy === "lock" ? "Locking…" : "Lock funds"}
          </button>
        </div>
      </form>

      <div>
        <h2 className="mb-3 text-base font-semibold font-heading">Your locks</h2>
        {deposits.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#e5caa0]/40 bg-[#FFEACE]/50 p-8 text-center text-sm text-[#8b7355]">
            No locks yet. Lock some funds above to start earning.
          </div>
        )}
        <div className="grid gap-3">
          {deposits.map((d) => {
            const now = Date.now(); void tick;
            const unlockMs = new Date(d.unlock_at).getTime() - now;
            const canUnlock = unlockMs <= 0 && d.status === "active";
            const days = (now - new Date(d.locked_at).getTime()) / 86400000;
            const accrued = d.status === "active" ? Number(d.principal) * Number(d.daily_rate) * days : Number(d.interest_credited);
            return (
              <div key={d.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Principal</div>
                    <div className="text-lg font-semibold font-heading">KES {Number(d.principal).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Interest {d.status === "active" ? "accruing" : "credited"}</div>
                    <div className="text-lg font-semibold text-primary font-heading">+KES {accrued.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Rate</div>
                    <div className="text-lg font-semibold font-heading">{(Number(d.daily_rate) * 100).toFixed(2)}%/day</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Status</div>
                    {d.status === "released" ? (
                      <div className="text-sm font-medium text-muted-foreground">Released</div>
                    ) : canUnlock ? (
                      <div className="text-sm font-medium text-primary">Ready to unlock</div>
                    ) : (
                      <div className="text-sm font-medium font-heading">{formatCountdown(unlockMs)}</div>
                    )}
                  </div>
                  {d.status === "active" && (
                    <button
                      onClick={() => handleUnlock(d.id)}
                      disabled={!canUnlock || busy === d.id}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 transition-transform active:scale-[0.98]"
                    >
                      <Unlock className="h-4 w-4" /> {busy === d.id ? "Releasing…" : "Unlock"}
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <span>Locked: {new Date(d.locked_at).toLocaleString()}</span>
                  <span>Unlocks: {new Date(d.unlock_at).toLocaleString()}</span>
                  {d.released_at && <span>Released: {new Date(d.released_at).toLocaleString()}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs text-muted-foreground flex gap-2">
        <TrendingUp className="h-4 w-4 text-primary shrink-0" />
        <span>Interest accrues per second at the configured daily rate. On release, the principal + interest is credited back to your available balance.</span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/20 p-3 border border-white/30 backdrop-blur-sm">
      <div className="text-xs text-white/80 font-medium">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white font-heading">{value}</div>
    </div>
  );
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}
