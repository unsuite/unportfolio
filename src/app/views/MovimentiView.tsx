import { useState } from "react";
import { depositoSegmentOf } from "../../core/beancount/booking";
import { deriveBolloTitoli } from "../../core/derive/bollo";
import type { ImportFile } from "../../core/import/types";
import { applyImport, type ImportPreview, previewImport } from "../store/importFlow";
import { fmtEur, useApp, useDerived } from "../store/selectors";
import { notify } from "../store/store";
import { DepositoPicker } from "./DepositoManager";

const pctFmt = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 2 });

export function MovimentiView() {
  const s = useApp();
  const { transactions, patrimonio } = useDerived();
  const [deposito, setDeposito] = useState("");
  const [filter, setFilter] = useState("");
  const [file, setFile] = useState<ImportFile>();
  const [preview, setPreview] = useState<ImportPreview>();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  // il conto scelto deve esistere ancora (potrebbe essere stato eliminato)
  const selezione = s.config.depositi.some((d) => d.id === deposito) ? deposito : "";

  function runPreview(f: ImportFile | undefined, dep: string) {
    setError(undefined);
    setPreview(undefined);
    setDone(false);
    if (!f || !dep) return;
    try {
      setPreview(previewImport(f, dep));
    } catch (e) {
      setError(String(e));
    }
  }

  async function onFile(f: File | undefined) {
    setFile(undefined);
    setError(undefined);
    setPreview(undefined);
    setDone(false);
    if (!f) return;
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const text = /\.(csv|txt)$/i.test(f.name) ? new TextDecoder().decode(bytes) : undefined;
      const imp: ImportFile = { name: f.name, bytes };
      if (text !== undefined) imp.text = text;
      setFile(imp);
      runPreview(imp, selezione);
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

  // stima bollo del conto selezionato (valore titoli × aliquota, live)
  const bolloRiga = selezione
    ? deriveBolloTitoli({
        rows: patrimonio.rows,
        depositi: s.config.depositi,
        when: "live",
      }).righe.find((r) => r.id === selezione)
    : undefined;

  // movimenti del solo conto selezionato, poi filtro testo
  const f = filter.trim().toLowerCase();
  const rows = selezione
    ? transactions
        .filter((t) => t.postings.some((p) => depositoSegmentOf(p.account) === selezione))
        .filter(
          (t) =>
            f === "" ||
            t.narration.toLowerCase().includes(f) ||
            t.payee?.toLowerCase().includes(f) ||
            t.postings.some((p) => p.account.toLowerCase().includes(f)),
        )
        .slice()
        .reverse()
    : [];

  return (
    <div className="space-y-5">
      {/* Conto titoli: selezione / aggiunta / modifica */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-200">
          Conto titoli <span className="text-red-400">*</span>
        </h2>
        <DepositoPicker
          value={selezione}
          onChange={(id) => {
            setDeposito(id);
            runPreview(file, id);
          }}
        />
        {bolloRiga && (
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm">
            <span className="font-medium">Bollo titoli stimato</span>
            <span className="tabular-nums">
              <span className="text-xs text-zinc-500">valore </span>
              {fmtEur(bolloRiga.valore)}
            </span>
            <span className="tabular-nums">
              <span className="text-xs text-zinc-500">aliquota </span>
              {pctFmt.format(bolloRiga.aliquota)}
            </span>
            <span className="tabular-nums">
              <span className="text-xs text-zinc-500">bollo/anno </span>
              <span className="font-medium">{fmtEur(bolloRiga.bollo)}</span>
            </span>
          </div>
        )}
      </section>

      {/* Import movimenti nel conto selezionato */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-200">Importa movimenti</h2>
        {!selezione ? (
          <p className="text-sm text-amber-400/90">Seleziona prima un conto titoli.</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-zinc-500">
              Export movimenti Directa (.csv). I movimenti già presenti (stesso{" "}
              <code>import-id</code>) vengono saltati: il re-import è idempotente.
            </p>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="block text-sm file:mr-3 file:rounded file:border-0 file:bg-zinc-700 file:px-3 file:py-1.5 file:text-sm file:text-zinc-100 hover:file:bg-zinc-600"
            />
          </>
        )}
        {error && (
          <div className="mt-2 rounded border border-red-700 bg-red-950 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {preview && (
          <div className="mt-2 rounded border border-zinc-700 bg-zinc-900 p-4 text-sm">
            <div className="mb-2 font-medium">
              {preview.importer.label}{" "}
              <span className="text-xs font-normal text-zinc-500">
                → {s.config.depositi.find((d) => d.id === selezione)?.nome ?? selezione}
              </span>
            </div>
            <ul className="mb-3 space-y-1 text-zinc-300">
              <li>
                <span className="font-semibold text-emerald-400">
                  {preview.newTransactions.length}
                </span>{" "}
                nuove transazioni da importare
              </li>
              <li>
                <span className="font-semibold text-zinc-400">{preview.duplicates}</span> già
                presenti (saltate)
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
          <div className="mt-2 rounded border border-emerald-800 bg-emerald-950 p-3 text-sm text-emerald-300">
            Import completato: movimenti aggiunti a <code>ledger/movimenti.beancount</code>.
          </div>
        )}
      </section>

      {/* Lista movimenti del conto selezionato */}
      <section>
        <div className="mb-3 flex items-center gap-3">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filtra per testo, ticker, conto…"
            disabled={!selezione}
            className="w-80 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm disabled:opacity-50"
          />
          <span className="text-sm text-zinc-500">{rows.length} transazioni</span>
        </div>
        {!selezione ? (
          <p className="text-sm text-zinc-500">
            Seleziona un conto titoli per vederne i movimenti.
          </p>
        ) : (
          <div className="space-y-1">
            {rows.map((t, i) => (
              <details
                key={t.meta["import-id"] ?? i}
                className="rounded border border-zinc-800 bg-zinc-900/50"
              >
                <summary className="flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm">
                  <span className="tabular-nums text-zinc-500">{t.date}</span>
                  <span className="font-medium">{t.payee}</span>
                  <span className="flex-1 truncate text-zinc-300">{t.narration}</span>
                  <span className="tabular-nums">
                    {fmtEur(t.postings.find((p) => p.account.endsWith(":Cash"))?.amount?.number)}
                  </span>
                </summary>
                <div className="border-t border-zinc-800 px-3 py-2 font-mono text-xs text-zinc-400">
                  {t.postings.map((p, j) => (
                    <div key={j} className="flex justify-between">
                      <span>{p.account}</span>
                      <span className="tabular-nums">
                        {p.amount ? `${p.amount.number.toString()} ${p.amount.currency}` : ""}
                        {p.cost?.number ? ` {${p.cost.number.toString()} ${p.cost.currency}}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
