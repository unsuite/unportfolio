import { Decimal } from "decimal.js";
import type { IsoDate, TransactionDirective } from "../beancount/ast";
import { type IndexPoint, type TrDay, trIndex } from "../math/returns";
import { depositoPrefix } from "./patrimonio";
import { type PriceTable, priceAt } from "./prices";
import { sampleGrid } from "./timeline";

/**
 * Serie di rendimento di un insieme di strumenti (un gruppo o un singolo
 * titolo), a passo giornaliero:
 *  - `index`: indice total-return time-weighted (1 = inizio storia), che
 *    neutralizza i versamenti e reinveste cedole/dividendi. La vista lo ribasa
 *    alla finestra selezionata (index_t / index_inizioFinestra − 1 = % periodo).
 *  - `invested`: capitale netto versato (acquisti − vendite, cedole escluse) vs
 *    valore di mercato. Il divario tra le due linee è il guadagno.
 *
 * Solo strumenti con commodity: i conti manuali (cash/debiti) non hanno un
 * rendimento di prezzo né un "investito" ben definito.
 */

export interface ReturnsHolding {
  commodity: string;
  deposito?: string;
}

export interface InvestedPoint {
  date: IsoDate;
  invested: number;
  value: number;
}

export interface ReturnsSeries {
  index: IndexPoint[];
  invested: InvestedPoint[];
}

const ZERO = new Decimal(0);

/** quote della commodity alla data (ultimo evento ≤ data). */
function unitsOn(evs: { date: IsoDate; units: Decimal }[], date: IsoDate): Decimal {
  let u = ZERO;
  for (const e of evs) {
    if (e.date <= date) u = e.units;
    else break;
  }
  return u;
}

export function deriveReturns(
  holdings: ReturnsHolding[],
  transactions: TransactionDirective[],
  prices: PriceTable,
  asOf: IsoDate,
): ReturnsSeries {
  const txns = [...transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const hs = holdings.map((h) => ({
    commodity: h.commodity,
    prefix: depositoPrefix(h.deposito),
    evs: [] as { date: IsoDate; units: Decimal }[], // quote cumulate, per data
  }));
  const commSet = new Set(hs.map((h) => h.commodity));

  // un passaggio sui movimenti: eventi quote per holding + income per data
  const incomeByDate = new Map<IsoDate, Decimal>();
  const cum = new Map(hs.map((h) => [h.commodity + (h.prefix ?? ""), ZERO]));
  let from: IsoDate | undefined;
  for (const t of txns) {
    for (const p of t.postings) {
      if (!p.amount) continue;
      const leaf = p.account.split(":").pop();
      if (
        leaf &&
        commSet.has(leaf) &&
        (p.account.startsWith("Income:Coupons:") || p.account.startsWith("Income:Dividends:"))
      ) {
        // income negativo nel ledger (Income a credito) → incassato (segno +)
        incomeByDate.set(t.date, (incomeByDate.get(t.date) ?? ZERO).minus(p.amount.number));
      }
      if (p.cost !== undefined && commSet.has(p.amount.currency)) {
        const h = hs.find(
          (x) =>
            x.commodity === p.amount!.currency && (!x.prefix || p.account.startsWith(x.prefix)),
        );
        if (!h) continue;
        const key = h.commodity + (h.prefix ?? "");
        const next = cum.get(key)!.add(p.amount.number);
        cum.set(key, next);
        h.evs.push({ date: t.date, units: next });
        if (from === undefined || t.date < from) from = t.date;
      }
    }
  }
  if (from === undefined) return { index: [], invested: [] };

  const grid = sampleGrid(from, asOf, 1);
  // quote note all'ultima data *con prezzo* di ciascun holding: così il flusso
  // (Δquote × prezzo) cattura l'acquisto sul primo giorno prezzato, senza
  // spurii salti di valore quando il prezzo compare in ritardo.
  const pricedUnits = hs.map(() => ZERO);

  const days: TrDay[] = [];
  const invested: InvestedPoint[] = [];
  let cumFlow = ZERO;

  for (const date of grid) {
    let value = ZERO;
    let flow = ZERO;
    hs.forEach((h, i) => {
      const pp = priceAt(prices, h.commodity, date);
      if (!pp) return; // non ancora prezzato: non tocca né valore né flusso
      const units = unitsOn(h.evs, date);
      if (!units.isZero()) value = value.add(units.mul(pp.price));
      const dUnits = units.minus(pricedUnits[i]!);
      if (!dUnits.isZero()) flow = flow.add(dUnits.mul(pp.price));
      pricedUnits[i] = units;
    });
    const income = incomeByDate.get(date) ?? ZERO;
    days.push({ date, value, flow, income });
    cumFlow = cumFlow.add(flow);
    invested.push({ date, invested: cumFlow.toNumber(), value: value.toNumber() });
  }

  return { index: trIndex(days), invested };
}
