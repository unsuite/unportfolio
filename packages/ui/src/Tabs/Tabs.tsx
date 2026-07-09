import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Tabs.module.css";

/**
 * Barra tab presentazionale del catalogo. Deriva dalla nav dello Shell in
 * apps/web (router.tsx) ma SENZA logica di router: se un item ha `href`
 * rende un <a> semplice, altrimenti un <button>. La selezione arriva via
 * props (`activeKey` + `onSelect`); lo styling consuma solo i token (ADR-0006).
 */
export interface TabItem {
  key: string;
  label: ReactNode;
  href?: string;
}

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  items: TabItem[];
  activeKey: string;
  onSelect?: (key: string) => void;
}

export function Tabs({ items, activeKey, onSelect, className, ...rest }: TabsProps) {
  const classes = [styles.base, className].filter(Boolean).join(" ");

  return (
    <div className={classes} role="tablist" {...rest}>
      {items.map((item) => {
        const active = item.key === activeKey;
        const itemClasses = [styles.tab, active ? styles.active : null].filter(Boolean).join(" ");

        if (item.href) {
          return (
            <a
              key={item.key}
              href={item.href}
              role="tab"
              aria-selected={active}
              className={itemClasses}
              onClick={() => onSelect?.(item.key)}
            >
              {item.label}
            </a>
          );
        }

        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={itemClasses}
            onClick={() => onSelect?.(item.key)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
