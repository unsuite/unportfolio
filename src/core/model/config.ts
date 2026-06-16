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
  operatingCurrency: string;
  /** waterfall order of portfolios for Goal Status (fallback se non c'è il grafo) */
  priorita: string[];
  /** grafo di esubero esplicito: se presente prevale sulla lista lineare */
  esuberoFlussi: EsuberoFlusso[];
  /** posizioni dei nodi nell'editor grafico; vuoto = auto-layout */
  esuberoLayout: NodoPos[];
  defaultBroker: string;
  /** anni di storico prezzi da mantenere (copertura incrementale) */
  storicoAnni: number;
  /** intervallo di campionamento dello storico: 1d | 1wk | 1mo */
  storicoIntervallo: string;
  /**
   * percorso assoluto della cartella dati, scritto dal CLI prices.mjs
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
