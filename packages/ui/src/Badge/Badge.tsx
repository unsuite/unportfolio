import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Badge.module.css";

/**
 * Varianti reali osservate nelle viste di apps/web (ADR-0006):
 * neutral = pill mono di metadato (es. chiave in Settings), status = testo
 * colorato di stato dal tono (ambra "chiusa", verde "✓"), swatch = quadratino
 * di colore inline (legenda categorie/chart).
 */
export type BadgeVariant = "neutral" | "status" | "swatch";

/** Tono semantico del testo di stato (usato solo dalla variante status). */
export type BadgeTone = "positive" | "warning" | "negative" | "info" | "muted";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  tone?: BadgeTone;
  /** Colore del quadratino (solo variante swatch); qualsiasi valore CSS. */
  color?: string;
  children?: ReactNode;
}

/**
 * Etichetta presentazionale del catalogo. Nessuno stato di dominio: intento e
 * dati arrivano via props, lo styling consuma solo i token via CSS Modules.
 */
export function Badge({
  variant = "neutral",
  tone,
  color,
  className,
  style,
  children,
  ...rest
}: BadgeProps) {
  const classes = [
    styles.base,
    styles[variant],
    variant === "status" && tone ? styles[tone] : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const mergedStyle = variant === "swatch" && color ? { ...style, backgroundColor: color } : style;

  return (
    <span className={classes} style={mergedStyle} {...rest}>
      {children}
    </span>
  );
}
