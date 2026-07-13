import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

/**
 * Varianti d'intento reali osservate nelle viste di apps/web (ADR-0006):
 * accent = azione primaria (emerald "Salva/Conferma"), neutral = azione
 * secondaria (zinc "Annulla/Modifica"), danger = outline distruttivo,
 * dangerSolid = distruttivo pieno, info = azzurro (install/link),
 * warning = ambra, ghost = solo testo.
 */
export type ButtonVariant =
  | "accent"
  | "neutral"
  | "danger"
  | "dangerSolid"
  | "info"
  | "warning"
  | "ghost";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Occupa tutta la larghezza disponibile. */
  fullWidth?: boolean;
  /** Mostra uno spinner e disabilita il click (stato "Aggiorno…/Controllo…"). */
  busy?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

/**
 * Pulsante presentazionale del catalogo. Nessuno stato di dominio: intento e
 * dati arrivano via props, lo styling consuma solo i token via CSS Modules.
 */
export function Button({
  variant = "neutral",
  size = "md",
  fullWidth = false,
  busy = false,
  iconLeft,
  iconRight,
  disabled,
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : null,
    busy ? styles.busy : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && <span className={styles.spinner} aria-hidden="true" />}
      {iconLeft && (
        <span className={styles.icon} aria-hidden="true">
          {iconLeft}
        </span>
      )}
      {children}
      {iconRight && (
        <span className={styles.icon} aria-hidden="true">
          {iconRight}
        </span>
      )}
    </button>
  );
}
