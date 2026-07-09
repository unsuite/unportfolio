import type { TextareaHTMLAttributes } from "react";
import styles from "./Textarea.module.css";

/**
 * Area di testo multilinea presentazionale del catalogo. Stessa estetica
 * dell'input a riga singola; nessuno stato di dominio, tutto arriva via props
 * e lo styling consuma solo i token via CSS Modules (ADR-0006). La variante
 * mono usa il font monospazio per note/blocchi tecnici (usata in ContoForm).
 */
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Usa il font monospazio (--font-mono) per note tecniche. */
  mono?: boolean;
}

export function Textarea({ mono = false, rows = 2, className, ...rest }: TextareaProps) {
  const classes = [styles.base, mono ? styles.mono : null, className].filter(Boolean).join(" ");

  return <textarea rows={rows} className={classes} {...rest} />;
}
