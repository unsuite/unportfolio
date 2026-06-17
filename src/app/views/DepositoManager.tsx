import { Settings } from "lucide-react";
import { useState } from "react";
import { sanitizeAccountSegment } from "../../core/import/mapping";
import {
  type BolloPeriodicita,
  DEFAULT_BOLLO_ALIQUOTA,
  type Deposito,
} from "../../core/model/config";
import { useApp } from "../store/selectors";
import { deleteDeposito, renameDeposito, upsertDeposito } from "../store/store";

/** slug pulito per il segmento di account (niente separatori multipli/estremi) */
function slugId(s: string): string {
  return sanitizeAccountSegment(s).replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** valori distinti non vuoti, ordinati */
function distinct(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v && v.trim() !== ""))].sort();
}

/**
 * Form di un conto titoli (creazione o modifica).
 *
 * `id` = segmento di account nel ledger (`Assets:Broker:<id>:…`): per i nuovi è
 * modificabile (auto-suggerito dal nome) e va fissato a `Directa` per agganciare
 * lo storico già importato. Dopo la creazione è immutabile.
 */
export function DepositoForm({
  deposito,
  existingIds,
  onSaved,
  onCancel,
  onDeleted,
}: {
  deposito?: Deposito;
  existingIds: string[];
  onSaved: (id: string) => void;
  onCancel: () => void;
  onDeleted?: () => void;
}) {
  const s = useApp();
  const isNew = !deposito;
  const [nome, setNome] = useState(deposito?.nome ?? "");
  const [owner, setOwner] = useState(deposito?.owner ?? "");
  const [broker, setBroker] = useState(deposito?.broker ?? s.config.defaultBroker ?? "Directa");
  const [id, setId] = useState(deposito?.id ?? "");
  const [idTouched, setIdTouched] = useState(false);
  const [aliquotaPct, setAliquotaPct] = useState(
    String(((deposito?.aliquota ?? DEFAULT_BOLLO_ALIQUOTA) * 100).toFixed(3)).replace(/\.?0+$/, ""),
  );
  const [periodicita, setPeriodicita] = useState<BolloPeriodicita>(
    deposito?.periodicita ?? "annuale",
  );
  const [err, setErr] = useState<string>();

  // elenchi predefiniti (datalist): valori già presenti nel modello
  const owners = distinct([
    ...s.accounts.map((a) => a.owner),
    ...s.goals.map((g) => g.owner),
    ...s.config.depositi.map((d) => d.owner),
  ]);
  const brokers = distinct([s.config.defaultBroker, ...s.config.depositi.map((d) => d.broker)]);

  function onNome(v: string) {
    setNome(v);
    if (isNew && !idTouched) setId(slugId(v));
  }

  async function save() {
    const finalId = id.trim() || slugId(nome);
    if (!nome.trim() || !finalId) {
      setErr("Nome e id sono obbligatori");
      return;
    }
    if (finalId !== deposito?.id && existingIds.includes(finalId)) {
      setErr(`id "${finalId}" già in uso`);
      return;
    }
    setErr(undefined);
    // id cambiato su un conto esistente: migra ledger + aggancia storico
    if (deposito && finalId !== deposito.id) {
      const ok = await renameDeposito(deposito.id, finalId);
      if (!ok) {
        setErr("rinomina id fallita");
        return;
      }
    }
    const aliquota = (Number(aliquotaPct.replace(",", ".")) || 0) / 100;
    await upsertDeposito({
      id: finalId,
      nome: nome.trim(),
      owner: owner.trim(),
      broker: broker.trim(),
      aliquota,
      periodicita,
    });
    onSaved(finalId);
  }

  async function remove() {
    if (!deposito) return;
    if (
      !window.confirm(
        `Eliminare il conto titoli "${deposito.nome}"? Il riferimento verrà rimosso dai conti collegati (lo storico nel ledger resta).`,
      )
    )
      return;
    await deleteDeposito(deposito.id);
    onDeleted?.();
  }

  return (
    <div className="rounded border border-zinc-700 bg-zinc-900/60 p-3 text-sm">
      <div className="mb-2 text-xs font-medium text-zinc-300">
        {isNew ? "Nuovo conto titoli" : `Modifica: ${deposito.nome}`}
      </div>
      <datalist id="owner-options">
        {owners.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <datalist id="broker-options">
        {brokers.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      <div className="grid grid-cols-[1.3fr_1fr_0.9fr_0.6fr_0.8fr] gap-2">
        <label className="block">
          <span className="text-xs text-zinc-500">Nome</span>
          <input
            value={nome}
            onChange={(e) => onNome(e.target.value)}
            placeholder="Directa — Gabriele"
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">Owner</span>
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            list="owner-options"
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">Broker</span>
          <input
            value={broker}
            onChange={(e) => setBroker(e.target.value)}
            list="broker-options"
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">Aliquota %</span>
          <input
            value={aliquotaPct}
            onChange={(e) => setAliquotaPct(e.target.value)}
            inputMode="decimal"
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-right tabular-nums"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">Addebito</span>
          <select
            value={periodicita}
            onChange={(e) => setPeriodicita(e.target.value as BolloPeriodicita)}
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          >
            <option value="annuale">Annuale</option>
            <option value="semestrale">Semestrale</option>
          </select>
        </label>
      </div>
      <label className="mt-2 flex items-center gap-2">
        <span className="text-[11px] text-zinc-500">id (segmento ledger)</span>
        <input
          value={id}
          onChange={(e) => {
            setIdTouched(true);
            setId(slugId(e.target.value));
          }}
          placeholder="Directa"
          className="w-44 rounded border border-zinc-800 bg-zinc-800/60 px-2 py-0.5 font-mono text-xs"
        />
        <span className="text-[11px] text-zinc-600">
          Assets:Broker:<span className="text-zinc-400">{id || "…"}</span>:&lt;ISIN&gt;
          {isNew
            ? " — usa “Directa” per il conto storico"
            : " — cambiandolo rinomino i movimenti e aggancio lo storico"}
        </span>
      </label>
      {err && <div className="mt-1 text-[11px] text-red-400">{err}</div>}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => void save()}
          className="rounded bg-emerald-700 px-3 py-1 text-xs hover:bg-emerald-600"
        >
          {isNew ? "Aggiungi" : "Salva"}
        </button>
        <button
          onClick={onCancel}
          className="rounded bg-zinc-700 px-3 py-1 text-xs hover:bg-zinc-600"
        >
          Annulla
        </button>
        {deposito && onDeleted && (
          <button
            onClick={() => void remove()}
            className="ml-auto rounded border border-red-900 px-3 py-1 text-xs text-red-400 hover:bg-red-950"
          >
            Elimina
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Selettore di conto titoli: select con i depositi + voce "aggiungi"; dopo la
 * selezione compare l'ingranaggio per modificarlo inline. Stato controllato dal
 * parent (`value`/`onChange`), così è riusabile in più viste.
 */
export function DepositoPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const s = useApp();
  const ids = s.config.depositi.map((d) => d.id);
  const selected = s.config.depositi.find((d) => d.id === value);
  const [mode, setMode] = useState<"none" | "add" | "edit">("none");

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={mode === "add" ? "__add__" : value}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__add__") {
              setMode("add");
            } else {
              onChange(v);
              setMode("none");
            }
          }}
          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
        >
          <option value="">— seleziona un conto titoli —</option>
          {s.config.depositi.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome} {d.owner ? `(${d.owner})` : ""}
            </option>
          ))}
          <option value="__add__">+ Aggiungi conto titoli…</option>
        </select>
        {selected && mode === "none" && (
          <button
            onClick={() => setMode("edit")}
            title={`Modifica ${selected.nome}`}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <Settings size={16} />
          </button>
        )}
      </div>

      {mode === "add" && (
        <DepositoForm
          existingIds={ids}
          onSaved={(id) => {
            onChange(id);
            setMode("none");
          }}
          onCancel={() => setMode("none")}
        />
      )}
      {mode === "edit" && selected && (
        <DepositoForm
          deposito={selected}
          existingIds={ids}
          onSaved={() => setMode("none")}
          onCancel={() => setMode("none")}
          onDeleted={() => {
            onChange("");
            setMode("none");
          }}
        />
      )}
    </div>
  );
}
