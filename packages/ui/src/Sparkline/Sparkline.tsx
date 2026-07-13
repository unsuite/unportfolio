import type { HTMLAttributes, SVGAttributes } from "react";
import styles from "./Sparkline.module.css";

/**
 * Mini trend SVG presentazionale (ADR-0006). Nessuno stato di dominio: la
 * serie numerica arriva via props come number[], il colore deriva dal segno
 * (ultimo >= primo = positivo, altrimenti negativo). Reale in PatrimonioView,
 * oggi inline. Con meno di 2 punti rende un placeholder "—".
 */
export interface SparklineProps extends Omit<SVGAttributes<SVGSVGElement>, "values"> {
  /** Serie di valori nell'ordine temporale (dal più vecchio al più recente). */
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
}

/**
 * Normalizza i valori nel box e restituisce il path SVG della polilinea.
 */
function buildPath(values: number[], width: number, height: number): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function Sparkline({
  values,
  width = 80,
  height = 22,
  strokeWidth = 1.5,
  className,
  ...rest
}: SparklineProps) {
  const classes = [styles.base, className].filter(Boolean).join(" ");

  if (values.length < 2) {
    return (
      <span
        className={[styles.placeholder, className].filter(Boolean).join(" ")}
        {...(rest as HTMLAttributes<HTMLSpanElement>)}
      >
        —
      </span>
    );
  }

  const positive = (values.at(-1) ?? 0) >= (values.at(0) ?? 0);
  const trendClass = positive ? styles.positive : styles.negative;

  return (
    <svg
      className={[classes, trendClass].join(" ")}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-hidden="true"
      {...rest}
    >
      <path
        d={buildPath(values, width, height)}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
