import type { ReactNode, SelectHTMLAttributes } from "react";
import styles from "./Select.module.css";

/**
 * Props della Select presentazionale. Estende gli attributi nativi del
 * <select> (OMESSO `size`, che confonde con l'idea di dimensione visiva e
 * non è usato nelle viste). Le opzioni arrivano come children <option>;
 * `placeholder` inserisce una voce guida disabilitata in testa (ADR-0006).
 */
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  /** Voce guida disabilitata mostrata quando nessun valore è selezionato. */
  placeholder?: string;
  /** Opzioni <option> / <optgroup> della lista. */
  children?: ReactNode;
}

/**
 * Select stilizzata del catalogo. Nessuno stato di dominio: valore e opzioni
 * arrivano via props, lo styling consuma solo i token via CSS Modules. La
 * freccia è un caret decorativo su un wrapper, con appearance:none sul select.
 */
export function Select({
  placeholder,
  className,
  children,
  disabled,
  defaultValue,
  value,
  ...rest
}: SelectProps) {
  const classes = [styles.select, className].filter(Boolean).join(" ");

  // Con un placeholder e nessun valore imposto, il default punta alla voce
  // guida (value="") così da mostrarla all'apertura.
  const resolvedDefault =
    value === undefined && defaultValue === undefined && placeholder ? "" : defaultValue;

  return (
    <span className={styles.root}>
      <select
        className={classes}
        disabled={disabled}
        value={value}
        defaultValue={resolvedDefault}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <span className={styles.caret} aria-hidden="true">
        ▾
      </span>
    </span>
  );
}
