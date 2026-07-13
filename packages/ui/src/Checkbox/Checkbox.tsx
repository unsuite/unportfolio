import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./Checkbox.module.css";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Testo/etichetta cliccabile accanto alla casella. */
  label?: ReactNode;
}

/**
 * Checkbox presentazionale: casella nativa + etichetta, wrappate in un
 * <label> cliccabile. Nessuno stato di dominio: checked/onChange arrivano via
 * props, lo styling consuma solo i token via CSS Modules (ADR-0006).
 */
export function Checkbox({ label, disabled, className, children, ...rest }: CheckboxProps) {
  const classes = [styles.base, disabled ? styles.disabled : null, className]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={classes}>
      <input type="checkbox" className={styles.input} disabled={disabled} {...rest} />
      {(label ?? children) != null && <span className={styles.label}>{label ?? children}</span>}
    </label>
  );
}
