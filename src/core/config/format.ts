/**
 * Versionamento del formato della cartella dati.
 *
 * La cartella porta un marcatore `formato_dati` in config.toml. L'app conosce la
 * versione corrente (`DATA_FORMAT`) e la minima apribile senza migrazione forzata
 * (`DATA_FORMAT_MIN`). Confrontando le due si decide se la cartella è a posto, se
 * conviene aggiornarla (auto-migrazione silenziosa) o se va aggiornata per forza
 * (scritture bloccate finché non si migra), oppure se è l'app a essere più
 * vecchia dei dati.
 *
 * Le migrazioni sono funzioni pure sulla mappa path→testo dei file (dati utente
 * compresi): `MIGRATIONS[n]` porta dalla versione n alla n+1.
 */

/** Versione corrente del formato. Bump a ogni cambiamento incompatibile del
 *  layout dei file (chiavi TOML, struttura ledger, semantica CSV, …). */
export const DATA_FORMAT = 1;

/** Versione minima apribile senza migrazione forzata. Sotto questa soglia le
 *  scritture vanno bloccate: l'app non capisce più abbastanza il formato per
 *  modificarlo senza rischiare di corromperlo. */
export const DATA_FORMAT_MIN = 0;

/** Marcatore assente in config.toml = cartella pre-versionamento. */
export const UNVERSIONED = 0;

export type FormatStatus =
  | "ok" // = DATA_FORMAT: niente da fare
  | "consigliato" // MIN ≤ v < DATA_FORMAT: auto-migrabile in sicurezza
  | "richiesto" // v < MIN: scritture bloccate finché non si migra
  | "app-vecchia"; // v > DATA_FORMAT: è l'app a essere indietro

export function formatStatus(version: number): FormatStatus {
  if (version > DATA_FORMAT) return "app-vecchia";
  if (version === DATA_FORMAT) return "ok";
  if (version < DATA_FORMAT_MIN) return "richiesto";
  return "consigliato";
}

/** Trasforma i file dalla versione `from` alla `from + 1`. */
export type Migration = (files: Map<string, string>) => Map<string, string>;

/**
 * Registro delle migrazioni dei dati. Vuoto oggi: il formato 1 è il primo
 * versionato e non serve trasformare i dati utente (il passaggio 0→1 è solo
 * marcatura + risincronizzazione dei file gestiti). Le voci future si aggiungono
 * qui, una per salto di versione.
 */
export const MIGRATIONS: Record<number, Migration> = {};

/** Applica in sequenza `registry[from], registry[from+1], …, registry[to-1]`,
 *  saltando i passi senza voce (nessuna trasformazione dati per quel salto). */
export function applyMigrations(
  files: Map<string, string>,
  from: number,
  to: number,
  registry: Record<number, Migration>,
): Map<string, string> {
  let out = files;
  for (let v = from; v < to; v++) {
    const step = registry[v];
    if (step) out = step(out);
  }
  return out;
}

/** Migra i file da `from` fino a DATA_FORMAT. Se `from` è già ≥ DATA_FORMAT
 *  (cartella pari o più recente dell'app) non tocca nulla. */
export function runMigrations(
  files: Map<string, string>,
  from: number,
): { files: Map<string, string>; to: number } {
  if (from >= DATA_FORMAT) return { files, to: from };
  return { files: applyMigrations(files, from, DATA_FORMAT, MIGRATIONS), to: DATA_FORMAT };
}
