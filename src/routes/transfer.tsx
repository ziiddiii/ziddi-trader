import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Send, Search, CheckCircle2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/transfer")({
  head: () => ({
    meta: [
      { title: "Send Funds — ZiiDi Trader" },
      { name: "description", content: "Send funds instantly to another ZiiDi Trader user by phone number or Account ID." },
      { property: "og:title", content: "Send Funds — ZiiDi Trader" },
      { property: "og:description", content: "Send funds instantly to another ZiiDi Trader user by phone number or Account ID." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TransferPage,
});

type Recipient = { id: string; username: string; account_id: string };
type Transfer = { id: string; sender_id: string; amount: number; recipient_label: string | null; sender_label: string | null; created_at: string };

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function TransferPage() {
  const { user, profile } = useAuth();
  const [myId, setMyId] = useState("");
  const [minAmount, setMinAmount] = useState(0);
  const [query, setQuery] = useState("");
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Transfer[]>([]);

  const load = async () => {
    if (!user) return;
    const [{ data: p }, { data: s }, { data: h }] = await Promise.all([
      supabase.from("profiles").select("account_id" as any).eq("id", user.id).maybeSingle(),
      supabase.from("transfer_settings" as any).select("min_amount").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("transfers" as any).select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setMyId(((p as any)?.account_id as string) || "");
    setMinAmount(Number((s as any)?.min_amount ?? 0));
    setHistory(((h as any) || []) as Transfer[]);
  };
  useEffect(() => { load(); }, [user]);

  const lookup = async () => {
    const q = query.trim();
    if (q.length < 6 || q.length > 20) return toast.error("Enter a phone number or Account ID (ZD123456)");
    setBusy(true);
    const { data, error } = await supabase.rpc("find_transfer_recipient" as any, { _q: q });
    setBusy(false);
    const r = (data as any)?.[0] as Recipient | undefined;
    if (error || !r) { setRecipient(null); return toast.error("No user found with that phone or Account ID"); }
    if (r.id === user?.id) { setRecipient(null); return toast.error("You cannot send funds to yourself"); }
    setRecipient(r);
  };

  const send = async () => {
    if (!recipient) return;
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) return toast.error("Enter a valid amount");
    if (v < minAmount) return toast.error(`Minimum transfer is KES ${fmt(minAmount)}`);
    if (profile && v > profile.balance) return toast.error("Insufficient balance");
    setBusy(true);
    const { error } = await supabase.rpc("transfer_funds" as any, { _recipient: recipient.account_id, _amount: v });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`KES ${fmt(v)} sent to ${recipient.username}`);
    setAmount(""); setRecipient(null); setQuery("");
    load();
  };

  if (!user) return <div className="p-8 text-center"><Link to="/auth" className="text-primary underline">Sign in</Link> to send funds.</div>;

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ChevronLeft className="h-4 w-4" /> Back</Link>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Send className="h-6 w-6 text-primary" /> Send Funds</h1>
        <p className="text-sm text-muted-foreground">Transfer to any ZiiDi user using their phone number or Account ID.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Your Account ID</div>
          <button onClick={() => { navigator.clipboard?.writeText(myId); toast.success("Copied"); }} className="mt-1 flex items-center gap-2 font-mono text-lg font-bold">{myId || "—"} <Copy className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Available balance</div>
          <div className="mt-1 text-lg font-bold">KES {fmt(profile?.balance ?? 0)}</div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <label className="text-sm font-medium">Recipient phone or Account ID</label>
        <div className="flex gap-2">
          <input value={query} onChange={(e) => { setQuery(e.target.value); setRecipient(null); }} placeholder="07XX XXX XXX or ZD123456" maxLength={20}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <button onClick={lookup} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-border px-3 text-sm hover:bg-accent disabled:opacity-50"><Search className="h-4 w-4" /> Find</button>
        </div>
        {recipient && (
          <div className="flex items-center gap-2 rounded-md bg-primary/10 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" /> <span className="font-semibold">{recipient.username}</span> <span className="font-mono text-muted-foreground">{recipient.account_id}</span>
          </div>
        )}
        <label className="text-sm font-medium">Amount (KES)</label>
        <input type="number" min={minAmount} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Min ${fmt(minAmount)}`}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <p className="text-xs text-muted-foreground">Minimum transfer: KES {fmt(minAmount)}</p>
        <button onClick={send} disabled={busy || !recipient} className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {busy ? "Processing…" : "Send funds"}
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Recent transfers</h2>
        {history.length === 0 ? <p className="text-sm text-muted-foreground">No transfers yet.</p> : (
          <ul className="divide-y divide-border">
            {history.map((t) => {
              const out = t.sender_id === user.id;
              return (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{out ? `To ${t.recipient_label}` : `From ${t.sender_label}`}</div>
                    <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                  </div>
                  <div className={`font-semibold ${out ? "text-destructive" : "text-primary"}`}>{out ? "-" : "+"}KES {fmt(Number(t.amount))}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
