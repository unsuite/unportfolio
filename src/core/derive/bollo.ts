import { Decimal } from "decimal.js";
import type { IsoDate } from "../beancount/ast";
import { DEFAULT_BOLLO_ALIQUOTA, type Deposito } from "../model/config";
import type { PatrimonioRow } from "./patrimonio";

/**
 * Stima dell'imposta di bollo sui prodotti finanziari, per conto titoli
 * (deposito): aliquota annua × valore di mercato dei titoli del rapporto.
 *
 * È una stima prospettica, distinta dal bollo storico effettivo già
 * contabilizzato dal broker (Expenses:Taxes:Bollo). Persona fisica: nessun tetto
 * né minimo; valore alla data scelta, senza pro-rata sui giorni di detenzione.
 */

export interface BolloRiga {
  /** Deposito.id (= segmento di account ledger) */
  id: string;
  nome: string;
  owner: string;
  /** valore dei titoli del deposito alla data scelta */
  valore: Decimal;
  /** aliquota applicata (frazione annua) */
  aliquota: number;
  /** bollo stimato = valore × aliquota */
  bollo: Decimal;
}

export interface BolloStatement {
  righe: BolloRiga[];
  totale: Decimal;
}

const ZERO = new Decimal(0);

export interface DeriveBolloInput {
  rows: PatrimonioRow[];
  depositi: Deposito[];
  when: IsoDate | "live";
  /** aliquota usata per i depositi senza aliquota in config */
  defaultAliquota?: number;
}

/** valore di una riga alla colonna scelta ("live" o una data snapshot). */
function valueAt(row: PatrimonioRow, when: IsoDate | "live"): Decimal | undefined {
  return when === "live" ? row.live : row.values.get(when);
}

export function deriveBolloTitoli(input: DeriveBolloInput): BolloStatement {
  const defaultAliquota = input.defaultAliquota ?? DEFAULT_BOLLO_ALIQUOTA;
  const byDeposito = new Map<string, Deposito>();
  for (const d of input.depositi) byDeposito.set(d.id, d);

  // valore dei titoli per deposito (somma delle righe assegnate al deposito)
  const valori = new Map<string, Decimal>();
  for (const r of input.rows) {
    const id = r.account.deposito;
    if (!id) continue;
    const v = valueAt(r, input.when);
    if (v === undefined) continue;
    valori.set(id, (valori.get(id) ?? ZERO).add(v));
  }

  // un riga per ogni deposito configurato (anche a valore 0) e per eventuali
  // depositi referenziati dai conti ma non (ancora) in config.
  const ids = new Set<string>([...byDeposito.keys(), ...valori.keys()]);
  const righe: BolloRiga[] = [];
  let totale = ZERO;
  for (const id of ids) {
    const dep = byDeposito.get(id);
    const aliquota = dep?.aliquota ?? defaultAliquota;
    const valore = valori.get(id) ?? ZERO;
    const bollo = valore.mul(aliquota);
    totale = totale.add(bollo);
    righe.push({
      id,
      nome: dep?.nome ?? id,
      owner: dep?.owner ?? "",
      valore,
      aliquota,
      bollo,
    });
  }
  righe.sort((a, b) => b.valore.comparedTo(a.valore) || a.id.localeCompare(b.id));
  return { righe, totale };
}
