import type { ReactNode } from "react";
import styles from "./SegmentedControl.module.css";

/**
 * Toggle a segmenti presentazionale del catalogo. Nessuno stato di dominio:
 * opzioni, valore selezionato e handler arrivano via props, lo styling consuma
 * solo i token via CSS Modules (ADR-0006). Reali nelle viste di Patrimonio:
 * Valore/Rendimento/Investito, Prezzo/Investito, range 1M/3M/6M/1A/YTD/Max.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export type SegmentedControlSize = "sm" | "md";

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: SegmentedControlSize;
  /** Etichetta accessibile del gruppo di segmenti. */
  "aria-label"?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  "aria-label": ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const classes = [styles.base, styles[size], className].filter(Boolean).join(" ");

  return (
    <div className={classes} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={[styles.item, active ? styles.active : null].filter(Boolean).join(" ")}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
