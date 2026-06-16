import { useEffect, useState } from "react";
import {
  opfsStore,
  pickDirectory,
  type RestoreResult,
  requestPermission,
  restoreDirectory,
} from "./fs/fileSystem";
import { useApp } from "./store/selectors";
import { dismissNotices, openStore, refreshFromDisk } from "./store/store";
import { GoalsView } from "./views/GoalsView";
import { GuidaView } from "./views/GuidaView";
import { ImportView } from "./views/ImportView";
import { MovimentiView } from "./views/MovimentiView";
import { PatrimonioView } from "./views/PatrimonioView";
import { PensioneView } from "./views/PensioneView";
import { PricesView } from "./views/PricesView";
import { RibilanciamentoView } from "./views/RibilanciamentoView";
import { SettingsView } from "./views/SettingsView";

const TABS = [
  ["patrimonio", "Patrimonio"],
  ["goals", "Goals"],
  ["pensione", "Pensione"],
  ["ribilanciamento", "Ribilancia"],
  ["movimenti", "Movimenti"],
  ["prezzi", "Prezzi"],
  ["import", "Import"],
  ["impostazioni", "Impostazioni"],
  ["guida", "Guida"],
] as const;

type Tab = (typeof TABS)[number][0];

/** Rileva se l'utente è probabilmente su Windows, per suggerire il comando giusto. */
function isWindows(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent;
  return /win/i.test(platform);
}

export function App() {
  const s = useApp();
  const [tab, setTab] = useState<Tab>("patrimonio");
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
    return <Onboarding restore={restore} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/60 px-6 py-3">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold tracking-tight">unportfolio</h1>
          <nav className="flex gap-1">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`rounded px-3 py-1 text-sm ${
                  tab === id
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      {s.notices.length > 0 && (
        <div
          className="cursor-pointer border-b border-sky-900 bg-sky-950 px-6 py-2 text-sm text-sky-300"
          onClick={dismissNotices}
        >
          {s.notices.map((n, i) => (
            <div key={i}>{n}</div>
          ))}
        </div>
      )}
      <main className="px-6 py-6">
        {tab === "patrimonio" && <PatrimonioView />}
        {tab === "goals" && <GoalsView />}
        {tab === "pensione" && <PensioneView />}
        {tab === "ribilanciamento" && <RibilanciamentoView />}
        {tab === "movimenti" && <MovimentiView />}
        {tab === "prezzi" && <PricesView />}
        {tab === "import" && <ImportView />}
        {tab === "impostazioni" && <SettingsView />}
        {tab === "guida" && <GuidaView />}
      </main>
    </div>
  );
}

function Onboarding({ restore }: { restore: RestoreResult | undefined }) {
  const [error, setError] = useState<string>();
  const [win, setWin] = useState(isWindows);

  async function pick() {
    try {
      const store = await pickDirectory();
      await openStore(store);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(String(e));
    }
  }

  async function regrant() {
    if (restore?.status !== "needs-permission") return;
    const store = await requestPermission(restore.handle);
    if (store) await openStore(store);
  }

  async function demo() {
    await openStore(await opfsStore());
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
          <button
            onClick={regrant}
            className="w-full rounded bg-emerald-700 px-4 py-2 font-medium hover:bg-emerald-600"
          >
            Riapri la cartella dati ({restore.handle.name})
          </button>
        ) : null}
        <button
          onClick={pick}
          className="w-full rounded bg-zinc-700 px-4 py-2 font-medium hover:bg-zinc-600"
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
              ? `irm ${window.location.origin}/init.ps1 | iex`
              : `curl -fsSL ${window.location.origin}/init.sh | sh -s -- ~/Documents/unportfolio-data`}
          </code>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <p className="text-xs text-zinc-600">Richiede Chrome/Edge (File System Access API).</p>
      </div>
    </div>
  );
}
