import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Landmark, Loader2, CheckCircle2, Wifi, ArrowRight, Clock, TrendingUp, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/bonds")({
  head: () => ({
    meta: [
      { title: "Buy Bonds — ZiiDi Trader" },
      { name: "description", content: "Invest in Fixed coupon, Infrastructure, and Zero-coupon bonds directly from your ZiiDi Trader wallet." },
      { property: "og:title", content: "Buy Bonds — ZiiDi Trader" },
      { property: "og:description", content: "Fixed coupon, Infrastructure, and Zero-coupon bonds on ZiiDi Trader." },
      { property: "og:url", content: "/bonds" },
    ],
    links: [{ rel: "canonical", href: "/bonds" }],
  }),
  component: BondsPage,
});

type BondKey = "fixed" | "infra" | "zero";

type Bond = {
  key: BondKey;
  name: string;
  tagline: string;
  entry: number;
  rate: string;
  term: string;
  payout: string;
  bullets: string[];
  accent: string;
};

const BONDS: Bond[] = [
  {
    key: "fixed",
    name: "Fixed Coupon Bond",
    tagline: "Predetermined, fixed interest paid semi-annually until maturity.",
    entry: 100000,
    rate: "Fixed",
    term: "1 – 30 years",
    payout: "Semi-annually",
    bullets: [
      "Guaranteed fixed interest rate for the entire term",
      "Predictable cashflow every 6 months",
      "Ideal for capital preservation & steady income",
    ],
    accent: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30",
  },
  {
    key: "infra",
    name: "Infrastructure Bond (IFB)",
    tagline: "Funds public projects like roads and energy. Long-term, higher yield.",
    entry: 250000,
    rate: "15% p.a",
    term: "5 – 25 years",
    payout: "After 5 years",
    bullets: [
      "Backed by government infrastructure projects",
      "Attractive 15% coupon rate",
      "Tax-free returns on qualifying issues",
    ],
    accent: "from-blue-500/15 to-blue-500/5 border-blue-500/30",
  },
  {
    key: "zero",
    name: "Zero-Coupon Bond",
    tagline: "Bought at a discount. Sell anytime as market price rises.",
    entry: 50000,
    rate: "~15% (variable)",
    term: "Sell anytime",
    payout: "On sale (capital gain)",
    bullets: [
      "Sold at a discount to face value",
      "Sell into the market at any time for a profit",
      "Amount is credited to your portfolio to resell",
    ],
    accent: "from-amber-500/15 to-amber-500/5 border-amber-500/30",
  },
];

function BondsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState<Bond | null>(null);
  const [step, setStep] = useState(0);

  const buy = async (bond: Bond) => {
    if (!user) { navigate({ to: "/auth" }); return; }
    setConnecting(bond);
    setStep(0);
    const started = Date.now();
    const MIN_MS = 10200;
    const timers = [
      setTimeout(() => setStep(1), 2200),
      setTimeout(() => setStep(2), 5200),
      setTimeout(() => setStep(3), 8000),
    ];
    const { data, error } = await supabase.rpc("buy_bond", { _bond_type: bond.key });
    timers.forEach(clearTimeout);
    if (error) {
      setConnecting(null);
      toast.error(error.message);
      return;
    }
    setStep(3);
    const remaining = Math.max(0, MIN_MS - (Date.now() - started));
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (uid) {
        const { notify } = await import("@/lib/notify");
        await notify(uid, "bond", `Bond desk matched — ${bond.name}`,
          `You've been connected to the ZiiDi bond desk for the ${bond.name}. Complete payment within 10 minutes to secure your bond.`);
      }
    } catch {}
    setTimeout(() => {
      setConnecting(null);
      const row = data as { id: string } | null;
      if (row?.id) navigate({ to: "/listing/$id", params: { id: row.id } });
    }, remaining);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <main className="mx-auto max-w-6xl py-6 md:py-10">
      {connecting && <BondConnecting bond={connecting} step={step} />}

      <section className="mb-8 rounded-2xl border border-border bg-gradient-to-br from-card to-background p-6 md:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Landmark className="h-3 w-3 text-primary" /> Government & infrastructure bonds
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
          Buy Bonds — secure, fixed & long-term returns
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Choose a bond, chat 1:1 with the ZiiDi bond desk, complete payment and receive it in your portfolio once approved.
        </p>
      </section>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {BONDS.map((b) => (
          <div
            key={b.key}
            className={`flex flex-col rounded-2xl border bg-gradient-to-br p-6 ${b.accent}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-background/60 backdrop-blur">
                <Landmark className="h-5 w-5 text-primary" />
              </div>
              <span className="rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-medium text-foreground/80">
                {b.rate}
              </span>
            </div>
            <div className="text-lg font-semibold">{b.name}</div>
            <p className="mt-1 text-sm text-muted-foreground">{b.tagline}</p>

            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-background/60 p-3 text-xs">
              <div>
                <div className="text-muted-foreground">Term</div>
                <div className="mt-0.5 flex items-center gap-1 font-medium"><Clock className="h-3 w-3" />{b.term}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Payout</div>
                <div className="mt-0.5 flex items-center gap-1 font-medium"><TrendingUp className="h-3 w-3" />{b.payout}</div>
              </div>
            </div>

            <ul className="mt-4 space-y-1.5 text-sm">
              {b.bullets.map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-foreground/90">{t}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 border-t border-border/50 pt-4">
              <div className="text-xs text-muted-foreground">Entry from</div>
              <div className="font-mono text-2xl font-bold">KES {b.entry.toLocaleString()}</div>
            </div>

            <button
              onClick={() => buy(b)}
              disabled={!!connecting}
              className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Buy bond <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          Bond purchases are escrow-protected. After payment, the ZiiDi bond desk approves and the bond amount lands in your Portfolio, ready to hold to maturity or sell into the market.
        </div>
      </div>
    </main>
  );
}

function BondConnecting({ bond, step }: { bond: Bond; step: number }) {
  const steps = [
    { label: "Scanning ZiiDi bond desk", icon: Wifi },
    { label: `Reserving ${bond.name}`, icon: Loader2 },
    { label: "Preparing secure payment channel", icon: Loader2 },
    { label: "Bond desk connected — opening chat", icon: CheckCircle2 },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="relative grid h-16 w-16 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
            <span className="relative grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
              {step >= 3 ? <CheckCircle2 className="h-6 w-6" /> : <Loader2 className="h-6 w-6 animate-spin" />}
            </span>
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            {step >= 3 ? "Bond desk connected!" : "Please wait…"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {step >= 3
              ? "Opening secure chat room…"
              : `Wait as Safaricom PLC connects you to the ZiiDi bond desk to buy the ${bond.name}.`}
          </p>
        </div>
        <ul className="mt-6 space-y-2.5">
          {steps.map((s, i) => {
            const done = i < step; const active = i === step;
            const Icon = done ? CheckCircle2 : s.icon;
            return (
              <li key={i} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${active ? "bg-primary/10 text-foreground" : done ? "text-foreground" : "text-muted-foreground"}`}>
                <Icon className={`h-4 w-4 ${done ? "text-primary" : active ? "animate-spin text-primary" : ""}`} />
                {s.label}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}