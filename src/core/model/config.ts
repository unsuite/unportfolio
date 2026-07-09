import type { IsoDate } from "../beancount/ast";

/** Goal definition (goals.toml). */
export interface Goal {
  id: string;
  attivo: boolean;
  tipo: string; // Liquidità | Emergency Fund | Investimento a lungo | Spese Previste Prevedibili
  owner: string;
  portfolio: string;
  descrizione?: string;
  /** explicit target; if absent, costoStimato × probabilita */
  target?: number;
  costoStimato?: number;
  probabilita?: number;
  dataTarget?: IsoDate;
}

export type Sezione = "debt" | "credit" | "cash" | "asset";

/**
 * Conto titoli / deposito (config.toml [[deposito]]). Entità di prima classe:
 * più rapporti possono insistere sullo stesso broker, ognuno con owner e
 * aliquota di bollo propri.
 *
 * `id` è anche il segmento di account nel ledger
 * (`Assets:Broker:<id>:<commodity>`): stabile, unico, mai ricalcolato su
 * rinomina. Per il deposito pre-esistente resta `Directa`, così lo storico
 * combacia senza riscritture.
 */
/** Cadenza di addebito del bollo titoli da parte del broker. */
export type BolloPeriodicita = "annuale" | "semestrale" | "trimestrale";

export interface Deposito {
  id: string; // = segmento di account ledger (es. "Directa", "DirectaAlessandra")
  nome: string; // etichetta leggibile
  owner: string;
  broker: string; // attributo descrittivo; più depositi possono condividerlo
  aliquota: number; // frazione annua del bollo titoli (default 0.002 = 0,20%)
  periodicita: BolloPeriodicita; // cadenza di addebito (default annuale)
}

/** aliquota di bollo titoli di default: 0,20% annuo (2 per mille). */
export const DEFAULT_BOLLO_ALIQUOTA = 0.002;

/** numero di addebiti l'anno per periodicità. */
export const BOLLO_PERIODI: Record<BolloPeriodicita, number> = {
  annuale: 1,
  semestrale: 2,
  trimestrale: 4,
};

/** Split percentuale per asset class di un account composito (es. fondo pensione). */
export interface AccountSplit {
  classe: string; // Bond | Stock | ...
  peso: number; // 0..1
}

/** Patrimonio row definition (patrimonio.toml). */
export interface PatrimonioAccount {
  id: string; // key referenced by snapshots.csv
  nome: string;
  sezione: Sezione;
  tipo: string; // Liquidity | High Yield Savings | Debt | Credit | p2p | ...
  owner: string;
  portfolio?: string; // goal-portfolio assignment
  /** conto titoli di appartenenza (Deposito.id); soggetto a bollo titoli.
   *  per i conti ledger-backed individua il sottoalbero da cui leggere le unità */
  deposito?: string;
  inNetWorth: boolean;
  valuta: string;
  /** when set, the value comes from the ledger: units × price at date */
  commodity?: string;
  /** account composito: distribuzione del valore per asset class */
  split?: AccountSplit[];
  /** opt-in rendimento per conti manuali: costo/capitale investito (prezzo di
   *  carico). Senza questo, il conto mostra solo la traiettoria di valore. */
  carico?: number;
  /** data di inizio per il rendimento; assente = primo snapshot del conto */
  caricoDal?: IsoDate;
  /** posizione manuale chiusa: ricavato lordo dell'uscita */
  uscitaLordo?: number;
  /** ricavato netto dell'uscita (lordo − commissioni − tasse) */
  uscitaNetto?: number;
  /** data di chiusura/uscita */
  uscitaIl?: IsoDate;
}

/** Target di ribilanciamento (targets.toml): peso desiderato di uno strumento nel suo portfolio. */
export interface RebalanceTarget {
  portfolio: string;
  commodity: string;
  peso: number; // 0..1
  /** posizione congelata: ideale = corrente, esclusa dal montante da ridistribuire */
  fisso?: boolean;
  /** fuori dalla matematica del ribilanciamento: nessun totale/percentuale/ideale */
  escluso?: boolean;
}

export interface SnapshotEntry {
  date: IsoDate;
  accountId: string;
  value: number;
  currency: string;
}

/** Arco del grafo di esubero: il surplus di `da` confluisce in `verso`. */
export interface EsuberoFlusso {
  da: string;
  verso: string;
}

/** Posizione salvata di un nodo nell'editor grafico dell'esubero. */
export interface NodoPos {
  portfolio: string;
  x: number;
  y: number;
}

export interface AppConfig {
  /** versione del formato della cartella dati (config.toml `formato_dati`);
   *  assente = cartella pre-versionamento. Vedi core/config/format.ts */
  formatoDati?: number;
  operatingCurrency: string;
  /** waterfall order of portfolios for Goal Status (fallback se non c'è il grafo) */
  priorita: string[];
  /** grafo di esubero esplicito: se presente prevale sulla lista lineare */
  esuberoFlussi: EsuberoFlusso[];
  /** posizioni dei nodi nell'editor grafico; vuoto = auto-layout */
  esuberoLayout: NodoPos[];
  defaultBroker: string;
  /** conti titoli configurati (per la stima del bollo e l'attribuzione import) */
  depositi: Deposito[];
  /** anni di storico prezzi da mantenere (copertura incrementale) */
  storicoAnni: number;
  /** intervallo di campionamento dello storico: 1d | 1wk | 1mo */
  storicoIntervallo: string;
  /**
   * percorso assoluto della cartella dati, scritto dal CLI prezzi
   * (il browser non può rilevarlo: la File System Access API non espone
   * i percorsi, solo handle opachi)
   */
  percorsoDati?: string;
  /** profili per il calcolo pensione (foglio 3); una persona per voce */
  pensioni: PensionProfile[];
  /**
   * portafogli da considerare come capitale destinato alla pensione nel
   * confronto col target di nucleo; vuoto = patrimonio netto totale
   */
  pensionePortafogli: string[];
}

/** input del calcolo pensione, persistito in [[pensione]] di config.toml */
export interface PensionProfile {
  /** etichetta libera della persona (es. "Gabriele") */
  nome: string;
  dataNascita: string;
  etaPensionamento: number;
  etaDecesso: number;
  speseAnnuali: number;
  rendimentoPre: number;
  rendimentoPost: number;
  /**
   * portafogli da considerare come capitale destinato alla pensione di questa
   * persona, nel confronto col suo target; vuoto = patrimonio netto totale
   */
  portafogli: string[];
}
