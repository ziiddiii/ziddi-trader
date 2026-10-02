import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ChevronLeft, RefreshCw, Send, Shield, Smartphone, Wallet } from "lucide-react";
import { sendMpesaPayout, checkMpesaBalance } from "@/lib/mpesa.functions";

export const Route = createFileRoute("/admin-payouts")({
  head: () => ({
    meta: [
      { title: "Admin — M-PESA Payouts & Balance" },
      { name: "description", content: "Send M-PESA payouts to individuals and view the live paybill balance." },
      { property: "og:title", content: "Admin — M-PESA Payouts & Balance" },
      { property: "og:description", content: "Send M-PESA payouts and check the paybill balance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPayoutsPage,
});

type Payout = {
  id: string;
  phone: string;
  amount: number;
  remarks: string;
  status: string;
  transaction_id: string | null;
  receiver_name: string | null;
  result_desc: string | null;
  created_at: string;
};

type BalanceCheck = {
  id: string;
  status: string;
  working_balance: number | null;
  available_balance: number | null;
  reserved_balance: number | null;
  uncleared_balance: number | null;
  result_desc: string | null;
  created_at: string;
};

const money = (v: number | null | undefined) =>
  v == null ? "—" : `KES ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function statusClass(status: string) {
  if (status === "completed") return "bg-emerald-500/10 text-emerald-600";
  if (status === "failed" || status === "timeout") return "bg-destructive/10 text-destructive";
  return "bg-amber-500/10 text-amber-600";
}

function AdminPayoutsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [balance, setBalance] = useState<BalanceCheck | null>(null);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("Payout");
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

  const send = useServerFn(sendMpesaPayout);
  const check = useServerFn(checkMpesaBalance);

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

  const load = useCallback(async () => {
    const [{ data: p }, { data: b }] = await Promise.all([
      supabase
        .from("mpesa_payouts")
        .select("id, phone, amount, remarks, status, transaction_id, receiver_name, result_desc, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("mpesa_balance_checks")
        .select("id, status, working_balance, available_balance, reserved_balance, uncleared_balance, result_desc, created_at")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    setPayouts((p ?? []) as Payout[]);
    setBalance(((b ?? [])[0] as BalanceCheck) ?? null);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const channel = supabase
      .channel(`mpesa-admin:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mpesa_payouts" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "mpesa_balance_checks" }, () => load())
      .subscribe();
    const poll = setInterval(load, 8000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [isAdmin, load]);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await send({ data: { phone, amount: Number(amount), remarks } });
      if (res.ok) {
        toast.success(res.message);
        setPhone("");
        setAmount("");
      } else {
        toast.error(res.message);
      }
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payout failed");
    } finally {
      setSending(false);
    }
  };

  const onCheck = async () => {
    setChecking(true);
    try {
      const res = await check({});
      res.ok ? toast.success(res.message) : toast.error(res.message);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Balance check failed");
    } finally {
      setChecking(false);
    }
  };

  if (loading || isAdmin === null) {
    return <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">Loading…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 text-center text-foreground">
        <div>
          <Shield className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <h1 className="text-lg font-semibold">Admins only</h1>
          <Link to="/dashboard" className="mt-3 inline-block text-sm text-primary underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground md:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/admin-panel" className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-accent">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold">M-PESA Payouts</h1>
              <p className="text-xs text-muted-foreground">Send money to individuals and check your paybill balance.</p>
            </div>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Wallet className="h-4 w-4 text-emerald-600" /> Paybill balance
            </div>
            <div className="rounded-xl bg-muted/60 p-4">
              <div className="text-xs text-muted-foreground">Utility / available</div>
              <div className="mt-1 text-2xl font-bold">{money(balance?.available_balance)}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Working: {money(balance?.working_balance)}</div>
                <div>Reserved: {money(balance?.reserved_balance)}</div>
                <div>Uncleared: {money(balance?.uncleared_balance)}</div>
                <div>
                  Status:{" "}
                  <span className={`rounded px-1.5 py-0.5 ${statusClass(balance?.status ?? "pending")}`}>
                    {balance?.status ?? "never checked"}
                  </span>
                </div>
              </div>
              {balance?.created_at && (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Last checked {new Date(balance.created_at).toLocaleString()}
                </div>
              )}
              {balance?.result_desc && balance.status !== "completed" && (
                <div className="mt-2 text-[11px] text-destructive">{balance.result_desc}</div>
              )}
            </div>
            <button
              onClick={onCheck}
              disabled={checking}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
              {checking ? "Requesting…" : "Check balance now"}
            </button>
            <p className="mt-2 text-[11px] text-muted-foreground">
              M-PESA returns the balance asynchronously — it appears here within a few seconds.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Smartphone className="h-4 w-4 text-emerald-600" /> Send a payout
            </div>
            <form onSubmit={onSend} className="grid gap-3">
              <label className="grid gap-1 text-xs text-muted-foreground">
                Recipient phone
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  inputMode="tel"
                  placeholder="0712345678"
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Amount (KES)
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  inputMode="numeric"
                  placeholder="1000"
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Remarks
                <input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"
                />
              </label>
              <button
                type="submit"
                disabled={sending}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send money"}
              </button>
            </form>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 text-sm font-semibold">Recent payouts ({payouts.length})</div>
          {payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payouts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2">Date</th>
                    <th className="py-2">Phone</th>
                    <th className="py-2">Amount</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">M-PESA ref</th>
                    <th className="py-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id} className="border-t border-border/60">
                      <td className="py-2 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</td>
                      <td className="py-2">{p.phone}</td>
                      <td className="py-2 font-medium">{money(p.amount)}</td>
                      <td className="py-2">
                        <span className={`rounded px-2 py-0.5 text-xs ${statusClass(p.status)}`}>{p.status}</span>
                      </td>
                      <td className="py-2 text-xs">{p.transaction_id ?? "—"}</td>
                      <td className="py-2 text-xs text-muted-foreground">{p.receiver_name ?? p.result_desc ?? p.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}