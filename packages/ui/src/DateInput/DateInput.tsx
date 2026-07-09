import type { InputHTMLAttributes } from "react";
import styles from "./DateInput.module.css";

/**
 * Campo data presentazionale del catalogo. Nessuno stato di dominio: valore
 * e handler arrivano via props, lo styling consuma solo i token via CSS
 * Modules (ADR-0006). La data viaggia come stringa ISO "YYYY-MM-DD", coerente
 * con l'input nativo type="date"; nessun tipo di dominio o Decimal.
 */
export interface DateInputProps extends InputHTMLAttributes<HTMLInputElement> {
  value?: string;
  onChange?: InputHTMLAttributes<HTMLInputElement>["onChange"];
  disabled?: boolean;
}

export function DateInput({ value, onChange, disabled, className, ...rest }: DateInputProps) {
  const classes = [styles.base, className].filter(Boolean).join(" ");

  return (
    <input
      type="date"
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={classes}
      {...rest}
    />
  );
}
