import type { Decimal } from "decimal.js";
import type { Directive, IsoDate } from "../beancount/ast";

export interface PricePoint {
  date: IsoDate;
  price: Decimal;
}

/** commodity → chronological price points, from `price` directives. */
export type PriceTable = Map<string, PricePoint[]>;

export function buildPriceTable(directives: Directive[]): PriceTable {
  const table: PriceTable = new Map();
  for (const d of directives) {
    if (d.kind !== "price") continue;
    let series = table.get(d.currency);
    if (!series) {
      series = [];
      table.set(d.currency, series);
    }
    series.push({ date: d.date, price: d.amount.number });
  }
  for (const series of table.values()) series.sort((a, b) => a.date.localeCompare(b.date));
  return table;
}

/** Last sampled price at or before `date` (binary search). */
export function priceAt(
  table: PriceTable,
  commodity: string,
  date: IsoDate,
): PricePoint | undefined {
  const series = table.get(commodity);
  if (!series || series.length === 0) return undefined;
  let lo = 0;
  let hi = series.length - 1;
  if (series[0]!.date > date) return undefined;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (series[mid]!.date <= date) lo = mid;
    else hi = mid - 1;
  }
  return series[lo];
}

export function latestPrice(table: PriceTable, commodity: string): PricePoint | undefined {
  const series = table.get(commodity);
  return series?.[series.length - 1];
}

/** True if a sample for (commodity, day) already exists — dedupe for the sampler. */
export function hasSample(table: PriceTable, commodity: string, date: IsoDate): boolean {
  return table.get(commodity)?.some((p) => p.date === date) ?? false;
}
