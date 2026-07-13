import type {
  HTMLAttributes,
  KeyboardEvent,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import styles from "./Table.module.css";

/**
 * Primitiva tabella a subcomponenti — presentazionale, nessuno stato di
 * dominio (ADR-0006). I dati numerici arrivano come `number` via props delle
 * viste; qui si compongono solo celle e righe, lo styling consuma i token via
 * CSS Modules. Le viste sorgente sono dark-hardcoded (scala zinc): qui i
 * colori sono tradotti ai token semantici (surface/text/border/muted).
 */

export type CellAlign = "left" | "right";

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {}

export function Table({ className, children, ...rest }: TableProps) {
  const classes = [styles.table, className].filter(Boolean).join(" ");
  return (
    <table className={classes} {...rest}>
      {children}
    </table>
  );
}

export interface THeadProps extends HTMLAttributes<HTMLTableSectionElement> {}

export function THead({ className, children, ...rest }: THeadProps) {
  const classes = [styles.thead, className].filter(Boolean).join(" ");
  return (
    <thead className={classes} {...rest}>
      {children}
    </thead>
  );
}

export interface TBodyProps extends HTMLAttributes<HTMLTableSectionElement> {}

export function TBody({ className, children, ...rest }: TBodyProps) {
  const classes = [styles.tbody, className].filter(Boolean).join(" ");
  return (
    <tbody className={classes} {...rest}>
      {children}
    </tbody>
  );
}

export interface TFootProps extends HTMLAttributes<HTMLTableSectionElement> {}

export function TFoot({ className, children, ...rest }: TFootProps) {
  const classes = [styles.tfoot, className].filter(Boolean).join(" ");
  return (
    <tfoot className={classes} {...rest}>
      {children}
    </tfoot>
  );
}

export interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Riga interattiva: cursore pointer e hover evidenziato. */
  clickable?: boolean;
  /** Riga attenuata (opacity 0.5). */
  muted?: boolean;
}

export function Tr({
  clickable = false,
  muted = false,
  className,
  onClick,
  onKeyDown,
  children,
  ...rest
}: TrProps) {
  const classes = [
    styles.tr,
    clickable ? styles.clickable : null,
    muted ? styles.muted : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const interactive = clickable && Boolean(onClick);

  const handleKeyDown = interactive
    ? (event: KeyboardEvent<HTMLTableRowElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.(event as unknown as Parameters<NonNullable<typeof onClick>>[0]);
        }
        onKeyDown?.(event);
      }
    : onKeyDown;

  return (
    <tr
      className={classes}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={interactive ? 0 : undefined}
      {...rest}
    >
      {children}
    </tr>
  );
}

export interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: CellAlign;
}

export function Th({ align = "left", className, children, ...rest }: ThProps) {
  const classes = [styles.th, align === "right" ? styles.right : null, className]
    .filter(Boolean)
    .join(" ");
  return (
    <th className={classes} {...rest}>
      {children}
    </th>
  );
}

export interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: CellAlign;
  /** Cella numerica: allineata a destra con cifre tabellari. */
  numeric?: boolean;
}

export function Td({ align = "left", numeric = false, className, children, ...rest }: TdProps) {
  const rightAligned = numeric || align === "right";
  const classes = [
    styles.td,
    rightAligned ? styles.right : null,
    numeric ? styles.numeric : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <td className={classes} {...rest}>
      {children}
    </td>
  );
}
