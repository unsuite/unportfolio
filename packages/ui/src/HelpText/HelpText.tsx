import type { HTMLAttributes, ReactNode } from "react";
import styles from "./HelpText.module.css";

/**
 * Toni reali osservati nelle viste di apps/web (ADR-0006):
 * muted = hint/caption neutra (zinc muted), warning = avviso ambra
 * (riallineo file gestiti, dati incompleti).
 */
export type HelpTextTone = "muted" | "warning";

export type HelpTextSize = "xs" | "sm";

export interface HelpTextProps extends HTMLAttributes<HTMLParagraphElement> {
  tone?: HelpTextTone;
  size?: HelpTextSize;
  children: ReactNode;
}

/**
 * Testo di aiuto/caption presentazionale (hint form, legende). Nessuno stato
 * di dominio: tono e testo arrivano via props, lo styling consuma solo i
 * token via CSS Modules.
 */
export function HelpText({
  tone = "muted",
  size = "xs",
  className,
  children,
  ...rest
}: HelpTextProps) {
  const classes = [styles.base, styles[tone], styles[size], className].filter(Boolean).join(" ");

  return (
    <p className={classes} {...rest}>
      {children}
    </p>
  );
}
