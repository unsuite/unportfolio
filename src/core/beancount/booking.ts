import { Decimal } from "decimal.js";
import type { Directive, IsoDate, Posting, TransactionDirective } from "./ast";

/** A purchase lot held at cost. */
export interface Lot {
  units: Decimal;
  costPerUnit: Decimal;
  costCurrency: string;
  date: IsoDate;
}

export interface InstrumentCashFlow {
  date: IsoDate;
  amount: Decimal;
}

/** Aggregated state of one instrument (commodity held at cost). */
export interface InstrumentPosition {
  commodity: string;
  accounts: Set<string>;
  units: Decimal;
  lots: Lot[];
  /** total cash spent on purchases, negative (sheet "prezzo di carico") */
  buyCost: Decimal;
  /** cost basis of currently open lots, positive */
  costBasis: Decimal;
  /** cash received from sales, positive */
  sellProceeds: Decimal;
  /** realized P&L on FIFO-matched sales */
  realizedGain: Decimal;
  /** broker fees attributed to this instrument, negative */
  fees: Decimal;
  /** coupons/dividends net of accrued interest paid at purchase; cash sign */
  income: Decimal;
  /** withholding taxes / tax credits, cash sign (usually negative) */
  withholding: Decimal;
  /** chronological cash movements for XIRR */
  cashFlows: InstrumentCashFlow[];
  /** units held after each buy/sell, in order — boundaries for TWRR */
  unitEvents: { date: IsoDate; unitsAfter: Decimal }[];
}

export interface BookingResult {
  /** account → currency → balance */
  balances: Map<string, Map<string, Decimal>>;
  positions: Map<string, InstrumentPosition>;
  errors: string[];
}

const ZERO = new Decimal(0);

function emptyPosition(commodity: string): InstrumentPosition {
  return {
    commodity,
    accounts: new Set(),
    units: ZERO,
    lots: [],
    buyCost: ZERO,
    costBasis: ZERO,
    sellProceeds: ZERO,
    realizedGain: ZERO,
    fees: ZERO,
    income: ZERO,
    withholding: ZERO,
    cashFlows: [],
    unitEvents: [],
  };
}

function addBalance(
  balances: BookingResult["balances"],
  account: string,
  currency: string,
  amount: Decimal,
): void {
  let byCur = balances.get(account);
  if (!byCur) {
    byCur = new Map();
    balances.set(account, byCur);
  }
  byCur.set(currency, (byCur.get(currency) ?? ZERO).add(amount));
}

/** FIFO-reduce lots by `units` (positive). Returns cost basis of removed units. */
function reduceLots(
  lots: Lot[],
  units: Decimal,
  matchCost?: { number?: Decimal; date?: IsoDate },
): { removedCost: Decimal; unmatched: Decimal } {
  let remaining = units;
  let removedCost = ZERO;
  for (const lot of lots) {
    if (remaining.lte(0)) break;
    if (matchCost?.number !== undefined && !lot.costPerUnit.equals(matchCost.number)) continue;
    if (matchCost?.date !== undefined && lot.date !== matchCost.date) continue;
    const take = Decimal.min(lot.units, remaining);
    removedCost = removedCost.add(take.mul(lot.costPerUnit));
    lot.units = lot.units.minus(take);
    remaining = remaining.minus(take);
  }
  // drop empty lots in place
  for (let i = lots.length - 1; i >= 0; i--) if (lots[i]!.units.isZero()) lots.splice(i, 1);
  return { removedCost, unmatched: remaining };
}

/**
 * Replay transactions chronologically (stable for same-date) and build
 * balances + instrument positions with FIFO lot tracking.
 *
 * Attribution of fee/income/withholding legs to an instrument:
 *  - account leaf equals the commodity (e.g. Income:Coupons:IT0005547408), or
 *  - transaction metadata `instrument: TICKER`.
 */
export function book(
  directives: Directive[],
  opts: { operatingCurrency?: string } = {},
): BookingResult {
  const operating = opts.operatingCurrency ?? "EUR";
  const balances: BookingResult["balances"] = new Map();
  const positions = new Map<string, InstrumentPosition>();
  const errors: string[] = [];

  const getPos = (commodity: string): InstrumentPosition => {
    let p = positions.get(commodity);
    if (!p) {
      p = emptyPosition(commodity);
      positions.set(commodity, p);
    }
    return p;
  };

  const txns = directives
    .filter((d): d is TransactionDirective => d.kind === "transaction")
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  for (const txn of txns) {
    // --- resolve the elided posting (at most one without amount) ---
    const residualByCurrency = new Map<string, Decimal>();
    let elided: Posting | undefined;
    const weights: { posting: Posting; weight: Decimal; currency: string }[] = [];

    for (const p of txn.postings) {
      if (!p.amount) {
        if (elided) {
          errors.push(`${txn.date} "${txn.narration}": more than one posting without amount`);
        }
        elided = p;
        continue;
      }
      let weight: Decimal;
      let currency: string;
      if (p.cost?.number !== undefined && p.cost.currency !== undefined) {
        weight = p.amount.number.mul(p.cost.number);
        currency = p.cost.currency;
      } else if (p.cost !== undefined && p.amount.number.isNegative()) {
        // reduction with empty/partial cost spec: weight = matched lot cost (filled below)
        weight = ZERO;
        currency = operating;
      } else if (p.price) {
        weight =
          p.price.kind === "unit"
            ? p.amount.number.mul(p.price.amount.number)
            : p.amount.number.isNegative()
              ? p.price.amount.number.neg()
              : p.price.amount.number;
        currency = p.price.amount.currency;
      } else {
        weight = p.amount.number;
        currency = p.amount.currency;
      }
      weights.push({ posting: p, weight, currency });
    }

    // --- instrument legs: lots and realized gains ---
    const touchedInstruments = new Set<string>();
    if (txn.meta["instrument"]) touchedInstruments.add(txn.meta["instrument"]);

    for (const w of weights) {
      const p = w.posting;
      if (!p.amount || p.cost === undefined) continue;
      const commodity = p.amount.currency;
      const pos = getPos(commodity);
      pos.accounts.add(p.account);
      touchedInstruments.add(commodity);

      if (p.amount.number.isPositive()) {
        // augmentation: new lot
        if (p.cost.number === undefined || p.cost.currency === undefined) {
          errors.push(`${txn.date} ${commodity}: buy without cost`);
          continue;
        }
        pos.lots.push({
          units: p.amount.number,
          costPerUnit: p.cost.number,
          costCurrency: p.cost.currency,
          date: p.cost.date ?? txn.date,
        });
        pos.units = pos.units.add(p.amount.number);
        pos.buyCost = pos.buyCost.minus(p.amount.number.mul(p.cost.number));
        pos.unitEvents.push({ date: txn.date, unitsAfter: pos.units });
      } else {
        // reduction: FIFO against (optionally cost-filtered) lots
        const sellUnits = p.amount.number.neg();
        const matchCost: { number?: Decimal; date?: IsoDate } = {};
        if (p.cost.number !== undefined) matchCost.number = p.cost.number;
        if (p.cost.date !== undefined) matchCost.date = p.cost.date;
        const { removedCost, unmatched } = reduceLots(pos.lots, sellUnits, matchCost);
        if (!unmatched.isZero())
          errors.push(
            `${txn.date} ${commodity}: sell of ${sellUnits} exceeds held lots by ${unmatched}`,
          );
        pos.units = pos.units.minus(sellUnits.minus(unmatched));
        const proceeds = p.price
          ? p.price.kind === "unit"
            ? sellUnits.mul(p.price.amount.number)
            : p.price.amount.number
          : removedCost;
        pos.sellProceeds = pos.sellProceeds.add(proceeds);
        pos.realizedGain = pos.realizedGain.add(proceeds.minus(removedCost));
        pos.unitEvents.push({ date: txn.date, unitsAfter: pos.units });
        // weight of a reduction at cost is the removed lot cost (negative)
        w.weight = removedCost.neg();
      }
    }

    // --- balance the transaction, fill the elided posting ---
    for (const w of weights) {
      residualByCurrency.set(
        w.currency,
        (residualByCurrency.get(w.currency) ?? ZERO).add(w.weight),
      );
    }
    if (elided) {
      // assign the full residual of the operating currency (typical case)
      const residual = residualByCurrency.get(operating) ?? ZERO;
      elided.amount = { number: residual.neg(), currency: operating };
      weights.push({ posting: elided, weight: residual.neg(), currency: operating });
      residualByCurrency.set(operating, ZERO);
    }
    for (const [cur, res] of residualByCurrency) {
      if (res.abs().gt(new Decimal("0.005")))
        errors.push(`${txn.date} "${txn.narration}": does not balance (${res} ${cur})`);
    }

    // --- update raw balances ---
    for (const w of weights) {
      const p = w.posting;
      if (!p.amount) continue;
      addBalance(balances, p.account, p.amount.currency, p.amount.number);
    }

    // --- attribute income/fees/withholding + collect instrument cash flows ---
    for (const p of txn.postings) {
      if (!p.amount) continue;
      const leaf = p.account.split(":").pop()!;
      if (positions.has(leaf) || /^[A-Z][A-Z0-9'._-]*\d/.test(leaf)) {
        if (p.account.startsWith("Income:")) touchedInstruments.add(leaf);
      }
    }

    for (const commodity of touchedInstruments) {
      const pos = getPos(commodity);
      let cash = ZERO;
      for (const p of txn.postings) {
        if (!p.amount) continue;
        const leaf = p.account.split(":").pop()!;
        if (p.account.startsWith("Income:") && leaf === commodity) {
          pos.income = pos.income.minus(p.amount.number); // income is negative in ledger
        } else if (p.account.startsWith("Expenses:Fees")) {
          pos.fees = pos.fees.minus(p.amount.number);
        } else if (p.account.startsWith("Expenses:Taxes")) {
          pos.withholding = pos.withholding.minus(p.amount.number);
        }
        // cash legs: operating currency, no cost, on balance-sheet accounts
        if (
          p.amount.currency === operating &&
          p.cost === undefined &&
          (p.account.startsWith("Assets:") || p.account.startsWith("Liabilities:"))
        ) {
          cash = cash.add(p.amount.number);
        }
      }
      if (!cash.isZero()) pos.cashFlows.push({ date: txn.date, amount: cash });
    }

    // recompute open-lot cost basis lazily at the end of each txn touching it
    for (const commodity of touchedInstruments) {
      const pos = positions.get(commodity);
      if (pos)
        pos.costBasis = pos.lots.reduce((acc, l) => acc.add(l.units.mul(l.costPerUnit)), ZERO);
    }
  }

  return { balances, positions, errors };
}
