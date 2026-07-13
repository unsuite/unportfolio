import type { LabelHTMLAttributes, ReactNode } from "react";
import { HelpText } from "../HelpText/HelpText";
import styles from "./FormField.module.css";

/**
 * Layout reali osservati nelle viste di apps/web (ADR-0006):
 * stacked = caption sopra + controllo sotto (ContoForm, SnapshotForm,
 * DepositoManager, Goals), inline = etichetta a sinistra e controllo a
 * destra su una riga (righe compatte di Pensione).
 */
export type FormFieldLayout = "stacked" | "inline";

export interface FormFieldProps extends Omit<LabelHTMLAttributes<HTMLLabelElement>, "children"> {
  /** Testo o nodo dell'etichetta. */
  label: ReactNode;
  layout?: FormFieldLayout;
  /** Mostra un asterisco in --color-negative accanto all'etichetta. */
  required?: boolean;
  /** Nota di aiuto sotto il controllo (resa via HelpText). */
  hint?: ReactNode;
  /** Il controllo di form (input, select, textarea…). */
  children: ReactNode;
}

/**
 * Wrapper etichetta+controllo presentazionale. Nessuno stato di dominio:
 * layout, testo ed eventuale hint arrivano via props, lo styling consuma
 * solo i token via CSS Modules.
 */
export function FormField({
  label,
  layout = "stacked",
  required = false,
  hint,
  htmlFor,
  className,
  children,
  ...rest
}: FormFieldProps) {
  const classes = [styles.base, styles[layout], className].filter(Boolean).join(" ");

  const caption = (
    <span className={styles.caption}>
      {label}
      {required && (
        <span className={styles.required} aria-hidden="true">
          *
        </span>
      )}
    </span>
  );

  // La hint è resa FUORI dal <label>: un <p> non può stare dentro <label> e,
  // col label implicito, finirebbe nel nome accessibile del controllo.
  return (
    <div className={classes}>
      <label className={styles.field} htmlFor={htmlFor} {...rest}>
        <span className={styles.row}>
          {caption}
          <span className={styles.control}>{children}</span>
        </span>
      </label>
      {hint && <HelpText className={styles.hint}>{hint}</HelpText>}
    </div>
  );
}
