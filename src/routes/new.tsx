import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "List shares — ZiiDi Trader" },
      { name: "description", content: "Create a new listing to sell your stock shares peer-to-peer on ZiiDi Trader." },
      { property: "og:title", content: "List shares — ZiiDi Trader" },
      { property: "og:description", content: "Create a new listing to sell your stock shares on ZiiDi Trader." },
      { property: "og:url", content: "/new" },
    ],
    links: [{ rel: "canonical", href: "/new" }],
  }),
  component: NewListing,
});

function NewListing() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [ticker, setTicker] = useState("");
  const [company, setCompany] = useState("");
  const [quantity, setQuantity] = useState(10);
  const [price, setPrice] = useState(100);
  const [busy, setBusy] = useState(false);
  const [minTotal, setMinTotal] = useState(25000);
  const [maxTotal, setMaxTotal] = useState(2000000);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    if (!loading && user && !isAdmin) {
      navigate({ to: "/deposit" });
    }
  }, [loading, user, isAdmin, navigate]);

  useEffect(() => {
    supabase.from("stock_settings" as any).select("*").order("updated_at",{ascending:false}).limit(1).maybeSingle().then(({ data }) => {
      if (data) { setMinTotal(Number((data as any).min_total)); setMaxTotal(Number((data as any).max_total)); }
    });
  }, []);

  if (!loading && user && !isAdmin) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only administrators can add new share listings to the marketplace.
        </p>
      </main>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const totalAsk = quantity * price;
    if (totalAsk < minTotal) {
      toast.error(`Total listing value must be at least KES ${minTotal.toLocaleString()}`);
      return;
    }
    if (totalAsk > maxTotal) {
      toast.error(`Total listing value cannot exceed KES ${maxTotal.toLocaleString()}`);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("listings")
      .insert({
        seller_id: user.id,
        ticker: ticker.toUpperCase().trim(),
        company_name: company.trim() || null,
        quantity,
        price_per_share: price,
      })
      .select()
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Listing created");
    navigate({ to: "/listing/$id", params: { id: data.id } });
  };

  const total = quantity * price;

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold">List shares for sale</h1>
      <p className="mt-1 text-sm text-muted-foreground">Buyers will chat with you before settlement.</p>
      <form onSubmit={submit} className="mt-8 space-y-5 rounded-xl border border-border bg-card p-6">
        <div>
          <label className="text-sm text-muted-foreground">Ticker</label>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            required
            maxLength={10}
            placeholder="AAPL"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono uppercase outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Company (optional)</label>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Apple Inc."
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground">Quantity</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Price / share (KES)</label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm">
          <span className="text-muted-foreground">Total ask</span>
          <span className="font-mono font-semibold">KES {total.toFixed(2)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Minimum listing value KES {minTotal.toLocaleString()} · Maximum KES {maxTotal.toLocaleString()}. Buyers can repurchase this listing unlimited times.
        </p>
        <button
          disabled={busy}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Publishing…" : "Publish listing"}
        </button>
      </form>
    </main>
  );
}