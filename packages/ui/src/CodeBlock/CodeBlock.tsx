import type { HTMLAttributes, ReactNode } from "react";
import styles from "./CodeBlock.module.css";

/**
 * Varianti reali osservate nelle viste di apps/web (ADR-0006):
 * block = comando/terminale su più righe (Prices/Settings/App), reso in
 * <pre> con scroll orizzontale; inline = frammento di codice dentro il testo
 * (InlineCode Movimenti), reso in <code> come pill leggera.
 */
export type CodeBlockVariant = "block" | "inline";

export interface CodeBlockProps extends HTMLAttributes<HTMLElement> {
  variant?: CodeBlockVariant;
  /** Rende l'intero contenuto selezionabile in un colpo (user-select: all). */
  selectAll?: boolean;
  children?: ReactNode;
}

/**
 * Blocco/inline codice presentazionale del catalogo. Nessuno stato di dominio:
 * il testo arriva via children, lo styling consuma solo i token via CSS Modules.
 */
export function CodeBlock({
  variant = "block",
  selectAll = false,
  className,
  children,
  ...rest
}: CodeBlockProps) {
  const classes = [styles.base, styles[variant], selectAll ? styles.selectAll : null, className]
    .filter(Boolean)
    .join(" ");

  if (variant === "inline") {
    return (
      <code className={classes} {...rest}>
        {children}
      </code>
    );
  }

  return (
    <pre className={classes} {...rest}>
      {children}
    </pre>
  );
}
