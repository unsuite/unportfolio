import type { Decimal } from "decimal.js";
import type { Directive, IsoDate, LedgerFile } from "../../core/beancount/ast";
import { book } from "../../core/beancount/booking";
import { parse } from "../../core/beancount/parser";
import { formatDirective, serialize } from "../../core/beancount/serializer";
import {
  parseAccounts,
  parseConfig,
  parseGoals,
  parseSnapshots,
  parseTargets,
  serializeSnapshots,
} from "../../core/config/codecs";
import { missingAssetAccounts } from "../../core/config/reconcile";
// (i codec per i salvataggi CRUD sono importati dinamicamente nelle funzioni)
import { readCommodityInfo } from "../../core/derive/assets";
import type {
  AppConfig,
  Deposito,
  Goal,
  PatrimonioAccount,
  RebalanceTarget,
  SnapshotEntry,
} from "../../core/model/config";
import { type DataFilePath, type DataStore, skeletonFiles } from "../fs/fileSystem";

export interface AppState {
  version: number;
  store?: DataStore;
  /** raw text + lastModified per file */
  files: Map<string, { text: string; lastModified: number }>;
  /** parsed ledger files, by path */
  ledgers: Map<string, LedgerFile>;
  goals: Goal[];
  accounts: PatrimonioAccount[];
  snapshots: SnapshotEntry[];
  targets: RebalanceTarget[];
  config: AppConfig;
  /** live quotes fetched this session */
  quotes: Map<string, Decimal>;
  busy: boolean;
  notices: string[];
}

const DEFAULT_CONFIG: AppConfig = {
  operatingCurrency: "EUR",
  priorita: [],
  esuberoFlussi: [],
  esuberoLayout: [],
  defaultBroker: "Directa",
  depositi: [],
  storicoAnni: 2,
  storicoIntervallo: "1wk",
  pensioni: [],
  pensionePortafogli: [],
};

let state: AppState = {
  version: 0,
  files: new Map(),
  ledgers: new Map(),
  goals: [],
  accounts: [],
  snapshots: [],
  targets: [],
  config: DEFAULT_CONFIG,
  quotes: new Map(),
  busy: false,
  notices: [],
};

const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState(): AppState {
  return state;
}

function emit(partial: Partial<AppState>): void {
  state = { ...state, ...partial, version: state.version + 1 };
  for (const fn of listeners) fn();
}

export function notify(msg: string): void {
  emit({ notices: [...state.notices, msg].slice(-5) });
}

export function dismissNotices(): void {
  emit({ notices: [] });
}

const LEDGER_PATHS = [
  "ledger/accounts.beancount",
  "ledger/movimenti.beancount",
  "ledger/prices.beancount",
];

function reparse(files: AppState["files"]): Partial<AppState> {
  const ledgers = new Map<string, LedgerFile>();
  for (const p of LEDGER_PATHS) {
    const f = files.get(p);
    ledgers.set(p, f ? parse(f.text) : { directives: [] });
  }
  return {
    ledgers,
    goals: parseGoals(files.get("goals.toml")?.text ?? ""),
    accounts: parseAccounts(files.get("patrimonio.toml")?.text ?? ""),
    snapshots: parseSnapshots(files.get("snapshots.csv")?.text ?? ""),
    targets: parseTargets(files.get("targets.toml")?.text ?? ""),
    config: files.get("config.toml") ? parseConfig(files.get("config.toml")!.text) : DEFAULT_CONFIG,
  };
}

/** All ledger directives merged (accounts + movimenti + prices). */
export function allDirectives(s: AppState = state): Directive[] {
  const out: Directive[] = [];
  for (const p of LEDGER_PATHS) {
    const lf = s.ledgers.get(p);
    if (lf) out.push(...lf.directives);
  }
  return out;
}

export async function openStore(store: DataStore): Promise<void> {
  emit({ busy: true });
  try {
    const files = await store.readAll();
    console.debug(`[unportfolio:fs] openStore: ${files.size} file letti`, [...files.keys()]);
    if (files.size === 0) {
      // init skeleton
      console.debug("[unportfolio:fs] openStore: cartella vuota, scrivo lo scheletro");
      for (const [path, text] of skeletonFiles()) {
        const lastModified = await store.write(path, text);
        files.set(path, { text, lastModified });
      }
    }
    let parsed: Partial<AppState>;
    try {
      parsed = reparse(files);
    } catch (e) {
      console.error("[unportfolio:fs] openStore: errore nel parsing dei file", e);
      throw new Error(`parsing dei file fallito: ${String(e)}`);
    }
    emit({ store, files, ...parsed, busy: false });
    console.debug("[unportfolio:fs] openStore: store aperto");
    await reconcileAssetAccounts();
  } catch (e) {
    console.error("[unportfolio:fs] openStore: errore", e);
    emit({ busy: false });
    notify(`errore apertura cartella: ${String(e)}`);
  }
}

/**
 * Crea un conto patrimonio per ogni strumento del ledger che non ne ha ancora
 * uno (così commodity↔conto è sempre 1:1 e l'etichetta è il `nome` del conto).
 * Idempotente: scrive patrimonio.toml solo quando manca davvero un conto.
 */
export async function reconcileAssetAccounts(): Promise<boolean> {
  const directives = allDirectives();
  const commodities = readCommodityInfo(directives);
  const { positions } = book(directives, { operatingCurrency: state.config.operatingCurrency });
  const missing = missingAssetAccounts(positions, commodities, state.accounts);
  if (missing.length === 0) return false;
  const { serializeAccounts } = await import("../../core/config/codecs");
  const next = [...state.accounts, ...missing];
  const ok = await writeFile("patrimonio.toml", serializeAccounts(next));
  if (ok)
    notify(`creati ${missing.length} conti asset mancanti (assegna owner/portfolio in Patrimonio)`);
  return ok;
}

/** Re-read files whose mtime changed on disk (external edits). */
export async function refreshFromDisk(): Promise<void> {
  const store = state.store;
  if (!store) return;
  let changed = false;
  const files = new Map(state.files);
  for (const [path, snap] of state.files) {
    const mtime = await store.stat(path);
    if (mtime !== undefined && mtime !== snap.lastModified) {
      const fresh = await store.read(path);
      if (fresh) {
        files.set(path, fresh);
        changed = true;
      }
    }
  }
  if (changed) {
    emit({ files, ...reparse(files) });
    notify("file ricaricati: modifiche esterne rilevate");
  }
}

/** Write-through with conflict detection. */
export async function writeFile(path: DataFilePath, text: string): Promise<boolean> {
  const store = state.store;
  if (!store) return false;
  const known = state.files.get(path)?.lastModified;
  const onDisk = await store.stat(path);
  if (known !== undefined && onDisk !== undefined && onDisk !== known) {
    const overwrite = window.confirm(
      `${path} è stato modificato fuori dall'app.\nOK = sovrascrivi, Annulla = ricarica la versione su disco.`,
    );
    if (!overwrite) {
      await refreshFromDisk();
      return false;
    }
  }
  const lastModified = await store.write(path, text);
  const files = new Map(state.files);
  files.set(path, { text, lastModified });
  emit({ files, ...reparse(files) });
  return true;
}

/** Append directives to a ledger file, preserving existing content losslessly. */
export async function appendToLedger(
  path: "ledger/movimenti.beancount" | "ledger/prices.beancount",
  directives: Directive[],
  header?: string,
): Promise<boolean> {
  const current = state.files.get(path)?.text ?? "";
  const parts = [current];
  if (current !== "" && !current.endsWith("\n")) parts.push("\n");
  if (header) parts.push(`\n; ${header}\n`);
  for (const d of directives) parts.push("\n" + formatDirective(d));
  return writeFile(path, parts.join(""));
}

/** Replace the whole accounts.beancount (regenerable file). */
export async function writeAccountsLedger(directives: Directive[]): Promise<boolean> {
  const text =
    "; generato dall'app (open + commodity)\n\n" + serialize({ directives }).replace(/^\n+/, "");
  return writeFile("ledger/accounts.beancount", text);
}

export async function addSnapshotEntries(entries: SnapshotEntry[]): Promise<boolean> {
  const merged = new Map<string, SnapshotEntry>();
  for (const e of [...state.snapshots, ...entries]) merged.set(`${e.date}|${e.accountId}`, e);
  return writeFile("snapshots.csv", serializeSnapshots([...merged.values()]));
}

/** Elimina lo snapshot di un conto a una certa data (snapshots.csv). */
export async function removeSnapshotEntry(accountId: string, date: IsoDate): Promise<boolean> {
  const next = state.snapshots.filter((e) => !(e.accountId === accountId && e.date === date));
  if (next.length === state.snapshots.length) return false;
  return writeFile("snapshots.csv", serializeSnapshots(next));
}

export function setQuotes(quotes: Map<string, Decimal>): void {
  emit({ quotes: new Map([...state.quotes, ...quotes]) });
}

/** Inserisce o aggiorna una riga di patrimonio.toml (merge per id). */
export async function upsertPatrimonioAccount(account: PatrimonioAccount): Promise<boolean> {
  const { serializeAccounts } = await import("../../core/config/codecs");
  const existing = state.accounts.findIndex((a) => a.id === account.id);
  const next =
    existing >= 0
      ? state.accounts.map((a, i) => (i === existing ? account : a))
      : [...state.accounts, account];
  return writeFile("patrimonio.toml", serializeAccounts(next));
}

/** Elimina una riga di patrimonio.toml. */
export async function deletePatrimonioAccount(id: string): Promise<boolean> {
  const { serializeAccounts } = await import("../../core/config/codecs");
  return writeFile("patrimonio.toml", serializeAccounts(state.accounts.filter((a) => a.id !== id)));
}

/** Sostituisce l'elenco goals (goals.toml). */
export async function saveGoals(goals: Goal[]): Promise<boolean> {
  const { serializeGoals } = await import("../../core/config/codecs");
  return writeFile("goals.toml", serializeGoals(goals));
}

/** Sostituisce i target di ribilanciamento (targets.toml). */
export async function saveTargets(targets: RebalanceTarget[]): Promise<boolean> {
  const { serializeTargets } = await import("../../core/config/codecs");
  return writeFile("targets.toml", serializeTargets(targets));
}

/** Merge parziale di config.toml (usato dall'editor del grafo di esubero). */
export async function updateConfig(patch: Partial<AppConfig>): Promise<boolean> {
  const { serializeConfig } = await import("../../core/config/codecs");
  return writeFile("config.toml", serializeConfig({ ...state.config, ...patch }));
}

/** Inserisce o aggiorna un conto titoli/deposito (merge per id) in config.toml. */
export async function upsertDeposito(deposito: Deposito): Promise<boolean> {
  const existing = state.config.depositi.findIndex((d) => d.id === deposito.id);
  const depositi =
    existing >= 0
      ? state.config.depositi.map((d, i) => (i === existing ? deposito : d))
      : [...state.config.depositi, deposito];
  return updateConfig({ depositi });
}

/** Elimina un conto titoli e ripulisce il riferimento dai conti che lo puntano. */
export async function deleteDeposito(id: string): Promise<boolean> {
  const depositi = state.config.depositi.filter((d) => d.id !== id);
  const ok = await updateConfig({ depositi });
  if (!ok) return false;
  const referenced = state.accounts.filter((a) => a.deposito === id);
  if (referenced.length === 0) return ok;
  const { serializeAccounts } = await import("../../core/config/codecs");
  const next = state.accounts.map((a) => (a.deposito === id ? { ...a, deposito: undefined } : a));
  return writeFile("patrimonio.toml", serializeAccounts(next));
}

/** Edita i metadati di una direttiva commodity in accounts.beancount. */
export async function updateCommodityMeta(
  commodity: string,
  updates: Record<string, string>,
): Promise<boolean> {
  const path = "ledger/accounts.beancount" as const;
  const lf = state.ledgers.get(path);
  if (!lf) return false;
  let found = false;
  const directives = lf.directives.map((d) => {
    if (d.kind !== "commodity" || d.currency !== commodity) return d;
    found = true;
    const { src: _src, ...rest } = d;
    return { ...rest, meta: { ...d.meta, ...updates } };
  });
  if (!found) return false;
  return writeFile(path, serialize({ directives }));
}

/** "Logout": dimentica la cartella e torna all'onboarding. I file restano intatti. */
export async function logout(): Promise<void> {
  const { forgetDirectory } = await import("../fs/fileSystem");
  await forgetDirectory();
  state = {
    version: state.version + 1,
    files: new Map(),
    ledgers: new Map(),
    goals: [],
    accounts: [],
    snapshots: [],
    targets: [],
    config: DEFAULT_CONFIG,
    quotes: new Map(),
    busy: false,
    notices: [],
  };
  for (const fn of listeners) fn();
}
