import type { InputHTMLAttributes } from "react";
import styles from "./FileInput.module.css";

/**
 * Input file presentazionale del catalogo. Nessuno stato di dominio: il file
 * scelto arriva al chiamante via onChange, lo styling consuma solo i token via
 * CSS Modules (ADR-0006). Usato per l'import CSV in MovimentiView.
 */
export interface FileInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Etichetta mostrata sopra il campo (es. "File CSV da importare"). */
  label?: string;
}

export function FileInput({ label, className, id, ...rest }: FileInputProps) {
  const classes = [styles.base, className].filter(Boolean).join(" ");

  const field = <input id={id} type="file" className={classes} {...rest} />;

  if (!label) return field;

  return (
    <label className={styles.wrapper} htmlFor={id}>
      <span className={styles.label}>{label}</span>
      {field}
    </label>
  );
}
