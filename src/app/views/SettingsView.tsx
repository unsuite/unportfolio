import { pickDirectory } from "../fs/fileSystem";
import { useApp } from "../store/selectors";
import { logout, openStore } from "../store/store";

export function SettingsView() {
  const s = useApp();

  async function changeFolder() {
    const store = await pickDirectory();
    await openStore(store);
  }

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
    </div>
  );
}
