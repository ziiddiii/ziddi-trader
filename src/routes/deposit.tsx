import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, ArrowRight, ArrowLeft, Loader2, CheckCircle2, Wifi,
  Search, Minus, Plus, X, AlertTriangle, Wallet,
} from "lucide-react";
import { TickerLogo } from "@/components/ticker-logo";
import { StockSpark } from "@/components/stock-spark";

export const Route = createFileRoute("/deposit")({
  head: () => ({
    meta: [
      { title: "Buy Shares — Live NSE Market | ZiiDi Trader" },
      { name: "description", content: "Browse live NSE stock prices with real-time gainers and losers, then buy shares instantly from your ZiiDi wallet." },
      { property: "og:title", content: "Buy Shares — Live NSE Market | ZiiDi Trader" },
      { property: "og:description", content: "Live NSE market movers and instant share purchase from your ZiiDi wallet." },
      { property: "og:url", content: "/deposit" },
    ],
    links: [{ rel: "canonical", href: "/deposit" }],
  }),
  component: Marketplace,
});

type Listing = {
  id: string;
  ticker: string;
  company_name: string | null;
  quantity: number;
  price_per_share: number;
  status: string;
  seller_id: string;
  buyer_id: string | null;
  created_at: string;
  seller_name?: string | null;
  logo_url?: string | null;
  change_percent?: number | null;
  min_buy_amount?: number | null;
  seller?: { username: string } | null;
};

import { BOND_FILTER, fetchMarketStocks } from "@/lib/market-stocks";

/** Ticks every 3s so quotes visibly move like a live NSE feed. */
function useMarketTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, []);
  return tick;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic drift around the admin-set baseline — sign (red/green) never flips. */
function liveQuote(ticker: string, basePrice: number, baseChange: number, tick: number) {
  const wobble = Math.sin((hash(ticker) % 100) / 7 + tick / 2);
  const pct = baseChange + wobble * Math.min(0.35, Math.abs(baseChange) * 0.25 + 0.05) * (baseChange >= 0 ? 1 : -1);
  const price = basePrice * (1 + (wobble * 0.0015));
  return { pct, price };
}

function Marketplace() {
  const { user, loading } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [myTrades, setMyTrades] = useState<Listing[]>([]);
  const [tab, setTab] = useState<"market" | "mine">("market");
  const [sort, setSort] = useState<"all" | "gainers" | "losers">("all");
  const [q, setQ] = useState("");
  const [connecting, setConnecting] = useState<{ listing: Listing; qty: number } | null>(null);
  const [connectStep, setConnectStep] = useState(0);
  const [balance, setBalance] = useState<number>(0);
  const [defaultMinBuy, setDefaultMinBuy] = useState<number>(25000);
  const [platformMin, setPlatformMin] = useState<number>(0);
  const [maxTotal, setMaxTotal] = useState<number>(2000000);
  const [buying, setBuying] = useState<Listing | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    supabase.from("stock_settings" as any).select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setDefaultMinBuy(Number((data as any).default_min_buy ?? (data as any).min_total ?? 25000));
        setPlatformMin(Number((data as any).min_total ?? 0) || 0);
        setMaxTotal(Number((data as any).max_total));
      }
    });
    // Same canonical stock set the admin panel edits.
    const activeRows = await fetchMarketStocks<Listing>();
    let mineRows: Listing[] = [];
    if (user) {
      const { data: mine } = await supabase
        .from("listings")
        .select("*")
        .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .not("ticker", "in", BOND_FILTER)
        .order("created_at", { ascending: false });
      mineRows = (mine ?? []) as Listing[];
    }
    const ids = Array.from(new Set([...activeRows, ...mineRows].map((r) => r.seller_id)));
    const nameMap = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabase.rpc("get_usernames", { _ids: ids });
      (profs ?? []).forEach((p: { id: string; username: string }) => nameMap.set(p.id, p.username));
    }
    setListings(activeRows.map((r: Listing) => ({ ...r, seller: { username: nameMap.get(r.seller_id) ?? "seller" } })));
    setMyTrades(mineRows.map((r) => ({ ...r, seller: { username: nameMap.get(r.seller_id) ?? "seller" } })));

    if (user) {
      const { data: bal } = await supabase.rpc("get_my_balance");
      setBalance(Number(bal ?? 0));
    } else {
      setBalance(0);
    }
  };

  useEffect(() => {
    if (loading) return;
    load();
    const ch = supabase
      .channel("listings-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  // Admin's platform minimum is a hard floor: per-stock minimums can only raise it.
  const minBuyFor = (l: Listing) =>
    Math.max(Number(l.min_buy_amount ?? defaultMinBuy) || 0, platformMin);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    let rows = listings.filter(
      (l) =>
        !term ||
        l.ticker.toLowerCase().includes(term) ||
        (l.company_name ?? "").toLowerCase().includes(term),
    );
    if (sort === "gainers") rows = rows.filter((l) => Number(l.change_percent ?? 0) >= 0);
    if (sort === "losers") rows = rows.filter((l) => Number(l.change_percent ?? 0) < 0);
    // Always alphabetical by ticker (then company name) — stocks are stand-alone, no sellers.
    return rows.sort(
      (a, b) =>
        a.ticker.localeCompare(b.ticker) ||
        (a.company_name ?? "").localeCompare(b.company_name ?? ""),
    );
  }, [listings, q, sort]);

  const doBuy = async (listing: Listing, qty: number) => {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    const total = qty * Number(listing.price_per_share);
    const min = minBuyFor(listing);
    if (total < min) {
      toast.error(`Minimum buy for ${listing.ticker} is KES ${min.toLocaleString()} — increase the number of shares.`);
      return;
    }
    if (total > maxTotal) {
      toast.error(`Maximum purchase per order is KES ${maxTotal.toLocaleString()}.`);
      return;
    }
    if (balance < total) {
      toast.error(`Insufficient balance — you need KES ${(total - balance).toLocaleString()} more. Deposit via M-PESA to continue.`);
      navigate({ to: "/fund" });
      return;
    }

    setBuying(null);
    setConnecting({ listing, qty });
    setConnectStep(0);

    const startedAt = Date.now();
    const SETTLE_MS = 7000; // fixed 7-second settlement experience
    const stepTimers = [
      setTimeout(() => setConnectStep(1), 1700),
      setTimeout(() => setConnectStep(2), 3600),
      setTimeout(() => setConnectStep(3), 5400),
    ];

    const { error } = await supabase.rpc("buy_from_balance", {
      _listing_id: listing.id,
      _quantity: qty,
    } as never);

    if (error) {
      stepTimers.forEach(clearTimeout);
      setConnecting(null);
      toast.error(error.message);
      return;
    }

    const remaining = Math.max(0, SETTLE_MS - (Date.now() - startedAt));
    const spend = qty * Number(listing.price_per_share);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (uid) {
        const { notify } = await import("@/lib/notify");
        await notify(
          uid,
          "purchase",
          `Shares purchased — ${listing.ticker}`,
          `Your purchase of ${qty} × ${listing.ticker} for KES ${spend.toLocaleString(undefined, { minimumFractionDigits: 2 })} settled from your ZiiDi wallet and the shares are now in your portfolio.`,
          {
            reference: listing.id.slice(0, 8).toUpperCase(),
            details: [
              { label: "Stock", value: `${listing.ticker}${listing.company_name ? ` — ${listing.company_name}` : ""}` },
              { label: "Quantity", value: `${qty} shares` },
              { label: "Price per share", value: `KES ${Number(listing.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
              { label: "Total paid", value: `KES ${spend.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
              { label: "Settlement", value: "ZiiDi wallet balance" },
              { label: "Status", value: "Credited to portfolio" },
              { label: "Date", value: new Date().toLocaleString() },
            ],
          },
        );
      }
    } catch {}
    setTimeout(() => {
      stepTimers.forEach(clearTimeout);
      setConnectStep(4);
      setConnecting(null);
      toast.success(`${qty} × ${listing.ticker} added to your portfolio`);
      load();
      navigate({ to: "/portfolio" });
    }, remaining);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <main className="mx-auto max-w-6xl py-6 md:py-10">
      {connecting && <ConnectingOverlay listing={connecting.listing} qty={connecting.qty} step={connectStep} />}
      {buying && (
        <BuyModal
          listing={buying}
          minBuy={minBuyFor(buying)}
          maxTotal={maxTotal}
          balance={balance}
          onClose={() => setBuying(null)}
          onConfirm={(qty) => doBuy(buying, qty)}
        />
      )}

      <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-gradient-to-br from-card to-background p-6 md:p-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Live NSE market feed · settled from your wallet
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">Buy stock shares instantly</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Track live gainers and losers, choose your number of shares, and settle straight from your ZiiDi
            wallet. Shares land in your portfolio, ready to resell at a profit.
          </p>
          <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
            <span>Minimum buy: KES {Math.max(defaultMinBuy, platformMin).toLocaleString()}</span>
            <span className="text-primary/40">·</span>
            <span>Maximum per order: KES {maxTotal.toLocaleString()}</span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-right">
          <div className="text-xs text-muted-foreground">Wallet balance</div>
          <div className="font-mono text-2xl font-semibold text-primary">KES {balance.toLocaleString()}</div>
          <Link
            to="/fund"
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            Deposit via M-PESA <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>

      <MarketTape rows={listings} />

      <div className="mb-4 mt-6 flex gap-1 rounded-lg border border-border bg-card p-1">
        <TabBtn active={tab === "market"} onClick={() => setTab("market")}>Market ({listings.length})</TabBtn>
        <TabBtn active={tab === "mine"} onClick={() => setTab("mine")}>My orders ({myTrades.length})</TabBtn>
      </div>

      {tab === "market" ? (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search ticker or company"
                aria-label="Search stocks"
                className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-1 rounded-lg border border-border bg-card p-1 text-xs">
              {(["all", "gainers", "losers"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`rounded-md px-3 py-1.5 font-medium capitalize transition ${
                    sort === s ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.length === 0 && (
              <div className="col-span-full rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
                No stocks match this view.
              </div>
            )}
            {visible.map((l, i) => (
              <StockCard
                key={l.id}
                listing={l}
                index={i}
                minBuy={minBuyFor(l)}
                balance={balance}
                onBuy={() => (user ? setBuying(l) : navigate({ to: "/auth" }))}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {myTrades.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
              No trades yet.
            </div>
          )}
          {myTrades.map((l) => {
            const role = user?.id === l.seller_id ? "Selling" : "Buying";
            return (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-4">
                  <span className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">{role}</span>
                  <TickerLogo ticker={l.ticker} logoUrl={l.logo_url} size={32} />
                  <div>
                    <div className="font-mono font-semibold">{l.ticker}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.quantity} shares · KES {(l.quantity * Number(l.price_per_share)).toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={l.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function MarketTape({ rows }: { rows: Listing[] }) {
  const tick = useMarketTick();
  if (rows.length === 0) return null;
  const tape = [...rows, ...rows].slice(0, 24);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex animate-[ziidi-tape_38s_linear_infinite] gap-6 whitespace-nowrap px-4 py-2.5">
        {tape.map((l, i) => {
          const q = liveQuote(l.ticker, Number(l.price_per_share), Number(l.change_percent ?? 0), tick);
          const pct = q.pct;
          const up = pct >= 0;
          return (
            <span key={`${l.id}-${i}`} className="inline-flex items-center gap-2 text-xs">
              <span className="font-mono font-semibold">{l.ticker}</span>
              <span className="text-muted-foreground">KES {q.price.toFixed(2)}</span>
              <span className={up ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
                {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
      <style>{`@keyframes ziidi-tape { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
}

function StockCard({
  listing,
  index,
  minBuy,
  balance,
  onBuy,
}: {
  listing: Listing;
  index: number;
  minBuy: number;
  balance: number;
  onBuy: () => void;
}) {
  const tick = useMarketTick();
  const price = Number(listing.price_per_share);
  const basePct = Number(listing.change_percent ?? 0);
  const live = liveQuote(listing.ticker, price, basePct, tick);
  const pct = live.pct;
  const up = pct >= 0;
  const minShares = Math.max(1, Math.ceil(minBuy / Math.max(price, 0.01)));
  const minCost = minShares * price;
  const shortfall = Math.max(0, minCost - balance);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/40 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="flex items-center gap-3">
          <TickerLogo ticker={listing.ticker} logoUrl={listing.logo_url} size={42} />
          <div>
            <div className="font-mono text-base font-semibold leading-tight">{listing.ticker}</div>
            <div className="line-clamp-1 text-xs text-muted-foreground">{listing.company_name}</div>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
            up ? "bg-emerald-500/12 text-emerald-600" : "bg-red-500/12 text-red-600"
          }`}
        >
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {up ? "+" : "−"}
          {Math.abs(pct).toFixed(2)}%
        </span>
      </div>

      <div className="px-5">
        <StockSpark changePercent={pct} seed={index * 3} height={44} />
      </div>

      <div className="flex items-end justify-between px-5 pt-1">
        <div>
          <div className={`font-mono text-xl font-semibold transition-colors ${up ? "text-emerald-600" : "text-red-600"}`}>
            KES {live.price.toFixed(2)}
          </div>
          <div className="text-[11px] text-muted-foreground">live · settles at KES {price.toFixed(2)}</div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{listing.quantity.toLocaleString()}</span> shares
          <div>available on NSE</div>
        </div>
      </div>

      <div className="mt-4 border-t border-border bg-muted/30 px-5 py-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Minimum buy</span>
          <span className="font-mono font-semibold">KES {minBuy.toLocaleString()}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-muted-foreground">= shares needed</span>
          <span className="font-semibold">
            {minShares.toLocaleString()} shares · KES {minCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="p-5 pt-3">
        <button
          onClick={onBuy}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Buy {listing.ticker} <ArrowRight className="h-4 w-4" />
        </button>
        {shortfall > 0 && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            You need KES {shortfall.toLocaleString(undefined, { maximumFractionDigits: 0 })} more —{" "}
            <Link to="/fund" className="font-semibold text-primary underline">deposit funds</Link>
          </p>
        )}
      </div>
    </article>
  );
}

function BuyModal({
  listing,
  minBuy,
  maxTotal,
  balance,
  onClose,
  onConfirm,
}: {
  listing: Listing;
  minBuy: number;
  maxTotal: number;
  balance: number;
  onClose: () => void;
  onConfirm: (qty: number) => void;
}) {
  const price = Number(listing.price_per_share);
  const minShares = Math.max(1, Math.ceil(minBuy / Math.max(price, 0.01)));
  const [qty, setQty] = useState<number>(minShares);
  const total = qty * price;
  const [amountInput, setAmountInput] = useState<string>(String(Math.round(minShares * price)));
  const applyAmount = (raw: string) => {
    setAmountInput(raw);
    const amt = Number(raw);
    if (!amt || amt <= 0) return;
    setQty(Math.max(1, Math.floor(amt / Math.max(price, 0.01))));
  };
  const belowMin = total < minBuy;
  const aboveMax = total > maxTotal;
  const shortfall = Math.max(0, total - balance);
  // Quick totals always respect the admin-configured min buy / max per order.
  const presetTotals = useMemo<number[]>(() => {
    const min = Math.max(1, minBuy);
    const max = Math.max(min, maxTotal);
    const cands = [min, min * 2, min * 4, min * 10, max];
    return Array.from(new Set(cands.filter((v) => v >= min && v <= max).map((v) => Math.round(v))))
      .sort((a, b) => a - b)
      .slice(0, 4);
  }, [minBuy, maxTotal]);
  const pct = Number(listing.change_percent ?? 0);
  const blocked = belowMin || aboveMax || shortfall > 0 || qty <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-card sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <TickerLogo ticker={listing.ticker} logoUrl={listing.logo_url} size={36} />
            <div>
              <div className="font-mono font-semibold">{listing.ticker}</div>
              <div className="text-xs text-muted-foreground">{listing.company_name}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Live price</span>
            <span className="font-mono font-semibold">
              KES {price.toFixed(2)}{" "}
              <span className={pct >= 0 ? "text-emerald-600" : "text-red-600"}>
                ({pct >= 0 ? "+" : "−"}{Math.abs(pct).toFixed(2)}%)
              </span>
            </span>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Amount you want to invest (KES)</label>
            <input
              type="number"
              min={0}
              step={100}
              value={amountInput}
              onChange={(e) => applyAmount(e.target.value)}
              placeholder={`e.g. ${Math.max(minBuy, 40000).toLocaleString()}`}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-center font-mono text-lg outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Enter any amount from KES {minBuy.toLocaleString()} upwards — e.g. KES{" "}
              {Math.max(minBuy + 5000, 40000).toLocaleString()}. That buys{" "}
              <b className="text-foreground">
                {Math.max(1, Math.floor((Number(amountInput) || 0) / Math.max(price, 0.01))).toLocaleString()} shares
              </b>{" "}
              at KES {price.toFixed(2)} each.
            </p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Number of shares</label>
            <div className="mt-1 flex items-center gap-2">
              <button
                onClick={() =>
                  setQty((n) => {
                    const next = Math.max(1, n - minShares);
                    setAmountInput(String(Math.round(next * price)));
                    return next;
                  })
                }
                className="rounded-md border border-border p-2 hover:bg-accent"
                aria-label="Decrease shares"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => {
                  const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                  setQty(n);
                  setAmountInput(String(Math.round(n * price)));
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-center font-mono outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={() =>
                  setQty((n) => {
                    const next = n + minShares;
                    setAmountInput(String(Math.round(next * price)));
                    return next;
                  })
                }
                className="rounded-md border border-border p-2 hover:bg-accent"
                aria-label="Increase shares"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => {
                setQty(minShares);
                setAmountInput(String(Math.round(minShares * price)));
              }}
              className="mt-2 text-[11px] font-semibold text-primary underline"
            >
              Use minimum ({minShares.toLocaleString()} shares)
            </button>
            <div className="mt-3 flex flex-wrap gap-2">
              {presetTotals.map((v) => (
                <button
                  key={v}
                onClick={() => {
                  setQty(Math.max(minShares, Math.ceil(v / Math.max(price, 0.01))));
                  setAmountInput(String(Math.round(v)));
                }}
                  className="rounded-full border border-border px-3 py-1.5 text-[11px] font-medium hover:border-primary hover:text-primary"
                >
                  KES {v.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 rounded-lg border border-border p-3 text-sm">
            <Row label="Minimum buy amount" value={`KES ${minBuy.toLocaleString()}`} />
            <Row label="Order total" value={`KES ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} strong />
            <Row label="Wallet balance" value={`KES ${balance.toLocaleString()}`} />
          </div>

          {belowMin && (
            <Alert>
              Below the minimum. Buy at least{" "}
              <b>{minShares.toLocaleString()} shares (KES {minBuy.toLocaleString()})</b> of {listing.ticker}.
            </Alert>
          )}
          {aboveMax && <Alert>Maximum per order is KES {maxTotal.toLocaleString()}. Reduce the shares.</Alert>}
          {!belowMin && !aboveMax && shortfall > 0 && (
            <Alert>
              You need <b>KES {shortfall.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b> more in your
              wallet.{" "}
              <Link to="/fund" className="font-semibold text-primary underline">Deposit via M-PESA</Link>
            </Alert>
          )}

          <button
            disabled={blocked}
            onClick={() => onConfirm(qty)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {shortfall > 0 && !belowMin && !aboveMax ? (
              <>Insufficient balance <Wallet className="h-4 w-4" /></>
            ) : (
              <>Buy for KES {total.toLocaleString(undefined, { maximumFractionDigits: 2 })} <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
          <button onClick={onClose} className="inline-flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Back to market
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono ${strong ? "text-base font-semibold" : "text-sm"}`}>{value}</span>
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
        active ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-primary/15 text-primary",
    pending: "bg-amber-500/15 text-amber-400",
    paid: "bg-blue-500/15 text-blue-400",
    sold: "bg-emerald-500/15 text-emerald-400",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-muted"}`}>{status}</span>
  );
}

function ConnectingOverlay({ listing, qty, step }: { listing: Listing; qty: number; step: number }) {
  const TOTAL_MS = 7000;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Math.min(TOTAL_MS, Date.now() - startedAt)), 80);
    return () => clearInterval(id);
  }, []);

  const pct = Math.min(100, (elapsed / TOTAL_MS) * 100);
  const secondsLeft = Math.max(0, Math.ceil((TOTAL_MS - elapsed) / 1000));
  const done = step >= 4 || pct >= 100;

  const steps = [
    { label: "Verifying your ZiiDi wallet balance", icon: Wifi },
    { label: `Reserving ${qty} × ${listing.ticker} at the live NSE price`, icon: Loader2 },
    { label: "Settling payment from your balance", icon: Loader2 },
    { label: "Crediting shares to your portfolio", icon: CheckCircle2 },
  ];

  const R = 42;
  const C = 2 * Math.PI * R;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm animate-scale-in overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex flex-col items-center px-6 pt-7 text-center">
          <div className="relative grid h-28 w-28 place-items-center">
            <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
              <circle cx="50" cy="50" r={R} className="fill-none stroke-muted" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r={R}
                className="fill-none stroke-primary transition-[stroke-dashoffset] duration-100 ease-linear"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C - (C * pct) / 100}
              />
            </svg>
            <span className="absolute grid place-items-center">
              {done ? (
                <CheckCircle2 className="h-9 w-9 text-primary" />
              ) : (
                <span className="font-mono text-2xl font-semibold tabular-nums">{secondsLeft}s</span>
              )}
            </span>
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            {done ? "Purchase complete!" : "Processing your order…"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {done
              ? `${qty} × ${listing.ticker} credited — opening your portfolio…`
              : `Settling ${qty} × ${listing.ticker} from your ZiiDi wallet. Please keep this window open.`}
          </p>
        </div>

        <ul className="mt-5 space-y-2 px-6">
          {steps.map((s, i) => {
            const isDone = done || i < step;
            const active = !done && i === step;
            const Icon = isDone ? CheckCircle2 : s.icon;
            return (
              <li
                key={i}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-primary/10 text-foreground" : isDone ? "text-foreground" : "text-muted-foreground/70"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isDone ? "text-primary" : active ? "animate-spin text-primary" : ""}`} />
                {s.label}
              </li>
            );
          })}
        </ul>

        <div className="mt-5 h-1.5 w-full bg-muted">
          <div className="h-full bg-primary transition-[width] duration-100 ease-linear" style={{ width: `${pct}%` }} />
        </div>
        <p className="bg-muted/40 px-6 py-3 text-center text-[11px] text-muted-foreground">
          Secured by ZiiDi Trader · NSE settlement engine
        </p>
      </div>
    </div>
  );
}
