import { type KeyboardEvent, type ReactNode, useId, useState } from "react";
import styles from "./Tooltip.module.css";

/**
 * Tooltip presentazionale e accessibile — sostituisce l'attributo `title=`
 * nativo (ADR-0006, PDR-0001). Mostra il contenuto su hover E su focus da
 * tastiera, si chiude con Escape, ed espone `role="tooltip"` con
 * `aria-describedby` sul trigger. Nessuno stato di dominio: contenuto e trigger
 * arrivano via props.
 */
export interface TooltipProps {
  /** Il contenuto del tooltip (breve). */
  content: ReactNode;
  /** L'elemento che fa da trigger (bottone, icona, testo…). */
  children: ReactNode;
  /** Lato di comparsa rispetto al trigger. */
  placement?: "top" | "bottom";
}

export function Tooltip({ content, children, placement = "top" }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Escape") setOpen(false);
  };

  return (
    <span
      className={styles.root}
      aria-describedby={id}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={onKeyDown}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        className={[styles.bubble, styles[placement]].join(" ")}
        data-open={open || undefined}
      >
        {content}
      </span>
    </span>
  );
}
