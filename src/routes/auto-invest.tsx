import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { PiggyBank, KeyRound, ShieldCheck, Clock, TrendingUp, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/auto-invest")({
  head: () => ({
    meta: [
      { title: "Auto Invest | ZiiDi Trader" },
      { name: "description", content: "Use an admin-issued passkey to start an Auto Invest session." },
      { property: "og:title", content: "Auto Invest | ZiiDi Trader" },
      { property: "og:description", content: "Use an admin-issued passkey to start an Auto Invest session on ZiiDi Trader." },
      { property: "og:url", content: "/auto-invest" },
    ],
    links: [{ rel: "canonical", href: "/auto-invest" }],
  }),
  component: AutoInvestPage,
});

type AI = {
  id: string;
  code: string;
  principal: number;
  return_percent: number;
  duration_days: number;
  projected_return: number;
  status: string;
  started_at: string;
  matures_at: string;
};

function AutoInvestPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number>(0);
  const [hasHoldings, setHasHoldings] = useState<boolean>(false);
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<AI[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    (async () => {
      const [{ data: p }, { data: h }, { data: a }] = await Promise.all([
        supabase.from("profiles").select("balance").eq("id", user.id).maybeSingle(),
        supabase.from("holdings").select("id").eq("user_id", user.id).limit(1),
        supabase.from("autoinvests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setBalance(Number(p?.balance ?? 0));
      setHasHoldings((h?.length ?? 0) > 0);
      setRows((a ?? []) as AI[]);
    })();
  }, [user, loading, navigate]);

  const reload = async () => {
    if (!user) return;
    const { data: a } = await supabase.from("autoinvests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setRows((a ?? []) as AI[]);
    const { data: p } = await supabase.from("profiles").select("balance").eq("id", user.id).maybeSingle();
    setBalance(Number(p?.balance ?? 0));
  };

  const start = async () => {
    if (!code.trim()) return toast.error("Enter your passkey");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a valid amount");
    setBusy(true);
    const { error } = await supabase.rpc("start_autoinvest", { _code: code.trim(), _amount: amt });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Auto Invest activated");
    try {
      const { notify } = await import("@/lib/notify");
      await notify(user?.id, "autoinvest", "Auto Invest activated",
        `Your Auto Invest of KES ${amt.toLocaleString()} is now running with passkey ${code.trim().toUpperCase()}.`,
        { reference: code.trim().toUpperCase(), details: [
          { label: "Passkey", value: code.trim().toUpperCase() },
          { label: "Amount invested", value: `KES ${amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          { label: "Status", value: "Active" },
          { label: "Date", value: new Date().toLocaleString() },
        ] });
    } catch {}
    setCode(""); setAmount("");
    reload();
  };

  const mature = async (id: string) => {
    const { error } = await supabase.rpc("mature_autoinvest", { _id: id });
    if (error) return toast.error(error.message);
    toast.success("Matured and credited to balance");
    try {
      const { notify } = await import("@/lib/notify");
      await notify(user?.id, "autoinvest", "Auto Invest matured",
        "Your Auto Invest plan matured and the principal plus returns have been credited to your available balance.",
        { reference: id.slice(0, 8).toUpperCase(), details: [
          { label: "Plan reference", value: id.slice(0, 8).toUpperCase() },
          { label: "Status", value: "Matured & credited" },
          { label: "Date", value: new Date().toLocaleString() },
        ] });
    } catch {}
    reload();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/15 text-primary"><PiggyBank className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold">Auto Invest</h1>
          <p className="text-sm text-muted-foreground">Passkey-gated. Available balance: <span className="font-semibold">KES {balance.toLocaleString()}</span></p>
        </div>
      </div>

      {!hasHoldings && balance <= 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <AlertCircle className="h-5 w-5 mt-0.5" />
          <div className="text-sm">
            Auto Invest is locked. Fund your account or buy at least one share first.{" "}
            <Link to="/deposit" className="font-semibold underline">Buy shares →</Link>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-primary" /> Redeem passkey</div>
          <p className="mt-1 text-xs text-muted-foreground">Enter the passkey issued by your ZiiDi admin. It sets minimum amount, duration and % return.</p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Passkey</label>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. ZIIDI-VIP-01"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm uppercase tracking-widest" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Amount (KES)</label>
              <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
            </div>
            <button
              disabled={busy || (!hasHoldings && balance <= 0)}
              onClick={start}
              className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Starting…" : "Start Auto Invest"}
            </button>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Secured by ZiiDi Escrow • funds debited immediately, credited on maturity
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-primary" /> How it works</div>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal pl-5">
            <li>Buy at least one share to unlock Auto Invest.</li>
            <li>Request a passkey from admin. Each passkey defines minimum amount, lock duration and % return.</li>
            <li>Enter passkey + amount. Your balance is debited and the auto-trade starts immediately.</li>
            <li>On maturity, principal + return is credited back to your available balance.</li>
          </ol>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-base font-semibold">Your Auto Invest sessions</h2>
        {rows.length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">No auto-invest sessions yet.</div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const matured = r.status === "matured";
              const dueMs = new Date(r.matures_at).getTime() - Date.now();
              const ready = !matured && dueMs <= 0;
              return (
                <div key={r.id} className="rounded-lg border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{r.code} • KES {Number(r.principal).toLocaleString()}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground flex items-center gap-3">
                      <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" /> +{r.return_percent}% (KES {Number(r.projected_return).toLocaleString()})</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {r.duration_days} day(s)</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      Matures {new Date(r.matures_at).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    {matured ? (
                      <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">Credited</span>
                    ) : ready ? (
                      <button onClick={() => mature(r.id)} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Claim payout</button>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Running</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}