import { type HTMLAttributes, type ReactNode, useRef, useState } from "react";
import { IconButton } from "../IconButton/IconButton";
import { NumberInput } from "../NumberInput/NumberInput";
import { TextInput } from "../TextInput/TextInput";
import styles from "./InlineEditField.module.css";

/**
 * Campo con toggle display<->edit, osservato nelle viste di apps/web
 * (NameEditor/TaxEditInline in AssetDetail): in display mostra il valore
 * formattato con una matita che si rivela su hover; in edit mostra un input
 * (TextInput o NumberInput) con conferma. Enter conferma, Escape annulla, il
 * blur conferma. Presentazionale: `onCommit` è un callback, nessun dominio —
 * i dati numerici arrivano come `number` via props (ADR-0006).
 */
export interface InlineEditFieldProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "onChange" | "children"> {
  /** Valore corrente; se `numeric`, un number allineato a destra. */
  value: string | number;
  /** Chiamato col testo grezzo dell'input alla conferma. */
  onCommit: (value: string) => void;
  /** Usa NumberInput e cifre tabellari invece di TextInput. */
  numeric?: boolean;
  /** Etichetta opzionale a sinistra del valore. */
  label?: ReactNode;
  /** Suffisso opzionale a destra (es. "%", valuta). */
  suffix?: ReactNode;
  placeholder?: string;
  /** Resa del valore in display (l'edit mostra sempre il valore grezzo). */
  format?: (value: string | number) => string;
}

export function InlineEditField({
  value,
  onCommit,
  numeric = false,
  label,
  suffix,
  placeholder,
  format,
  className,
  ...rest
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const done = useRef(false);

  function startEdit() {
    setDraft(String(value));
    done.current = false;
    setEditing(true);
  }

  function finish(shouldCommit: boolean) {
    if (done.current) return;
    done.current = true;
    setEditing(false);
    if (shouldCommit) onCommit(draft);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") finish(true);
    else if (e.key === "Escape") finish(false);
  }

  const classes = [styles.base, className].filter(Boolean).join(" ");

  if (editing) {
    const Field = numeric ? NumberInput : TextInput;
    return (
      <span className={classes} {...rest}>
        {label && <span className={styles.label}>{label}</span>}
        <Field
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => finish(true)}
          placeholder={placeholder}
          autoFocus
          className={styles.input}
        />
        {suffix && <span className={styles.suffix}>{suffix}</span>}
        <IconButton icon="✓" title="Conferma" onClick={() => finish(true)} />
      </span>
    );
  }

  const shown = format ? format(value) : String(value);
  return (
    <span className={classes} {...rest}>
      {label && <span className={styles.label}>{label}</span>}
      <span className={numeric ? styles.valueNumeric : styles.value}>{shown}</span>
      {suffix && <span className={styles.suffix}>{suffix}</span>}
      <IconButton icon="✎" title="Modifica" revealOnHover onClick={startEdit} />
    </span>
  );
}
