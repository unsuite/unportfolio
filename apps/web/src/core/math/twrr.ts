import { Decimal } from "decimal.js";

/**
 * TWRR (time-weighted rate of return) sul prezzo: misura la performance
 * dello strumento eliminando l'effetto dei flussi (quando/quanto hai
 * comprato), al contrario del MWRR/XIRR che li pesa.
 *
 * I periodi sono delimitati dagli eventi che cambiano le quote
 * (acquisti/vendite): per ogni confine d_i,
 *   fattore_i = V_before(d_i) / V_after(d_{i-1})
 * con V = quote × prezzo(d). Le valutazioni usano lo storico campionato
 * (ultimo prezzo ≤ data): con campioni settimanali è un'approssimazione.
 * Cedole e commissioni non entrano (price return, non total return).
 */

export interface UnitEvent {
  date: string;
  unitsAfter: Decimal;
}

export interface TwrrResult {
  /** rendimento cumulato del periodo coperto */
  cumulative: number;
  /** annualizzato (solo se il periodo ≥ 90 giorni) */
  annualized?: number;
  /** data di inizio effettiva (primo evento con prezzo disponibile) */
  from: string;
}

const MS_PER_DAY = 86_400_000;

export function twrr(
  events: UnitEvent[],
  priceAt: (date: string) => Decimal | undefined,
  asOf: string,
): TwrrResult | undefined {
  if (events.length === 0) return undefined;

  // primo evento con prezzo disponibile = inizio della misura
  let start = 0;
  let p0: Decimal | undefined;
  while (start < events.length) {
    p0 = priceAt(events[start]!.date);
    if (p0) break;
    start++;
  }
  if (p0 === undefined) return undefined;

  let prevAfter = events[start]!.unitsAfter.mul(p0);
  let prevUnits = events[start]!.unitsAfter;
  const from = events[start]!.date;
  let product = new Decimal(1);

  for (let i = start + 1; i < events.length; i++) {
    const e = events[i]!;
    const p = priceAt(e.date);
    if (p === undefined || prevAfter.isZero()) {
      // prezzo mancante: flusso neutro, riscala il valore alle nuove quote
      if (!prevUnits.isZero()) prevAfter = prevAfter.mul(e.unitsAfter).div(prevUnits);
      prevUnits = e.unitsAfter;
      continue;
    }
    const before = prevUnits.mul(p);
    product = product.mul(before.div(prevAfter));
    prevUnits = e.unitsAfter;
    prevAfter = prevUnits.mul(p);
    if (prevUnits.isZero()) break; // posizione chiusa: la misura finisce qui
  }

  // ultimo tratto fino a oggi (solo se la posizione è ancora aperta)
  if (!prevUnits.isZero()) {
    const pEnd = priceAt(asOf);
    if (pEnd === undefined) return undefined;
    if (prevAfter.isZero()) return undefined;
    product = product.mul(prevUnits.mul(pEnd).div(prevAfter));
  }

  const cumulative = product.toNumber() - 1;
  const days = (Date.parse(asOf) - Date.parse(from)) / MS_PER_DAY;
  const result: TwrrResult = { cumulative, from };
  if (days >= 90) result.annualized = (1 + cumulative) ** (365 / days) - 1;
  return result;
}
