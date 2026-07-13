import type { HTMLAttributes, ReactNode } from "react";
import styles from "./DeltaText.module.css";

/**
 * DeltaText — numero/testo colorato per segno ("semaforo"), presentazionale.
 * Centralizza la logica deltaClass/gainColor osservata nelle viste di
 * apps/web (Patrimonio, Goals, Ribilanciamento, AssetDetail): >0 verde,
 * <0 rosso, 0 muted (ADR-0006). Nessun dato di dominio: il segno arriva da
 * `value` (un number) o da `sign`, e il contenuto già formattato via
 * children. Con value null/undefined mostra un trattino em in muted.
 */

/** Segno del delta: positivo, nullo, negativo. */
export type DeltaTone = 1 | 0 | -1;

/**
 * Deriva il tono ("semaforo") da un number: >0 → 1, <0 → -1, 0 → 0.
 * NaN è trattato come nullo. Riutilizzabile ovunque serva la stessa
 * mappa segno→colore senza dipendere dal componente.
 */
export function deltaTone(n: number): DeltaTone {
  if (Number.isNaN(n) || n === 0) return 0;
  return n > 0 ? 1 : -1;
}

export interface DeltaTextProps extends HTMLAttributes<HTMLSpanElement> {
  /** Valore numerico da cui derivare il segno; null/undefined → trattino. */
  value?: number | null;
  /** Segno esplicito, prevale su `value` quando fornito. */
  sign?: DeltaTone;
  /** Attenua il colore (variante meno satura per contesti secondari). */
  muted?: boolean;
  /** Contenuto già formattato (es. "+1.234,56 €", "▲ 3,2%"). */
  children?: ReactNode;
}

const toneClass: Record<DeltaTone, string> = {
  1: "positive",
  0: "zero",
  [-1]: "negative",
};

/**
 * Nessuno stato di dominio: intento (segno) e testo arrivano via props, lo
 * styling consuma solo i token via CSS Modules.
 */
export function DeltaText({
  value,
  sign,
  muted = false,
  className,
  children,
  ...rest
}: DeltaTextProps) {
  const isEmpty = sign === undefined && (value === null || value === undefined);
  const tone: DeltaTone = sign ?? (value === null || value === undefined ? 0 : deltaTone(value));

  const classes = [
    styles.base,
    styles[isEmpty ? "empty" : toneClass[tone]],
    muted ? styles.muted : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...rest}>
      {isEmpty ? "—" : children}
    </span>
  );
}
