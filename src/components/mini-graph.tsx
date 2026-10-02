import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

type Props = {
  variant: "down" | "up";
  label?: string;
  seed?: number;
};

type Candle = { o: number; h: number; l: number; c: number };

// Live-updating forex-style candlestick chart.
// Down variant = predominantly red/bearish (good time to BUY the dip).
// Up variant = predominantly green/bullish (good time to SELL for profit).
export function MiniGraph({ variant, label, seed = 0 }: Props) {
  const isDown = variant === "down";
  const [candles, setCandles] = useState<Candle[]>(() => {
    const arr: Candle[] = [];
    let price = 50 + (seed % 7);
    for (let i = 0; i < 26; i++) {
      const bias = isDown ? -0.6 : 0.6;
      const o = price;
      const c = o + bias + (Math.random() - 0.5) * 3.2;
      const h = Math.max(o, c) + Math.random() * 1.6;
      const l = Math.min(o, c) - Math.random() * 1.6;
      arr.push({ o, h, l, c });
      price = c;
    }
    return arr;
  });
  const [pct, setPct] = useState<number>(variant === "down" ? -2.4 : 3.1);

  useEffect(() => {
    const id = setInterval(() => {
      setCandles((prev) => {
        const last = prev[prev.length - 1];
        const bias = isDown ? -0.55 : 0.55;
        const o = last.c;
        let c = o + bias + (Math.random() - 0.5) * 3.4;
        c = Math.max(8, Math.min(92, c));
        const h = Math.max(o, c) + Math.random() * 1.8;
        const l = Math.min(o, c) - Math.random() * 1.8;
        return [...prev.slice(1), { o, h, l, c }];
      });
      setPct((p) => {
        const jitter = (Math.random() - 0.5) * 0.3;
        const target = variant === "down" ? -2.5 : 3.5;
        return +(p + jitter + (target - p) * 0.05).toFixed(2);
      });
    }, 850);
    return () => clearInterval(id);
  }, [variant, isDown]);

  const accent = isDown ? "#dc2626" : "#059669";
  const accentFill = isDown ? "rgba(220,38,38,0.12)" : "rgba(5,150,105,0.14)";
  const upColor = "#059669";
  const downColor = "#dc2626";
  const w = 320;
  const h = 96;
  const pad = 4;
  const allVals = candles.flatMap((k) => [k.h, k.l]);
  const min = Math.min(...allVals) - 1;
  const max = Math.max(...allVals) + 1;
  const range = Math.max(1, max - min);
  // Down variant: flip so higher price is at top but downward trend visually descends.
  const toY = (v: number) => pad + ((max - v) / range) * (h - pad * 2);
  const slot = w / candles.length;
  const bodyW = Math.max(2, slot * 0.62);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label ?? (isDown ? "Live market — buy signal" : "Live market — sell signal")}
        </div>
        <div
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ color: accent, background: accentFill }}
        >
          {isDown ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
          {isDown ? "" : "+"}
          {pct.toFixed(2)}%
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full">
        {/* subtle gridlines */}
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={0}
            x2={w}
            y1={pad + g * (h - pad * 2)}
            y2={pad + g * (h - pad * 2)}
            stroke="currentColor"
            className="text-border"
            strokeWidth={0.5}
            strokeDasharray="2 3"
            opacity={0.5}
          />
        ))}
        {candles.map((k, i) => {
          const bull = k.c >= k.o;
          const col = bull ? upColor : downColor;
          const cx = i * slot + slot / 2;
          const yH = toY(k.h);
          const yL = toY(k.l);
          const yO = toY(k.o);
          const yC = toY(k.c);
          const top = Math.min(yO, yC);
          const bh = Math.max(1.2, Math.abs(yC - yO));
          return (
            <g key={i}>
              <line x1={cx} x2={cx} y1={yH} y2={yL} stroke={col} strokeWidth={1} />
              <rect
                x={cx - bodyW / 2}
                y={top}
                width={bodyW}
                height={bh}
                fill={bull ? col : col}
                opacity={bull ? 0.95 : 1}
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: accent }} />
          Live
        </span>
        <span>
          {isDown
            ? "Prices dipping — great entry to buy low"
            : "Prices rising — good moment to sell for profit"}
        </span>
      </div>
    </div>
  );
}