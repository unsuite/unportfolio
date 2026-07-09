import type { Decimal } from "decimal.js";
import { useRef, useState } from "react";
import type { deriveGroupStats, TimelinePoint } from "../../core/derive/timeline";
import { fmtEur } from "../store/selectors";

export const eurCompact = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** +12,3% con segno; il valore è una frazione (0,123 = +12,3%). */
const signedPct = (v: number) => `${v >= 0 ? "+" : "−"}${(Math.abs(v) * 100).toFixed(1)}%`;

export function LineChart({
  points,
  format = "eur",
}: {
  points: TimelinePoint[];
  /** "eur" = valuta; "pct" = frazione con segno (rendimento ribasato) */
  format?: "eur" | "pct";
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const fmtVal = format === "pct" ? signedPct : (v: number) => fmtEur(v);
  const fmtShort = format === "pct" ? signedPct : (v: number) => eurCompact.format(v);
  if (points.length < 2)
    return (
      <div className="flex h-44 items-center justify-center text-sm text-zinc-600">
        servono almeno due punti (lancia il CLI prezzi per lo storico)
      </div>
    );
  const W = 720;
  const H = 176;
  const PAD = 4;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
  // linea di riferimento a 0% per il rendimento, se lo zero è nell'intervallo
  const zeroY = format === "pct" && min < 0 && max > 0 ? y(0) : undefined;
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");
  const area = `${path} L${x(points.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (points.length - 1)));
  };
  const hp = hover != null ? points[hover] : undefined;
  const hx = hover != null ? x(hover) : 0;
  const hy = hp ? y(hp.value) : 0;
  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#area)" />
        {zeroY !== undefined && (
          <line
            x1={PAD}
            y1={zeroY}
            x2={W - PAD}
            y2={zeroY}
            stroke="#52525b"
            strokeWidth="0.75"
            strokeDasharray="3 3"
          />
        )}
        <path d={path} fill="none" stroke="#10b981" strokeWidth="1.5" />
        {hp && (
          <g>
            <line
              x1={hx}
              y1={PAD}
              x2={hx}
              y2={H - PAD}
              stroke="#71717a"
              strokeWidth="0.75"
              strokeDasharray="2 2"
            />
            <circle cx={hx} cy={hy} r="2.5" fill="#10b981" stroke="#0a0a0a" strokeWidth="1" />
          </g>
        )}
      </svg>
      {hp && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-y-1 whitespace-nowrap rounded border border-zinc-700 bg-zinc-900/95 px-2 py-1 text-xs shadow"
          style={{
            left: `${(hx / W) * 100}%`,
            transform: `translateX(${hx / W < 0.5 ? "0.5rem" : "calc(-100% - 0.5rem)"})`,
          }}
        >
          <div className="text-zinc-400">{hp.date}</div>
          <div className="font-medium tabular-nums text-zinc-100">{fmtVal(hp.value)}</div>
        </div>
      )}
      <div className="flex justify-between text-xs text-zinc-500">
        <span>
          {first.date} · {fmtShort(first.value)}
        </span>
        <span className="text-zinc-300">
          {last.date} · <strong>{fmtShort(last.value)}</strong>
        </span>
      </div>
      <div className="flex justify-between text-xs text-zinc-600">
        <span>min {fmtShort(min)}</span>
        <span>max {fmtShort(max)}</span>
      </div>
    </div>
  );
}

/** Grafico a due linee: capitale versato (investito) vs valore di mercato.
 *  Il divario tra le due è il guadagno. Scala condivisa su entrambe le serie. */
export function InvestedValueChart({
  points,
}: {
  points: { date: string; invested: number; value: number }[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2)
    return (
      <div className="flex h-44 items-center justify-center text-sm text-zinc-600">
        servono almeno due punti (lancia il CLI prezzi per lo storico)
      </div>
    );
  const W = 720;
  const H = 176;
  const PAD = 4;
  const all = points.flatMap((p) => [p.invested, p.value]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
  const line = (key: "invested" | "value") =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`)
      .join(" ");
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (points.length - 1)));
  };
  const hp = hover != null ? points[hover] : undefined;
  const hx = hover != null ? x(hover) : 0;
  return (
    <div className="relative">
      <div className="mb-1 flex gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-emerald-500" /> valore
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-amber-400" /> investito
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <path d={line("value")} fill="none" stroke="#10b981" strokeWidth="1.5" />
        <path d={line("invested")} fill="none" stroke="#fbbf24" strokeWidth="1.5" />
        {hp && (
          <line
            x1={hx}
            y1={PAD}
            x2={hx}
            y2={H - PAD}
            stroke="#71717a"
            strokeWidth="0.75"
            strokeDasharray="2 2"
          />
        )}
      </svg>
      {hp && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-y-1 whitespace-nowrap rounded border border-zinc-700 bg-zinc-900/95 px-2 py-1 text-xs shadow"
          style={{
            left: `${(hx / W) * 100}%`,
            transform: `translateX(${hx / W < 0.5 ? "0.5rem" : "calc(-100% - 0.5rem)"})`,
          }}
        >
          <div className="text-zinc-400">{hp.date}</div>
          <div className="tabular-nums text-emerald-400">valore {fmtEur(hp.value)}</div>
          <div className="tabular-nums text-amber-400">investito {fmtEur(hp.invested)}</div>
          <div className="tabular-nums text-zinc-100">
            guadagno {fmtEur(hp.value - hp.invested)}
          </div>
        </div>
      )}
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{first.date}</span>
        <span className="text-zinc-300">
          {last.date} · guadagno <strong>{eurCompact.format(last.value - last.invested)}</strong>
        </span>
      </div>
    </div>
  );
}

export const CLASS_COLORS: Record<string, string> = {
  Liquidity: "#38bdf8",
  "High Yield Savings": "#22d3ee",
  Bond: "#818cf8",
  Stock: "#34d399",
  p2p: "#fbbf24",
  Pension: "#f472b6",
  Credit: "#a3e635",
  Debt: "#f87171",
  Crypto: "#f7931a",
};

export function AllocationBars({ allocation }: { allocation: Map<string, Decimal> }) {
  const entries = [...allocation.entries()]
    .filter(([, v]) => !v.isZero())
    .sort((a, b) => b[1].toNumber() - a[1].toNumber());
  const total = entries.reduce((s, [, v]) => s + Math.abs(v.toNumber()), 0);
  if (total === 0) return <p className="text-sm text-zinc-600">nessun dato di allocazione</p>;
  return (
    <div className="space-y-1.5">
      {entries.map(([classe, v]) => {
        const pct = Math.abs(v.toNumber()) / total;
        return (
          <div key={classe} className="flex items-center gap-3 text-sm">
            <span className="w-40 truncate text-zinc-400">{classe}</span>
            <div className="h-3 flex-1 overflow-hidden rounded bg-zinc-800">
              <div
                className="h-full"
                style={{
                  width: `${(pct * 100).toFixed(1)}%`,
                  background: CLASS_COLORS[classe] ?? "#a1a1aa",
                }}
              />
            </div>
            <span className="w-20 text-right tabular-nums">{fmtEur(v)}</span>
            <span className="w-12 text-right text-xs text-zinc-500 tabular-nums">
              {(pct * 100).toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export type GroupStats = NonNullable<ReturnType<typeof deriveGroupStats>>;
