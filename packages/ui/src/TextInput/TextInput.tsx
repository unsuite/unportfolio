import type { InputHTMLAttributes } from "react";
import styles from "./TextInput.module.css";

/**
 * Input testo presentazionale del catalogo. Nessuno stato di dominio: i dati
 * arrivano via props (numerici come `number`, mai Decimal), lo styling consuma
 * solo i token via CSS Modules (ADR-0006). `numeric` allinea a destra con cifre
 * tabellari, `mono` usa il font monospazio, `invalid` segnala l'errore col
 * bordo negativo.
 */
export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Allinea a destra e usa cifre tabellari (importi, quantità). */
  numeric?: boolean;
  /** Usa il font monospazio (ISIN, ticker, hash). */
  mono?: boolean;
  /** Segnala un valore non valido col bordo negativo. */
  invalid?: boolean;
}

export function TextInput({
  numeric = false,
  mono = false,
  invalid = false,
  type = "text",
  className,
  ...rest
}: TextInputProps) {
  const classes = [
    styles.input,
    numeric ? styles.numeric : null,
    mono ? styles.mono : null,
    invalid ? styles.invalid : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <input type={type} className={classes} aria-invalid={invalid || undefined} {...rest} />;
}
