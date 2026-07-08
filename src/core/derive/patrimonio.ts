import { Decimal } from "decimal.js";
import type { Directive, IsoDate, TransactionDirective } from "../beancount/ast";
import type { PatrimonioAccount, Sezione, SnapshotEntry } from "../model/config";
import { type PriceTable, priceAt } from "./prices";

/**
 * Net worth statement: one row per patrimonio.toml entry, one value column per
 * snapshot date plus "live". Manual accounts read snapshots.csv; ledger-backed
 * accounts (with `commodity`) compute units(date) × price(≤date).
 */

export interface PatrimonioRow {
  account: PatrimonioAccount;
  /** snapshot date → value (undefined = no data) */
  values: Map<IsoDate, Decimal | undefined>;
  live?: Decimal;
}

export interface PatrimonioStatement {
  dates: IsoDate[];
  rows: PatrimonioRow[];
  /** totals per snapshot over inNetWorth rows */
  totals: Map<IsoDate, Decimal>;
  liveTotal: Decimal;
  sections: Map<Sezione, PatrimonioRow[]>;
}

const ZERO = new Decimal(0);

/**
 * units of a commodity held at end of `date`. Con `accountPrefix` somma solo le
 * gambe il cui account inizia con quel prefisso (es. `Assets:Broker:<dep>:`),
 * così lo stesso ISIN su depositi diversi resta separato; senza prefisso somma
 * su tutti gli account (comportamento globale, retro-compatibile).
 */
export function unitsAt(
  transactions: TransactionDirective[],
  commodity: string,
  date: IsoDate,
  accountPrefix?: string,
): Decimal {
  let units = ZERO;
  for (const t of transactions) {
    if (t.date > date) continue;
    for (const p of t.postings) {
      if (p.amount && p.cost !== undefined && p.amount.currency === commodity) {
        if (accountPrefix && !p.account.startsWith(accountPrefix)) continue;
        units = units.add(p.amount.number);
      }
    }
  }
  return units;
}

/** prefisso account per limitare le unità al sottoalbero del deposito. */
export function depositoPrefix(deposito: string | undefined): string | undefined {
  return deposito ? `Assets:Broker:${deposito}:` : undefined;
}

export interface DerivePatrimonioInput {
  accounts: PatrimonioAccount[];
  snapshots: SnapshotEntry[];
  directives: Directive[];
  prices: PriceTable;
  liveQuotes?: Map<string, Decimal>;
  asOf: IsoDate;
}

export function derivePatrimonio(input: DerivePatrimonioInput): PatrimonioStatement {
  const dates = [...new Set(input.snapshots.map((s) => s.date))].sort();
  const manual = new Map<string, Decimal>(); // `${date}|${accountId}`
  for (const s of input.snapshots) manual.set(`${s.date}|${s.accountId}`, new Decimal(s.value));

  const transactions = input.directives.filter(
    (d): d is TransactionDirective => d.kind === "transaction",
  );

  const rows: PatrimonioRow[] = input.accounts.map((account) => {
    const values = new Map<IsoDate, Decimal | undefined>();
    let live: Decimal | undefined;
    if (account.commodity) {
      const prefix = depositoPrefix(account.deposito);
      for (const date of dates) {
        const units = unitsAt(transactions, account.commodity, date, prefix);
        const pp = priceAt(input.prices, account.commodity, date);
        values.set(date, pp ? units.mul(pp.price) : undefined);
      }
      const unitsNow = unitsAt(transactions, account.commodity, input.asOf, prefix);
      const liveQuote =
        input.liveQuotes?.get(account.commodity) ??
        priceAt(input.prices, account.commodity, input.asOf)?.price;
      if (liveQuote !== undefined) live = unitsNow.mul(liveQuote);
    } else {
      // carry-forward (come timeline.ts): il saldo di un conto manuale è una
      // funzione a gradino, persiste fino allo snapshot successivo. Alla data D
      // vale l'ultimo snapshot ≤ D, non solo quello esattamente a D — altrimenti
      // un conto non ri-registrato nell'ultimo snapshot si azzererebbe e il Δ vs
      // una data precedente mostrerebbe l'intero valore come variazione.
      let carried: Decimal | undefined;
      for (const date of dates) {
        const exact = manual.get(`${date}|${account.id}`);
        if (exact !== undefined) carried = exact;
        values.set(date, carried);
      }
      live = carried; // ultimo snapshot noto
    }
    const row: PatrimonioRow = { account, values };
    if (live !== undefined) row.live = live;
    return row;
  });

  const totals = new Map<IsoDate, Decimal>();
  for (const date of dates) {
    let sum = ZERO;
    for (const r of rows) {
      if (!r.account.inNetWorth) continue;
      const v = r.values.get(date);
      if (v !== undefined) sum = sum.add(v);
    }
    totals.set(date, sum);
  }
  let liveTotal = ZERO;
  for (const r of rows)
    if (r.account.inNetWorth && r.live !== undefined) liveTotal = liveTotal.add(r.live);

  const sections = new Map<Sezione, PatrimonioRow[]>();
  for (const r of rows) {
    let list = sections.get(r.account.sezione);
    if (!list) {
      list = [];
      sections.set(r.account.sezione, list);
    }
    list.push(r);
  }

  return { dates, rows, totals, liveTotal, sections };
}

/** current value per portfolio at a given snapshot (or live), for Goal Status. */
export function portfolioCurrents(
  statement: PatrimonioStatement,
  at: IsoDate | "live",
): Map<string, Decimal> {
  const out = new Map<string, Decimal>();
  for (const r of statement.rows) {
    const portfolio = r.account.portfolio;
    if (!portfolio || !r.account.inNetWorth) continue;
    const v = at === "live" ? r.live : r.values.get(at);
    if (v === undefined) continue;
    out.set(portfolio, (out.get(portfolio) ?? ZERO).add(v));
  }
  return out;
}
