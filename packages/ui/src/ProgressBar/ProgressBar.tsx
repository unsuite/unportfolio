import type { HTMLAttributes } from "react";
import styles from "./ProgressBar.module.css";

/**
 * Toni reali osservati nelle viste di apps/web (ADR-0006): auto = il tono
 * dipende dal valore (warning finché < 1, positive a copertura piena),
 * positive = sempre verde, warning = sempre ambra. Usati da CoverageBar
 * (Pensione), CompletionBar (Goals) e dalla barra dell'EsuberoGraph.
 */
export type ProgressBarTone = "auto" | "positive" | "warning";

export type ProgressBarHeight = "sm" | "md";

export type ProgressBarRounded = "md" | "full";

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Avanzamento normalizzato 0..1 (viene sempre clampato a [0, 1]). */
  value: number;
  tone?: ProgressBarTone;
  /** Mostra la percentuale a fianco della traccia (tabular-nums). */
  showLabel?: boolean;
  height?: ProgressBarHeight;
  rounded?: ProgressBarRounded;
}

/**
 * Barra di avanzamento/meter presentazionale del catalogo. Nessuno stato di
 * dominio: il valore arriva come number via props, lo styling consuma solo i
 * token via CSS Modules.
 */
export function ProgressBar({
  value,
  tone = "auto",
  showLabel = false,
  height = "md",
  rounded = "full",
  className,
  ...rest
}: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const resolvedTone: "positive" | "warning" =
    tone === "auto" ? (clamped < 1 ? "warning" : "positive") : tone;
  const percent = Math.round(clamped * 100);

  const classes = [styles.root, styles[height], className].filter(Boolean).join(" ");

  const trackClasses = [
    styles.track,
    rounded === "full" ? styles.roundedFull : styles.roundedMd,
  ].join(" ");

  const fillClasses = [
    styles.fill,
    styles[resolvedTone],
    rounded === "full" ? styles.roundedFull : styles.roundedMd,
  ].join(" ");

  return (
    <div
      className={classes}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      {...rest}
    >
      <div className={trackClasses}>
        <div className={fillClasses} style={{ width: `${percent}%` }} />
      </div>
      {showLabel && <span className={styles.label}>{percent}%</span>}
    </div>
  );
}
