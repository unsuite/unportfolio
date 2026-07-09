import { Decimal } from "decimal.js";

/**
 * Matematica del ribilanciamento, estratta dalla view per essere testabile.
 *
 * Due modificatori per strumento oltre al peso target:
 * - `fisso`: la posizione resta al valore corrente (ideale = corrente, delta 0)
 *   e il suo valore esce dal montante da distribuire; gli altri si spartiscono
 *   il resto secondo i loro pesi, rinormalizzati fra i soli non-fissi.
 * - `escluso`: fuori da tutta la matematica. Non entra nel totale né nelle
 *   percentuali, non ha ideale né delta. Riga di solo promemoria.
 */

export interface RebalanceInput {
  commodity: string;
  corrente: Decimal;
  peso: number; // 0..1
  fisso: boolean;
  escluso: boolean;
}

export interface RebalanceRow extends RebalanceInput {
  /** quota corrente sul totale non-escluso; 0 per gli esclusi */
  correntePct: number;
  /** valore obiettivo; corrente per i fissi, 0 per gli esclusi */
  ideale: Decimal;
  /** ideale − corrente; 0 per fissi ed esclusi */
  delta: Decimal;
}

export interface RebalanceResult {
  rows: RebalanceRow[];
  /** somma dei correnti non-esclusi: base di tutti i calcoli */
  totale: Decimal;
  /** totale + liquidità da investire */
  futuro: Decimal;
  /** somma dei pesi target di tutti gli strumenti non-esclusi (fissi inclusi):
   *  la percentuale mostrata all'utente. I fissi «occupano» la loro quota. */
  totalePesi: number;
  /** somma dei soli pesi non-fissi: divisore effettivo della distribuzione
   *  del montante fra gli strumenti ribilanciabili */
  pesiNonFissi: number;
  /** valore complessivo tenuto fuori dalla matematica (promemoria) */
  totaleEscluso: Decimal;
}

const ZERO = new Decimal(0);

export function rebalance(input: RebalanceInput[], liq: Decimal): RebalanceResult {
  const attivi = input.filter((r) => !r.escluso);
  const totale = attivi.reduce((t, r) => t.add(r.corrente), ZERO);
  const totaleEscluso = input.filter((r) => r.escluso).reduce((t, r) => t.add(r.corrente), ZERO);
  const futuro = totale.add(liq);
  const fissiVal = attivi.filter((r) => r.fisso).reduce((t, r) => t.add(r.corrente), ZERO);
  // montante da spartire fra i non-fissi: futuro meno il congelato dei fissi
  const montante = futuro.minus(fissiVal);
  // totale visualizzato: include i fissi, che occupano la loro quota di target
  const totalePesi = attivi.reduce((t, r) => t + r.peso, 0);
  // divisore della distribuzione: solo i non-fissi si spartiscono il montante
  const pesiNonFissi = attivi.filter((r) => !r.fisso).reduce((t, r) => t + r.peso, 0);

  const rows = input.map((r): RebalanceRow => {
    if (r.escluso) return { ...r, correntePct: 0, ideale: ZERO, delta: ZERO };
    const correntePct = totale.isZero() ? 0 : r.corrente.div(totale).toNumber();
    if (r.fisso) return { ...r, correntePct, ideale: r.corrente, delta: ZERO };
    const ideale = pesiNonFissi > 0 ? montante.mul(r.peso / pesiNonFissi) : ZERO;
    return { ...r, correntePct, ideale, delta: ideale.minus(r.corrente) };
  });

  return { rows, totale, futuro, totalePesi, pesiNonFissi, totaleEscluso };
}
