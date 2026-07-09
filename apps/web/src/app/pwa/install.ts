import { useEffect, useState } from "react";

/**
 * Evento non-standard `beforeinstallprompt` (Chromium): non è nei lib types,
 * lo dichiariamo qui. `prompt()` mostra il dialog nativo di installazione.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** True se l'app gira già come PWA installata (display standalone). */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari espone navigator.standalone
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Gestisce l'installazione PWA. Chrome emette `beforeinstallprompt` quando l'app
 * è installabile; lo intercettiamo per offrire un bottone esplicito. Installare
 * l'app permette a Chromium di conservare il permesso sulla cartella dati tra i
 * riavvii (persistent permissions), eliminando il re-grant a ogni avvio.
 */
export function useInstallPrompt(): {
  canInstall: boolean;
  installed: boolean;
  promptInstall: () => Promise<void>;
} {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent>();
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(undefined);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function promptInstall(): Promise<void> {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    console.debug(`[unportfolio:pwa] install: ${outcome}`);
    // l'evento è usa-e-getta: dopo prompt() Chrome non lo riemette
    setDeferred(undefined);
  }

  return { canInstall: !!deferred && !installed, installed, promptInstall };
}
