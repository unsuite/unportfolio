import type { HTMLAttributes, MouseEvent } from "react";
import { useRef, useState } from "react";
import styles from "./InvestedValueChart.module.css";

/**
 * Grafico a due linee: capitale versato (investito) vs valore di mercato
 * (portato da InvestedValueChart di apps/web, ADR-0006). Il divario tra le due
 * serie è il guadagno; la scala Y è condivisa su entrambe. Presentazionale e
 * puro: i punti arrivano come number via props (niente Decimal/store), lo
 * styling consuma solo i token via CSS Modules. value → --chart-2,
 * investito → --chart-3. Con meno di due punti rende un placeholder.
 */

export interface InvestedValuePoint {
  /** Etichetta dell'asse X (es. una data ISO), mostrata nel tooltip. */
  label: string;
  /** Capitale versato cumulato a quel punto. */
  invested: number;
  /** Valore di mercato a quel punto. */
  value: number;
}

export interface InvestedValueChartProps extends HTMLAttributes<HTMLDivElement> {
  points: InvestedValuePoint[];
  /** Formatta i valori nel tooltip e nel riepilogo (default: it-IT). */
  formatValue?: (value: number) => string;
}

const defaultFormat = (value: number) => value.toLocaleString("it-IT");

const W = 720;
const H = 176;
const PAD = 4;

/**
 * Componente presentazionale del catalogo. Nessuno stato di dominio: lo hover
 * è stato locale, lo styling consuma solo i token via CSS Modules.
 */
export function InvestedValueChart({
  points,
  formatValue = defaultFormat,
  className,
  ...rest
}: InvestedValueChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const classes = [styles.base, className].filter(Boolean).join(" ");

  if (points.length < 2) {
    return (
      <div className={classes} {...rest}>
        <p className={styles.empty}>
          servono almeno due punti (lancia il CLI prezzi per lo storico)
        </p>
      </div>
    );
  }

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

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (points.length - 1)));
  };

  const hp = hover != null ? points[hover] : undefined;
  const hx = hover != null ? x(hover) : 0;

  return (
    <div className={classes} {...rest}>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchValue}`} /> valore
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchInvested}`} /> investito
        </span>
      </div>
      <div className={styles.plot}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={styles.svg}
          role="img"
          aria-label="Valore di mercato contro capitale investito nel tempo"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <path d={line("value")} fill="none" className={styles.lineValue} strokeWidth="1.5" />
          <path
            d={line("invested")}
            fill="none"
            className={styles.lineInvested}
            strokeWidth="1.5"
          />
          {hp && (
            <g>
              <line
                x1={hx}
                y1={PAD}
                x2={hx}
                y2={H - PAD}
                className={styles.crosshair}
                strokeWidth="0.75"
                strokeDasharray="2 2"
              />
              <circle cx={hx} cy={y(hp.value)} r="2.5" className={styles.dotValue} />
              <circle cx={hx} cy={y(hp.invested)} r="2.5" className={styles.dotInvested} />
            </g>
          )}
        </svg>
        {hp && (
          <div
            className={styles.tooltip}
            style={{
              left: `${(hx / W) * 100}%`,
              transform: `translateX(${hx / W < 0.5 ? "0.5rem" : "calc(-100% - 0.5rem)"})`,
            }}
          >
            <div className={styles.tipLabel}>{hp.label}</div>
            <div className={`${styles.tipRow} ${styles.tipValue}`}>
              valore {formatValue(hp.value)}
            </div>
            <div className={`${styles.tipRow} ${styles.tipInvested}`}>
              investito {formatValue(hp.invested)}
            </div>
            <div className={`${styles.tipRow} ${styles.tipGain}`}>
              guadagno {formatValue(hp.value - hp.invested)}
            </div>
          </div>
        )}
      </div>
      <div className={styles.footer}>
        <span>{first.label}</span>
        <span className={styles.footerStrong}>
          {last.label} · guadagno <strong>{formatValue(last.value - last.invested)}</strong>
        </span>
      </div>
    </div>
  );
}
