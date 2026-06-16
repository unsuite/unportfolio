import type { IsoDate } from "../beancount/ast";
import type { PatrimonioAccount, SnapshotEntry } from "../model/config";

/**
 * Rendimento "a due numeri" per i conti manuali (non tracciati): carico
 * (capitale investito) + valore finale. Sblocca resa totale, P&L e CAGR senza
 * tracciare ogni flusso. È opt-in: senza `carico` nessun rendimento.
 *
 * - Aperti: valore = ultimo snapshot, fine = asOf, lordo = netto.
 * - Chiusi (`uscitaIl`): ricavato lordo/netto + data uscita.
 *
 * Il CAGR è una stima lump-sum (assume il carico entrato a `caricoDal`):
 * la resa totale è esatta, l'annualizzazione no se i versamenti sono scaglionati.
 */
export interface ManualReturn {
  carico: number;
  from: IsoDate;
  to: IsoDate;
  valoreLordo: number;
  valoreNetto: number;
  resaLorda: number;
  resaNetta: number;
  cagrLordo?: number;
  cagrNetto?: number;
  plLordo: number;
  plNetto: number;
  closed: boolean;
}

const MS_PER_DAY = 86_400_000;

export function deriveManualReturn(
  account: PatrimonioAccount,
  snapshots: SnapshotEntry[],
  asOf: IsoDate,
): ManualReturn | undefined {
  if (account.carico === undefined || account.carico <= 0) return undefined;
  const carico = account.carico;

  const own = snapshots
    .filter((s) => s.accountId === account.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const from = account.caricoDal ?? own[0]?.date;
  if (!from) return undefined;

  const closed = account.uscitaIl !== undefined;
  let to: IsoDate;
  let valoreLordo: number;
  let valoreNetto: number;
  if (closed) {
    to = account.uscitaIl!;
    valoreLordo = account.uscitaLordo ?? 0;
    valoreNetto = account.uscitaNetto ?? valoreLordo;
  } else {
    to = asOf;
    valoreLordo = own.length > 0 ? own[own.length - 1]!.value : 0;
    valoreNetto = valoreLordo; // nessun costo d'uscita per i conti ancora aperti
  }

  const resaLorda = (valoreLordo - carico) / carico;
  const resaNetta = (valoreNetto - carico) / carico;
  const days = (Date.parse(to) - Date.parse(from)) / MS_PER_DAY;

  const out: ManualReturn = {
    carico,
    from,
    to,
    valoreLordo,
    valoreNetto,
    resaLorda,
    resaNetta,
    plLordo: valoreLordo - carico,
    plNetto: valoreNetto - carico,
    closed,
  };
  // annualizza solo su finestre ≥ 90 giorni e valori positivi (CAGR indefinito
  // se il valore finale è ≤ 0).
  if (days >= 90 && valoreLordo > 0) out.cagrLordo = (valoreLordo / carico) ** (365 / days) - 1;
  if (days >= 90 && valoreNetto > 0) out.cagrNetto = (valoreNetto / carico) ** (365 / days) - 1;
  return out;
}
