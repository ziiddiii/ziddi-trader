import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2 } from "lucide-react";

type Promo = { id: string; message: string };

export function PromoFlash() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from("promo_flashes")
        .select("id, message")
        .eq("enabled", true)
        .order("created_at", { ascending: false });
      if (alive && data) setPromos(data as Promo[]);
    };
    load();
    const ch = supabase
      .channel("promo_flashes_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "promo_flashes" }, load)
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    if (promos.length === 0) return;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    const t = setInterval(() => {
      setVisible(false);
      revealTimer = setTimeout(() => {
        setIdx((i) => (i + 1) % promos.length);
        setVisible(true);
      }, 300);
    }, 5000);
    return () => {
      clearInterval(t);
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, [promos]);

  if (promos.length === 0) return null;
  const current = promos[idx % promos.length];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6">
      <div
        key={current.id}
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex w-full max-w-lg items-center gap-2.5 rounded-md border border-primary/30 bg-gradient-to-r from-primary/95 to-emerald-500/95 px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-emerald-600/25 backdrop-blur transition-all duration-300 motion-reduce:transition-none animate-in fade-in slide-in-from-bottom-2 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-foreground/20">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <span className="min-w-0 leading-snug">{current.message}</span>
      </div>
    </div>
  );
}