import type { HTMLAttributes, ReactNode } from "react";
import styles from "./EmptyState.module.css";

/**
 * Varianti reali osservate nelle viste di apps/web (ADR-0006):
 * box = riquadro centrato a piena larghezza (EmptyChartNote in
 * Patrimonio/charts), inline = paragrafo muted inline. L'azione
 * opzionale (es. "Aggiungi obiettivo" nella vista Goals) va sotto.
 */
export type EmptyStateVariant = "box" | "inline";

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  variant?: EmptyStateVariant;
  /** Azione opzionale mostrata sotto il messaggio (es. un Button). */
  action?: ReactNode;
}

/**
 * Stato vuoto presentazionale del catalogo. Nessuno stato di dominio:
 * messaggio e azione arrivano via props, lo styling consuma solo i token
 * via CSS Modules.
 */
export function EmptyState({
  variant = "inline",
  action,
  className,
  children,
  ...rest
}: EmptyStateProps) {
  const classes = [styles.base, styles[variant], className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...rest}>
      <div className={styles.message}>{children}</div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
