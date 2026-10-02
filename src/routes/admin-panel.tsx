import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Shield, CheckCircle2, XCircle, RefreshCw, Users, Wallet, FileText, Landmark, Film,
  BadgeCheck, Banknote, LineChart, Newspaper, Search, Ban, Mail, Plus, Trash2,
  Eye, Save, LogOut, KeyRound, MessageCircle, Send, X, AlertTriangle, Headphones,
} from "lucide-react";
import { Receipt, Megaphone, Smartphone } from "lucide-react";
import { TickerLogo } from "@/components/ticker-logo";
import { useServerFn } from "@tanstack/react-start";
import { broadcastEmailToAllUsers } from "@/lib/broadcast-email.functions";
import { AdminContentSection } from "@/components/admin-content-section";

export const Route = createFileRoute("/admin-panel")({
  head: () => ({
    meta: [
      { title: "Admin Panel — ZiiDi Trader" },
      { name: "description", content: "Manage ZiiDi Trader listings, users, media and platform settings." },
      { property: "og:title", content: "Admin Panel — ZiiDi Trader" },
      { property: "og:description", content: "ZiiDi Trader administration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPanel,
});

import { BOND_TICKERS, fetchMarketStocks } from "@/lib/market-stocks";

type TabId =
  | "shares" | "bonds" | "plans" | "community"
  | "users" | "stocks" | "kyc" | "deposits" | "withdrawals" | "passkeys" | "tax" | "transfers" | "support" | "disputes" | "promos" | "broadcast" | "content";

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "shares",      label: "Approve Shares",     icon: CheckCircle2 },
  { id: "bonds",       label: "Approve Bonds",      icon: Landmark },
  { id: "plans",       label: "Investment Plans",   icon: LineChart },
  { id: "community",   label: "Community Blog",     icon: Newspaper },
  { id: "content",     label: "Platform Content",   icon: Film },
  { id: "users",       label: "User Management",    icon: Users },
  { id: "stocks",      label: "Add Stocks",         icon: Wallet },
  { id: "kyc",         label: "KYC Approvals",      icon: BadgeCheck },
  { id: "deposits",    label: "Deposits",           icon: Smartphone },
  { id: "withdrawals", label: "Withdrawals",        icon: Banknote },
  { id: "passkeys",    label: "Auto Invest Passkeys", icon: KeyRound },
  { id: "tax",         label: "Withdrawal Tax",     icon: Receipt },
  { id: "transfers",   label: "Transfer Settings",  icon: Banknote },
  { id: "support",     label: "Live Support",       icon: MessageCircle },
  { id: "disputes",    label: "Disputes",           icon: AlertTriangle },
  { id: "promos",      label: "Promo Flashes",      icon: Megaphone },
  { id: "broadcast",   label: "Broadcast Email",    icon: Mail },
];

function AdminPanel() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabId>("shares");

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    (async () => {
      const { data } = await supabase.from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user, loading, navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (loading || isAdmin === null) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in with an admin account.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/20 text-primary-foreground">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">ZiiDi Admin Panel</div>
              <div className="text-[11px] text-slate-300">Signed in as {user?.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin-payouts" className="rounded-md border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10">M-PESA Payouts</Link>
            <Link to="/dashboard" className="rounded-md border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10">User Dashboard</Link>
            <button onClick={signOut} className="inline-flex items-center gap-1 rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium hover:bg-red-600">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 p-4 sm:p-6">
        {/* Sidebar */}
        <aside className="sticky top-[72px] hidden h-[calc(100vh-96px)] w-60 flex-shrink-0 overflow-y-auto rounded-xl border bg-white p-2 md:block">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${active ? "bg-primary text-primary-foreground shadow" : "hover:bg-slate-100"}`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Mobile tab bar */}
        <div className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t bg-white md:hidden">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex min-w-[74px] flex-col items-center gap-0.5 px-2 py-2 text-[10px] ${active ? "text-primary" : "text-slate-500"}`}>
                <Icon className="h-4 w-4" />
                {t.label.split(" ")[0]}
              </button>
            );
          })}
        </div>

        <main className="min-w-0 flex-1 pb-24 md:pb-0">
          {tab === "shares"      && <ListingsApproval kind="shares" />}
          {tab === "bonds"       && <ListingsApproval kind="bonds" />}
          {tab === "plans"       && <PlansSection />}
          {tab === "community"   && <CommunitySection />}
          {tab === "content"     && <AdminContentSection />}
          {tab === "users"       && <UsersSection />}
          {tab === "stocks"      && <AddStocksSection />}
          {tab === "kyc"         && <KycSection />}
          {tab === "deposits"    && <DepositsSection />}
          {tab === "withdrawals" && <WithdrawalsSection />}
          {tab === "passkeys"    && <PasskeysSection />}
          {tab === "tax"         && <TaxSettingsSection />}
          {tab === "transfers"   && <TransferSettingsSection />}
          {tab === "support"     && <SupportSection />}
          {tab === "disputes"    && <DisputesSection />}
          {tab === "promos"      && <PromosSection />}
          {tab === "broadcast"   && <BroadcastSection />}
        </main>
      </div>
    </div>
  );
}

/* ---------- Shared UI ---------- */
function SectionHeader({ icon: Icon, title, subtitle, actions }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className ?? ""}`}>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

/* ---------- 1 & 2. Approve share/bond purchases ---------- */
type ListingRow = {
  id: string; ticker: string; company_name: string | null;
  quantity: number; price_per_share: number; status: string;
  buyer_id: string | null; seller_id: string; created_at: string;
};

function ListingsApproval({ kind }: { kind: "shares" | "bonds" }) {
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"paid" | "pending" | "sold" | "all">("paid");
  const [busy, setBusy] = useState<string | null>(null);
  const [chatRow, setChatRow] = useState<ListingRow | null>(null);

  const load = async () => {
    let q = supabase.from("listings").select("*").order("created_at", { ascending: false });
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return toast.error(error.message);
    const filtered = (data ?? []).filter((r) => {
      const isBond = BOND_TICKERS.includes(r.ticker);
      return kind === "bonds" ? isBond : !isBond;
    }) as ListingRow[];
    setRows(filtered);
    const ids = Array.from(new Set(filtered.flatMap((r) => [r.seller_id, r.buyer_id].filter(Boolean) as string[])));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", ids);
      const m: Record<string, string> = {};
      (profs ?? []).forEach((p: { id: string; username: string }) => { m[p.id] = p.username; });
      setNames(m);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, kind]);

  const approve = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_approve_payment", { _listing_id: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(kind === "bonds" ? "Bond approved & credited to buyer portfolio" : "Payment approved — shares released");
    load();
  };

  return (
    <>
      <SectionHeader
        icon={kind === "bonds" ? Landmark : CheckCircle2}
        title={kind === "bonds" ? "Approve Bond Purchases" : "Approve Share Purchases"}
        subtitle={kind === "bonds" ? "Release bond units to the buyer's portfolio once payment is confirmed." : "Release paid stock shares to the buyer's portfolio."}
        actions={<button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs hover:bg-slate-50"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {(["paid","pending","sold","all"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${status===s ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:bg-slate-50"}`}>
            {s === "paid" ? "Awaiting approval" : s}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border bg-white">
        {rows.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No records.</div>}
        {rows.map((r) => {
          const total = r.quantity * Number(r.price_per_share);
          return (
            <div key={r.id} className="grid grid-cols-2 gap-3 border-b px-4 py-3 text-sm md:grid-cols-12 md:items-center">
              <div className="md:col-span-3">
                <div className="font-semibold">{r.ticker}</div>
                <div className="text-xs text-muted-foreground">{r.company_name}</div>
              </div>
              <div className="md:col-span-1"><span className="md:hidden text-xs text-muted-foreground">Qty: </span>{r.quantity}</div>
              <div className="md:col-span-2 font-mono text-xs">KES {Number(r.price_per_share).toLocaleString()}</div>
              <div className="md:col-span-2 font-mono text-sm font-semibold">KES {total.toLocaleString()}</div>
              <div className="md:col-span-2 truncate">Buyer: {r.buyer_id ? (names[r.buyer_id] ?? "—") : "—"}</div>
              <div className="flex items-center justify-end gap-2 md:col-span-2">
                {kind === "shares" && r.buyer_id && (
                  <button onClick={() => setChatRow(r)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">
                    <MessageCircle className="h-3.5 w-3.5" /> Chat
                  </button>
                )}
                {r.status === "paid" ? (
                  <button onClick={() => approve(r.id)} disabled={busy===r.id}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {busy===r.id ? "Approving…" : "Approve"}
                  </button>
                ) : (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] uppercase text-slate-600">{r.status}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {chatRow && (
        <AdminChatModal
          listing={chatRow}
          buyerName={chatRow.buyer_id ? (names[chatRow.buyer_id] ?? "Buyer") : "Buyer"}
          sellerName={names[chatRow.seller_id] ?? "Seller"}
          onClose={() => setChatRow(null)}
        />
      )}
    </>
  );
}

/* ---------- Admin ↔ Buyer chat (posts as seller via RPC) ---------- */
type ChatMsg = { id: string; listing_id: string; sender_id: string; content: string; created_at: string };
function AdminChatModal({ listing, buyerName, sellerName, onClose }: {
  listing: ListingRow; buyerName: string; sellerName: string; onClose: () => void;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [closed, setClosed] = useState<boolean>(!!(listing as any).chat_closed_at);
  const [closing, setClosing] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const msgChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const raiseDispute = async () => {
    const reason = window.prompt(
      "Describe the issue with this trade (e.g. buyer marked paid but no funds received). This will be raised as ZiiDi Customer Care. False claims may lead to account suspension.",
      "Buyer marked payment as sent but funds were not received."
    );
    if (!reason || reason.trim().length < 3) return;
    setDisputing(true);
    const { error } = await supabase.rpc("open_dispute", { _listing_id: listing.id, _reason: reason.trim() });
    setDisputing(false);
    if (error) return toast.error(error.message);
    toast.success("Dispute raised — visible in Disputes tab");
  };

  const closeChat = async () => {
    if (!window.confirm("Close this chat for both parties?")) return;
    setClosing(true);
    const { error } = await supabase.rpc("close_listing_chat", { _listing_id: listing.id });
    setClosing(false);
    if (error) return toast.error(error.message);
    setClosed(true);
    toast.success("Chat closed");
  };

  const load = async () => {
    const { data, error } = await supabase.from("messages")
      .select("*").eq("listing_id", listing.id).order("created_at", { ascending: true });
    if (error) return toast.error(error.message);
    setMsgs((data ?? []) as ChatMsg[]);
  };
  useEffect(() => {
    load();
    const ch = supabase.channel(`admin-msgs-${listing.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `listing_id=eq.${listing.id}` },
        (payload) => setMsgs((prev) => {
          const m = payload.new as ChatMsg;
          return prev.some((x) => x.id === m.id) ? prev : [...prev, m];
        }))
      .subscribe();
    const bch = supabase
      .channel(`listing-msgs:${listing.id}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "new-message" }, (payload) => {
        const m = (payload.payload ?? {}) as ChatMsg;
        if (!m?.id) return;
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      })
      .subscribe();
    msgChanRef.current = bch;
    const poll = setInterval(() => { load(); }, 1500);
    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(bch);
      msgChanRef.current = null;
      clearInterval(poll);
    };
    // eslint-disable-next-line
  }, [listing.id]);

  const send = async () => {
    const content = text.trim();
    if (!content) return;
    setSending(true);
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: ChatMsg = {
      id: tempId,
      sender_id: listing.seller_id,
      content,
      created_at: new Date().toISOString(),
    } as ChatMsg;
    setMsgs((prev) => [...prev, optimistic]);
    setText("");
    try {
      await msgChanRef.current?.send({ type: "broadcast", event: "new-message", payload: optimistic });
    } catch {}
    const { error } = await supabase.rpc("admin_send_as_seller", { _listing_id: listing.id, _content: content });
    setSending(false);
    if (error) {
      setMsgs((prev) => prev.filter((m) => m.id !== tempId));
      return toast.error(error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:h-[600px] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b bg-slate-900 px-4 py-3 text-white">
          <div>
            <div className="text-sm font-semibold">Chat with {buyerName}</div>
            <div className="text-[11px] text-slate-300">{listing.ticker} · replying as seller ({sellerName})</div>
          </div>
          <div className="flex items-center gap-2">
            {!closed && (
              <button
                onClick={closeChat}
                disabled={closing}
                className="rounded-md border border-white/20 px-2 py-1 text-[11px] hover:bg-white/10 disabled:opacity-60"
              >
                {closing ? "Closing…" : "Close chat"}
              </button>
            )}
            <button
              onClick={raiseDispute}
              disabled={disputing}
              className="rounded-md border border-red-400/50 bg-red-500/20 px-2 py-1 text-[11px] text-red-100 hover:bg-red-500/30 disabled:opacity-60"
              title="Raise dispute (e.g. buyer didn't actually pay)"
            >
              {disputing ? "Raising…" : "⚠ Raise dispute"}
            </button>
            <button onClick={onClose} className="rounded-md p-1 hover:bg-white/10"><X className="h-4 w-4" /></button>
          </div>
        </div>
        {closed && (
          <div className="border-b bg-amber-50 px-4 py-2 text-[11px] text-amber-800">
            🔒 This chat is closed. No further messages can be sent.
          </div>
        )}
        <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
          {msgs.length === 0 && <div className="mt-8 text-center text-xs text-muted-foreground">No messages yet.</div>}
          {msgs.map((m) => {
            const fromSeller = m.sender_id === listing.seller_id;
            return (
              <div key={m.id} className={`flex ${fromSeller ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${fromSeller ? "bg-primary text-primary-foreground" : "bg-white border"}`}>
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  <div className={`mt-1 text-[10px] ${fromSeller ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {fromSeller ? "Seller" : buyerName} · {new Date(m.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-end gap-2 border-t bg-white p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!closed) send(); } }}
            rows={2}
            disabled={closed}
            placeholder={closed ? "Chat closed" : "Reply to buyer as seller…"}
            className="flex-1 resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button onClick={send} disabled={sending || closed || !text.trim()}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
            <Send className="h-4 w-4" /> {sending ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- 9. Auto Invest passkeys ---------- */
type Passkey = {
  id: string; code: string; min_amount: number; max_amount: number;
  duration_days: number; return_percent: number; is_active: boolean;
  used_by: string | null; used_at: string | null; created_at: string;
};

function PasskeysSection() {
  const [rows, setRows] = useState<Passkey[]>([]);
  const [code, setCode] = useState("");
  const [minA, setMinA] = useState("10000");
  const [maxA, setMaxA] = useState("100000");
  const [days, setDays] = useState("7");
  const [ret, setRet] = useState("10");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("autoinvest_passkeys")
      .select("*").order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Passkey[]);
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return toast.error("Passkey code required");
    const mn = Number(minA), mx = Number(maxA), d = Number(days), r = Number(ret);
    if (mn <= 0 || mx <= 0 || mx < mn) return toast.error("Check min/max amounts");
    if (d <= 0) return toast.error("Duration must be at least 1 day");
    if (r < 0) return toast.error("Return % cannot be negative");
    setBusy(true);
    const { error } = await supabase.rpc("admin_create_passkey", {
      _code: code, _min_amount: mn, _max_amount: mx,
      _duration_days: d, _return_percent: r,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Passkey issued");
    setCode(""); load();
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

  const randomCode = () => {
    const s = "ZIIDI-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    setCode(s);
  };

  return (
    <>
      <SectionHeader
        icon={KeyRound}
        title="Auto Invest Passkeys"
        subtitle="Generate passkeys users redeem to start an Auto Invest session. Set min/max amount, interest %, and duration."
        actions={<button onClick={load} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>}
      />
      <section className="mb-4 rounded-xl border bg-white p-4">
        <form onSubmit={create} className="grid gap-3 md:grid-cols-6">
          <Field label="Passkey code" className="md:col-span-2">
            <div className="flex gap-2">
              <input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ZIIDI-VIP-01"
                className="w-full rounded-md border px-3 py-2 text-sm uppercase tracking-widest" />
              <button type="button" onClick={randomCode}
                className="whitespace-nowrap rounded-md border px-2 text-xs hover:bg-slate-50">Generate</button>
            </div>
          </Field>
          <Field label="Min amount (KES)">
            <input type="number" min={1} value={minA} onChange={(e) => setMinA(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm" />
          </Field>
          <Field label="Max amount (KES)">
            <input type="number" min={1} value={maxA} onChange={(e) => setMaxA(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm" />
          </Field>
          <Field label="Duration (days)">
            <input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm" />
          </Field>
          <Field label="Interest / return %">
            <input type="number" min={0} step="0.1" value={ret} onChange={(e) => setRet(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm" />
          </Field>
          <div className="md:col-span-6">
            <button disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              <Plus className="h-4 w-4" /> {busy ? "Issuing…" : "Issue passkey"}
            </button>
          </div>
        </form>
      </section>

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="grid grid-cols-12 gap-2 border-b bg-slate-50 px-4 py-2 text-[11px] font-medium uppercase text-muted-foreground">
          <div className="col-span-3">Code</div>
          <div className="col-span-2">Min</div>
          <div className="col-span-2">Max</div>
          <div className="col-span-1">Days</div>
          <div className="col-span-1">%</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {rows.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No passkeys yet.</div>}
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-12 items-center gap-2 border-b px-4 py-2 text-sm">
            <div className="col-span-3 font-mono text-xs">
              {r.code}
              {r.used_by && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">used</span>}
            </div>
            <div className="col-span-2">KES {Number(r.min_amount).toLocaleString()}</div>
            <div className="col-span-2">KES {Number(r.max_amount).toLocaleString()}</div>
            <div className="col-span-1">{r.duration_days}</div>
            <div className="col-span-1">{r.return_percent}%</div>
            <div className="col-span-1">
              <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${r.is_active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                {r.is_active ? "Active" : "Off"}
              </span>
            </div>
            <div className="col-span-2 flex items-center justify-end gap-2">
              <button onClick={() => toggle(r.id, !r.is_active)} className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50">
                {r.is_active ? "Disable" : "Enable"}
              </button>
              <button onClick={() => del(r.id)} className="rounded-md border border-destructive/40 p-1 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Promo Flashes ---------- */
type Promo = { id: string; message: string; enabled: boolean; created_at: string };
function PromosSection() {
  const [items, setItems] = useState<Promo[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("promo_flashes").select("*").order("created_at", { ascending: false });
    setItems((data as Promo[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    const text = msg.trim();
    if (!text) return;
    setBusy(true);
    const { error } = await supabase.from("promo_flashes").insert({ message: text });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setMsg("");
    toast.success("Promo added");
    load();
  };
  const toggle = async (p: Promo) => {
    const { error } = await supabase.from("promo_flashes").update({ enabled: !p.enabled }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    load();
  };
  const del = async (id: string) => {
    const { error } = await supabase.from("promo_flashes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  return (
    <>
      <SectionHeader
        icon={Megaphone}
        title="Withdrawal Promo Flashes"
        subtitle="Messages flash near the footer on user pages every 5 seconds."
      />
      <div className="rounded-xl border bg-white p-4">
        <label className="text-xs font-medium text-slate-600">New promo message</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="e.g. James withdrew KES 45,000 successfully 🎉"
            className="flex-1 rounded-md border px-3 py-2 text-sm"
          />
          <button
            onClick={add}
            disabled={busy || !msg.trim()}
            className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">No promos yet.</div>
        ) : items.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{p.message}</div>
              <div className="text-[11px] text-slate-500">{new Date(p.created_at).toLocaleString()}</div>
            </div>
            <button
              onClick={() => toggle(p)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${p.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
            >
              {p.enabled ? "Enabled" : "Disabled"}
            </button>
            <button onClick={() => del(p.id)} className="rounded-md p-2 text-red-600 hover:bg-red-50" aria-label="Delete">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- 3. Investment plans ---------- */
type Plan = { id: string; name: string; description: string; interest_rate: number; duration_hours: number; min_amount: number; max_amount: number; active: boolean; sort_order: number; };
type PlanDraft = Omit<Plan, "id"> & { id?: string };
const emptyPlan: PlanDraft = { name:"", description:"", interest_rate:100, duration_hours:24, min_amount:1000, max_amount:100000, active:true, sort_order:10 };

function PlansSection() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [draft, setDraft] = useState<PlanDraft>(emptyPlan);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const { data, error } = await supabase.from("investment_plans").select("*").order("sort_order");
    if (error) return toast.error(error.message);
    setPlans((data ?? []) as Plan[]);
  };
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!draft.name.trim()) return toast.error("Name required");
    setBusy(true);
    const payload = { ...draft }; delete (payload as { id?: string }).id;
    const q = draft.id ? supabase.from("investment_plans").update(payload).eq("id", draft.id) : supabase.from("investment_plans").insert(payload);
    const { error } = await q;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(draft.id ? "Plan updated" : "Plan created");
    setDraft(emptyPlan); load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this plan?")) return;
    const { error } = await supabase.from("investment_plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <>
      <SectionHeader icon={LineChart} title="Investment Plans" subtitle="Create, edit, or disable investment packages available to users." />
      <section className="mb-4 rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">{draft.id ? "Edit plan" : "Create new plan"}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Plan name"><input value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Starter Plan" /></Field>
          <Field label="Sort order"><input type="number" value={draft.sort_order} onChange={(e)=>setDraft({...draft,sort_order:Number(e.target.value)})} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
          <Field label="Interest rate (%)"><input type="number" step="0.01" value={draft.interest_rate} onChange={(e)=>setDraft({...draft,interest_rate:Number(e.target.value)})} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
          <Field label="Duration (hours)"><input type="number" value={draft.duration_hours} onChange={(e)=>setDraft({...draft,duration_hours:Number(e.target.value)})} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
          <Field label="Minimum (KES)"><input type="number" value={draft.min_amount} onChange={(e)=>setDraft({...draft,min_amount:Number(e.target.value)})} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
          <Field label="Maximum (KES)"><input type="number" value={draft.max_amount} onChange={(e)=>setDraft({...draft,max_amount:Number(e.target.value)})} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
          <Field label="Description" className="md:col-span-2"><textarea value={draft.description} onChange={(e)=>setDraft({...draft,description:e.target.value})} rows={3} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
          <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={draft.active} onChange={(e)=>setDraft({...draft,active:e.target.checked})} /> Active</label>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {draft.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {busy ? "Saving…" : draft.id ? "Save changes" : "Create plan"}
          </button>
          {draft.id && <button onClick={()=>setDraft(emptyPlan)} className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>}
        </div>
      </section>
      <div className="overflow-hidden rounded-xl border bg-white">
        {plans.length===0 && <div className="p-8 text-center text-sm text-muted-foreground">No plans yet.</div>}
        {plans.map((p) => (
          <div key={p.id} className="grid grid-cols-2 gap-3 border-b px-4 py-3 text-sm md:grid-cols-12 md:items-center">
            <div className="md:col-span-4">
              <div className="font-semibold">{p.name} {!p.active && <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-600">off</span>}</div>
              <div className="line-clamp-1 text-xs text-muted-foreground">{p.description}</div>
            </div>
            <div className="md:col-span-1 font-mono">{p.interest_rate}%</div>
            <div className="md:col-span-2">{p.duration_hours}h</div>
            <div className="md:col-span-2 font-mono text-xs">KES {Number(p.min_amount).toLocaleString()}</div>
            <div className="md:col-span-1 font-mono text-xs">KES {Number(p.max_amount).toLocaleString()}</div>
            <div className="flex items-center justify-end gap-2 md:col-span-2">
              <button onClick={()=>setDraft({ ...p })} className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50">Edit</button>
              <button onClick={()=>remove(p.id)} className="rounded-md border border-destructive/30 p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- 4. Community blog ---------- */
type Post = { id: string; title: string; excerpt: string | null; body: string; category: string | null; cover_url: string | null; author_name: string | null; published: boolean; created_at: string; };
type PostDraft = Omit<Post, "id" | "created_at"> & { id?: string };
const emptyPost: PostDraft = { title:"", excerpt:"", body:"", category:"General", cover_url:"", author_name:"ZiiDi Team", published:true };

function CommunitySection() {
  const [rows, setRows] = useState<Post[]>([]);
  const [draft, setDraft] = useState<PostDraft>(emptyPost);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const { data, error } = await supabase.from("community_posts").select("*").order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Post[]);
  };
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!draft.title.trim() || !draft.body.trim()) return toast.error("Title and body required");
    setBusy(true);
    const payload = { ...draft }; delete (payload as { id?: string }).id;
    const q = draft.id ? supabase.from("community_posts").update(payload).eq("id", draft.id) : supabase.from("community_posts").insert(payload);
    const { error } = await q; setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(draft.id ? "Post updated" : "Post published");
    setDraft(emptyPost); load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete post?")) return;
    const { error } = await supabase.from("community_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <>
      <SectionHeader icon={Newspaper} title="Community Blog" subtitle="Publish trends, testimonials, and marketing articles for the community page." />
      <section className="mb-4 rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">{draft.id ? "Edit article" : "New article"}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Title" className="md:col-span-2"><input value={draft.title} onChange={(e)=>setDraft({...draft,title:e.target.value})} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
          <Field label="Category"><input value={draft.category ?? ""} onChange={(e)=>setDraft({...draft,category:e.target.value})} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Trends" /></Field>
          <Field label="Author name"><input value={draft.author_name ?? ""} onChange={(e)=>setDraft({...draft,author_name:e.target.value})} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
          <Field label="Cover image URL" className="md:col-span-2"><input value={draft.cover_url ?? ""} onChange={(e)=>setDraft({...draft,cover_url:e.target.value})} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="https://…" /></Field>
          <Field label="Excerpt" className="md:col-span-2"><input value={draft.excerpt ?? ""} onChange={(e)=>setDraft({...draft,excerpt:e.target.value})} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="One-line teaser" /></Field>
          <Field label="Body (markdown/plain)" className="md:col-span-2"><textarea value={draft.body} onChange={(e)=>setDraft({...draft,body:e.target.value})} rows={6} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
          <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={draft.published} onChange={(e)=>setDraft({...draft,published:e.target.checked})} /> Published</label>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {draft.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {busy ? "Saving…" : draft.id ? "Save changes" : "Publish"}
          </button>
          {draft.id && <button onClick={()=>setDraft(emptyPost)} className="rounded-md border px-4 py-2 text-sm">Cancel</button>}
        </div>
      </section>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((p) => (
          <div key={p.id} className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase text-primary">{p.category}</div>
                <div className="text-sm font-semibold">{p.title}</div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.excerpt}</div>
                {!p.published && <span className="mt-2 inline-block rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-700">Draft</span>}
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={()=>setDraft({ ...p })} className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50">Edit</button>
                <button onClick={()=>remove(p.id)} className="rounded-md border border-destructive/30 p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- 5. User management ---------- */
type ProfileRow = {
  id: string;
  username: string;
  balance: number;
  suspended: boolean;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
};

function UsersSection() {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<{ kind: "credit" | "mail"; user: ProfileRow } | null>(null);
  const load = async () => {
    // Fetch in pages — the API caps a single response at 1000 rows, which used
    // to hide every user beyond the first 1000 from search.
    const page = 1000;
    const all: ProfileRow[] = [];
    let from = 0;
    let firstError: { message: string } | null = null;
    for (;;) {
      const { data, error } = await supabase.rpc("admin_list_users").range(from, from + page - 1);
      if (error) { firstError = error; break; }
      const batch = (data ?? []) as ProfileRow[];
      all.push(...batch);
      if (batch.length < page) break;
      from += page;
      if (from > 50000) break;
    }
    if (firstError && all.length === 0) {
      // Fallback to profiles-only (e.g. RPC not yet deployed).
      const { data: fallback, error: fbErr } = await supabase
        .from("profiles")
        .select("id, username, balance, suspended")
        .order("username")
        .range(0, 4999);
      if (fbErr) return toast.error(fbErr.message);
      setRows((fallback ?? []) as ProfileRow[]);
      return;
    }
    setRows(all);
  };
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return rows.filter((r) =>
      r.username.toLowerCase().includes(needle) ||
      (r.email ?? "").toLowerCase().includes(needle) ||
      (r.phone ?? "").toLowerCase().includes(needle),
    );
  }, [rows, q]);

  const toggleSuspend = async (u: ProfileRow) => {
    const { error } = await supabase.rpc("admin_set_user_suspended", { _user_id: u.id, _suspended: !u.suspended });
    if (error) return toast.error(error.message);
    toast.success(u.suspended ? "User reactivated" : "User suspended");
    load();
  };

  return (
    <>
      <SectionHeader icon={Users} title="User Management" subtitle="View users, credit balances, send messages, and suspend accounts." />
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search users…" className="w-full rounded-lg border bg-white pl-9 pr-3 py-2 text-sm" />
        </div>
        <div className="text-xs text-muted-foreground">{filtered.length} of {rows.length}</div>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white">
        {filtered.map((u) => (
          <div key={u.id} className="border-b px-4 py-3 text-sm last:border-b-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{u.username}</span>
                  {u.suspended
                    ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Suspended</span>
                    : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Active</span>}
                  <span className="font-mono text-xs text-slate-600">KES {Number(u.balance).toLocaleString()}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs md:grid-cols-2 lg:grid-cols-3">
                  <DetailCell label="Email" value={u.email || "—"} />
                  <DetailCell label="Phone" value={u.phone || "—"} />
                  <DetailCell label="Registered" value={fmtDateTime(u.created_at)} />
                  <DetailCell label="Last sign-in" value={fmtDateTime(u.last_sign_in_at)} />
                  <DetailCell label="Email confirmed" value={fmtDateTime(u.email_confirmed_at)} />
                  <DetailCell label="User ID" value={u.id} />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <button onClick={()=>setModal({ kind:"credit", user:u })} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-slate-50"><Wallet className="h-3.5 w-3.5" /> Balance</button>
                <button onClick={()=>setModal({ kind:"mail", user:u })} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-slate-50"><Mail className="h-3.5 w-3.5" /> Mail</button>
                <button onClick={()=>toggleSuspend(u)} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${u.suspended ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-red-600 text-white hover:bg-red-700"}`}>
                  <Ban className="h-3.5 w-3.5" /> {u.suspended ? "Unsuspend" : "Suspend"}
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No users match.</div>}
      </div>
      {modal && <UserActionModal action={modal.kind} user={modal.user} onClose={()=>{ setModal(null); load(); }} />}
    </>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-all font-mono text-[11px] text-slate-800">{value}</div>
    </div>
  );
}

function fmtDateTime(v?: string | null) {
  if (!v) return "—";
  try { return new Date(v).toLocaleString(); } catch { return v; }
}

function UserActionModal({ action, user, onClose }: { action: "credit" | "mail"; user: ProfileRow; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    if (action === "credit") {
      const amt = Number(amount);
      if (!amt) { setBusy(false); return toast.error("Enter amount (use negative to debit)"); }
      const { error } = await supabase.rpc("admin_credit_user_balance", { _user_id: user.id, _amount: amt, _note: note || "" });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Balance updated");
    } else {
      if (!subject.trim() || !body.trim()) { setBusy(false); return toast.error("Subject and body required"); }
      const { error } = await supabase.rpc("admin_send_user_mail", { _user_id: user.id, _subject: subject, _body: body });
      setBusy(false);
      if (error) return toast.error(error.message);
      // Also send the branded ZiiDi Trader email template to the user's inbox
      try {
        const { sendUserNotificationEmail } = await import("@/lib/email-notify.functions");
        void sendUserNotificationEmail({
          data: {
            userId: user.id,
            title: subject,
            body,
            kind: "message",
            idempotencyKey: `admin-mail-${user.id}-${Date.now()}`,
          },
        });
      } catch { /* fire and forget */ }
      toast.success("Message delivered — branded email sent");
    }
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e)=>e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          {action === "credit" ? <Wallet className="h-5 w-5 text-primary" /> : <Mail className="h-5 w-5 text-primary" />}
          <div>
            <div className="text-sm font-semibold">{action === "credit" ? "Adjust balance" : "Send message"}</div>
            <div className="text-xs text-muted-foreground">To: {user.username}</div>
          </div>
        </div>
        {action === "credit" ? (
          <div className="space-y-3">
            <Field label="Amount (KES, use negative to debit)"><input type="number" value={amount} onChange={(e)=>setAmount(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="e.g. 5000 or -500" /></Field>
            <Field label="Note (optional)"><input value={note} onChange={(e)=>setNote(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Promo bonus" /></Field>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Subject"><input value={subject} onChange={(e)=>setSubject(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
            <Field label="Message"><textarea rows={5} value={body} onChange={(e)=>setBody(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={busy} className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60">{busy?"Sending…":"Confirm"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- 6. Add stocks ---------- */
function AddStocksSection() {
  const { user } = useAuth();
  const [ticker, setTicker] = useState("");
  const [company, setCompany] = useState("");
  const [qty, setQty] = useState("100");
  const [price, setPrice] = useState("100");
  const [sellerName, setSellerName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [changePct, setChangePct] = useState("");
  const [minBuy, setMinBuy] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [search, setSearch] = useState("");
  const [minTotal, setMinTotal] = useState<number>(25000);
  const [maxTotal, setMaxTotal] = useState<number>(2000000);
  const [minInput, setMinInput] = useState("25000");
  const [maxInput, setMaxInput] = useState("2000000");
  const [defMinBuy, setDefMinBuy] = useState<number>(25000);
  const [defMinBuyInput, setDefMinBuyInput] = useState("25000");
  const [savingLimits, setSavingLimits] = useState(false);
  const loadSettings = async () => {
    const { data } = await supabase.from("stock_settings" as any).select("*").order("updated_at",{ascending:false}).limit(1).maybeSingle();
    if (data) {
      setMinTotal(Number((data as any).min_total));
      setMaxTotal(Number((data as any).max_total));
      setMinInput(String((data as any).min_total));
      setMaxInput(String((data as any).max_total));
      setDefMinBuy(Number((data as any).default_min_buy ?? 25000));
      setDefMinBuyInput(String((data as any).default_min_buy ?? 25000));
    }
  };
  useEffect(() => { loadSettings(); }, []);
  const saveLimits = async () => {
    const _min = Number(minInput); const _max = Number(maxInput);
    if (!Number.isFinite(_min) || !Number.isFinite(_max) || _min <= 0 || _max <= 0 || _min > _max) return toast.error("Invalid range");
    setSavingLimits(true);
    const _default_min_buy = Number(defMinBuyInput);
    if (!Number.isFinite(_default_min_buy) || _default_min_buy <= 0) { setSavingLimits(false); return toast.error("Invalid minimum buy"); }
    const { error } = await supabase.rpc("admin_update_stock_settings" as any, { _min, _max, _default_min_buy });
    setSavingLimits(false);
    if (error) return toast.error(error.message);
    toast.success("Stock limits updated");
    loadSettings();
  };
  const load = async () => {
    // Identical canonical set to the buyers' Buy Shares page.
    const unique = await fetchMarketStocks<ListingRow>();
    setRows(unique);
  };
  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-stocks-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  const add = async () => {
    if (!user) return;
    if (!ticker.trim() || !company.trim() || !qty || !price) return toast.error("All fields required");
    const totalAsk = Number(qty) * Number(price);
    if (totalAsk < minTotal) return toast.error(`Total listing value must be at least KES ${minTotal.toLocaleString()}`);
    if (totalAsk > maxTotal) return toast.error(`Total listing value cannot exceed KES ${maxTotal.toLocaleString()}`);
    setBusy(true);
    const { error } = await supabase.from("listings").insert({
      ticker: ticker.toUpperCase().trim(), company_name: company.trim(),
      quantity: Number(qty), price_per_share: Number(price), status: "active", seller_id: user.id,
      seller_name: sellerName.trim() || null,
      logo_url: logoUrl.trim() || null,
      change_percent: changePct.trim() === "" ? 0 : Number(changePct),
      min_buy_amount: minBuy.trim() === "" ? null : Number(minBuy),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Stock listing added — visible on marketplace");
    setTicker(""); setCompany(""); setQty("100"); setPrice("100"); setSellerName(""); setLogoUrl(""); setChangePct(""); setMinBuy("");
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Remove this listing?")) return;
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  const onLogoFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo must be under 2 MB");
    setUploading(true);
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("stock-logos").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { setUploading(false); return toast.error(up.error.message); }
    setUploading(false);
    setLogoUrl(`stock-logos://${path}`);
    toast.success("Logo uploaded");
  };
  return (
    <>
      <SectionHeader icon={Wallet} title="Add Stocks" subtitle="Publish new share listings that appear on the buyers' Buy Shares page." />
      <section className="mb-4 rounded-xl border bg-white p-4">
        <div className="mb-2 text-sm font-semibold">Stock listing limits</div>
        <p className="mb-3 text-xs text-muted-foreground">Global minimum & maximum total value (qty × price) allowed per listing. Enforced in the admin form and the buyers' new-listing page.</p>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Minimum total (KES)"><input type="number" value={minInput} onChange={(e)=>setMinInput(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
          <Field label="Maximum total (KES)"><input type="number" value={maxInput} onChange={(e)=>setMaxInput(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
          <Field label="Default minimum buy (KES)"><input type="number" value={defMinBuyInput} onChange={(e)=>setDefMinBuyInput(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
          <div className="flex items-end">
            <button onClick={saveLimits} disabled={savingLimits} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {savingLimits ? "Saving…" : "Save limits"}
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">Current: min KES {minTotal.toLocaleString()} · max KES {maxTotal.toLocaleString()} · default min buy KES {defMinBuy.toLocaleString()}</div>
      </section>
      <section className="mb-4 rounded-xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Ticker"><input value={ticker} onChange={(e)=>setTicker(e.target.value.toUpperCase())} className="w-full rounded-md border px-3 py-2 text-sm uppercase" placeholder="SAF" /></Field>
          <Field label="Company"><input value={company} onChange={(e)=>setCompany(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Safaricom Plc" /></Field>
          <Field label="Quantity"><input type="number" value={qty} onChange={(e)=>setQty(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
          <Field label="Price / share (KES)"><input type="number" step="0.01" value={price} onChange={(e)=>setPrice(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Market change % (negative = red / falling)">
            <input type="number" step="0.01" value={changePct} onChange={(e)=>setChangePct(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="e.g. 2.45 or -1.80" />
          </Field>
          <Field label="Minimum buy amount (KES, blank = global default)">
            <input type="number" value={minBuy} onChange={(e)=>setMinBuy(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder={String(defMinBuy)} />
          </Field>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Seller username (shown to buyers)">
            <input value={sellerName} onChange={(e)=>setSellerName(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="e.g. John Kamau" />
          </Field>
          <Field label="Stock icon logo">
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-slate-50">
                {uploading ? "Uploading…" : (logoUrl ? "Replace image" : "Upload image")}
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={(e)=>onLogoFile(e.target.files?.[0] ?? null)} />
              </label>
              <input value={logoUrl} onChange={(e)=>setLogoUrl(e.target.value)} className="w-full rounded-md border px-3 py-2 text-xs" placeholder="…or paste image URL" />
              {logoUrl.trim() && <TickerLogo ticker={ticker || "ST"} logoUrl={logoUrl.trim()} size={40} />}
            </div>
          </Field>
        </div>
        <button onClick={add} disabled={busy} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
          <Plus className="h-4 w-4" /> {busy ? "Adding…" : "Add stock listing"}
        </button>
      </section>
      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-2">
          <div className="text-xs font-medium text-muted-foreground">Live NSE listings ({rows.length}) — A→Z, edit logo, price, market % and minimum buy</div>
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search ticker or company" className="w-56 rounded-md border px-2 py-1 text-xs" />
        </div>
        {rows.length===0 && <div className="p-6 text-center text-sm text-muted-foreground">None yet.</div>}
        {rows.filter((r) => {
          const t = search.trim().toLowerCase();
          return !t || r.ticker.toLowerCase().includes(t) || (r.company_name ?? "").toLowerCase().includes(t);
        }).map((r) => (
          <ListingEditRow key={r.id} row={r} onChanged={load} onRemove={remove} minTotal={minTotal} maxTotal={maxTotal} />
        ))}
      </div>
    </>
  );
}

function ListingEditRow({ row, onChanged, onRemove, minTotal, maxTotal }: { row: ListingRow; onChanged: () => void; onRemove: (id: string) => void; minTotal: number; maxTotal: number; }) {
  const [editing, setEditing] = useState(false);
  const [sellerName, setSellerName] = useState((row as any).seller_name ?? "");
  const [logoUrl, setLogoUrl] = useState((row as any).logo_url ?? "");
  const [quantity, setQuantity] = useState(String(row.quantity));
  const [pricePerShare, setPricePerShare] = useState(String(row.price_per_share));
  const [changePct, setChangePct] = useState(String((row as any).change_percent ?? 0));
  const [minBuy, setMinBuy] = useState((row as any).min_buy_amount == null ? "" : String((row as any).min_buy_amount));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const onLogoFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo must be under 2 MB");
    setUploading(true);
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("stock-logos").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { setUploading(false); return toast.error(up.error.message); }
    setUploading(false);
    setLogoUrl(`stock-logos://${path}`);
    toast.success("Logo uploaded — remember to Save");
  };

  const reset = () => {
    setEditing(false);
    setSellerName((row as any).seller_name ?? "");
    setLogoUrl((row as any).logo_url ?? "");
    setQuantity(String(row.quantity));
    setPricePerShare(String(row.price_per_share));
    setChangePct(String((row as any).change_percent ?? 0));
    setMinBuy((row as any).min_buy_amount == null ? "" : String((row as any).min_buy_amount));
  };

  const basePrice = Number(row.price_per_share);

  // Changing the price auto-flips the market signal: lower price → red (negative %),
  // higher price → green (positive %). Admin can still override the % manually.
  const onPriceChange = (v: string) => {
    setPricePerShare(v);
    const p = Number(v);
    if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(basePrice) || basePrice <= 0) return;
    const pct = ((p - basePrice) / basePrice) * 100;
    setChangePct(pct === 0 ? String((row as any).change_percent ?? 0) : pct.toFixed(2));
  };

  const save = async () => {
    const qty = Number(quantity);
    const price = Number(pricePerShare);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
      return toast.error("Quantity and price must be positive numbers");
    }
    setSaving(true);
    const { error } = await supabase.from("listings").update({
      seller_name: sellerName.trim() || null,
      logo_url: logoUrl.trim() || null,
      quantity: qty,
      price_per_share: price,
      change_percent: changePct.trim() === "" ? 0 : Number(changePct),
      min_buy_amount: minBuy.trim() === "" ? null : Number(minBuy),
    }).eq("id", row.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Listing updated");
    setEditing(false);
    onChanged();
  };

  if (!editing) {
    return (
      <div className="flex items-center justify-between border-b px-4 py-2 text-sm">
        <div className="flex items-center gap-3">
          <TickerLogo ticker={row.ticker} logoUrl={(row as any).logo_url} size={36} />
          <div>
            <div className="font-semibold">{row.ticker} · <span className="text-xs font-normal text-muted-foreground">{row.company_name}</span></div>
            <div className="text-xs text-muted-foreground">
              Qty {row.quantity} @ KES {Number(row.price_per_share).toLocaleString()}
              {(row as any).seller_name ? <> · Seller: <span className="font-medium text-slate-700">{(row as any).seller_name}</span></> : null}
              {" · "}
              <span className={Number((row as any).change_percent ?? 0) >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
                {Number((row as any).change_percent ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(Number((row as any).change_percent ?? 0)).toFixed(2)}%
              </span>
              {(row as any).min_buy_amount ? <> · Min buy KES {Number((row as any).min_buy_amount).toLocaleString()}</> : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setEditing(true)} className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-slate-50">Edit</button>
          <button onClick={()=>onRemove(row.id)} className="rounded-md border border-destructive/30 p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b bg-slate-50/60 px-4 py-3 text-sm">
      <div className="flex items-center gap-3">
        <TickerLogo ticker={row.ticker} logoUrl={logoUrl || (row as any).logo_url} size={40} />
        <div className="font-semibold">{row.ticker} · <span className="text-xs font-normal text-muted-foreground">{row.company_name}</span></div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label="Seller username">
          <input value={sellerName} onChange={(e)=>setSellerName(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="e.g. John Kamau" />
        </Field>
        <Field label="Stock icon logo">
          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded-md border bg-white px-3 py-2 text-xs hover:bg-slate-50">
              {uploading ? "Uploading…" : (logoUrl ? "Replace image" : "Upload image")}
              <input type="file" accept="image/*" className="hidden" disabled={uploading}
                onChange={(e)=>onLogoFile(e.target.files?.[0] ?? null)} />
            </label>
            <input value={logoUrl} onChange={(e)=>setLogoUrl(e.target.value)} className="w-full rounded-md border px-3 py-2 text-xs" placeholder="…or paste image URL" />
            {logoUrl.trim() && <TickerLogo ticker={row.ticker} logoUrl={logoUrl.trim()} size={40} />}
          </div>
        </Field>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label="Quantity"><input type="number" value={quantity} onChange={(e)=>setQuantity(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
        <Field label="Price / share (KES)"><input type="number" step="0.01" value={pricePerShare} onChange={(e)=>onPriceChange(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" /></Field>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">Total value: KES {(Number(quantity || 0) * Number(pricePerShare || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label="Market change % (negative = red / falling)">
          <input type="number" step="0.01" value={changePct} onChange={(e)=>setChangePct(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" />
        </Field>
        <Field label="Minimum buy amount (KES, blank = global default)">
          <input type="number" value={minBuy} onChange={(e)=>setMinBuy(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="global default" />
        </Field>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={reset} className="rounded-md border px-3 py-1.5 text-xs hover:bg-white">Cancel</button>
        <button onClick={save} disabled={saving || uploading} className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button>
      </div>
    </div>
  );
}

/* ---------- 7. KYC ---------- */
type Kyc = { id: string; user_id: string; full_name: string; id_type: string; id_number: string; id_front_url: string | null; id_back_url: string | null; selfie_url: string | null; status: string; reject_reason: string | null; created_at: string; };

function KycSection() {
  const [rows, setRows] = useState<Kyc[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [view, setView] = useState<Kyc | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [status, setStatus] = useState<"pending"|"verified"|"rejected"|"all">("pending");
  const [loadError, setLoadError] = useState<string | null>(null);
  const load = async () => {
    setLoadingList(true);
    setLoadError(null);
    // NOTE: documents are stored as base64 data URLs (multi-MB per row) — never select
    // them for the list view or the request times out. They load on demand in the modal.
    let q = supabase
      .from("kyc_verifications")
      .select("id,user_id,full_name,id_type,id_number,status,reject_reason,created_at")
      .order("created_at",{ascending:false})
      .limit(200);
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    setLoadingList(false);
    if (error) { setLoadError(error.message); toast.error(error.message); return; }
    const list = ((data ?? []) as Omit<Kyc, "id_front_url"|"id_back_url"|"selfie_url">[]).map((r) => ({
      ...r, id_front_url: null, id_back_url: null, selfie_url: null,
    })) as Kyc[];
    setRows(list);
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,username").in("id", ids);
      const m: Record<string, string> = {};
      (profs ?? []).forEach((p: { id: string; username: string }) => { m[p.id] = p.username; });
      setNames(m);
    }
  };
  const openView = async (row: Kyc) => {
    setView(row);
    setViewLoading(true);
    const { data, error } = await supabase
      .from("kyc_verifications")
      .select("id_front_url,id_back_url,selfie_url")
      .eq("id", row.id)
      .maybeSingle();
    setViewLoading(false);
    if (error) { toast.error(error.message); return; }
    if (data) setView({ ...row, ...data });
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);
  const approve = async (id: string) => {
    const { error } = await supabase.rpc("admin_approve_kyc", { _id: id });
    if (error) return toast.error(error.message);
    const row = rows.find((r) => r.id === id);
    try {
      const { notify } = await import("@/lib/notify");
      await notify(row?.user_id, "kyc", "KYC verified — account approved",
        "Your identity verification was approved. You can now withdraw funds from your ZiiDi Trader account.",
        { reference: id.slice(0, 8).toUpperCase(), details: [
          { label: "Full name", value: row?.full_name ?? "—" },
          { label: "Document", value: (row?.id_type ?? "").toUpperCase() },
          { label: "Status", value: "Verified" },
          { label: "Date", value: new Date().toLocaleString() },
        ] });
    } catch {}
    toast.success("KYC verified"); setView(null); load();
  };
  const reject = async (id: string) => {
    const reason = prompt("Reason for rejection?") ?? "";
    if (!reason.trim()) return;
    const { error } = await supabase.rpc("admin_reject_kyc", { _id: id, _reason: reason });
    if (error) return toast.error(error.message);
    const row = rows.find((r) => r.id === id);
    try {
      const { notify } = await import("@/lib/notify");
      await notify(row?.user_id, "kyc", "KYC could not be verified",
        `Your identity verification was not approved. Reason: ${reason}. Please resubmit with clearer documents.`,
        { reference: id.slice(0, 8).toUpperCase(), details: [
          { label: "Status", value: "Rejected" },
          { label: "Reason", value: reason },
          { label: "Date", value: new Date().toLocaleString() },
        ] });
    } catch {}
    toast.success("KYC rejected"); setView(null); load();
  };
  return (
    <>
      <SectionHeader icon={BadgeCheck} title="KYC Approvals" subtitle="Review submitted identity documents and selfie before approving." />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["pending","verified","rejected","all"] as const).map((s) => (
          <button key={s} onClick={()=>setStatus(s)} className={`rounded-full border px-3 py-1 text-xs capitalize ${status===s?"border-primary bg-primary text-primary-foreground":"bg-white hover:bg-slate-50"}`}>{s}</button>
        ))}
        <button onClick={()=>void load()} className="ml-auto rounded-md border bg-white px-3 py-1 text-xs hover:bg-slate-50">Refresh</button>
        {!loadingList && !loadError && <span className="text-xs text-muted-foreground">{rows.length} submission(s)</span>}
      </div>
      <div className="overflow-hidden rounded-xl border bg-white">
        {loadingList && <div className="p-8 text-center text-sm text-muted-foreground">Loading KYC submissions…</div>}
        {!loadingList && loadError && (
          <div className="p-8 text-center text-sm text-red-600">Could not load submissions: {loadError}</div>
        )}
        {!loadingList && !loadError && rows.length===0 && <div className="p-8 text-center text-sm text-muted-foreground">No submissions.</div>}
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-2 gap-3 border-b px-4 py-3 text-sm md:grid-cols-12 md:items-center">
            <div className="md:col-span-3"><div className="font-semibold">{r.full_name}</div><div className="text-xs text-muted-foreground">{names[r.user_id] ?? r.user_id.slice(0,8)}</div></div>
            <div className="md:col-span-2 uppercase text-xs">{r.id_type}</div>
            <div className="md:col-span-3 font-mono text-xs">{r.id_number}</div>
            <div className="md:col-span-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.status==="verified"?"bg-emerald-100 text-emerald-700":r.status==="rejected"?"bg-red-100 text-red-700":"bg-amber-100 text-amber-700"}`}>{r.status}</span>
            </div>
            <div className="flex items-center justify-end gap-2 md:col-span-2">
              <button onClick={()=>void openView(r)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-slate-50"><Eye className="h-3.5 w-3.5" /> View</button>
            </div>
          </div>
        ))}
      </div>
      {view && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={()=>setView(null)}>
          <div className="w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl max-h-[90vh]" onClick={(e)=>e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">{view.full_name}</div>
                <div className="text-xs text-muted-foreground">{view.id_type.toUpperCase()} · {view.id_number}</div>
              </div>
              <button onClick={()=>setView(null)} className="rounded-md border p-1.5 hover:bg-slate-50"><XCircle className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {(["id_front_url","id_back_url","selfie_url"] as const).map((k) => (
                <div key={k} className="rounded-lg border bg-slate-50 p-2">
                  <div className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">{k.replace("_url","").replace("_"," ")}</div>
                  {view[k]
                    ? <img src={view[k] as string} alt={k} className="h-48 w-full rounded-md object-cover" />
                    : <div className="grid h-48 place-items-center text-xs text-muted-foreground">{viewLoading ? "Loading…" : "Not provided"}</div>}
                </div>
              ))}
            </div>
            {view.status === "pending" && (
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={()=>reject(view.id)} className="inline-flex items-center gap-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><XCircle className="h-4 w-4" /> Reject</button>
                <button onClick={()=>approve(view.id)} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"><CheckCircle2 className="h-4 w-4" /> Approve</button>
              </div>
            )}
            {view.reject_reason && <div className="mt-3 rounded-md bg-red-50 p-3 text-xs text-red-700"><strong>Rejected:</strong> {view.reject_reason}</div>}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- 8. Withdrawals ---------- */
type Withdrawal = { id: string; user_id: string; amount: number; method: string; destination: string; status: string; created_at: string; tax_paid_at?: string | null; tax_tx_code?: string | null; };

function WithdrawalsSection() {
  const [rows, setRows] = useState<Withdrawal[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"tax_paid"|"pending"|"completed"|"rejected"|"all">("tax_paid");
  const [busy, setBusy] = useState<string | null>(null);
  const load = async () => {
    let q = supabase
      .from("withdrawals")
      .select("*")
      .order("tax_paid_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (status === "tax_paid") q = q.eq("status", "pending").not("tax_paid_at", "is", null);
    else if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return toast.error(error.message);
    const list = (data ?? []) as Withdrawal[]; setRows(list);
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,username").in("id", ids);
      const m: Record<string, string> = {};
      (profs ?? []).forEach((p: { id: string; username: string }) => { m[p.id] = p.username; });
      setNames(m);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);
  const approve = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_approve_withdrawal", { _id: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    const row = rows.find((r) => r.id === id);
    try {
      const { notify } = await import("@/lib/notify");
      await notify(row?.user_id, "withdrawal", "Withdrawal approved — funds sent",
        `Your withdrawal of KES ${Number(row?.amount ?? 0).toLocaleString()} has been approved and released to ${row?.destination ?? "your destination"}.`,
        { reference: id.slice(0, 8).toUpperCase(), details: [
          { label: "Amount", value: `KES ${Number(row?.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          { label: "Method", value: (row?.method ?? "").toUpperCase() },
          { label: "Destination", value: row?.destination ?? "—" },
          { label: "Status", value: "Completed" },
          { label: "Date", value: new Date().toLocaleString() },
        ] });
    } catch {}
    toast.success("Withdrawal approved"); load();
  };
  const reject = async (id: string) => {
    const reason = prompt("Rejection reason?") ?? "";
    if (!reason.trim()) return;
    setBusy(id);
    const { error } = await supabase.rpc("admin_reject_withdrawal", { _id: id, _reason: reason });
    setBusy(null);
    if (error) return toast.error(error.message);
    const row = rows.find((r) => r.id === id);
    try {
      const { notify } = await import("@/lib/notify");
      await notify(row?.user_id, "withdrawal", "Withdrawal rejected — funds refunded",
        `Your withdrawal of KES ${Number(row?.amount ?? 0).toLocaleString()} was rejected and refunded to your ZiiDi balance. Reason: ${reason}.`,
        { reference: id.slice(0, 8).toUpperCase(), details: [
          { label: "Amount refunded", value: `KES ${Number(row?.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          { label: "Status", value: "Rejected & refunded" },
          { label: "Reason", value: reason },
          { label: "Date", value: new Date().toLocaleString() },
        ] });
    } catch {}
    toast.success("Withdrawal rejected & refunded"); load();
  };
  return (
    <>
      <SectionHeader icon={Banknote} title="Withdrawal Approvals" subtitle="Tax-paid withdrawal requests appear here ready for final release. Rejections auto-refund balance." />
      <div className="mb-3 flex gap-2">
        {(["tax_paid","pending","completed","rejected","all"] as const).map((s) => (
          <button key={s} onClick={()=>setStatus(s)} className={`rounded-full border px-3 py-1 text-xs capitalize ${status===s?"border-primary bg-primary text-primary-foreground":"bg-white hover:bg-slate-50"}`}>{s === "tax_paid" ? "Tax paid" : s}</button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border bg-white">
        {rows.length===0 && <div className="p-8 text-center text-sm text-muted-foreground">Nothing here.</div>}
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-2 gap-3 border-b px-4 py-3 text-sm md:grid-cols-12 md:items-center">
            <div className="md:col-span-3"><div className="font-semibold">{names[r.user_id] ?? r.user_id.slice(0,8)}</div><div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div></div>
            <div className="md:col-span-2 font-semibold">KES {Number(r.amount).toLocaleString()}</div>
            <div className="md:col-span-2 uppercase text-xs">{r.method}</div>
            <div className="md:col-span-3 truncate font-mono text-xs">{r.destination}</div>
            <div className="flex items-center justify-end gap-2 md:col-span-2">
              {r.status === "pending" ? (
                <>
                  {r.tax_paid_at ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">TAX CODE: <span className="font-mono">{r.tax_tx_code ?? "—"}</span></span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">TAX DUE</span>
                  )}
                  <button onClick={()=>reject(r.id)} disabled={busy===r.id} className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"><XCircle className="h-3.5 w-3.5" /> Reject</button>
                  <button onClick={()=>approve(r.id)} disabled={busy===r.id} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</button>
                </>
              ) : (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.status==="completed"?"bg-emerald-100 text-emerald-700":"bg-red-100 text-red-700"}`}>{r.status}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
/* ---------- Withdrawal Tax Settings ---------- */
function TaxSettingsSection() {
  const [row, setRow] = useState<{
    tax_percent: number;
    till_number: string;
    till_business_name: string;
    paybill_number: string;
    paybill_account: string;
    instructions: string;
    active_method: "till" | "paybill";
    min_withdrawal: number;
    max_withdrawal: number;
  }>({ tax_percent: 15, till_number: "", till_business_name: "", paybill_number: "", paybill_account: "", instructions: "", active_method: "till", min_withdrawal: 500, max_withdrawal: 1000000 });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("withdrawal_tax_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setRow({
      tax_percent: Number(data.tax_percent ?? 15),
      till_number: data.till_number ?? "",
      till_business_name: data.till_business_name ?? "",
      paybill_number: data.paybill_number ?? "",
      paybill_account: data.paybill_account ?? "",
      instructions: data.instructions ?? "",
      active_method: ((data as { active_method?: string }).active_method === "paybill" ? "paybill" : "till"),
      min_withdrawal: Number((data as { min_withdrawal?: number }).min_withdrawal ?? 500),
      max_withdrawal: Number((data as { max_withdrawal?: number }).max_withdrawal ?? 1000000),
    });
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_update_tax_settings", {
      _tax_percent: row.tax_percent,
      _till_number: row.till_number,
      _till_business_name: row.till_business_name,
      _paybill_number: row.paybill_number,
      _paybill_account: row.paybill_account,
      _instructions: row.instructions,
      _active_method: row.active_method,
      _min_withdrawal: row.min_withdrawal,
      _max_withdrawal: row.max_withdrawal,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Withdrawal tax settings saved");
    load();
  };

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <>
      <SectionHeader
        icon={Receipt}
        title="Withdrawal Tax Settings"
        subtitle="Configure the 15% withholding tax and the payment steps buyers see on their invoice."
        actions={
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" /> {busy ? "Saving…" : "Save changes"}
          </button>
        }
      />
      <MmfTaxSwitch />
      <div className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">
        <Field label="Withholding tax %">
          <input
            type="number" min="0" max="100" step="0.1"
            value={row.tax_percent}
            onChange={(e) => setRow({ ...row, tax_percent: Number(e.target.value) })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Active payment method (shown on invoice)">
          <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setRow({ ...row, active_method: "till" })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${row.active_method === "till" ? "bg-emerald-600 text-white" : "text-slate-600"}`}
            >
              Buy Goods (Till) {row.active_method === "till" ? "· ON" : "· OFF"}
            </button>
            <button
              type="button"
              onClick={() => setRow({ ...row, active_method: "paybill" })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${row.active_method === "paybill" ? "bg-sky-600 text-white" : "text-slate-600"}`}
            >
              Paybill {row.active_method === "paybill" ? "· ON" : "· OFF"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Only the ON method appears on the user's invoice and PDF.</p>
        </Field>

        <Field label="Minimum withdrawal (KES)">
          <input
            type="number" min="0" step="1"
            value={row.min_withdrawal}
            onChange={(e) => setRow({ ...row, min_withdrawal: Number(e.target.value) })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Maximum withdrawal (KES)">
          <input
            type="number" min="0" step="1"
            value={row.max_withdrawal}
            onChange={(e) => setRow({ ...row, max_withdrawal: Number(e.target.value) })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Buy Goods Till Number">
          <input
            value={row.till_number}
            onChange={(e) => setRow({ ...row, till_number: e.target.value })}
            placeholder="e.g. 5203941"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Till Business Name">
          <input
            value={row.till_business_name}
            onChange={(e) => setRow({ ...row, till_business_name: e.target.value })}
            placeholder="e.g. ZIIDI TRADER TAX"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Paybill Number">
          <input
            value={row.paybill_number}
            onChange={(e) => setRow({ ...row, paybill_number: e.target.value })}
            placeholder="e.g. 247247"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Paybill Account Number">
          <input
            value={row.paybill_account}
            onChange={(e) => setRow({ ...row, paybill_account: e.target.value })}
            placeholder="e.g. ZIIDI-TAX"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Instructions (shown on invoice)" className="md:col-span-2">
          <textarea
            rows={5}
            value={row.instructions}
            onChange={(e) => setRow({ ...row, instructions: e.target.value })}
            placeholder="Explain payment steps for both Till and Paybill methods."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        These values appear on every user's downloadable tax invoice when they initiate a withdrawal.
      </p>
    </>
  );
}

/* ---------- Live Support ---------- */
type SupportMsg = {
  id: string;
  user_id: string;
  sender_role: "user" | "admin";
  body: string;
  created_at: string;
  read_by_admin: boolean;
};

function SupportSection() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<{ user_id: string; username: string; last: string; last_at: string; unread: number }[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<SupportMsg[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [userTyping, setUserTyping] = useState(false);
  const typingChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);
  const userTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadThreads = async () => {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (!data) return;
    const byUser = new Map<string, SupportMsg[]>();
    (data as SupportMsg[]).forEach((m) => {
      const arr = byUser.get(m.user_id) ?? [];
      arr.push(m);
      byUser.set(m.user_id, arr);
    });
    const ids = Array.from(byUser.keys());
    let names = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabase.rpc("get_usernames", { _ids: ids });
      (profs ?? []).forEach((p: any) => names.set(p.id, p.username));
    }
    const list = ids.map((uid) => {
      const arr = byUser.get(uid)!;
      const latest = arr[0];
      const unread = arr.filter((m) => m.sender_role === "user" && !m.read_by_admin).length;
      return {
        user_id: uid,
        username: names.get(uid) ?? uid.slice(0, 8),
        last: latest.body,
        last_at: latest.created_at,
        unread,
      };
    }).sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
    setThreads(list);
  };

  useEffect(() => {
    loadThreads();
    const ch = supabase
      .channel("admin-support")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, () => {
        loadThreads();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!active) { setMsgs([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("user_id", active)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setMsgs((data ?? []) as SupportMsg[]);
      const unreadIds = (data ?? []).filter((m: any) => m.sender_role === "user" && !m.read_by_admin).map((m: any) => m.id);
      if (unreadIds.length) {
        await supabase.from("support_messages").update({ read_by_admin: true }).in("id", unreadIds);
        loadThreads();
      }
    })();
    const ch = supabase
      .channel(`admin-support-${active}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `user_id=eq.${active}` },
        (payload) => {
          const m = payload.new as SupportMsg;
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [active]);

  // Typing broadcast (per active thread)
  useEffect(() => {
    if (!active) { setUserTyping(false); return; }
    const ch = supabase.channel(`support-typing:${active}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "typing" }, (payload) => {
      const p = (payload.payload ?? {}) as { role?: string };
      if (p.role !== "user") return;
      setUserTyping(true);
      if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
      userTypingTimerRef.current = setTimeout(() => setUserTyping(false), 3000);
    });
    ch.on("broadcast", { event: "msg" }, (payload) => {
      const m = payload.payload as SupportMsg;
      if (!m?.id) return;
      setUserTyping(false);
      setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      loadThreads();
    });
    ch.subscribe();
    const poll = setInterval(async () => {
      const { data } = await supabase.from("support_messages").select("*").eq("user_id", active).order("created_at", { ascending: true });
      if (data) setMsgs((prev) => (data.length !== prev.length ? (data as SupportMsg[]) : prev));
    }, 2500);
    typingChanRef.current = ch;
    return () => {
      clearInterval(poll);
      if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
      supabase.removeChannel(ch);
      typingChanRef.current = null;
    };
  }, [active]);

  const emitTyping = () => {
    const ch = typingChanRef.current;
    if (!ch) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1200) return;
    lastTypingSentRef.current = now;
    ch.send({ type: "broadcast", event: "typing", payload: { role: "admin" } });
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const send = async () => {
    const body = reply.trim();
    if (!body || !active || !user || sending) return;
    setSending(true);
    setReply("");
    const { data: row, error } = await supabase.from("support_messages").insert({
      user_id: active,
      sender_role: "admin",
      sender_id: user.id,
      body,
      read_by_admin: true,
    }).select("*").single();
    setSending(false);
    if (error) { toast.error(error.message); setReply(body); return; }
    if (row) {
      const m = row as SupportMsg;
      setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      typingChanRef.current?.send({ type: "broadcast", event: "msg", payload: m });
    }
  };

  const activeThread = threads.find((t) => t.user_id === active);

  return (
    <>
      <SectionHeader icon={MessageCircle} title="Live Support" subtitle="Reply to users who message you via the Live Support widget. Replies appear instantly in their chat." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
        <div className="rounded-xl border bg-white">
          <div className="border-b px-3 py-2 text-xs font-semibold uppercase text-slate-500">Conversations</div>
          <div className="max-h-[520px] overflow-y-auto">
            {threads.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">No support messages yet.</div>
            )}
            {threads.map((t) => (
              <button
                key={t.user_id}
                onClick={() => setActive(t.user_id)}
                className={`flex w-full items-start gap-2 border-b px-3 py-3 text-left hover:bg-slate-50 ${active === t.user_id ? "bg-emerald-50" : ""}`}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                  {t.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{t.username}</span>
                    {t.unread > 0 && (
                      <span className="grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{t.unread}</span>
                    )}
                  </div>
                  <div className="truncate text-xs text-slate-500">{t.last}</div>
                  <div className="text-[10px] text-slate-400">{new Date(t.last_at).toLocaleString()}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-[520px] flex-col rounded-xl border bg-white">
          {!active && (
            <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
              Select a conversation to reply.
            </div>
          )}
          {active && (
            <>
              <div className="border-b px-4 py-3">
                <div className="text-sm font-bold">{activeThread?.username ?? "User"}</div>
                <div className="text-xs text-slate-500">You are replying as ZiiDi Customer Care</div>
              </div>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-4">
                {msgs.map((m) => {
                  const mine = m.sender_role === "admin";
                  return (
                    <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : ""}`}>
                      <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${mine ? "rounded-br-sm bg-emerald-600 text-white" : "rounded-bl-sm bg-white text-slate-800"}`}>
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        <div className={`mt-1 text-[10px] ${mine ? "text-emerald-50/80" : "text-slate-400"}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {userTyping && (
                  <div className="flex items-end gap-2">
                    <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-xs italic text-slate-500 shadow-sm">
                      {activeThread?.username ?? "User"} is typing
                      <span className="ml-1 inline-flex gap-0.5">
                        <span className="h-1 w-1 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                        <span className="h-1 w-1 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                        <span className="h-1 w-1 animate-bounce rounded-full bg-slate-400" />
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); send(); }}
                className="flex items-center gap-2 border-t bg-white p-3"
              >
                <input
                  value={reply}
                  onChange={(e) => { setReply(e.target.value); emitTyping(); }}
                  placeholder="Type your reply as ZiiDi Customer Care…"
                  className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={!reply.trim() || sending}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow hover:bg-emerald-700 disabled:opacity-50"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------- Disputes ---------- */
type Dispute = {
  id: string; listing_id: string; opened_by: string; opened_role: string;
  reason: string; status: string; resolution: string | null; created_at: string;
};
type DisputeListing = {
  id: string; ticker: string; company_name: string | null;
  quantity: number; price_per_share: number; status: string;
  buyer_id: string | null; seller_id: string;
};

function DisputesSection() {
  const [rows, setRows] = useState<Dispute[]>([]);
  const [listings, setListings] = useState<Record<string, DisputeListing>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"open" | "all">("open");

  const load = async () => {
    const { data } = await supabase
      .from("disputes")
      .select("*")
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Dispute[];
    setRows(list);
    const listingIds = Array.from(new Set(list.map((d) => d.listing_id)));
    if (listingIds.length) {
      const { data: ls } = await supabase.from("listings").select("id,ticker,company_name,quantity,price_per_share,status,buyer_id,seller_id").in("id", listingIds);
      const map: Record<string, DisputeListing> = {};
      (ls ?? []).forEach((l: any) => (map[l.id] = l));
      setListings(map);
      const userIds = Array.from(new Set([
        ...list.map((d) => d.opened_by),
        ...(ls ?? []).flatMap((l: any) => [l.buyer_id, l.seller_id].filter(Boolean)),
      ])) as string[];
      if (userIds.length) {
        const { data: profs } = await supabase.rpc("get_usernames", { _ids: userIds });
        const nm: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => (nm[p.id] = p.username));
        setNames(nm);
      }
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-disputes")
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const resolve = async (id: string, action: "release" | "refund" | "dismiss") => {
    const resolution = resolutionText[id] ?? "";
    setBusy(id);
    const { error } = await supabase.rpc("admin_resolve_dispute", { _id: id, _action: action, _resolution: resolution || "" });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Dispute ${action === "dismiss" ? "dismissed" : "resolved"}`);
    setResolutionText((p) => ({ ...p, [id]: "" }));
    load();
  };

  const visible = filter === "open" ? rows.filter((r) => r.status === "open") : rows;

  return (
    <>
      <SectionHeader icon={AlertTriangle} title="Disputes" subtitle="Mediate buyer / seller disputes as ZiiDi Customer Care. Release shares to buyer, refund/cancel the trade, or dismiss the claim." />
      <div className="mb-3 flex gap-2 text-xs">
        <button onClick={() => setFilter("open")} className={`rounded-full px-3 py-1 ${filter==="open" ? "bg-emerald-600 text-white" : "border border-slate-300"}`}>Open ({rows.filter(r=>r.status==="open").length})</button>
        <button onClick={() => setFilter("all")} className={`rounded-full px-3 py-1 ${filter==="all" ? "bg-emerald-600 text-white" : "border border-slate-300"}`}>All ({rows.length})</button>
      </div>
      {visible.length === 0 && <div className="rounded-xl border bg-white p-6 text-sm text-muted-foreground">No disputes.</div>}
      <div className="space-y-3">
        {visible.map((d) => {
          const l = listings[d.listing_id];
          const openerName = names[d.opened_by] ?? "user";
          const buyerName = l?.buyer_id ? (names[l.buyer_id] ?? "buyer") : "—";
          const sellerName = l ? (names[l.seller_id] ?? "seller") : "—";
          const total = l ? l.quantity * Number(l.price_per_share) : 0;
          return (
            <div key={d.id} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      d.status === "open" ? "bg-amber-100 text-amber-800" :
                      d.status === "resolved" ? "bg-emerald-100 text-emerald-800" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      <Headphones className="h-3 w-3" /> {d.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(d.created_at).toLocaleString()}</span>
                  </div>
                  <div className="mt-1.5 text-sm">
                    <b className="uppercase">{d.opened_role}</b> <span className="text-slate-600">@{openerName}</span> raised a dispute on{" "}
                    <b>{l ? `${l.quantity} × ${l.ticker}` : d.listing_id.slice(0,8)}</b>
                    {l && <span className="text-slate-500"> (KES {total.toFixed(2)} · status: {l.status})</span>}
                  </div>
                  {l && (
                    <div className="mt-0.5 text-xs text-slate-500">
                      Buyer @{buyerName} · Seller @{sellerName}
                    </div>
                  )}
                </div>
                <Link to="/listing/$id" params={{ id: d.listing_id }} className="rounded-md border px-3 py-1 text-xs hover:bg-slate-50">
                  Open trade chat
                </Link>
              </div>
              <div className="mt-2 rounded-md bg-slate-50 p-2.5 text-sm">
                <div className="text-[11px] font-semibold uppercase text-slate-500">Reason</div>
                <div className="mt-0.5 whitespace-pre-wrap">{d.reason}</div>
              </div>
              {d.status === "open" ? (
                <div className="mt-3 space-y-2">
                  <input
                    value={resolutionText[d.id] ?? ""}
                    onChange={(e) => setResolutionText((p) => ({ ...p, [d.id]: e.target.value }))}
                    placeholder="Resolution note (sent to opener from ZiiDi Customer Care)"
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={busy === d.id}
                      onClick={() => resolve(d.id, "release")}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Release shares to buyer
                    </button>
                    <button
                      disabled={busy === d.id}
                      onClick={() => resolve(d.id, "refund")}
                      className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancel / refund trade
                    </button>
                    <button
                      disabled={busy === d.id}
                      onClick={() => resolve(d.id, "dismiss")}
                      className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60"
                    >
                      <Ban className="h-3.5 w-3.5" /> Dismiss
                    </button>
                  </div>
                </div>
              ) : d.resolution ? (
                <div className="mt-2 text-xs text-slate-500">Resolution: {d.resolution}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Deposits (M-PESA funding) ---------- */
type DepositRow = {
  id: string;
  user_id: string;
  amount: number;
  phone: string;
  tx_ref: string | null;
  mpesa_receipt: string | null;
  channel?: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
};

function DepositsSection() {
  const [rows, setRows] = useState<DepositRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [settings, setSettings] = useState({
    paybill_number: "",
    account_number: "",
    business_name: "",
    min_deposit: 0,
    max_deposit: 0,
    instructions: "",
    till_number: "",
    till_business_name: "",
    active_method: "paybill" as "paybill" | "till",
    stk_enabled: true,
    mobile_enabled: true,
    crypto_enabled: false,
    crypto_kes_per_usd: 130,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("deposits")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const list = (data ?? []) as DepositRow[];
    setRows(list);
    const ids = [...new Set(list.map((r) => r.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase.rpc("get_usernames", { _ids: ids } as never);
      const map: Record<string, string> = {};
      for (const p of (profs ?? []) as { id: string; username: string }[]) map[p.id] = p.username;
      setNames(map);
    }
    const { data: s } = await supabase
      .from("deposit_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (s) {
      setSettings({
        paybill_number: s.paybill_number ?? "",
        account_number: s.account_number ?? "",
        business_name: s.business_name ?? "",
        min_deposit: Number(s.min_deposit ?? 0),
        max_deposit: Number(s.max_deposit ?? 0),
        instructions: s.instructions ?? "",
        till_number: (s as { till_number?: string }).till_number ?? "",
        till_business_name: (s as { till_business_name?: string }).till_business_name ?? "",
        active_method: ((s as { active_method?: string }).active_method === "till" ? "till" : "paybill"),
        stk_enabled: (s as { stk_enabled?: boolean }).stk_enabled !== false,
        mobile_enabled: (s as { mobile_enabled?: boolean }).mobile_enabled !== false,
        crypto_enabled: (s as { crypto_enabled?: boolean }).crypto_enabled === true,
        crypto_kes_per_usd: Number((s as { crypto_kes_per_usd?: number }).crypto_kes_per_usd ?? 130),
      });
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-deposits")
      .on("postgres_changes", { event: "*", schema: "public", table: "deposits" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const saveSettings = async () => {
    setSavingSettings(true);
    const { data: existing } = await supabase
      .from("deposit_settings")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const payload = {
      paybill_number: settings.paybill_number,
      account_number: settings.account_number,
      business_name: settings.business_name,
      min_deposit: Number(settings.min_deposit),
      max_deposit: Number(settings.max_deposit),
      instructions: settings.instructions || null,
      till_number: settings.till_number,
      till_business_name: settings.till_business_name,
      active_method: settings.active_method,
      stk_enabled: settings.stk_enabled,
      mobile_enabled: settings.mobile_enabled,
      crypto_enabled: settings.crypto_enabled,
      crypto_kes_per_usd: Number(settings.crypto_kes_per_usd) || 130,
    };
    const { error } = existing
      ? await supabase.from("deposit_settings").update(payload).eq("id", existing.id)
      : await supabase.from("deposit_settings").insert(payload);
    setSavingSettings(false);
    if (error) return toast.error(error.message);
    toast.success("Deposit settings saved");
  };

  const act = async (id: string, approve: boolean) => {
    setBusy(id);
    const { error } = approve
      ? await supabase.rpc("admin_approve_deposit", { _id: id })
      : await supabase.rpc("admin_reject_deposit", { _id: id, _note: "Payment not found" });
    setBusy(null);
    if (error) return toast.error(error.message);
    const row = rows.find((r) => r.id === id);
    try {
      const { notify } = await import("@/lib/notify");
      await notify(
        row?.user_id,
        "deposit",
        approve ? "Deposit approved — wallet credited" : "Deposit rejected",
        approve
          ? `Your M-PESA deposit of KES ${Number(row?.amount ?? 0).toLocaleString()} was confirmed and credited to your ZiiDi wallet.`
          : `We could not confirm your M-PESA deposit of KES ${Number(row?.amount ?? 0).toLocaleString()}. Please check the transaction code and try again.`,
        { reference: row?.tx_ref ?? id.slice(0, 8).toUpperCase(), details: [
          { label: "Amount", value: `KES ${Number(row?.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          { label: "M-PESA code", value: row?.tx_ref ?? "—" },
          { label: "Phone", value: row?.phone ?? "—" },
          { label: "Status", value: approve ? "Credited" : "Rejected" },
          { label: "Date", value: new Date().toLocaleString() },
        ] });
    } catch {}
    toast.success(approve ? "Deposit approved — wallet credited" : "Deposit rejected");
    load();
  };

  const visible = filter === "pending" ? rows.filter((r) => r.status === "pending") : rows;

  return (
    <div>
      <SectionHeader
        icon={Smartphone}
        title="M-PESA Deposits"
        subtitle="Set the Paybill or Till details and approve user funding requests"
        actions={
          <button onClick={load} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-slate-100">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />

      <div className="mb-6 rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Deposit method, details & limits</h2>
        <div className="mb-4 rounded-lg border bg-slate-50 p-3">
          <div className="text-xs font-semibold text-slate-800">Deposit method users see</div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {!settings.mobile_enabled
              ? settings.crypto_enabled
                ? "Mobile money is OFF — users can only deposit with crypto (NOWPayments)."
                : "All deposit methods are OFF — users cannot deposit right now."
              : settings.stk_enabled
              ? "STK push: users get a PIN prompt on their phone and deposits settle automatically."
              : settings.active_method === "till"
                ? "Till (Buy Goods): users pay to the till and paste the M-PESA code for approval."
                : "Paybill: users pay to the paybill and paste the M-PESA code for approval."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSettings((s) => ({ ...s, mobile_enabled: !s.mobile_enabled }))}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${settings.mobile_enabled ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}
              aria-pressed={settings.mobile_enabled}
            >
              Mobile money (STK · Paybill · Till) {settings.mobile_enabled ? "· ON" : "· OFF"}
            </button>
            <button
              type="button"
              onClick={() => setSettings((s) => ({ ...s, crypto_enabled: !s.crypto_enabled }))}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${settings.crypto_enabled ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-700"}`}
              aria-pressed={settings.crypto_enabled}
            >
              Crypto deposits (NOWPayments) {settings.crypto_enabled ? "· ON" : "· OFF"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {([
              { key: "paybill", label: "Paybill (manual)" },
              { key: "till", label: "Till Number (manual)" },
              { key: "stk", label: "Paybill STK Push (auto)" },
            ] as const).map((m) => {
              const selected =
                settings.mobile_enabled &&
                (m.key === "stk" ? settings.stk_enabled : !settings.stk_enabled && settings.active_method === m.key);
              return (
                <button
                  key={m.key}
                  type="button"
                  disabled={!settings.mobile_enabled}
                  onClick={() =>
                    setSettings((s) =>
                      m.key === "stk"
                        ? { ...s, stk_enabled: true }
                        : { ...s, stk_enabled: false, active_method: m.key },
                    )
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${selected ? "bg-primary text-primary-foreground" : "border bg-white hover:bg-slate-50"}`}
                  aria-pressed={selected}
                >
                  {m.label} {selected ? "· ON" : ""}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Paybill number">
            <input className="w-full rounded-md border px-3 py-2 text-sm" value={settings.paybill_number}
              onChange={(e) => setSettings((s) => ({ ...s, paybill_number: e.target.value }))} />
          </Field>
          <Field label="Account number">
            <input className="w-full rounded-md border px-3 py-2 text-sm" value={settings.account_number}
              onChange={(e) => setSettings((s) => ({ ...s, account_number: e.target.value }))} />
          </Field>
          <Field label="Business name">
            <input className="w-full rounded-md border px-3 py-2 text-sm" value={settings.business_name}
              onChange={(e) => setSettings((s) => ({ ...s, business_name: e.target.value }))} />
          </Field>
          <Field label="Till number (Buy Goods)">
            <input className="w-full rounded-md border px-3 py-2 text-sm" value={settings.till_number}
              onChange={(e) => setSettings((s) => ({ ...s, till_number: e.target.value }))} />
          </Field>
          <Field label="Till business name">
            <input className="w-full rounded-md border px-3 py-2 text-sm" value={settings.till_business_name}
              onChange={(e) => setSettings((s) => ({ ...s, till_business_name: e.target.value }))} />
          </Field>
          <Field label="Minimum deposit (KES)">
            <input type="number" className="w-full rounded-md border px-3 py-2 text-sm" value={settings.min_deposit}
              onChange={(e) => setSettings((s) => ({ ...s, min_deposit: Number(e.target.value) }))} />
          </Field>
          <Field label="Maximum deposit (KES)">
            <input type="number" className="w-full rounded-md border px-3 py-2 text-sm" value={settings.max_deposit}
              onChange={(e) => setSettings((s) => ({ ...s, max_deposit: Number(e.target.value) }))} />
          </Field>
          <Field label="Crypto rate (KES per 1 USD)">
            <input type="number" min={1} className="w-full rounded-md border px-3 py-2 text-sm" value={settings.crypto_kes_per_usd}
              onChange={(e) => setSettings((s) => ({ ...s, crypto_kes_per_usd: Number(e.target.value) }))} />
          </Field>
          <Field label="Extra instructions (optional)" className="sm:col-span-2 lg:col-span-3">
            <textarea rows={2} className="w-full rounded-md border px-3 py-2 text-sm" value={settings.instructions}
              onChange={(e) => setSettings((s) => ({ ...s, instructions: e.target.value }))} />
          </Field>
        </div>
        <button onClick={saveSettings} disabled={savingSettings}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
          <Save className="h-4 w-4" /> {savingSettings ? "Saving…" : "Save settings"}
        </button>
      </div>

      <div className="mb-3 flex gap-2">
        <button onClick={() => setFilter("pending")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${filter === "pending" ? "bg-primary text-primary-foreground" : "border bg-white"}`}>
          Pending ({rows.filter((r) => r.status === "pending").length})
        </button>
        <button onClick={() => setFilter("all")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${filter === "all" ? "bg-primary text-primary-foreground" : "border bg-white"}`}>
          All ({rows.length})
        </button>
      </div>

      <div className="space-y-2">
        {visible.length === 0 && (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            No deposit requests here.
          </div>
        )}
        {visible.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-semibold">KES {Number(r.amount).toLocaleString()}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  r.status === "pending" ? "bg-amber-100 text-amber-700"
                  : r.status === "approved" ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"}`}>
                  {r.status}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                @{names[r.user_id] ?? r.user_id.slice(0, 8)} · {r.phone} ·{" "}
                {new Date(r.created_at).toLocaleString()}
              </div>
              <div className="mt-1 text-xs">
                M-PESA code:{" "}
                <span className="font-mono font-semibold">{r.mpesa_receipt || r.tx_ref || "—"}</span>
                {r.mpesa_receipt && r.tx_ref && r.tx_ref !== r.mpesa_receipt ? (
                  <span className="text-muted-foreground"> · user ref {r.tx_ref}</span>
                ) : null}
              </div>
            </div>
            {r.status === "pending" && (
              <div className="flex gap-2">
                <button onClick={() => act(r.id, true)} disabled={busy === r.id}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve & credit
                </button>
                <button onClick={() => act(r.id, false)} disabled={busy === r.id}
                  className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Broadcast Email ---------- */
const BROADCAST_PRESETS: { id: string; label: string; subject: string; body: string }[] = [
  {
    id: "new-deposit-structure",
    label: "New deposit structure + 35% gains",
    subject: "The market is open — buy NSE stocks today and earn up to 35%",
    body: `Hello ZiiDi Trader,

The Nairobi Securities Exchange is moving and today is the perfect day to take your position. We have just rolled out a brand-new deposit experience that is simpler, faster and gets you from M-PESA to market in minutes.

Here is what is waiting for you:

✅ New fast deposit structure — fund via M-PESA Paybill, paste your transaction code and watch your wallet credit automatically once approved.
✅ Minimum deposit & stock buy from only KES 35,000.
✅ Earn up to 35% profit when you sell your shares on the green market.
✅ Instant withdrawals — sell, settle and cash out straight to M-PESA.

How to start right now:
1. Log in to your ZiiDi Trader account.
2. Tap Deposit, enter your amount (from KES 35,000) and complete the Paybill steps.
3. Head to Buy Shares, pick a trending NSE stock and buy instantly from your balance.
4. Track your Portfolio, sell when the market surges and withdraw your profits instantly.

Stocks do not wait. The earlier you buy, the earlier your shares start working for you. Join thousands of traders who are already building wealth with ZiiDi Trader.

Log in now and place your first order today.

To your success,
ZiiDi Trader — Customer Care`,
  },
];

function BroadcastSection() {
  const sendBroadcast = useServerFn(broadcastEmailToAllUsers);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    sent: number;
    skipped: number;
    failed: number;
    rateLimited?: number;
    invalid?: number;
  } | null>(null);

  const run = async (test: boolean) => {
    if (!subject.trim() || !body.trim()) return toast.error("Add a subject and message");
    if (!test && !confirm("Send this email to ALL registered users?")) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await sendBroadcast({ data: { title: subject.trim(), body: body.trim(), test } });
      setResult(res);
      if (test) toast.success("Test email sent to your admin address");
      else if (res.sent === res.total)
        toast.success(`✅ Success! Email sent to all ${res.total} users`, { duration: 8000 });
      else
        toast.success(`Broadcast complete: ${res.sent} of ${res.total} users received it`, { duration: 8000 });
      if (!test) alert(`Broadcast complete!\n\nSent: ${res.sent} of ${res.total} users${res.failed ? `\nFailed: ${res.failed}` : ""}${res.skipped ? `\nSkipped (unsubscribed): ${res.skipped}` : ""}`);
    } catch (e: any) {
      toast.error(e?.message || "Broadcast failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Mail}
        title="Broadcast Email"
        subtitle="Email every registered user using the branded ZiiDi notification template."
      />
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Quick templates:</span>
          {BROADCAST_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSubject(p.subject);
                setBody(p.body);
                toast.success("Template loaded — review and send");
              }}
              className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-slate-50"
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Subject / title</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={150}
            placeholder="Important update from ZiiDi Trader"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            rows={8}
            placeholder="Write your announcement here…"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <span className="mt-1 block text-[11px] text-slate-400">{body.length}/5000 characters</span>
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={() => run(false)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {busy ? "Sending…" : "Send to all users"}
          </button>
          <button
            disabled={busy}
            onClick={() => run(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            <Mail className="h-4 w-4" /> Send test to me
          </button>
        </div>
        {result && (
          <div className="mt-4 space-y-1 rounded-lg border bg-slate-50 p-3 text-xs text-slate-600">
            <div>
              Recipients: <b>{result.total}</b> · Delivered to inbox provider:{" "}
              <b className="text-emerald-600">{result.sent}</b> · Skipped (unsubscribed/bounced):{" "}
              <b>{result.skipped}</b> · Failed: <b className="text-red-600">{result.failed}</b>
              {!!result.rateLimited && (
                <>
                  {" "}· Rate limited: <b className="text-amber-600">{result.rateLimited}</b>
                </>
              )}
            </div>
            {!!result.invalid && (
              <div className="text-slate-500">
                {result.invalid} test/placeholder address(es) were skipped automatically — they always
                bounce and hurt deliverability.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TransferSettingsSection() {
  const [min, setMin] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("transfer_settings" as any).select("min_amount").order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (data) setMin(String((data as any).min_amount));
    })();
  }, []);
  const save = async () => {
    const v = Number(min);
    if (!Number.isFinite(v) || v < 0) return toast.error("Enter a valid amount");
    setSaving(true);
    const { error } = await supabase.rpc("admin_update_transfer_settings" as any, { _min: v });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Transfer settings saved");
  };
  return (
    <div className="rounded-xl border bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold">Internal transfer settings</h2>
      <p className="mb-4 text-xs text-muted-foreground">Minimum amount a user can send to another user (by phone number or Account ID).</p>
      <label className="mb-1 block text-xs font-medium">Minimum transfer amount (KES)</label>
      <div className="flex gap-2">
        <input type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} className="w-48 rounded-md border px-3 py-2 text-sm" />
        <button onClick={save} disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

function MmfTaxSwitch() {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.from("withdrawal_tax_settings").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setOn((data as { tax_enabled?: boolean } | null)?.tax_enabled !== false));
  }, []);
  const toggle = async () => {
    if (on === null) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_tax_enabled" as never, { _enabled: !on } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    setOn(!on);
    toast.success(!on ? "MMF tax is ON — users must pay tax to complete withdrawals" : "MMF tax is OFF — withdrawals go straight to processing");
  };
  return (
    <div className="mb-4 flex items-center justify-between rounded-xl border bg-white p-5">
      <div>
        <div className="text-sm font-semibold">MMF tax required</div>
        <p className="text-xs text-muted-foreground">ON: users pay the MMF tax and submit a transaction code after withdrawing. OFF: withdrawals show a processing screen with no tax step.</p>
      </div>
      <button onClick={toggle} disabled={busy || on === null} role="switch" aria-checked={!!on} aria-label="MMF tax switch"
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-emerald-600" : "bg-slate-300"} disabled:opacity-60`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
