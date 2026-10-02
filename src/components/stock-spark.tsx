import { useEffect, useMemo, useState } from "react";

/** Compact live sparkline. Green when changePercent >= 0, red when negative. */
export function StockSpark({
  changePercent,
  seed = 0,
  height = 40,
}: {
  changePercent: number;
  seed?: number;
  height?: number;
}) {
  const up = changePercent >= 0;
  const bias = useMemo(() => (up ? 0.55 : -0.55), [up]);
  const [pts, setPts] = useState<number[]>(() => {
    const arr: number[] = [];
    let v = 50 + (seed % 9);
    for (let i = 0; i < 28; i++) {
      v = Math.max(10, Math.min(90, v + bias + (Math.random() - 0.5) * 4));
      arr.push(v);
    }
    return arr;
  });

  useEffect(() => {
    const id = setInterval(() => {
      setPts((prev) => {
        const last = prev[prev.length - 1] ?? 50;
        const next = Math.max(10, Math.min(90, last + bias + (Math.random() - 0.5) * 4.5));
        return [...prev.slice(1), next];
      });
    }, 1100);
    return () => clearInterval(id);
  }, [bias]);

  const w = 120;
  const h = height;
  const min = Math.min(...pts) - 2;
  const max = Math.max(...pts) + 2;
  const range = Math.max(1, max - min);
  const step = w / (pts.length - 1);
  const line = pts.map((p, i) => `${i * step},${h - ((p - min) / range) * h}`).join(" ");
  const color = up ? "#059669" : "#dc2626";
  const fill = up ? "rgba(5,150,105,0.14)" : "rgba(220,38,38,0.14)";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }} aria-hidden="true">
      <polygon points={`0,${h} ${line} ${w},${h}`} fill={fill} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}
