import { Decimal } from "decimal.js";
import type { IsoDate } from "../beancount/ast";

/**
 * Indice total-return (crescita di 1 €) time-weighted, con linking giornaliero.
 *
 * Per ogni giorno d il fattore è
 *   (V_end − flow + income) / V_start
 * con V_start = valore di fine giorno precedente, V_end = valore di fine giorno
 * (quote post-scambio × prezzo). I flussi di capitale (acquisti/vendite) sono
 * neutralizzati sottraendoli al numeratore; cedole e dividendi entrano come
 * rendimento (income). L'indice parte a 1 al primo giorno con V_start > 0, così
 * misura solo la performance, non i versamenti — al contrario del grafico di
 * valore. Rebase alla finestra: si divide l'indice per quello del primo punto
 * visibile (fatto lato vista).
 */

export interface TrDay {
  date: IsoDate;
  /** valore di fine giorno = quote (post-scambio) × prezzo; ≥ 0 */
  value: Decimal;
  /** capitale netto aggiunto nel giorno (acquisti − vendite); + = aggiunto */
  flow: Decimal;
  /** cedole/dividendi incassati nel giorno; ≥ 0 */
  income: Decimal;
}

export interface IndexPoint {
  date: IsoDate;
  /** indice di crescita, 1 = inizio */
  index: number;
}

export function trIndex(days: TrDay[]): IndexPoint[] {
  const out: IndexPoint[] = [];
  let index = new Decimal(1);
  let prevValue: Decimal | undefined;

  for (const d of days) {
    if (prevValue === undefined) {
      // ancora l'indice al primo giorno con valore positivo (primo acquisto):
      // il flusso iniziale non deve generare rendimento
      if (d.value.gt(0)) {
        prevValue = d.value;
        out.push({ date: d.date, index: 1 });
      }
      continue;
    }
    if (prevValue.gt(0)) {
      // giorno normale: neutralizza i flussi, aggiungi l'income come rendimento
      const factor = d.value.minus(d.flow).plus(d.income).div(prevValue);
      index = index.mul(factor);
    }
    // se prevValue == 0 (posizione chiusa in un tratto) il fattore è indefinito:
    // si tiene l'indice fermo finché non si riapre una posizione con valore > 0
    out.push({ date: d.date, index: index.toNumber() });
    prevValue = d.value;
  }
  return out;
}
