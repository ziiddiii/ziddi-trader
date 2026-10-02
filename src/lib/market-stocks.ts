import { supabase } from "@/integrations/supabase/client";

export const BOND_TICKERS = ["FXD-BOND", "IFB-BOND", "ZCB-BOND"];
export const BOND_FILTER = `(${BOND_TICKERS.join(",")})`;

/**
 * Canonical marketplace stock set — shared by the buyers' Buy Shares page and
 * the admin panel so both show exactly the same stocks in the same order.
 * One row per ticker (newest listing wins), bonds excluded, sorted A→Z.
 */
export function canonicalStocks<T extends { ticker: string; created_at?: string }>(rows: T[]): T[] {
  const newest = [...rows].sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  );
  const seen = new Set<string>();
  const unique = newest.filter((r) => {
    if (BOND_TICKERS.includes(r.ticker) || seen.has(r.ticker)) return false;
    seen.add(r.ticker);
    return true;
  });
  return unique.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export async function fetchMarketStocks<T = any>(): Promise<T[]> {
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("status", "active")
    .not("ticker", "in", BOND_FILTER)
    .order("created_at", { ascending: false })
    .limit(1000);
  return canonicalStocks((data ?? []) as any[]) as T[];
}
