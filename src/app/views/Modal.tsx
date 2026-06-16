import { type ReactNode, useEffect } from "react";

/** Overlay modale centrato: click fuori o Esc per chiudere, contenuto scrollabile. */
export function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-6"
      onClick={onClose}
    >
      <div className="my-8 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
