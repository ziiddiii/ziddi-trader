import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Shield, CheckCircle2, Clock, RefreshCw, ExternalLink, MessageSquare, Wallet, Lock as LockIcon, KeyRound, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Approve Orders | ZiiDi Trader" },
      { name: "description", content: "Approve paid share purchases and release stock to buyer portfolios." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Row = {
  id: string;
  ticker: string;
  company_name: string | null;
  quantity: number;
  price_per_share: number;
  status: string;
  buyer_id: string | null;
  seller_id: string;
  created_at: string;
};

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"paid" | "pending" | "sold" | "all">("paid");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user, loading, navigate]);

  const load = async () => {
    let q = supabase.from("listings").select("*").order("created_at", { ascending: false });
    if (tab !== "all") q = q.eq("status", tab);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    const list = (data ?? []) as Row[];
    setRows(list);
    const ids = Array.from(new Set(list.flatMap((r) => [r.seller_id, r.buyer_id].filter(Boolean) as string[])));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: { id: string; username: string }) => { map[p.id] = p.username; });
      setNames(map);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const ch = supabase
      .channel("admin:listings")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, tab]);

  const approve = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_approve_payment", { _listing_id: id });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Payment approved — shares released to buyer");
    try {
      const row = rows.find((r) => r.id === id);
      if (row?.buyer_id) {
        const { notify } = await import("@/lib/notify");
        await notify(row.buyer_id, "approval", "Payment approved — shares credited",
          `Your payment for ${row.quantity} × ${row.ticker} has been approved. The shares are now in your portfolio.`);
      }
    } catch {}
    load();
  };

  if (loading || isAdmin === null) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account does not have the admin role. Contact the platform owner to be granted access.</p>
      </div>
    );
  }

  const counts = {
    paid: rows.filter((r) => r.status === "paid").length,
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Shield className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-semibold">Admin — Orders</h1>
            <p className="text-xs text-muted-foreground">Approve buyer payments and release shares to their portfolio.</p>
          </div>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-accent">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
        <Link to="/admin-plans" className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20">
          <Wallet className="h-3.5 w-3.5" /> Manage Investment Plans
        </Link>
      </div>

      <LockSettingsCard />
      <PasskeysCard />

      <div className="mb-4 flex flex-wrap gap-2">
        {(["paid", "pending", "sold", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${tab === t ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
          >
            {t === "paid" ? `Awaiting approval${tab !== "paid" && counts.paid ? ` (${counts.paid})` : ""}` : t}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="hidden grid-cols-12 gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
          <div className="col-span-2">Ticker</div>
          <div className="col-span-1">Qty</div>
          <div className="col-span-2">Price</div>
          <div className="col-span-2">Total</div>
          <div className="col-span-2">Buyer</div>
          <div className="col-span-2">Seller</div>
          <div className="col-span-1 text-right">Action</div>
        </div>
        {rows.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No orders in this view.</div>
        )}
        {rows.map((r) => {
          const total = r.quantity * Number(r.price_per_share);
          return (
            <div key={r.id} className="grid grid-cols-2 gap-3 border-b px-4 py-3 text-sm md:grid-cols-12 md:items-center">
              <div className="md:col-span-2">
                <div className="font-semibold">{r.ticker}</div>
                <div className="text-xs text-muted-foreground">{r.company_name}</div>
              </div>
              <div className="md:col-span-1"><span className="md:hidden text-muted-foreground">Qty: </span>{r.quantity}</div>
              <div className="md:col-span-2 font-mono text-xs">Ksh {Number(r.price_per_share).toFixed(2)}</div>
              <div className="md:col-span-2 font-mono text-sm font-semibold">Ksh {total.toFixed(2)}</div>
              <div className="md:col-span-2 truncate">{r.buyer_id ? (names[r.buyer_id] ?? "—") : "—"}</div>
              <div className="md:col-span-2 truncate">{names[r.seller_id] ?? "—"}</div>
              <div className="flex items-center justify-end gap-2 md:col-span-1">
                {r.buyer_id ? (
                  <Link
                    to="/listing/$id"
                    params={{ id: r.id }}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                    title="Chat with buyer as seller"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Chat
                  </Link>
                ) : (
                  <Link to="/listing/$id" params={{ id: r.id }} className="rounded-md border p-1.5 hover:bg-accent" title="Open trade room">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
                {r.status === "paid" ? (
                  <button
                    onClick={() => approve(r.id)}
                    disabled={busy === r.id}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {busy === r.id ? "Approving…" : "Approve"}
                  </button>
                ) : (
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] uppercase ${r.status === "sold" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {r.status === "sold" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {r.status}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Approving a paid order runs <code className="rounded bg-muted px-1">admin_approve_payment</code> — it credits the seller's balance and moves the shares into the buyer's portfolio.
      </p>
    </div>
  );
}

function LockSettingsCard() {
  const [s, setS] = useState<{ min_amount: number; max_amount: number; lock_period_hours: number; daily_rate: number } | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    supabase.from("lock_settings").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => data && setS(data as never));
  }, []);
  if (!s) return null;
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const { error } = await supabase.rpc("admin_update_lock_settings", {
      _min_amount: Number(s.min_amount), _max_amount: Number(s.max_amount),
      _lock_period_hours: Number(s.lock_period_hours), _daily_rate: Number(s.daily_rate),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("ZiiDi Lock settings updated");
  };
  return (
    <form onSubmit={save} className="mb-6 rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><LockIcon className="h-4 w-4 text-orange-500" /> ZiiDi Lock — settings</div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-xs">Min amount (KES)
          <input type="number" min={1} value={s.min_amount} onChange={(e) => setS({ ...s, min_amount: Number(e.target.value) })} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs">Max amount (KES)
          <input type="number" min={1} value={s.max_amount} onChange={(e) => setS({ ...s, max_amount: Number(e.target.value) })} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs">Lock period (hours)
          <input type="number" min={1} value={s.lock_period_hours} onChange={(e) => setS({ ...s, lock_period_hours: Number(e.target.value) })} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs">Daily rate (0.07 = 7%)
          <input type="number" step="0.001" min={0} max={1} value={s.daily_rate} onChange={(e) => setS({ ...s, daily_rate: Number(e.target.value) })} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
        </label>
      </div>
      <button disabled={saving} className="mt-3 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {saving ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}

type PK = { id: string; code: string; min_amount: number; max_amount: number; duration_days: number; return_percent: number; is_active: boolean; used_by: string | null; created_at: string };

function PasskeysCard() {
  const [rows, setRows] = useState<PK[]>([]);
  const [code, setCode] = useState("");
  const [minAmount, setMinAmount] = useState("10000");
  const [maxAmount, setMaxAmount] = useState("100000");
  const [duration, setDuration] = useState("7");
  const [ret, setRet] = useState("10");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("autoinvest_passkeys").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as PK[]);
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("admin_create_passkey", {
      _code: code, _min_amount: Number(minAmount), _max_amount: Number(maxAmount),
      _duration_days: Number(duration), _return_percent: Number(ret),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Passkey created");
    setCode("");
    load();
  };

  const toggle = async (id: string, active: boolean) => {
    const { error } = await supabase.rpc("admin_toggle_passkey", { _id: id, _active: active });
    if (error) return toast.error(error.message);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this passkey?")) return;
    const { error } = await supabase.from("autoinvest_passkeys").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-primary" /> Auto Invest — passkeys</div>
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-6">
        <label className="text-xs sm:col-span-2">Passkey code
          <input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ZIIDI-VIP-01" className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm uppercase tracking-widest" />
        </label>
        <label className="text-xs">Min amount (KES)
          <input type="number" min={1} value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs">Max amount (KES)
          <input type="number" min={1} value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs">Duration (days)
          <input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs">Return %
          <input type="number" min={0} step="0.1" value={ret} onChange={(e) => setRet(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
        </label>
        <div className="sm:col-span-6">
          <button disabled={busy} className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {busy ? "Creating…" : "Issue passkey"}
          </button>
        </div>
      </form>

      {rows.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border">
          <div className="grid grid-cols-7 gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground">
            <div className="col-span-2">Code</div><div>Min</div><div>Max</div><div>Days</div><div>%</div><div className="text-right">Actions</div>
          </div>
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-7 items-center gap-2 border-b px-3 py-2 text-sm">
              <div className="col-span-2 font-mono text-xs">
                {r.code}
                {r.used_by && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">used</span>}
                {!r.is_active && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] uppercase text-amber-800">off</span>}
              </div>
              <div>KES {Number(r.min_amount).toLocaleString()}</div>
              <div>KES {Number(r.max_amount).toLocaleString()}</div>
              <div>{r.duration_days}</div>
              <div>{r.return_percent}%</div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => toggle(r.id, !r.is_active)} className="rounded-md border px-2 py-1 text-xs hover:bg-accent">
                  {r.is_active ? "Disable" : "Enable"}
                </button>
                <button onClick={() => del(r.id)} className="rounded-md border border-destructive/40 p-1 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}