import type { AnchorHTMLAttributes } from "react";
import styles from "./Link.module.css";

/**
 * Varianti d'intento reali osservate nelle viste di apps/web (ADR-0006):
 * accent = link d'azione (Settings), muted = riferimento discreto in
 * monospace (VersionFooter). external aggiunge target/rel di sicurezza.
 */
export type LinkVariant = "accent" | "muted";

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: LinkVariant;
  /** Apre in una nuova scheda con rel="noreferrer". */
  external?: boolean;
}

/**
 * Ancora presentazionale del catalogo. Nessuno stato di dominio: intento e
 * dati arrivano via props, lo styling consuma solo i token via CSS Modules.
 */
export function Link({
  variant = "accent",
  external = false,
  className,
  children,
  ...rest
}: LinkProps) {
  const classes = [styles.base, styles[variant], className].filter(Boolean).join(" ");

  const externalProps = external ? { target: "_blank", rel: "noreferrer" } : {};

  return (
    <a className={classes} {...externalProps} {...rest}>
      {children}
    </a>
  );
}
