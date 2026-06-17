import { Decimal } from "decimal.js";
import type { Directive, IsoDate, TransactionDirective } from "../beancount/ast";
import { findPosition, type InstrumentPosition } from "../beancount/booking";
import { xirr } from "../math/xirr";
import type { PatrimonioAccount, SnapshotEntry } from "../model/config";
import { depositoPrefix, unitsAt } from "./patrimonio";
import { type PriceTable, priceAt } from "./prices";

/**
 * Serie storiche e statistiche aggregate, sui due livelli:
 *  1. portfolio/goal — il gruppo di conti e asset assegnati via patrimonio.toml
 *  2. globale — tutto il net worth (per le serie) o tutto l'investito
 *     (per MWRR/TWRR, dove servono i flussi: i conti manuali non li hanno)
 */

export interface TimelinePoint {
  date: IsoDate;
  value: number;
}

const ZERO = new Decimal(0);
const MS_PER_DAY = 86_400_000;

function isoAddDays(date: IsoDate, days: number): IsoDate {
  return new Date(Date.parse(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** griglia settimanale dalla prima data utile a oggi (max ~260 punti) */
export function weeklyGrid(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  let d = from;
  let guard = 0;
  while (d < to && guard++ < 520) {
    out.push(d);
    d = isoAddDays(d, 7);
  }
  out.push(to);
  return out;
}

export interface TimelineInput {
  accounts: PatrimonioAccount[];
  snapshots: SnapshotEntry[];
  directives: Directive[];
  prices: PriceTable;
  asOf: IsoDate;
  /** peso per-conto (id → quota), per distribuire conti compositi su più
   *  classi nelle serie. Assente o 1 = valore pieno. */
  weights?: Map<string, number>;
}

/** valore di una riga del patrimonio a una certa data (undefined = nessun dato) */
function accountValueAt(
  account: PatrimonioAccount,
  date: IsoDate,
  transactions: TransactionDirective[],
  snapshotsByAccount: Map<string, SnapshotEntry[]>,
  prices: PriceTable,
): Decimal | undefined {
  if (account.commodity) {
    const units = unitsAt(transactions, account.commodity, date, depositoPrefix(account.deposito));
    if (units.isZero()) return ZERO;
    const p = priceAt(prices, account.commodity, date);
    return p ? units.mul(p.price) : undefined;
  }
  const series = snapshotsByAccount.get(account.id);
  if (!series) return undefined;
  let last: SnapshotEntry | undefined;
  for (const s of series) {
    if (s.date <= date) last = s;
    else break;
  }
  return last ? new Decimal(last.value) : undefined;
}

export interface ValueSeries {
  global: TimelinePoint[];
  byPortfolio: Map<string, TimelinePoint[]>;
}

export function deriveValueSeries(input: TimelineInput): ValueSeries {
  const transactions = input.directives.filter(
    (d): d is TransactionDirective => d.kind === "transaction",
  );
  const snapshotsByAccount = new Map<string, SnapshotEntry[]>();
  for (const s of [...input.snapshots].sort((a, b) => a.date.localeCompare(b.date))) {
    let list = snapshotsByAccount.get(s.accountId);
    if (!list) {
      list = [];
      snapshotsByAccount.set(s.accountId, list);
    }
    list.push(s);
  }

  // prima data utile: primo snapshot o prima transazione
  let from = input.asOf;
  for (const s of input.snapshots) if (s.date < from) from = s.date;
  for (const t of transactions) if (t.date < from) from = t.date;
  // includi sempre le date di snapshot nella griglia: i conti manuali sono
  // funzioni a gradino (valore = ultimo snapshot ≤ data), quindi un punto
  // settimanale anche un solo giorno prima dello snapshot mostrerebbe ancora
  // il valore del trimestre precedente. Aggiungerle fa cadere il gradino sulla
  // data esatta e — siccome la vista seleziona sempre una data di snapshot —
  // allinea l'ultimo punto del grafico (e quindi il valore) al totale as-of.
  const snapInRange = input.snapshots
    .map((s) => s.date)
    .filter((d) => d >= from && d <= input.asOf);
  const grid = [...new Set([...weeklyGrid(from, input.asOf), ...snapInRange])].sort();

  const global: TimelinePoint[] = [];
  const byPortfolio = new Map<string, TimelinePoint[]>();

  for (const date of grid) {
    let total = ZERO;
    let any = false;
    const perPortfolio = new Map<string, Decimal>();
    for (const account of input.accounts) {
      if (!account.inNetWorth) continue;
      const v = accountValueAt(account, date, transactions, snapshotsByAccount, input.prices);
      if (v === undefined) continue;
      const w = input.weights?.get(account.id);
      const vw = w === undefined ? v : v.mul(w);
      any = true;
      total = total.add(vw);
      if (account.portfolio)
        perPortfolio.set(account.portfolio, (perPortfolio.get(account.portfolio) ?? ZERO).add(vw));
    }
    if (!any) continue;
    global.push({ date, value: total.toNumber() });
    for (const [p, v] of perPortfolio) {
      let list = byPortfolio.get(p);
      if (!list) {
        list = [];
        byPortfolio.set(p, list);
      }
      list.push({ date, value: v.toNumber() });
    }
  }
  return { global, byPortfolio };
}

/** allocazione per classe a oggi, con gli split degli account compositi */
export function deriveAllocation(input: TimelineInput): Map<string, Decimal> {
  const transactions = input.directives.filter(
    (d): d is TransactionDirective => d.kind === "transaction",
  );
  const snapshotsByAccount = new Map<string, SnapshotEntry[]>();
  for (const s of [...input.snapshots].sort((a, b) => a.date.localeCompare(b.date))) {
    let list = snapshotsByAccount.get(s.accountId);
    if (!list) {
      list = [];
      snapshotsByAccount.set(s.accountId, list);
    }
    list.push(s);
  }
  const out = new Map<string, Decimal>();
  const add = (classe: string, v: Decimal) => out.set(classe, (out.get(classe) ?? ZERO).add(v));
  for (const account of input.accounts) {
    if (!account.inNetWorth) continue;
    const v = accountValueAt(account, input.asOf, transactions, snapshotsByAccount, input.prices);
    if (v === undefined || v.isZero()) continue;
    if (account.split && account.split.length > 0) {
      for (const s of account.split) add(s.classe, v.mul(s.peso));
    } else {
      add(account.tipo, v);
    }
  }
  return out;
}

export interface GroupStats {
  value: Decimal;
  invested: Decimal; // cash investito (negativo cumulato dei flussi)
  mwrr?: number;
  twrr?: number; // annualizzato se possibile, altrimenti cumulato
  twrrIsAnnualized: boolean;
  from?: IsoDate;
}

/**
 * MWRR e TWRR aggregati per un gruppo di strumenti (un portfolio o tutto
 * l'investito). MWRR: tutti i flussi di cassa dei membri + valore finale.
 * TWRR: confini all'unione degli eventi-quote, V di gruppo = Σ qty×prezzo.
 */
export interface GroupHolding {
  commodity: string;
  /** segmento di deposito; assente = aggrega su tutti gli account (compat) */
  deposito?: string;
}

export function deriveGroupStats(
  holdings: GroupHolding[],
  positions: Map<string, InstrumentPosition>,
  directives: Directive[],
  prices: PriceTable,
  asOf: IsoDate,
): GroupStats | undefined {
  const members = holdings
    .map((h) => ({
      commodity: h.commodity,
      prefix: depositoPrefix(h.deposito),
      pos: findPosition(positions, h.deposito, h.commodity),
    }))
    .filter(
      (m): m is { commodity: string; prefix: string | undefined; pos: InstrumentPosition } =>
        !!m.pos,
    );
  if (members.length === 0) return undefined;

  const transactions = directives.filter(
    (d): d is TransactionDirective => d.kind === "transaction",
  );

  const groupValueAt = (date: IsoDate): Decimal | undefined => {
    let total = ZERO;
    for (const m of members) {
      const units = unitsAt(transactions, m.commodity, date, m.prefix);
      if (units.isZero()) continue;
      const p = priceAt(prices, m.commodity, date);
      if (!p) return undefined;
      total = total.add(units.mul(p.price));
    }
    return total;
  };

  const value = groupValueAt(asOf) ?? ZERO;

  // --- MWRR ---
  const flows = members
    .flatMap((m) => m.pos.cashFlows)
    .map((f) => ({ date: f.date, amount: f.amount.toNumber() }))
    .sort((a, b) => a.date.localeCompare(b.date));
  let invested = ZERO;
  for (const f of flows) if (f.amount < 0) invested = invested.add(-f.amount);
  const allFlows = value.isZero() ? flows : [...flows, { date: asOf, amount: value.toNumber() }];
  const mwrr = xirr(allFlows);

  // --- TWRR di gruppo ---
  const boundaryDates = [
    ...new Set(members.flatMap((m) => m.pos.unitEvents.map((e) => e.date))),
  ].sort();
  let product = new Decimal(1);
  let prevAfter: Decimal | undefined;
  let from: IsoDate | undefined;
  for (const d of boundaryDates) {
    const before = groupValueAt(isoAddDays(d, -1));
    const after = groupValueAt(d);
    if (after === undefined) continue;
    if (prevAfter !== undefined && before !== undefined && !prevAfter.isZero())
      product = product.mul(before.div(prevAfter));
    if (prevAfter === undefined && !after.isZero()) from = d;
    prevAfter = after;
  }
  let twrr: number | undefined;
  let twrrIsAnnualized = false;
  if (prevAfter !== undefined && !prevAfter.isZero() && from) {
    const end = groupValueAt(asOf);
    if (end !== undefined) {
      product = product.mul(end.div(prevAfter));
      const cumulative = product.toNumber() - 1;
      const days = (Date.parse(asOf) - Date.parse(from)) / MS_PER_DAY;
      if (days >= 90) {
        twrr = (1 + cumulative) ** (365 / days) - 1;
        twrrIsAnnualized = true;
      } else {
        twrr = cumulative;
      }
    }
  }

  const stats: GroupStats = { value, invested, twrrIsAnnualized };
  if (mwrr !== undefined) stats.mwrr = mwrr;
  if (twrr !== undefined) stats.twrr = twrr;
  if (from) stats.from = from;
  return stats;
}
