import type { HTMLAttributes, ReactNode } from "react";
import { Sparkline } from "../Sparkline/Sparkline";
import styles from "./LedgerHeader.module.css";

/**
 * Elemento firma del design "Registro" (PDR-0001): la testata del ledger.
 * Il numero-protagonista (patrimonio netto) in font display, il delta in mono,
 * la microriga che ricorda le radici plain-text/beancount, e uno sparkline del
 * trend. Presentazionale e puro: tutto arriva già formattato via props.
 */
export type DeltaTone = "positive" | "negative" | "neutral";

export interface LedgerHeaderProps extends HTMLAttributes<HTMLElement> {
  /** Etichetta sopra il valore. */
  label?: ReactNode;
  /** Valore-protagonista, già formattato (es. "€ 248.320,50"). */
  value: ReactNode;
  /** Variazione, già formattata (es. "+2,4% · +5.780 €"). */
  delta?: ReactNode;
  deltaTone?: DeltaTone;
  /** Microriga secondaria (es. "ledger/*.beancount · aggiornato ora"). */
  sub?: ReactNode;
  /** Serie del trend per lo sparkline (dal più vecchio al più recente). */
  trend?: number[];
}

export function LedgerHeader({
  label = "Patrimonio netto",
  value,
  delta,
  deltaTone = "neutral",
  sub,
  trend,
  className,
  ...rest
}: LedgerHeaderProps) {
  const classes = [styles.root, className].filter(Boolean).join(" ");

  return (
    <section className={classes} {...rest}>
      <div className={styles.main}>
        <div className={styles.label}>{label}</div>
        <div className={styles.value}>{value}</div>
        <div className={styles.rule} />
        {sub && <div className={styles.sub}>{sub}</div>}
      </div>

      <div className={styles.aside}>
        {delta && <span className={[styles.delta, styles[deltaTone]].join(" ")}>{delta}</span>}
        {trend && trend.length > 1 && (
          <Sparkline
            values={trend}
            width={200}
            height={44}
            strokeWidth={2}
            style={{ stroke: "var(--color-accent)" }}
          />
        )}
      </div>
    </section>
  );
}
