import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Banner.module.css";

/**
 * Toni d'avviso reali osservati nelle viste di apps/web (ADR-0006):
 * error = errore bloccante (Movimenti/router), warning = ambra (attenzione),
 * success = esito positivo (verde), info = informativo (azzurro). Mapping ai
 * token semantici: error→negative, warning→warning, success→positive,
 * info→info.
 */
export type BannerTone = "error" | "warning" | "success" | "info";

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  tone: BannerTone;
  /** Solo testo colorato, senza box tinto (variante compatta). */
  inline?: boolean;
  /** Azione contestuale (es. un Button "Riprova"/"Ignora"). */
  action?: ReactNode;
  /** Icona a sinistra del contenuto. */
  icon?: ReactNode;
  /** Titolo in grassetto sopra il contenuto. */
  title?: string;
  children?: ReactNode;
}

/**
 * Avviso presentazionale del catalogo. Nessuno stato di dominio: tono e dati
 * arrivano via props, lo styling consuma solo i token via CSS Modules.
 */
export function Banner({
  tone,
  inline = false,
  action,
  icon,
  title,
  className,
  children,
  ...rest
}: BannerProps) {
  if (inline) {
    const classes = [styles.inline, styles[tone], className].filter(Boolean).join(" ");
    return (
      <p className={classes} role={tone === "error" ? "alert" : "status"} {...rest}>
        {children}
      </p>
    );
  }

  const classes = [styles.box, styles[tone], className].filter(Boolean).join(" ");

  return (
    <div className={classes} role={tone === "error" ? "alert" : "status"} {...rest}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <div className={styles.content}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.body}>{children}</div>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
