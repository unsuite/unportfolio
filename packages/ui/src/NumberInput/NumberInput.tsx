import type { InputHTMLAttributes } from "react";
import styles from "./NumberInput.module.css";

/**
 * Campo numerico presentazionale del catalogo. Come un input di testo ma per
 * numeri: rende <input type="number"> allineato a destra con cifre tabellari
 * (ADR-0006). Nessuno stato di dominio: il valore arriva via props (number),
 * lo styling consuma solo i token via CSS Modules. step/min/max/inputMode
 * sono attributi HTML nativi passati direttamente all'input.
 */
export interface NumberInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Segnala un valore non valido (bordo negativo, aria-invalid). */
  invalid?: boolean;
}

export function NumberInput({
  invalid = false,
  type = "number",
  inputMode = "decimal",
  className,
  ...rest
}: NumberInputProps) {
  const classes = [styles.input, invalid ? styles.invalid : null, className]
    .filter(Boolean)
    .join(" ");

  return (
    <input
      type={type}
      inputMode={inputMode}
      className={classes}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}
