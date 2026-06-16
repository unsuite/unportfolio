import { useMemo, useState } from "react";
import type { IsoDate } from "../../core/beancount/ast";
import type { PatrimonioAccount, SnapshotEntry } from "../../core/model/config";
import { fmtEur, todayIso } from "../store/selectors";
import { addSnapshotEntries, removeSnapshotEntry } from "../store/store";

/**
 * Snapshot globale: la fotografia del valore dei conti manuali (senza
 * strumento collegato) a una certa data. Si sceglie la data e si compila una
 * riga per conto — precompilata con l'eventuale valore già registrato a quella
 * data. Salva tutte le righe valorizzate in un colpo solo (snapshots.csv).
 */
export function SnapshotForm({
  accounts,
  snapshots,
  onClose,
}: {
  /** conti manuali (senza commodity): gli unici alimentati da snapshot */
  accounts: PatrimonioAccount[];
  snapshots: SnapshotEntry[];
  onClose: () => void;
}) {
  const [date, setDate] = useState<IsoDate>(todayIso());
  // valore digitato per conto; "" = lascia invariato (non scrive nulla)
  const [values, setValues] = useState<Record<string, string>>({});

  // valore già registrato a `date`, e ultimo valore noto prima di `date`
  // (mostrato come placeholder per orientarsi).
  const byAccount = useMemo(() => {
    const m = new Map<string, { atDate?: number; last?: number; lastDate?: IsoDate }>();
    for (const a of accounts) {
      const hist = snapshots
        .filter((e) => e.accountId === a.id)
        .sort((x, y) => x.date.localeCompare(y.date));
      const atDate = hist.find((e) => e.date === date)?.value;
      const before = [...hist].reverse().find((e) => e.date <= date && e.date !== date);
      m.set(a.id, { atDate, last: before?.value, lastDate: before?.date });
    }
    return m;
  }, [accounts, snapshots, date]);

  function fieldValue(id: string): string {
    if (values[id] !== undefined) return values[id]!;
    const atDate = byAccount.get(id)?.atDate;
    return atDate !== undefined ? String(atDate) : "";
  }

  async function save() {
    if (!date) return;
    const entries: SnapshotEntry[] = [];
    for (const a of accounts) {
      const raw = values[a.id];
      if (raw === undefined || raw.trim() === "") continue; // non toccato
      const num = Number(raw.replace(",", "."));
      if (!Number.isFinite(num)) continue;
      entries.push({ date, accountId: a.id, value: num, currency: a.valuta || "EUR" });
    }
    if (entries.length > 0) await addSnapshotEntries(entries);
    onClose();
  }

  if (accounts.length === 0)
    return (
      <div className="w-full rounded border border-zinc-700 bg-zinc-900 p-4 text-sm">
        <div className="mb-3 font-medium">Nuovo snapshot</div>
        <p className="text-zinc-400">
          Nessun conto manuale: gli snapshot servono ai conti senza strumento collegato (asset
          campionati). Crea prima un conto manuale.
        </p>
        <div className="mt-3">
          <button onClick={onClose} className="rounded bg-zinc-700 px-3 py-1.5 hover:bg-zinc-600">
            Chiudi
          </button>
        </div>
      </div>
    );

  return (
    <div className="w-full rounded border border-zinc-700 bg-zinc-900 p-4 text-sm">
      <div className="mb-3 flex items-center justify-between gap-4">
        <span className="font-medium">Nuovo snapshot</span>
        <label className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Data</span>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setValues({});
            }}
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
        </label>
      </div>

      <p className="mb-2 text-xs text-zinc-500">
        Lascia vuoto un conto per non registrarne il valore a questa data. Il grigio è l'ultimo
        valore noto precedente.
      </p>

      <div className="max-h-[50vh] space-y-1 overflow-y-auto">
        {accounts.map((a) => {
          const info = byAccount.get(a.id);
          return (
            <div key={a.id} className="flex items-center gap-3">
              <span className="flex-1 truncate">
                {a.nome}
                {a.owner ? <span className="ml-2 text-xs text-zinc-600">{a.owner}</span> : null}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  inputMode="decimal"
                  value={fieldValue(a.id)}
                  onChange={(e) => setValues((v) => ({ ...v, [a.id]: e.target.value }))}
                  placeholder={info?.last !== undefined ? `${info.last} (${info.lastDate})` : "—"}
                  className="w-36 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-right tabular-nums"
                />
                <span className="w-10 text-xs text-zinc-500">{a.valuta || "EUR"}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => void save()}
          className="rounded bg-emerald-700 px-3 py-1.5 hover:bg-emerald-600"
        >
          Salva snapshot
        </button>
        <button onClick={onClose} className="rounded bg-zinc-700 px-3 py-1.5 hover:bg-zinc-600">
          Annulla
        </button>
      </div>
    </div>
  );
}

/**
 * Editor inline degli snapshot di un singolo conto, per l'accordion del
 * dettaglio: ogni valore registrato è modificabile in loco (clic → input,
 * Invio/blur salva, Esc annulla) o eliminabile.
 */
export function ManualSnapshotEditor({
  account,
  snapshots,
}: {
  account: PatrimonioAccount;
  snapshots: SnapshotEntry[];
}) {
  const entries = snapshots
    .filter((e) => e.accountId === account.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
      {entries.length === 0 && (
        <span className="text-zinc-600">nessuno snapshot — usa “Nuovo snapshot”</span>
      )}
      {entries.map((e) => (
        <SnapshotChip key={e.date} entry={e} />
      ))}
    </div>
  );
}

function SnapshotChip({ entry }: { entry: SnapshotEntry }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(entry.value));

  async function commit() {
    setEditing(false);
    const num = Number(draft.replace(",", "."));
    if (!Number.isFinite(num) || num === entry.value) {
      setDraft(String(entry.value));
      return;
    }
    await addSnapshotEntries([{ ...entry, value: num }]);
  }

  async function remove() {
    if (!window.confirm(`Eliminare lo snapshot del ${entry.date}?`)) return;
    await removeSnapshotEntry(entry.accountId, entry.date);
  }

  return (
    <span className="flex items-center gap-1 tabular-nums">
      <span className="text-zinc-600">{entry.date}</span>
      {editing ? (
        <input
          // biome-ignore lint/a11y/noAutofocus: l'input compare solo dopo il clic dell'utente
          autoFocus
          inputMode="decimal"
          value={draft}
          onChange={(ev) => setDraft(ev.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") void commit();
            if (ev.key === "Escape") {
              setDraft(String(entry.value));
              setEditing(false);
            }
          }}
          className="w-24 rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-right"
        />
      ) : (
        <button
          onClick={() => {
            setDraft(String(entry.value));
            setEditing(true);
          }}
          title="Modifica valore"
          className="rounded px-0.5 hover:bg-zinc-800 hover:text-zinc-200"
        >
          {fmtEur(entry.value)}
        </button>
      )}
      <button
        onClick={() => void remove()}
        title="Elimina"
        className="rounded px-1 text-zinc-600 hover:bg-red-950 hover:text-red-400"
      >
        ×
      </button>
    </span>
  );
}
