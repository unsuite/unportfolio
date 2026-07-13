import type { HTMLAttributes, ReactNode } from "react";
import styles from "./StatTile.module.css";

/**
 * Tessera metrica label+valore. Primitiva presentazionale osservata come
 * SummaryMetric in Patrimonio e come KPI in Pensione/Movimenti (ADR-0006).
 * Il tono colora solo il valore; i dati numerici arrivano formattati via
 * props, lo styling consuma solo i token via CSS Modules.
 */
export type StatTileTone = "default" | "positive" | "negative" | "muted";

export type StatTileSize = "sm" | "lg";

export interface StatTileProps extends HTMLAttributes<HTMLDivElement> {
  /** Etichetta descrittiva, mostrata sopra il valore. */
  label: ReactNode;
  /** Valore della metrica, reso con cifre tabulari. */
  value: ReactNode;
  /** Colora il valore secondo l'intento (default = colore testo pieno). */
  tone?: StatTileTone;
  size?: StatTileSize;
}

/**
 * Tessera metrica presentazionale del catalogo. Nessuno stato di dominio:
 * label e valore arrivano già formattati via props.
 */
export function StatTile({
  label,
  value,
  tone = "default",
  size = "sm",
  className,
  ...rest
}: StatTileProps) {
  const classes = [styles.base, styles[size], className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...rest}>
      <span className={styles.label}>{label}</span>
      <span className={[styles.value, styles[tone]].filter(Boolean).join(" ")}>{value}</span>
    </div>
  );
}
