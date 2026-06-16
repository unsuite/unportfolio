import { Decimal } from "decimal.js";
import { useMemo, useState } from "react";
import type { RebalanceTarget } from "../../core/model/config";
import { fmtEur, fmtPct, useApp, useDerived } from "../store/selectors";
import { saveTargets } from "../store/store";

/**
 * Ribilanciamento (erede del foglio "6. Distribuzione"): per un portfolio,
 * confronta i pesi correnti degli strumenti con i target e calcola gli
 * acquisti ideali data la liquidità da investire.
 */
export function RibilanciamentoView() {
  const s = useApp();
  const { assets } = useDerived();
  const [portfolio, setPortfolio] = useState<string>("");
  const [liquidita, setLiquidita] = useState("0");
  const [editPesi, setEditPesi] = useState<Record<string, string>>();

  // commodity → portfolio dalle righe di patrimonio.toml
  const commoditiesOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const acc of s.accounts) {
      if (!acc.commodity || !acc.portfolio) continue;
      let list = map.get(acc.portfolio);
      if (!list) {
        list = [];
        map.set(acc.portfolio, list);
      }
      list.push(acc.commodity);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.version]);

  // commodity → nome del conto (etichetta visualizzata)
  const nomeByCommodity = useMemo(
    () => new Map(s.accounts.filter((a) => a.commodity).map((a) => [a.commodity!, a.nome])),
    [s.version],
  );

  const portfolios = [...commoditiesOf.keys()].sort();
  const active = portfolio || portfolios[0] || "";
  const members = commoditiesOf.get(active) ?? [];
  const liq = new Decimal(Number(liquidita.replace(",", ".")) || 0);

  const rows = useMemo(() => {
    const targetOf = new Map(
      s.targets.filter((t) => t.portfolio === active).map((t) => [t.commodity, t.peso]),
    );
    const list = members
      .map((commodity) => {
        const asset = assets.find((a) => a.commodity === commodity);
        const corrente = asset?.value ?? new Decimal(0);
        return {
          commodity,
          nome: nomeByCommodity.get(commodity) ?? commodity,
          name: asset?.name ?? commodity,
          corrente,
          peso: targetOf.get(commodity) ?? 0,
        };
      })
      .filter((r) => !r.corrente.isZero() || r.peso > 0);
    const totale = list.reduce((t, r) => t.add(r.corrente), new Decimal(0));
    const totalePesi = list.reduce((t, r) => t + r.peso, 0);
    const futuro = totale.add(liq);
    return {
      list: list.map((r) => {
        const ideale = totalePesi > 0 ? futuro.mul(r.peso / totalePesi) : new Decimal(0);
        return {
          ...r,
          correntePct: totale.isZero() ? 0 : r.corrente.div(totale).toNumber(),
          ideale,
          delta: ideale.minus(r.corrente),
        };
      }),
      totale,
      totalePesi,
      futuro,
    };
  }, [s.targets, members, assets, active, liq]);

  async function savePesi() {
    if (!editPesi) return;
    const others = s.targets.filter((t) => t.portfolio !== active);
    const updated: RebalanceTarget[] = [];
    for (const [commodity, raw] of Object.entries(editPesi)) {
      const v = Number(raw.replace(",", "."));
      if (!Number.isNaN(v) && v > 0) updated.push({ portfolio: active, commodity, peso: v / 100 });
    }
    await saveTargets([...others, ...updated]);
    setEditPesi(undefined);
  }

  if (portfolios.length === 0) {
    return (
      <p className="max-w-xl text-sm text-zinc-400">
        Nessun asset è assegnato a un portfolio. Assegna gli strumenti dalla sidebar della tab
        Assets (select "portfolio"), poi torna qui per impostare i pesi target.
      </p>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select
          value={active}
          onChange={(e) => {
            setPortfolio(e.target.value);
            setEditPesi(undefined);
          }}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5"
        >
          {portfolios.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <label className="ml-2 text-zinc-400">Liquidità da investire</label>
        <input
          value={liquidita}
          onChange={(e) => setLiquidita(e.target.value)}
          className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-right tabular-nums"
        />
        <span className="text-zinc-500">EUR</span>
        {editPesi ? (
          <span className="ml-auto flex gap-2">
            <button
              onClick={() => void savePesi()}
              className="rounded bg-emerald-700 px-3 py-1.5 hover:bg-emerald-600"
            >
              Salva pesi
            </button>
            <button
              onClick={() => setEditPesi(undefined)}
              className="rounded bg-zinc-700 px-3 py-1.5 hover:bg-zinc-600"
            >
              Annulla
            </button>
          </span>
        ) : (
          <button
            onClick={() =>
              setEditPesi(
                Object.fromEntries(rows.list.map((r) => [r.commodity, String(r.peso * 100)])),
              )
            }
            className="ml-auto rounded bg-zinc-700 px-3 py-1.5 hover:bg-zinc-600"
          >
            Modifica pesi target
          </button>
        )}
      </div>

      {rows.totalePesi > 0 && Math.abs(rows.totalePesi - 1) > 0.001 && (
        <p className="text-xs text-amber-400">
          I pesi target sommano a {(rows.totalePesi * 100).toFixed(1)}% — vengono normalizzati al
          100% nel calcolo dell'ideale.
        </p>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700 text-left text-zinc-400 [&>th]:px-2 [&>th]:py-1.5 [&>th]:font-medium">
            <th>Strumento</th>
            <th className="text-right">Corrente</th>
            <th className="text-right">Corrente %</th>
            <th className="text-right">Target %</th>
            <th className="text-right">Ideale</th>
            <th className="text-right">Da comprare</th>
          </tr>
        </thead>
        <tbody>
          {rows.list.map((r) => (
            <tr key={r.commodity} className="border-b border-zinc-800 [&>td]:px-2 [&>td]:py-1.5">
              <td>
                <div className="font-medium">{r.nome}</div>
                <div className="max-w-56 truncate text-xs text-zinc-500">{r.name}</div>
              </td>
              <td className="text-right tabular-nums">{fmtEur(r.corrente)}</td>
              <td className="text-right tabular-nums">{fmtPct(r.correntePct)}</td>
              <td className="text-right tabular-nums">
                {editPesi ? (
                  <input
                    value={editPesi[r.commodity] ?? ""}
                    onChange={(e) => setEditPesi({ ...editPesi, [r.commodity]: e.target.value })}
                    className="w-16 rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 text-right tabular-nums"
                  />
                ) : r.peso > 0 ? (
                  fmtPct(r.peso)
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </td>
              <td className="text-right tabular-nums">{fmtEur(r.ideale)}</td>
              <td
                className={`text-right font-medium tabular-nums ${
                  r.delta.isNegative() ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {fmtEur(r.delta)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-medium [&>td]:px-2 [&>td]:py-2">
            <td>Totale</td>
            <td className="text-right tabular-nums">{fmtEur(rows.totale)}</td>
            <td className="text-right tabular-nums">100%</td>
            <td className="text-right tabular-nums">{(rows.totalePesi * 100).toFixed(1)}%</td>
            <td className="text-right tabular-nums">{fmtEur(rows.futuro)}</td>
            <td className="text-right tabular-nums text-zinc-400">{fmtEur(liq)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="text-xs text-zinc-500">
        Ideale = (totale corrente + liquidità) × peso target normalizzato. "Da comprare" negativo =
        posizione sopra il target (vendere o lasciar diluire coi prossimi versamenti). I pesi vivono
        in targets.toml.
      </p>
    </div>
  );
}
