import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Info, LineChart, ArrowUpCircle, TrendingUp, TrendingDown, ChevronDown, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EntryBanner } from "@/components/entry-banner";
import autoInvestIcon from "@/assets/cash-bag-zidii.png";
import lockIcon from "@/assets/pad-lock-zidii.png";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ZiiDi Trader" },
      { name: "description", content: "View your balance, portfolio, and recent activity on your ZiiDi Trader dashboard." },
      { property: "og:title", content: "Dashboard — ZiiDi Trader" },
      { property: "og:description", content: "Your ZiiDi Trader account dashboard." },
      { property: "og:url", content: "/dashboard" },
    ],
    links: [{ rel: "canonical", href: "/dashboard" }],
  }),
  component: Dashboard,
});

const TICKERS = [
  { s: "AMAC", p: "KSH 93.50", c: 1.92 },
  { s: "AMAZON", p: "KSH 149,210.00", c: 0.28 },
  { s: "BAT", p: "KSH 522.34", c: -0.45 },
  { s: "SAFCOM", p: "KSH 18.20", c: 0.85 },
  { s: "EQTY", p: "KSH 46.75", c: -0.32 },
  { s: "KCB", p: "KSH 38.90", c: 1.10 },
  { s: "TSLA", p: "KSH 32,410.00", c: 2.15 },
  { s: "NVDA", p: "KSH 116,880.00", c: 0.94 },
];

function Dashboard() {
  const { profile } = useAuth();
  const balance = profile?.balance ?? 0;
  const greeting = getGreeting();
  const [hidden, setHidden] = useState(false);

  const dailyRate = 0.07;
  const previousBalance = balance > 0 ? balance / (1 + dailyRate) : 0;
  const interestYesterday = previousBalance * dailyRate;
  const netRate24h = previousBalance > 0 ? (interestYesterday / previousBalance) * 100 : 0;
  
  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">ZiiDi Trader</h1>
          <p className="text-sm text-muted-foreground">Good {greeting}</p>
        </div>
      </div>

      <div className="mb-8 overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex animate-[ticker_45s_linear_infinite] gap-8 whitespace-nowrap px-4 py-3 text-sm">
          {[...TICKERS, ...TICKERS].map((t, i) => (
            <span key={i} className="inline-flex items-center gap-2">
              <span className="font-semibold">{t.s}</span>
              <span className="text-muted-foreground">{t.p}</span>
              <span className={`inline-flex items-center gap-0.5 ${t.c >= 0 ? "text-primary" : "text-destructive"}`}>
                {t.c >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(t.c).toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>

      <section className="mb-8 rounded-2xl bg-primary p-6 sm:p-8 text-primary-foreground shadow-lg">
        <div className="flex flex-col items-center text-center">
          <button className="inline-flex items-center gap-1 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs hover:bg-primary-foreground/20">
            KSH <ChevronDown className="h-3 w-3" />
          </button>
          <div className="mt-3 text-sm opacity-90">Investment balance</div>
          <div className="mt-1 flex items-center gap-3">
            <div className="break-all text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              KSH {hidden ? "••••" : balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <button
              onClick={() => setHidden((v) => !v)}
              aria-label={hidden ? "Show balance" : "Hide balance"}
              className="rounded-full p-1 opacity-80 hover:opacity-100"
            >
              {hidden ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
          </div>
          <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-6 text-sm">
            <div>
              <div className="opacity-90">Interest earned yesterday</div>
              <div className="mt-1 text-lg font-semibold">
                KSH {hidden ? "••••" : interestYesterday.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="opacity-90">Net rate (last 24 hrs)</div>
              <div className="mt-1 text-lg font-semibold">{netRate24h.toFixed(1)}%</div>
              
            </div>
          </div>
          <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-3">
            <Link
              to="/deposit"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-foreground py-2.5 text-sm font-medium text-primary hover:opacity-95"
            >
              <LineChart className="h-4 w-4 text-emerald-500" /> Buy Shares
            </Link>
            <Link
              to="/withdraw"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary-foreground/40 py-2.5 text-sm font-medium hover:bg-primary-foreground/10"
            >
              <ArrowUpCircle className="h-4 w-4" /> Withdraw
            </Link>
          </div>
        </div>
      </section>

      <div className="mb-8 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-primary">
        <Info className="h-4 w-4" /> Market is open
      </div>

      <div className="mb-8">
        <EntryBanner variant="compact" />
      </div>

      <div className="mb-8 grid gap-5 sm:grid-cols-2">
        <Link to="/lock" className="rounded-xl bg-[#FFEACE] p-6 hover:bg-[#FFE0C0] transition-colors block">
          <img src={lockIcon} alt="ZiiDi Lock" className="h-12 w-12 object-contain" />
          <div className="mt-4 text-base font-semibold text-[#5c4a35]">ZiiDi Lock</div>
          <div className="text-sm text-[#8b7355]">Lock funds and earn 7% daily interest. Tap to start.</div>
        </Link>
        <Link to="/auto-invest" className="rounded-xl bg-primary/15 p-6 hover:bg-primary/25 transition-colors block">
          <img src={autoInvestIcon} alt="Auto Invest" className="h-12 w-12 object-contain" />
          <div className="mt-4 text-base font-semibold">Auto Invest</div>
          <div className="text-sm text-muted-foreground">Enter your admin passkey to start an auto-trade.</div>
        </Link>
      </div>

      <div id="transactions" className="scroll-mt-20">
        <TransactionHistory />
      </div>

      <style>{`@keyframes ticker { from { transform: translateX(0);} to { transform: translateX(-50%);} }`}</style>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

type Txn = {
  id: string;
  kind: "share" | "bond" | "lock" | "unlock" | "withdrawal" | "autoinvest" | "deposit" | "investment" | "transfer";
  title: string;
  subtitle: string;
  amount: number;
  direction: "in" | "out";
  status: string;
  at: string;
};

function TransactionHistory() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [listings, locks, wds, ais, deps, invs, tfs] = await Promise.all([
        supabase.from("listings").select("id,ticker,company_name,quantity,price_per_share,status,pending_at,created_at").eq("buyer_id", user.id).order("created_at", { ascending: false }),
        supabase.from("lock_deposits").select("id,principal,interest_credited,status,locked_at,released_at").eq("user_id", user.id).order("locked_at", { ascending: false }),
        supabase.from("withdrawals").select("id,amount,method,destination,status,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("autoinvests").select("id,code,principal,projected_return,status,started_at,matured_at").eq("user_id", user.id).order("started_at", { ascending: false }),
        supabase.from("deposits").select("id,amount,channel,status,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("investments").select("id,plan_name,amount,expected_return,status,invested_at,matures_at").eq("user_id", user.id).order("invested_at", { ascending: false }),
        supabase.from("transfers").select("id,sender_id,recipient_id,amount,recipient_label,sender_label,created_at").or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`).order("created_at", { ascending: false }),
      ]);

      const items: Txn[] = [];

      for (const l of listings.data ?? []) {
        const isBond = typeof l.ticker === "string" && l.ticker.endsWith("-BOND");
        const amt = Number(l.quantity) * Number(l.price_per_share);
        items.push({
          id: `l-${l.id}`,
          kind: isBond ? "bond" : "share",
          title: isBond ? `Bond purchase • ${l.ticker}` : `Bought ${l.quantity} × ${l.ticker}`,
          subtitle: l.company_name ?? "",
          amount: amt,
          direction: "out",
          status: l.status,
          at: l.pending_at ?? l.created_at,
        });
      }
      for (const d of locks.data ?? []) {
        items.push({
          id: `lk-${d.id}`,
          kind: "lock",
          title: "ZiiDi Lock",
          subtitle: d.status === "released" ? `Released • +KES ${Number(d.interest_credited ?? 0).toLocaleString()} interest` : "Locked & earning interest",
          amount: Number(d.principal),
          direction: d.status === "released" ? "in" : "out",
          status: d.status,
          at: d.released_at ?? d.locked_at,
        });
      }
      for (const w of wds.data ?? []) {
        items.push({
          id: `w-${w.id}`,
          kind: "withdrawal",
          title: `Withdrawal • ${String(w.method).toUpperCase()}`,
          subtitle: String(w.destination ?? ""),
          amount: Number(w.amount),
          direction: "out",
          status: w.status,
          at: w.created_at,
        });
      }
      for (const a of ais.data ?? []) {
        items.push({
          id: `a-${a.id}`,
          kind: "autoinvest",
          title: `Auto Invest • ${a.code}`,
          subtitle: a.status === "matured" ? `Matured • +KES ${Number(a.projected_return).toLocaleString()} return` : "Running",
          amount: Number(a.principal),
          direction: a.status === "matured" ? "in" : "out",
          status: a.status,
          at: a.matured_at ?? a.started_at,
        });
      }
      for (const d of deps.data ?? []) {
        items.push({
          id: `d-${d.id}`,
          kind: "deposit",
          title: `Deposit • ${String(d.channel ?? "mpesa").toUpperCase()}`,
          subtitle: d.status === "approved" ? "Credited to balance" : d.status === "rejected" ? "Rejected" : "Awaiting approval",
          amount: Number(d.amount),
          direction: "in",
          status: d.status,
          at: d.created_at,
        });
      }
      for (const i of invs.data ?? []) {
        items.push({
          id: `i-${i.id}`,
          kind: "investment",
          title: `Investment • ${i.plan_name}`,
          subtitle: i.status === "matured" ? `Matured • +KES ${Number(i.expected_return).toLocaleString()} return` : "Running",
          amount: Number(i.amount),
          direction: i.status === "matured" ? "in" : "out",
          status: i.status,
          at: i.invested_at,
        });
      }
      for (const t of tfs.data ?? []) {
        const sent = t.sender_id === user.id;
        items.push({
          id: `t-${t.id}`,
          kind: "transfer",
          title: sent ? `Transfer sent` : `Transfer received`,
          subtitle: sent ? `To ${t.recipient_label ?? "user"}` : `From ${t.sender_label ?? "user"}`,
          amount: Number(t.amount),
          direction: sent ? "out" : "in",
          status: "completed",
          at: t.created_at,
        });
      }

      items.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
      setRows(items);
      setLoading(false);
    })();
  }, [user]);

  const visible = showAll ? rows : rows.slice(0, 5);

  return (
    <div>
      <h2 className="text-base font-semibold">Transaction</h2>
      {loading ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No transactions yet.</p>
      ) : (
        <div className="mt-3 divide-y rounded-lg border bg-card">
          {visible.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{r.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.subtitle} • {new Date(r.at).toLocaleString()}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-sm font-semibold ${r.direction === "in" ? "text-primary" : "text-foreground"}`}>
                  {r.direction === "in" ? "+" : "−"} KES {r.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.status}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {rows.length > 5 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {showAll ? "Show less" : `Show more (${rows.length - 5})`}
        </button>
      )}
    </div>
  );
}
