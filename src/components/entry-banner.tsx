import { TrendingUp, Wallet, ArrowRightCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function useMinEntry() {
  const [min, setMin] = useState<number | null>(null);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("stock_settings").select("min_total").order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (data) setMin(Number(data.min_total));
    };
    load();
    const ch = supabase.channel(`stock-settings-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_settings" }, load)
      .subscribe();
    const t = setInterval(load, 15000);
    return () => { clearInterval(t); supabase.removeChannel(ch); };
  }, []);
  return min;
}

const TIERS = [
  { range: "KES 20,000 – 49,999", gain: 35, color: "bg-emerald-500" },
  { range: "KES 50,000 – 99,999", gain: 70, color: "bg-emerald-600" },
  { range: "KES 100,000+", gain: 100, color: "bg-emerald-700" },
];

export function EntryBanner({ variant = "default" }: { variant?: "default" | "compact" }) {
  const min = useMinEntry();
  const minLabel = min != null ? `KES ${min.toLocaleString()}` : "…";
  if (variant === "compact") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary to-emerald-700 p-4 text-primary-foreground shadow-lg">
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Start from only {minLabel}</p>
              <p className="text-xs opacity-90">Resell in portfolio & earn up to 100% gains</p>
            </div>
          </div>
          <Link
            to="/deposit"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-white/90"
          >
            Buy shares <ArrowRightCircle className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary via-emerald-600 to-emerald-800 py-12 text-primary-foreground sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl"
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest backdrop-blur">
              <TrendingUp className="h-3.5 w-3.5" /> Portfolio resell
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Minimum entry {minLabel}
            </h2>
            <p className="mt-3 max-w-lg text-emerald-50">
              Buy shares today and resell them from your portfolio at a market gain. The more you hold, the higher your upside when the market turns green.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-emerald-700 shadow hover:bg-white/90"
              >
                Open account <ArrowRightCircle className="h-4 w-4" />
              </Link>
              <Link
                to="/deposit"
                className="inline-flex items-center gap-2 rounded-full border-2 border-white/40 px-5 py-2.5 text-sm font-semibold hover:bg-white/10"
              >
                Buy shares now
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider opacity-90">
                Sell from portfolio — your upside
              </h3>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
                Green market
              </span>
            </div>
            <div className="space-y-4">
              {TIERS.map((tier) => (
                <div key={tier.range} className="flex items-center gap-4">
                  <div className="w-24 shrink-0 text-xs font-medium opacity-90 sm:w-32 sm:text-sm">
                    {tier.range}
                  </div>
                  <div className="flex-1">
                    <div className="h-3 w-full overflow-hidden rounded-full bg-black/20">
                      <div
                        className={`h-full rounded-full ${tier.color} transition-all duration-1000`}
                        style={{ width: `${tier.gain}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 shrink-0 text-right text-sm font-black sm:text-base">
                    +{tier.gain}%
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs opacity-80">
              Gains are applied automatically when you sell approved shares from your portfolio.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
