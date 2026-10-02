import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Search, TrendingUp, ChevronRight, Wallet, Clock } from "lucide-react";

export const Route = createFileRoute("/investments/")({
  head: () => ({
    meta: [
      { title: "Investment Plans — ZiiDi Trader" },
      { name: "description", content: "Pick an investment plan and grow your capital with fixed returns." },
      { property: "og:title", content: "Investment Plans — ZiiDi Trader" },
      { property: "og:description", content: "Pick an investment plan and grow your capital with fixed returns." },
      { property: "og:url", content: "/investments" },
    ],
    links: [{ rel: "canonical", href: "/investments" }],
  }),
  component: InvestmentsPage,
});

type Plan = {
  id: string;
  name: string;
  description: string;
  interest_rate: number;
  duration_hours: number;
  min_amount: number;
  max_amount: number;
  active: boolean;
  sort_order: number;
};

type Investment = {
  id: string;
  plan_name: string;
  amount: number;
  interest_rate: number;
  duration_hours: number;
  expected_return: number;
  status: string;
  invested_at: string;
  matures_at: string;
};

function fmt(n: number) {
  return `KSH ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function InvestmentsPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [mine, setMine] = useState<Investment[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: pd }, { data: md }] = await Promise.all([
      supabase.from("investment_plans").select("*").eq("active", true).order("sort_order"),
      user ? supabase.from("investments").select("*").eq("user_id", user.id).order("invested_at", { ascending: false }) : Promise.resolve({ data: [] as Investment[] }),
    ]);
    setPlans((pd ?? []) as Plan[]);
    setMine((md ?? []) as Investment[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const filtered = useMemo(() => {
    if (!q.trim()) return plans;
    const s = q.toLowerCase();
    return plans.filter((p) => p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s));
  }, [q, plans]);

  return (
    <main className="mx-auto max-w-4xl py-4 md:py-8">
      <section className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Available Packages</h1>
          <p className="text-xs text-muted-foreground">Pick an investment plan that fits your capital and time horizon.</p>
        </div>
      </section>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search packages..."
          className="w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="space-y-3">
        {loading && <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Loading plans…</div>}
        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No plans available right now. Please check again shortly.
          </div>
        )}
        {filtered.map((p) => (
          <Link
            key={p.id}
            to="/investments/$id"
            params={{ id: p.id }}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-sm"
          >
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold">{p.name}</div>
              <div className="line-clamp-1 text-sm text-muted-foreground">{p.description}</div>
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-[11px] text-muted-foreground">Min. Invest</div>
              <div className="whitespace-nowrap text-sm font-bold text-primary">KSH {Number(p.min_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">Your Investments</h2>
        {mine.length === 0 ? (
          <div className="text-sm text-muted-foreground">No investments yet.</div>
        ) : (
          <div className="space-y-2">
            {mine.map((i) => (
              <div key={i.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{i.plan_name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {i.duration_hours}h · {new Date(i.invested_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Invested</div>
                  <div className="text-sm font-semibold">{fmt(i.amount)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Return</div>
                  <div className="text-sm font-bold text-primary">{fmt(i.expected_return)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

// dummy to suppress unused import if toast unused
void toast;