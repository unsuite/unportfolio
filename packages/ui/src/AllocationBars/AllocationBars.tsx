import type { HTMLAttributes } from "react";
import styles from "./AllocationBars.module.css";

/**
 * Barre di allocazione orizzontali (portata da AllocationBars di apps/web,
 * ADR-0006). Presentazionale e puro: i dati arrivano come number via props,
 * niente Decimal/Map. Ogni riga mostra label, barra proporzionale al valore
 * sul totale e il valore stesso; il colore è quello dell'item oppure un ciclo
 * sulla palette categorica --chart-1..8.
 */

export interface AllocationItem {
  label: string;
  /** Valore assoluto usato per la larghezza della barra. */
  value: number;
  /** Colore esplicito della barra; senza, cicla su --chart-1..8. */
  color?: string;
}

export interface AllocationBarsProps extends HTMLAttributes<HTMLDivElement> {
  items: AllocationItem[];
  /** Formatta il valore mostrato a destra (default: toLocaleString it-IT). */
  formatValue?: (value: number) => string;
}

const CHART_TOKENS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

const defaultFormat = (value: number) => value.toLocaleString("it-IT");

/**
 * Componente presentazionale del catalogo. Nessuno stato di dominio: lo
 * styling consuma solo i token via CSS Modules.
 */
export function AllocationBars({
  items,
  formatValue = defaultFormat,
  className,
  ...rest
}: AllocationBarsProps) {
  // Come l'originale (charts.tsx): scarta i valori nulli e ordina per quota
  // decrescente, così le fette più grandi vengono prima e non compaiono righe
  // vuote allo 0%.
  const entries = items
    .filter((item) => item.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const total = entries.reduce((sum, item) => sum + Math.abs(item.value), 0);

  const classes = [styles.base, className].filter(Boolean).join(" ");

  if (total === 0) {
    return (
      <div className={classes} {...rest}>
        <p className={styles.empty}>nessun dato di allocazione</p>
      </div>
    );
  }

  return (
    <div className={classes} {...rest}>
      {entries.map((item, index) => {
        const pct = (Math.abs(item.value) / total) * 100;
        const fill = item.color ?? CHART_TOKENS[index % CHART_TOKENS.length];
        return (
          <div key={item.label} className={styles.row}>
            <span className={styles.label}>{item.label}</span>
            <div className={styles.track}>
              <div
                className={styles.fill}
                style={{ width: `${pct.toFixed(1)}%`, backgroundColor: fill }}
              />
            </div>
            <span className={styles.value}>{formatValue(item.value)}</span>
            <span className={styles.percent}>{pct.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}
