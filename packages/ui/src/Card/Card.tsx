import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

/**
 * Varianti di contenitore reali osservate nelle viste di apps/web (ADR-0006):
 * section = riquadro con bordo su fondo trasparente, panel = superficie piena
 * (--color-surface) con bordo, subtle = superficie semitrasparente.
 */
export type CardVariant = "section" | "panel" | "subtle";

export type CardPadding = "none" | "sm" | "md";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  children?: ReactNode;
}

/**
 * Contenitore presentazionale del catalogo. Nessuno stato di dominio: intento
 * e dati arrivano via props, lo styling consuma solo i token via CSS Modules.
 */
export function Card({
  variant = "panel",
  padding = "md",
  className,
  children,
  ...rest
}: CardProps) {
  const classes = [styles.base, styles[variant], styles[`padding-${padding}`], className]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes} {...rest}>
      {children}
    </section>
  );
}
