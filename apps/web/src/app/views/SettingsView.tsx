import { dataVersionLabel, formatStatus } from "@unportfolio/core/config/format";
import { useState } from "react";
import { pickDirectory } from "../fs/fileSystem";
import { useApp } from "../store/selectors";
import { logout, migrateStore, openStore } from "../store/store";
import {
  APP_BUILD_TIME,
  APP_SHA,
  APP_VERSION,
  COMMITS_URL,
  checkLatest,
  commitUrl,
  releaseUrl,
  type UpdateCheck,
} from "../version";

export function SettingsView() {
  const s = useApp();
  const [update, setUpdate] = useState<UpdateCheck>();
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [migrating, setMigrating] = useState(false);

  async function changeFolder() {
    const store = await pickDirectory();
    await openStore(store);
  }

  async function updateFolder() {
    if (migrating) return;
    setMigrating(true);
    await migrateStore();
    setMigrating(false);
  }

  // comando di aggiornamento cartella: stessa origine dell'app (in dev
  // localhost, in prod il sito deployato) + base path del bundle
  const updateCmd = `curl -fsSL ${window.location.origin}${import.meta.env.BASE_URL}init.sh | sh -s -- "${s.config.percorsoDati ?? "<cartella-dati>"}"`;

  async function copyCmd() {
    try {
      await navigator.clipboard.writeText(updateCmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  // la revisione «supportata dall'app» resta interna (DATA_FORMAT): non la
  // mostriamo, segnaliamo solo quando la revisione della cartella non è gestibile
  const status = formatStatus(s.dataFormat);

  async function checkUpdate() {
    if (checking) return;
    setChecking(true);
    setUpdate(undefined);
    setUpdate(await checkLatest());
    setChecking(false);
  }

  const builtOn = APP_BUILD_TIME
    ? new Date(APP_BUILD_TIME).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="max-w-2xl space-y-6 text-sm">
      <section>
        <h2 className="mb-2 text-lg font-semibold">Cartella dati</h2>
        <div className="flex items-center gap-3">
          <span className="rounded bg-zinc-800 px-3 py-1.5 font-mono text-xs">
            {s.store?.label ?? "nessuna"}
          </span>
          <button
            onClick={changeFolder}
            className="rounded bg-zinc-700 px-3 py-1.5 hover:bg-zinc-600"
          >
            Cambia cartella
          </button>
          <button
            onClick={() => void logout()}
            className="rounded border border-red-900 px-3 py-1.5 text-red-400 hover:bg-red-950"
          >
            Esci
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-600">
          "Esci" dimentica la cartella e torna alla schermata iniziale: i file su disco restano
          intatti.
        </p>
        {s.store?.kind === "opfs" && (
          <p className="mt-2 text-xs text-amber-400">
            Modalità demo: i dati vivono solo nel browser. Scegli una cartella per averli come file
            versionabili.
          </p>
        )}
        <p className="mt-2 text-xs text-zinc-500">
          Il ledger è beancount valido: puoi verificarlo con{" "}
          <code>bean-check ledger/main.beancount</code> o esplorarlo con fava.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Formato dati</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded bg-zinc-800 px-3 py-1.5 font-mono text-xs">
            Versione Dati Cartella: {dataVersionLabel(s.dataFormat)}
          </span>
          {status === "richiesto" && (
            <span className="text-xs text-red-400">
              non supportata da questa app — aggiorna la cartella
            </span>
          )}
          {status === "app-vecchia" && (
            <span className="text-xs text-amber-400">
              più recente di questa app — aggiorna l'app
            </span>
          )}
          {/* sempre disponibile per ri-sincronizzare i file gestiti; nascosto solo
              se è l'app a essere indietro (ri-migrare declasserebbe il marcatore) */}
          {status !== "app-vecchia" && (
            <button
              onClick={updateFolder}
              disabled={migrating || s.busy}
              className="rounded bg-zinc-700 px-3 py-1.5 hover:bg-zinc-600 disabled:opacity-50"
            >
              {migrating ? "Aggiorno…" : status === "ok" ? "Ri-sincronizza" : "Aggiorna cartella"}
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          "Aggiorna cartella" allinea i file gestiti (es. <code>AGENTS.md</code>) e applica le
          migrazioni, senza toccare i tuoi dati. Lo stesso da terminale:
        </p>
        <div className="mt-1 flex items-start gap-2">
          <code className="flex-1 overflow-x-auto rounded bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
            {updateCmd}
          </code>
          <button
            onClick={() => void copyCmd()}
            className="shrink-0 rounded bg-zinc-700 px-3 py-2 text-xs hover:bg-zinc-600"
          >
            {copied ? "Copiato" : "Copia"}
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-600">
          Su Windows usa <code>init.ps1</code> al posto di <code>init.sh</code>.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Altre impostazioni</h2>
        <ul className="space-y-1 text-xs text-zinc-500">
          <li>
            <strong className="text-zinc-400">Copertura storico prezzi</strong> (anni / intervallo)
            → tab <strong>Prezzi</strong>
          </li>
          <li>
            <strong className="text-zinc-400">Cascata dell'esubero</strong> →{" "}
            <strong>Grafo di esubero</strong> nella tab Goals
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Versione</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded bg-zinc-800 px-3 py-1.5 font-mono text-xs">
            {APP_VERSION === "dev" ? (
              "dev"
            ) : (
              <a
                href={releaseUrl(APP_VERSION)}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline"
              >
                v{APP_VERSION}
              </a>
            )}
          </span>
          {APP_SHA !== "dev" && (
            <a
              href={commitUrl(APP_SHA)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-zinc-500 hover:underline"
            >
              {APP_SHA}
            </a>
          )}
          {builtOn && <span className="text-xs text-zinc-500">build del {builtOn}</span>}
          <button
            onClick={checkUpdate}
            disabled={checking}
            className="rounded bg-zinc-700 px-3 py-1.5 hover:bg-zinc-600 disabled:opacity-50"
          >
            {checking ? "Controllo…" : "Controlla aggiornamenti"}
          </button>
          <a
            href={COMMITS_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-sky-400 hover:underline"
          >
            ultima versione su GitHub →
          </a>
        </div>
        {update?.status === "current" && (
          <p className="mt-2 text-xs text-emerald-400">Sei aggiornato all'ultima versione.</p>
        )}
        {update?.status === "stale" && (
          <p className="mt-2 text-xs text-amber-400">
            {update.version !== "?" && update.version !== APP_VERSION
              ? `È disponibile la versione v${update.version}. `
              : `È disponibile una build più recente (${update.sha}). `}
            Ricarica la pagina per aggiornare.
          </p>
        )}
        {update?.status === "error" && (
          <p className="mt-2 text-xs text-zinc-500">
            Impossibile verificare ora ({update.message}).
          </p>
        )}
      </section>
    </div>
  );
}
