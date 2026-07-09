import type { HTMLAttributes } from "react";
import { useRef, useState } from "react";
import { EmptyState } from "../EmptyState/EmptyState";
import styles from "./LineChart.module.css";

/**
 * Grafico a linea/area SVG a 1 serie, presentazionale (ADR-0006). Nessuno
 * stato di dominio: i punti arrivano via props come { label, value }[] con
 * value gia number (nessun Decimal). Traduce il LineChart delle viste dark
 * ai token semantici. Con meno di 2 punti rende un EmptyState.
 */
export interface LineChartPoint {
  /** Etichetta del punto (es. una data) mostrata nel tooltip e nei footer. */
  label: string;
  value: number;
}

export interface LineChartProps extends HTMLAttributes<HTMLDivElement> {
  points: LineChartPoint[];
  /** "eur" = valuta; "pct" = frazione con segno (abilita la zero-line). */
  format?: "eur" | "pct";
  /** Formattatore dei valori nel tooltip e nei footer (default String). */
  formatValue?: (value: number) => string;
}

const VIEW_W = 720;
const VIEW_H = 176;
const PAD = 4;

export function LineChart({
  points,
  format = "eur",
  formatValue = String,
  className,
  ...rest
}: LineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const classes = [styles.base, className].filter(Boolean).join(" ");

  if (points.length < 2) {
    return (
      <EmptyState variant="box" className={className} {...rest}>
        Servono almeno due punti (lancia il CLI prezzi per lo storico)
      </EmptyState>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (VIEW_W - 2 * PAD);
  const y = (v: number) => VIEW_H - PAD - ((v - min) / span) * (VIEW_H - 2 * PAD);
  // linea di riferimento a 0% per il rendimento, se lo zero e nell'intervallo
  const zeroY = format === "pct" && min < 0 && max > 0 ? y(0) : undefined;
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");
  const area =
    `${path} L${x(points.length - 1).toFixed(1)},${VIEW_H - PAD}` +
    ` L${x(0).toFixed(1)},${VIEW_H - PAD} Z`;
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
    <div className={classes} {...rest}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className={styles.svg}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Grafico dell'andamento"
      >
        <defs>
          <linearGradient id="unportfolio-linechart-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className={styles.areaStopTop} />
            <stop offset="100%" className={styles.areaStopBottom} />
          </linearGradient>
        </defs>
        <path d={area} className={styles.area} />
        {zeroY !== undefined && (
          <line
            x1={PAD}
            y1={zeroY}
            x2={VIEW_W - PAD}
            y2={zeroY}
            className={styles.zeroLine}
            strokeDasharray="3 3"
          />
        )}
        <path d={path} className={styles.line} />
        {hp && (
          <g>
            <line
              x1={hx}
              y1={PAD}
              x2={hx}
              y2={VIEW_H - PAD}
              className={styles.crosshair}
              strokeDasharray="2 2"
            />
            <circle cx={hx} cy={hy} r="2.5" className={styles.dot} />
          </g>
        )}
      </svg>
      {hp && (
        <div
          className={styles.tooltip}
          style={{
            left: `${(hx / VIEW_W) * 100}%`,
            transform: `translateX(${hx / VIEW_W < 0.5 ? "0.5rem" : "calc(-100% - 0.5rem)"})`,
          }}
        >
          <div className={styles.tooltipLabel}>{hp.label}</div>
          <div className={styles.tooltipValue}>{formatValue(hp.value)}</div>
        </div>
      )}
      <div className={styles.footer}>
        <span>
          {first.label} · {formatValue(first.value)}
        </span>
        <span className={styles.footerStrong}>
          {last.label} · <strong>{formatValue(last.value)}</strong>
        </span>
      </div>
      <div className={styles.footerMuted}>
        <span>min {formatValue(min)}</span>
        <span>max {formatValue(max)}</span>
      </div>
    </div>
  );
}
