import { Decimal } from "decimal.js";

/**
 * Calcolo pensione (foglio 3): dato un profilo (età, spese, rendimenti attesi)
 * stima il capitale-obiettivo, in due varianti:
 *
 *  - SENZA erosione: rendita perpetua che lascia il capitale intatto
 *    (vivi solo dei rendimenti) → S / r_post
 *  - CON erosione: annualità che azzera il capitale entro l'età di decesso
 *    (consumi anche il capitale) → S × (1 − (1+r_post)^−n) / r_post
 *
 * e per ciascuna il valore "a pensionamento" e quello "corrente" (scontato ad
 * oggi al rendimento atteso pre-pensione su `anniAllaPensione`).
 *
 * Tutto in termini REALI: spese e rendimenti sono già al netto dell'inflazione,
 * quindi le spese restano costanti in potere d'acquisto (nessun parametro
 * inflazione, come nel foglio). Modulo puro: nessuna dipendenza da app/DOM, la
 * data "oggi" è passata come argomento.
 */

export interface PensionInput {
  /** data di nascita ISO (YYYY-MM-DD) */
  dataNascita: string;
  /** età a cui si va in pensione */
  etaPensionamento: number;
  /** età di decesso pianificata (orizzonte di finanziamento) */
  etaDecesso: number;
  /** spese annuali in pensione (reali, potere d'acquisto costante) */
  speseAnnuali: number;
  /** rendimento reale atteso pre-pensione (es. 0.05) */
  rendimentoPre: number;
  /** rendimento reale atteso post-pensione (es. 0.04) */
  rendimentoPost: number;
}

export interface PensionResult {
  /** età attuale = anno(asOf) − anno(dataNascita) */
  etaAttuale: number;
  /** anni mancanti alla pensione (fase di accumulo); ≥ 0 */
  anniAllaPensione: number;
  /** anni da finanziare in pensione = etaDecesso − etaPensionamento */
  anniDaFinanziare: number;
  /** capitale a pensionamento per una rendita perpetua (capitale intatto) */
  targetPensionamentoSenzaErosione: number;
  /** capitale a pensionamento per un'annualità che si azzera a fine vita */
  targetPensionamentoConErosione: number;
  /** target perpetuo scontato ad oggi (quanto dovresti già avere) */
  targetCorrenteSenzaErosione: number;
  /** target con erosione scontato ad oggi */
  targetCorrenteConErosione: number;
}

function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

export function computePension(input: PensionInput, asOf: string): PensionResult {
  const etaAttuale = yearOf(asOf) - yearOf(input.dataNascita);
  const anniAllaPensione = Math.max(0, input.etaPensionamento - etaAttuale);
  const anniDaFinanziare = Math.max(0, input.etaDecesso - input.etaPensionamento);

  const S = new Decimal(input.speseAnnuali);
  const rPost = new Decimal(input.rendimentoPost);
  const rPre = new Decimal(input.rendimentoPre);

  // a pensionamento, senza erosione: rendita perpetua S / r_post
  const targetPensionamentoSenzaErosione = rPost.lte(0)
    ? Number.POSITIVE_INFINITY
    : S.div(rPost).toNumber();

  // a pensionamento, con erosione: PV di un'annualità posticipata di n rate
  //   r = 0 → S × n (nessuno sconto)
  //   r > 0 → S × (1 − (1+r)^−n) / r
  const onePlusPost = rPost.plus(1);
  const targetPensionamentoConErosione = rPost.lte(0)
    ? S.mul(anniDaFinanziare).toNumber()
    : S.mul(new Decimal(1).minus(onePlusPost.pow(-anniDaFinanziare)))
        .div(rPost)
        .toNumber();

  // sconto ad oggi al rendimento pre-pensione: / (1+r_pre)^anniAllaPensione
  const discount = rPre.plus(1).pow(anniAllaPensione);
  const targetCorrenteSenzaErosione = Number.isFinite(targetPensionamentoSenzaErosione)
    ? new Decimal(targetPensionamentoSenzaErosione).div(discount).toNumber()
    : Number.POSITIVE_INFINITY;
  const targetCorrenteConErosione = new Decimal(targetPensionamentoConErosione)
    .div(discount)
    .toNumber();

  return {
    etaAttuale,
    anniAllaPensione,
    anniDaFinanziare,
    targetPensionamentoSenzaErosione,
    targetPensionamentoConErosione,
    targetCorrenteSenzaErosione,
    targetCorrenteConErosione,
  };
}
