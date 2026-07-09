import { useEffect, useState } from "react";
import { APP_SHA, APP_VERSION, checkLatest, releaseUrl, type UpdateCheck } from "./version";

/**
 * Footer sempre visibile (onboarding incluso) con la build in esecuzione e un
 * auto-check con la versione deployata: utile per capire, anche da bloccati,
 * se si sta girando il bundle aggiornato o uno stantio ancora in cache.
 */
export function VersionFooter() {
  const [update, setUpdate] = useState<UpdateCheck>();

  useEffect(() => {
    void checkLatest().then(setUpdate);
  }, []);

  return (
    <footer className="fixed right-2 bottom-2 z-40 flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/90 px-2 py-1 font-mono text-[11px] text-zinc-500 backdrop-blur">
      {APP_VERSION === "dev" ? (
        <span>dev</span>
      ) : (
        <a
          href={releaseUrl(APP_VERSION)}
          target="_blank"
          rel="noreferrer"
          title={APP_SHA === "dev" ? undefined : `commit ${APP_SHA}`}
          className="text-zinc-400 hover:underline"
        >
          v{APP_VERSION}
        </a>
      )}
      {update?.status === "current" && <span className="text-emerald-500">✓ aggiornato</span>}
      {update?.status === "stale" && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded bg-amber-700 px-1.5 py-0.5 text-amber-50 hover:bg-amber-600"
          title={`Disponibile ${update.sha}`}
        >
          aggiorna ↻
        </button>
      )}
    </footer>
  );
}
