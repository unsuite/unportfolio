import { RouterProvider } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  opfsStore,
  pickDirectory,
  type RestoreResult,
  requestPermission,
  resetClientState,
  restoreDirectory,
} from "./fs/fileSystem";
import { useInstallPrompt } from "./pwa/install";
import { router } from "./router";
import { useApp } from "./store/selectors";
import { openStore, refreshFromDisk } from "./store/store";
import { VersionFooter } from "./VersionFooter";

/** Rileva se l'utente è probabilmente su Windows, per suggerire il comando giusto. */
function isWindows(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent;
  return /win/i.test(platform);
}

export function App() {
  const s = useApp();
  const [restore, setRestore] = useState<RestoreResult>();

  useEffect(() => {
    void restoreDirectory().then(async (r) => {
      setRestore(r);
      if (r.status === "ok") await openStore(r.store);
    });
  }, []);

  // rileva modifiche esterne quando si torna sull'app
  useEffect(() => {
    const onFocus = () => void refreshFromDisk();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  if (!s.store) {
    return (
      <>
        <Onboarding restore={restore} />
        <VersionFooter />
      </>
    );
  }

  // Store pronto: il guscio + le route (TanStack Router) prendono il controllo.
  return <RouterProvider router={router} />;
}

function Onboarding({ restore }: { restore: RestoreResult | undefined }) {
  const s = useApp();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [error, setError] = useState<string>();
  const [win, setWin] = useState(isWindows);
  // Flag separati: una promessa appesa di un'azione non deve bloccare le altre.
  const [regranting, setRegranting] = useState(false);
  const [picking, setPicking] = useState(false);
  // Su alcuni browser (es. Arc) requestPermission()/showDirectoryPicker possono
  // restare appesi senza mostrare alcun popup: dopo un attimo mostriamo una via
  // d'uscita (picker esplicito o suggerimento di usare Chrome/Edge).
  const [stuckHint, setStuckHint] = useState(false);

  async function pick() {
    if (picking) return;
    setPicking(true);
    try {
      const store = await pickDirectory();
      await openStore(store);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(String(e));
    } finally {
      setPicking(false);
    }
  }

  async function regrant() {
    if (restore?.status !== "needs-permission" || regranting) return;
    // Via primaria: requestPermission() sull'handle salvato — ri-concede il
    // permesso senza riaprire il picker. Se entro 1.5s non risolve (popup mai
    // mostrato), riveliamo la via d'uscita senza congelare la UI.
    setRegranting(true);
    setStuckHint(false);
    const timer = window.setTimeout(() => setStuckHint(true), 1500);
    try {
      console.debug("[unportfolio:fs] regrant: requestPermission", restore.handle.name);
      const store = await requestPermission(restore.handle);
      if (store) {
        await openStore(store);
        return;
      }
      setStuckHint(true);
    } catch (e) {
      console.error("[unportfolio:fs] regrant: errore", e);
      setError(String(e));
      setStuckHint(true);
    } finally {
      window.clearTimeout(timer);
      setRegranting(false);
    }
  }

  async function demo() {
    await openStore(await opfsStore());
  }

  async function unblock() {
    await resetClientState();
    window.location.reload();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="text-2xl font-bold">unportfolio</h1>
        <p className="text-sm text-zinc-400">
          Net worth, goals e portafoglio. I dati vivono in una cartella di file in chiaro (ledger
          beancount + TOML/CSV) che scegli tu.
        </p>
        {restore?.status === "needs-permission" ? (
          <div className="space-y-2">
            <button
              onClick={regrant}
              disabled={regranting}
              className="w-full rounded bg-emerald-700 px-4 py-2 font-medium hover:bg-emerald-600 disabled:opacity-50"
            >
              Riapri la cartella dati… ({restore.handle.name})
            </button>
            {stuckHint ? (
              <div className="space-y-2">
                <p className="text-xs text-amber-400/90">
                  Il browser non ha mostrato il popup del permesso? Sblocca e riparti da una scelta
                  pulita col bottone qui sotto, oppure usa "Scegli la cartella dati…". Alcuni
                  browser (es. Arc) non ricordano il permesso tra i riavvii: per non ri-autorizzare
                  ogni volta apri unportfolio in Chrome/Edge e installa l'app.
                </p>
                <button
                  onClick={unblock}
                  className="w-full rounded border border-amber-800 px-4 py-2 text-sm text-amber-300 hover:bg-amber-950"
                >
                  Sblocca: dimentica e ricarica
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {canInstall ? (
          <div className="rounded border border-sky-900 bg-sky-950/50 p-3">
            <button
              onClick={promptInstall}
              className="w-full rounded bg-sky-700 px-4 py-2 font-medium hover:bg-sky-600"
            >
              Installa l'app
            </button>
            <p className="mt-2 text-xs text-sky-300/80">
              Installandola, il browser ricorda il permesso sulla cartella: niente più "riapri" a
              ogni avvio.
            </p>
          </div>
        ) : null}
        <button
          onClick={pick}
          disabled={picking}
          className="w-full rounded bg-zinc-700 px-4 py-2 font-medium hover:bg-zinc-600 disabled:opacity-50"
        >
          Scegli la cartella dati…
        </button>
        <button
          onClick={demo}
          className="w-full rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
        >
          Prova senza cartella (demo nel browser)
        </button>
        <div className="border-t border-zinc-800 pt-3">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <p className="text-xs text-zinc-500">
              Prima volta? Questo comando crea la cartella dati già configurata (poi selezionala qui
              sopra — il click è richiesto dal browser):
            </p>
            <button
              onClick={() => setWin((w) => !w)}
              className="shrink-0 text-xs text-zinc-500 underline hover:text-zinc-300"
            >
              {win ? "macOS / Linux" : "Windows"}
            </button>
          </div>
          <code className="block overflow-x-auto rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs whitespace-nowrap text-zinc-400 select-all">
            {win
              ? `irm ${window.location.origin}${import.meta.env.BASE_URL}init.ps1 | iex`
              : `curl -fsSL ${window.location.origin}${import.meta.env.BASE_URL}init.sh | sh -s -- ~/Documents/unportfolio-data`}
          </code>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {s.notices.map((n, i) => (
          <p key={i} className="text-sm text-amber-400">
            {n}
          </p>
        ))}
        <p className="text-xs text-zinc-600">Richiede Chrome/Edge (File System Access API).</p>
      </div>
    </div>
  );
}
