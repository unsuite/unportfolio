import { Decimal } from "decimal.js";
import { useMemo, useState } from "react";
import { rebalance } from "../../core/derive/rebalance";
import type { RebalanceTarget } from "../../core/model/config";
import { fmtEur, fmtPct, useApp, useDerived } from "../store/selectors";
import { saveTargets } from "../store/store";

/** Stato dell'editor pesi: percentuali come stringhe + insiemi dei flag. */
interface EditState {
  peso: Record<string, string>;
  fisso: Set<string>;
  escluso: Set<string>;
}

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
  const [edit, setEdit] = useState<EditState>();

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
      s.targets.filter((t) => t.portfolio === active).map((t) => [t.commodity, t]),
    );
    const meta = members
      .map((commodity) => {
        const asset = assets.find((a) => a.commodity === commodity);
        const t = targetOf.get(commodity);
        return {
          commodity,
          nome: nomeByCommodity.get(commodity) ?? commodity,
          name: asset?.name ?? commodity,
          corrente: asset?.value ?? new Decimal(0),
          peso: t?.peso ?? 0,
          fisso: t?.fisso ?? false,
          escluso: t?.escluso ?? false,
        };
      })
      .filter((r) => !r.corrente.isZero() || r.peso > 0 || r.fisso || r.escluso);
    const result = rebalance(meta, liq);
    const byCommodity = new Map(meta.map((m) => [m.commodity, m]));
    return {
      list: result.rows.map((r) => ({ ...byCommodity.get(r.commodity)!, ...r })),
      totale: result.totale,
      totalePesi: result.totalePesi,
      futuro: result.futuro,
      totaleEscluso: result.totaleEscluso,
    };
  }, [s.targets, members, assets, active, liq]);

  // in edit mode il totale segue gli input digitati (fissi inclusi, esclusi no);
  // fuori dall'editing usa il valore salvato
  const totalePesiLive = edit
    ? rows.list.reduce((sum, r) => {
        if (edit.escluso.has(r.commodity)) return sum;
        const v = Number((edit.peso[r.commodity] ?? "").replace(",", "."));
        return !Number.isNaN(v) && v > 0 ? sum + v / 100 : sum;
      }, 0)
    : rows.totalePesi;

  function startEdit() {
    setEdit({
      peso: Object.fromEntries(
        rows.list.map((r) => [r.commodity, r.peso > 0 ? String(r.peso * 100) : ""]),
      ),
      fisso: new Set(rows.list.filter((r) => r.fisso).map((r) => r.commodity)),
      escluso: new Set(rows.list.filter((r) => r.escluso).map((r) => r.commodity)),
    });
  }

  function toggleFlag(kind: "fisso" | "escluso", commodity: string) {
    if (!edit) return;
    const next = new Set(edit[kind]);
    if (next.has(commodity)) next.delete(commodity);
    else {
      next.add(commodity);
      // fisso ed escluso si escludono a vicenda
      const other = kind === "fisso" ? "escluso" : "fisso";
      if (edit[other].has(commodity)) {
        const otherSet = new Set(edit[other]);
        otherSet.delete(commodity);
        setEdit({ ...edit, [kind]: next, [other]: otherSet });
        return;
      }
    }
    setEdit({ ...edit, [kind]: next });
  }

  async function saveEdit() {
    if (!edit) return;
    const others = s.targets.filter((t) => t.portfolio !== active);
    const updated: RebalanceTarget[] = [];
    for (const r of rows.list) {
      const commodity = r.commodity;
      const fisso = edit.fisso.has(commodity);
      const escluso = edit.escluso.has(commodity);
      const v = Number((edit.peso[commodity] ?? "").replace(",", "."));
      const peso = !Number.isNaN(v) && v > 0 ? v / 100 : 0;
      if (peso <= 0 && !fisso && !escluso) continue;
      const target: RebalanceTarget = { portfolio: active, commodity, peso };
      if (fisso) target.fisso = true;
      if (escluso) target.escluso = true;
      updated.push(target);
    }
    await saveTargets([...others, ...updated]);
    setEdit(undefined);
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
            setEdit(undefined);
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
        {edit ? (
          <span className="ml-auto flex gap-2">
            <button
              onClick={() => void saveEdit()}
              className="rounded bg-emerald-700 px-3 py-1.5 hover:bg-emerald-600"
            >
              Salva pesi
            </button>
            <button
              onClick={() => setEdit(undefined)}
              className="rounded bg-zinc-700 px-3 py-1.5 hover:bg-zinc-600"
            >
              Annulla
            </button>
          </span>
        ) : (
          <button
            onClick={startEdit}
            className="ml-auto rounded bg-zinc-700 px-3 py-1.5 hover:bg-zinc-600"
          >
            Modifica pesi target
          </button>
        )}
      </div>

      {totalePesiLive > 0 && Math.abs(totalePesiLive - 1) > 0.001 && (
        <p className="text-xs text-amber-400">
          I pesi target sommano a {(totalePesiLive * 100).toFixed(1)}% — vengono normalizzati al
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
            {edit ? (
              <>
                <th className="text-right">Fisso</th>
                <th className="text-right">Escluso</th>
              </>
            ) : (
              <>
                <th className="text-right">Ideale</th>
                <th className="text-right">Da comprare</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.list.map((r) => {
            const isFisso = edit ? edit.fisso.has(r.commodity) : r.fisso;
            const isEscluso = edit ? edit.escluso.has(r.commodity) : r.escluso;
            return (
              <tr
                key={r.commodity}
                className={`border-b border-zinc-800 [&>td]:px-2 [&>td]:py-1.5 ${
                  isEscluso ? "text-zinc-500" : ""
                }`}
              >
                <td>
                  <div className="font-medium">{r.nome}</div>
                  <div className="max-w-56 truncate text-xs text-zinc-500">{r.name}</div>
                </td>
                <td className="text-right tabular-nums">{fmtEur(r.corrente)}</td>
                <td className="text-right tabular-nums">
                  {isEscluso ? <span className="text-zinc-600">—</span> : fmtPct(r.correntePct)}
                </td>
                <td className="text-right tabular-nums">
                  {edit ? (
                    <input
                      value={edit.peso[r.commodity] ?? ""}
                      disabled={isFisso || isEscluso}
                      onChange={(e) =>
                        setEdit({ ...edit, peso: { ...edit.peso, [r.commodity]: e.target.value } })
                      }
                      className="w-16 rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 text-right tabular-nums disabled:opacity-40"
                    />
                  ) : isEscluso ? (
                    <span className="text-zinc-600">—</span>
                  ) : isFisso ? (
                    <span className="text-zinc-500">
                      {r.peso > 0 ? fmtPct(r.peso) : "—"}{" "}
                      <span className="text-xs text-zinc-600">fisso</span>
                    </span>
                  ) : r.peso > 0 ? (
                    fmtPct(r.peso)
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                {edit ? (
                  <>
                    <td className="text-right">
                      <input
                        type="checkbox"
                        checked={isFisso}
                        onChange={() => toggleFlag("fisso", r.commodity)}
                      />
                    </td>
                    <td className="text-right">
                      <input
                        type="checkbox"
                        checked={isEscluso}
                        onChange={() => toggleFlag("escluso", r.commodity)}
                      />
                    </td>
                  </>
                ) : (
                  <>
                    <td className="text-right tabular-nums">
                      {isEscluso ? <span className="text-zinc-600">—</span> : fmtEur(r.ideale)}
                    </td>
                    <td
                      className={`text-right font-medium tabular-nums ${
                        isEscluso
                          ? "text-zinc-600"
                          : r.delta.isNegative()
                            ? "text-red-400"
                            : "text-emerald-400"
                      }`}
                    >
                      {isEscluso ? "—" : fmtEur(r.delta)}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-medium [&>td]:px-2 [&>td]:py-2">
            <td>Totale</td>
            <td className="text-right tabular-nums">{fmtEur(rows.totale)}</td>
            <td className="text-right tabular-nums">100%</td>
            <td className="text-right tabular-nums">{(totalePesiLive * 100).toFixed(1)}%</td>
            {edit ? (
              <td className="text-right" colSpan={2} />
            ) : (
              <>
                <td className="text-right tabular-nums">{fmtEur(rows.futuro)}</td>
                <td className="text-right tabular-nums text-zinc-400">{fmtEur(liq)}</td>
              </>
            )}
          </tr>
        </tfoot>
      </table>
      {!rows.totaleEscluso.isZero() && (
        <p className="text-xs text-zinc-500">
          {fmtEur(rows.totaleEscluso)} di posizioni escluse restano fuori dal calcolo (totale,
          percentuali e montante).
        </p>
      )}
      <p className="text-xs text-zinc-500">
        Ideale = (totale corrente non-fisso + liquidità) × peso target normalizzato. "Da comprare"
        negativo = posizione sopra il target (vendere o lasciar diluire coi prossimi versamenti). Un
        asset <span className="text-zinc-400">fisso</span> resta al valore corrente e sfila il suo
        valore dal montante; uno <span className="text-zinc-400">escluso</span> esce da tutta la
        matematica. Pesi e flag vivono in targets.toml.
      </p>
    </div>
  );
}
