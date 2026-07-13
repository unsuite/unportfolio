import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButton.module.css";

/**
 * Varianti d'intento reali osservate nelle viste di apps/web (ADR-0006):
 * ghost = azione neutra icona-only (matita "modifica", chevron di espansione),
 * danger = azione distruttiva icona-only (✕ "rimuovi").
 */
export type IconButtonVariant = "ghost" | "danger";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Glifo/icona da rendere come unico contenuto del bottone. */
  icon: ReactNode;
  variant?: IconButtonVariant;
  /** Parte invisibile (opacity 0) finché il genitore non fa hover/focus. */
  revealOnHover?: boolean;
  /** Obbligatorio: usato sia come aria-label sia come tooltip nativo. */
  title: string;
}

/**
 * Pulsante presentazionale icona-only del catalogo. Nessuno stato di dominio:
 * intento e icona arrivano via props, lo styling consuma solo i token via CSS
 * Modules.
 */
export function IconButton({
  icon,
  variant = "ghost",
  revealOnHover = false,
  title,
  type = "button",
  className,
  ...rest
}: IconButtonProps) {
  const classes = [
    styles.base,
    styles[variant],
    revealOnHover ? styles.revealOnHover : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} title={title} aria-label={title} {...rest}>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}
