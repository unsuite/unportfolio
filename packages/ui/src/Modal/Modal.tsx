import { type MouseEvent, type ReactNode, useEffect, useId, useRef } from "react";
import styles from "./Modal.module.css";

/**
 * Dialog modale presentazionale del catalogo (ADR-0006). Porta la vista
 * apps/web/src/app/views/Modal.tsx migliorandone l'a11y: role="dialog",
 * aria-modal, chiusura su Escape e click sullo scrim, focus iniziale sul
 * pannello. Nessuno stato di dominio: intento e contenuto arrivano via props.
 */
export interface ModalProps {
  /** Richiesta di chiusura (Escape o click sullo scrim). */
  onClose: () => void;
  children: ReactNode;
  /** Titolo del dialog: se presente etichetta il pannello via aria-labelledby. */
  title?: ReactNode;
  /** Larghezza massima del pannello (px numerici o valore CSS). */
  maxWidth?: number | string;
}

export function Modal({ onClose, children, title, maxWidth = 640 }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const onScrimMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.scrim} onMouseDown={onScrimMouseDown}>
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "Finestra di dialogo"}
        tabIndex={-1}
        style={{ maxWidth }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
