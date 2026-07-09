import type { AssetRow } from "@unportfolio/core/derive/assets";
import { useState } from "react";
import { fmtPct } from "../store/selectors";
import { updateCommodityMeta } from "../store/store";

/** durata di detenzione in forma compatta: "2,3 anni", "8 mesi", "20 giorni" */
export function holdingLabel(firstFlowDate: string, asOf?: string): string {
  const end = asOf ? Date.parse(asOf) : Date.now();
  const days = (end - Date.parse(firstFlowDate)) / 86_400_000;
  if (days >= 365) {
    const anni = days / 365;
    return `${anni.toLocaleString("it-IT", { maximumFractionDigits: 1 })} anni`;
  }
  if (days >= 60) return `${Math.round(days / 30.44)} mesi`;
  return `${Math.round(days)} giorni`;
}

export function gainColor(v: { isNegative(): boolean } | undefined): string {
  if (!v) return "";
  return v.isNegative() ? "text-red-400" : "text-emerald-400";
}

/** descrizione editabile inline (scrive il metadato `name` della commodity).
 *  L'etichetta visualizzata dell'asset è invece il `nome` del conto patrimonio,
 *  che si modifica dal form del conto (matita "Modifica conto"). */
export function NameEditor({ asset: a }: { asset: AssetRow }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(a.name);

  async function save() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== a.name) await updateCommodityMeta(a.commodity, { name: trimmed });
    setEditing(false);
  }

  if (editing)
    return (
      <span className="flex gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void save()}
          autoFocus
          className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-xs"
        />
        <button
          onClick={() => void save()}
          className="rounded bg-emerald-700 px-2 text-xs hover:bg-emerald-600"
        >
          OK
        </button>
      </span>
    );

  return (
    <button
      onClick={() => {
        setName(a.name);
        setEditing(true);
      }}
      title="Modifica la descrizione (scrive il metadato name in accounts.beancount)"
      className="group max-w-full truncate text-left text-xs text-zinc-500 hover:text-zinc-300"
    >
      {a.name} <span className="opacity-0 group-hover:opacity-100">✎</span>
    </button>
  );
}

/** aliquota CG editabile in forma compatta (per la riga summary). */
export function TaxEditInline({ asset: a }: { asset: AssetRow }) {
  const [editing, setEditing] = useState(false);
  const [tax, setTax] = useState(String(a.taxRate * 100));

  async function save() {
    const v = Number(tax.replace(",", "."));
    if (!Number.isNaN(v) && v >= 0 && v <= 100)
      await updateCommodityMeta(a.commodity, { "tax-rate": String(v / 100) });
    setEditing(false);
  }

  if (editing)
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <span className="text-zinc-500">Tassa CG</span>
        <input
          value={tax}
          onChange={(e) => setTax(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void save()}
          autoFocus
          className="w-12 rounded border border-zinc-600 bg-zinc-800 px-1 py-0.5 text-right tabular-nums"
        />
        <span className="text-zinc-500">%</span>
        <button
          onClick={() => void save()}
          className="rounded bg-emerald-700 px-1.5 hover:bg-emerald-600"
        >
          OK
        </button>
      </span>
    );

  return (
    <button
      onClick={() => {
        setTax(String(a.taxRate * 100));
        setEditing(true);
      }}
      title="Modifica l'aliquota sul capital gain (scrive tax-rate)"
      className="text-xs text-zinc-500 hover:text-zinc-300"
    >
      Tassa CG {fmtPct(a.taxRate)} ✎
    </button>
  );
}
