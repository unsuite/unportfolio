import { useState } from "react";
import { accountSlug } from "../../core/config/codecs";
import type { PatrimonioAccount, Sezione } from "../../core/model/config";
import { deletePatrimonioAccount, upsertPatrimonioAccount } from "../store/store";

const SEZIONI: { value: Sezione; label: string }[] = [
  { value: "cash", label: "Cash e risparmi" },
  { value: "asset", label: "Assets" },
  { value: "credit", label: "Crediti" },
  { value: "debt", label: "Debiti" },
];

/** Form per creare/modificare una riga del patrimonio (patrimonio.toml). */
export function ContoForm({
  conto,
  draft,
  portfolios,
  onClose,
}: {
  conto: PatrimonioAccount | undefined;
  draft?: Partial<PatrimonioAccount>;
  portfolios: string[];
  onClose: () => void;
}) {
  const base = conto ?? draft;
  const [nome, setNome] = useState(base?.nome ?? "");
  const [sezione, setSezione] = useState<Sezione>(base?.sezione ?? "cash");
  const [tipo, setTipo] = useState(base?.tipo ?? "Liquidity");
  const [owner, setOwner] = useState(base?.owner ?? "");
  const [portfolio, setPortfolio] = useState(base?.portfolio ?? "");
  const [inNetWorth, setInNetWorth] = useState(base?.inNetWorth ?? true);
  const [splitText, setSplitText] = useState(
    base?.split?.map((sp) => `${sp.classe} ${sp.peso * 100}`).join("\n") ?? "",
  );
  const commodity = conto?.commodity ?? draft?.commodity;

  async function save() {
    if (!nome.trim()) return;
    const split = splitText
      .split("\n")
      .map((line) => {
        const m = /^(.+?)\s+([\d.,]+)\s*%?$/.exec(line.trim());
        if (!m) return undefined;
        const peso = Number(m[2]!.replace(",", ".")) / 100;
        return peso > 0 ? { classe: m[1]!.trim(), peso } : undefined;
      })
      .filter((sp): sp is { classe: string; peso: number } => !!sp);
    const next: PatrimonioAccount = {
      id: conto?.id ?? accountSlug(nome, owner || "conto"),
      nome: nome.trim(),
      sezione,
      tipo: tipo.trim() || "Liquidity",
      owner: owner.trim(),
      inNetWorth,
      valuta: conto?.valuta ?? "EUR",
    };
    if (portfolio) next.portfolio = portfolio;
    if (commodity) next.commodity = commodity;
    if (split.length > 0) next.split = split;
    await upsertPatrimonioAccount(next);
    onClose();
  }

  async function remove() {
    if (!conto) return;
    if (!window.confirm(`Eliminare il conto "${conto.nome}" da patrimonio.toml?`)) return;
    await deletePatrimonioAccount(conto.id);
    onClose();
  }

  return (
    <div className="w-full rounded border border-zinc-700 bg-zinc-900 p-4 text-sm">
      <div className="mb-3 font-medium">{conto ? `Modifica: ${conto.nome}` : "Nuovo conto"}</div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-zinc-500">Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">Owner</span>
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">Sezione</span>
          <select
            value={sezione}
            onChange={(e) => setSezione(e.target.value as Sezione)}
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          >
            {SEZIONI.map((sz) => (
              <option key={sz.value} value={sz.value}>
                {sz.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">
            Tipo / classe (Liquidity, Bond, Stock, Pension…)
          </span>
          <input
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">Portfolio / goal</span>
          <select
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          >
            <option value="">— nessuno —</option>
            {portfolios.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-1">
          <input
            type="checkbox"
            checked={inNetWorth}
            onChange={(e) => setInNetWorth(e.target.checked)}
          />
          <span className="text-zinc-400">conta nel net worth</span>
        </label>
        <label className="col-span-2 block">
          <span className="text-xs text-zinc-500">
            Split per classe (conto composito, una riga per classe: es. "Bond 40" e "Stock 60") —
            opzionale
          </span>
          <textarea
            value={splitText}
            onChange={(e) => setSplitText(e.target.value)}
            rows={2}
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 p-2 font-mono text-xs"
          />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => void save()}
          className="rounded bg-emerald-700 px-3 py-1.5 hover:bg-emerald-600"
        >
          Salva
        </button>
        <button onClick={onClose} className="rounded bg-zinc-700 px-3 py-1.5 hover:bg-zinc-600">
          Annulla
        </button>
        {conto && (
          <button
            onClick={() => void remove()}
            className="ml-auto rounded border border-red-900 px-3 py-1.5 text-red-400 hover:bg-red-950"
          >
            Elimina
          </button>
        )}
      </div>
    </div>
  );
}
