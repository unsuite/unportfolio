import { useState } from "react";
import { applyImport, type ImportPreview, previewImport } from "../store/importFlow";
import { notify } from "../store/store";

export function ImportView() {
  const [preview, setPreview] = useState<ImportPreview>();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  async function onFile(f: File | undefined) {
    setError(undefined);
    setPreview(undefined);
    setDone(false);
    if (!f) return;
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const text = /\.(csv|txt)$/i.test(f.name) ? new TextDecoder().decode(bytes) : undefined;
      const file: { name: string; bytes: Uint8Array; text?: string } = {
        name: f.name,
        bytes,
      };
      if (text !== undefined) file.text = text;
      setPreview(previewImport(file));
    } catch (e) {
      setError(String(e));
    }
  }

  async function confirm() {
    if (!preview) return;
    try {
      await applyImport(preview);
      setDone(true);
      setPreview(undefined);
      notify("import completato");
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-zinc-400">
        Formati supportati: export movimenti Directa (.csv). I movimenti già presenti (stesso{" "}
        <code>import-id</code>) vengono saltati: il re-import è idempotente.
      </p>
      <input
        type="file"
        accept=".csv,.txt"
        onChange={(e) => onFile(e.target.files?.[0])}
        className="block text-sm file:mr-3 file:rounded file:border-0 file:bg-zinc-700 file:px-3 file:py-1.5 file:text-sm file:text-zinc-100 hover:file:bg-zinc-600"
      />
      {error && (
        <div className="rounded border border-red-700 bg-red-950 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {preview && (
        <div className="rounded border border-zinc-700 bg-zinc-900 p-4 text-sm">
          <div className="mb-2 font-medium">{preview.importer.label}</div>
          <ul className="mb-3 space-y-1 text-zinc-300">
            <li>
              <span className="font-semibold text-emerald-400">
                {preview.newTransactions.length}
              </span>{" "}
              nuove transazioni da importare
            </li>
            <li>
              <span className="font-semibold text-zinc-400">{preview.duplicates}</span> già presenti
              (saltate)
            </li>
            <li>
              <span className="font-semibold text-zinc-400">{preview.instruments.length}</span>{" "}
              strumenti nel registro
            </li>
          </ul>
          {preview.warnings.length > 0 && (
            <div className="mb-3 rounded bg-amber-950 p-2 text-xs text-amber-300">
              {preview.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}
          <button
            onClick={confirm}
            disabled={preview.newTransactions.length === 0}
            className="rounded bg-emerald-700 px-4 py-1.5 text-sm hover:bg-emerald-600 disabled:opacity-50"
          >
            Importa
          </button>
        </div>
      )}
      {done && (
        <div className="rounded border border-emerald-800 bg-emerald-950 p-3 text-sm text-emerald-300">
          Import completato: movimenti aggiunti a <code>ledger/movimenti.beancount</code> e conti
          rigenerati in <code>ledger/accounts.beancount</code>.
        </div>
      )}
    </div>
  );
}
