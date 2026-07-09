/**
 * Storage layer: File System Access API (user-picked directory) with OPFS
 * fallback (demo mode) and OPFS mirror as crash backup.
 */

export const DATA_FILES = [
  "ledger/main.beancount",
  "ledger/accounts.beancount",
  "ledger/movimenti.beancount",
  "ledger/prices.beancount",
  "patrimonio.toml",
  "goals.toml",
  "targets.toml",
  "snapshots.csv",
  "config.toml",
] as const;

export type DataFilePath = (typeof DATA_FILES)[number];

export interface FileSnapshot {
  text: string;
  lastModified: number;
}

const IDB_NAME = "unportfolio";
const IDB_STORE = "handles";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getDir(
  root: FileSystemDirectoryHandle,
  path: string,
  create: boolean,
): Promise<{ dir: FileSystemDirectoryHandle; name: string }> {
  const parts = path.split("/");
  const name = parts.pop()!;
  let dir = root;
  for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
  return { dir, name };
}

export class DataStore {
  constructor(
    public readonly kind: "fsa" | "opfs",
    private readonly root: FileSystemDirectoryHandle,
    private readonly mirror?: FileSystemDirectoryHandle,
  ) {}

  get label(): string {
    return this.kind === "fsa" ? this.root.name : "browser (OPFS demo)";
  }

  async read(path: string): Promise<FileSnapshot | undefined> {
    try {
      const { dir, name } = await getDir(this.root, path, false);
      const fh = await dir.getFileHandle(name);
      const file = await fh.getFile();
      return { text: await file.text(), lastModified: file.lastModified };
    } catch {
      return undefined;
    }
  }

  async stat(path: string): Promise<number | undefined> {
    try {
      const { dir, name } = await getDir(this.root, path, false);
      const fh = await dir.getFileHandle(name);
      return (await fh.getFile()).lastModified;
    } catch {
      return undefined;
    }
  }

  async write(path: string, text: string): Promise<number> {
    const { dir, name } = await getDir(this.root, path, true);
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
    if (this.mirror) {
      try {
        const { dir: mdir, name: mname } = await getDir(this.mirror, path, true);
        const mfh = await mdir.getFileHandle(mname, { create: true });
        const mw = await mfh.createWritable();
        await mw.write(text);
        await mw.close();
      } catch {
        // mirror best-effort
      }
    }
    return (await fh.getFile()).lastModified;
  }

  async readAll(): Promise<Map<string, FileSnapshot>> {
    const out = new Map<string, FileSnapshot>();
    for (const path of DATA_FILES) {
      const snap = await this.read(path);
      if (snap) out.set(path, snap);
    }
    return out;
  }
}

async function opfsBackupDir(): Promise<FileSystemDirectoryHandle | undefined> {
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle("backup", { create: true });
  } catch {
    return undefined;
  }
}

/** Ask the user to pick the data directory; persist the handle. */
export async function pickDirectory(): Promise<DataStore> {
  // Niente `id`/`startIn`: su alcuni browser (es. Arc) quelle opzioni fanno
  // restare appeso showDirectoryPicker; la forma nuda è quella che apre sempre.
  const root = await window.showDirectoryPicker({ mode: "readwrite" });
  await idbSet("dataDir", root);
  return new DataStore("fsa", root, await opfsBackupDir());
}

/**
 * Sblocco/reset lato client: dimentica l'handle salvato (su browser che non
 * persistono il permesso FSA, es. Arc, il re-grant si pianta: meglio ripartire
 * da una scelta pulita) e rimuove service worker + cache così al reload gira la
 * build aggiornata. NON tocca l'OPFS: dati demo e backup di sicurezza restano.
 */
export async function resetClientState(): Promise<void> {
  await forgetDirectory();
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

/** Dimentica l'handle persistito: al prossimo avvio si torna all'onboarding. */
export async function forgetDirectory(): Promise<void> {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete("dataDir");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export type RestoreResult =
  | { status: "ok"; store: DataStore }
  | { status: "needs-permission"; handle: FileSystemDirectoryHandle }
  | { status: "none" };

/** Try to restore the persisted handle without a user gesture. */
export async function restoreDirectory(): Promise<RestoreResult> {
  const handle = await idbGet<FileSystemDirectoryHandle>("dataDir");
  if (!handle) {
    console.debug("[unportfolio:fs] restore: nessun handle in IndexedDB");
    return { status: "none" };
  }
  const perm = await handle.queryPermission({ mode: "readwrite" });
  console.debug(`[unportfolio:fs] restore: handle "${handle.name}", permesso=${perm}`);
  if (perm === "granted")
    return {
      status: "ok",
      store: new DataStore("fsa", handle, await opfsBackupDir()),
    };
  return { status: "needs-permission", handle };
}

/** Re-request permission (requires a user gesture). */
export async function requestPermission(
  handle: FileSystemDirectoryHandle,
): Promise<DataStore | undefined> {
  const perm = await handle.requestPermission({ mode: "readwrite" });
  console.debug(`[unportfolio:fs] requestPermission: esito=${perm}`);
  if (perm !== "granted") return undefined;
  return new DataStore("fsa", handle, await opfsBackupDir());
}

/** Demo mode: everything lives in the browser's origin-private FS. */
export async function opfsStore(): Promise<DataStore> {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle("data", { create: true });
  return new DataStore("opfs", dir);
}

/**
 * AGENTS.md scritto nella cartella dati: onboarding per un LLM "inconsapevole"
 * che apre la cartella e deve capire da solo cos'è (ledger beancount valido +
 * TOML/CSV), le convenzioni e come aggiornare i prezzi col CLI installato.
 * Duplicato in public/init.sh per l'onboarding via curl (nessun runtime).
 */
export const AGENTS_MD = `# unportfolio — cartella dati

Questa cartella è il database di **unportfolio**, un'app locale per net worth,
portafoglio e obiettivi. Nessun backend: sono file in chiaro, versionabili in
git. Se stai analizzando questa cartella, parti da qui.

## Il ledger è beancount v2 valido

\`ledger/\` si usa senza conversioni:

\`\`\`sh
bean-check ledger/main.beancount                        # valida
bean-query ledger/main.beancount "SELECT account, sum(position)"   # interroga
fava ledger/main.beancount                              # UI web
\`\`\`

- \`ledger/main.beancount\` — opzioni + \`include\`: è il punto d'ingresso.
- \`ledger/accounts.beancount\` — \`open\` + \`commodity\` (**rigenerato dall'app**, non editarlo a mano).
- \`ledger/movimenti.beancount\` — transazioni (append per batch di import).
- \`ledger/prices.beancount\` — direttive \`price\` campionate (storico prezzi).

## Convenzioni (rilevanti per l'analisi)

- **La commodity di ogni strumento è l'ISIN**, non il ticker; il ticker è solo
  metadato di display (\`ticker\` sulla direttiva \`commodity\`).
- **Bond in lotti da 100 di nominale**: 5.000 € nominali = 50 unità, così il
  prezzo (% del nominale) è letteralmente il prezzo unitario.
- Vendite con booking **FIFO**.
- Metadati strumento (classe, tassa, scadenza, cedola, sorgente prezzo) sulle
  direttive \`commodity\`.
- Dedupe import via metadato \`import-id\`: re-importare lo stesso file non duplica.

## File di configurazione (TOML/CSV)

- \`patrimonio.toml\` — righe del Patrimonio (sezione, owner, portfolio, split).
  L'**etichetta** mostrata di uno strumento è il campo \`nome\` qui.
- \`goals.toml\` — obiettivi. \`targets.toml\` — pesi target del ribilanciamento (vedi sotto).
- \`snapshots.csv\` — saldi manuali periodici. Header: \`date,account_id,value,currency\`.
- \`config.toml\` — \`percorso_dati\` (path assoluto, annotato dal CLI) e \`[prezzi]\`
  (\`anni\`, \`intervallo\`) che definisce la copertura dello storico.

## Ribilanciamento (targets.toml)

Per ogni \`(portfolio, commodity)\` \`targets.toml\` tiene il peso target \`peso\`
(frazione 0..1) e due flag opzionali che cambiano come lo strumento entra nel
calcolo. **Attenzione a non confonderli:**

- \`fisso = true\` — posizione **congelata**: non si compra **né si vende**, resta
  al valore corrente (ideale = corrente, "da comprare" = 0). Il suo peso **conta
  ancora** nella percentuale target mostrata, ma il suo valore **esce dal
  montante** da ridistribuire: gli altri si spartiscono \`(totale + liquidità −
  fissi)\` coi loro pesi rinormalizzati.
- \`escluso = true\` — **fuori da tutta la matematica**: non entra nel totale, nelle
  percentuali né nel montante, e non ha ideale né "da comprare". Non è solo
  "fuori dai pesi": è ignorato del tutto (riga di solo promemoria).

I due flag sono **mutuamente esclusivi**. Uno strumento senza flag con \`peso > 0\`
è un normale target ribilanciabile; se non ha riga in \`targets.toml\` vale 0.

## Aggiornare i prezzi (CLI)

I prezzi si aggiornano **solo da terminale** (niente CORS/proxy): ETF via Yahoo
(simboli risolti dall'ISIN), bond MOT via Borsa Italiana. Campiona una \`price\`
per giorno/strumento in \`ledger/prices.beancount\`.

Col binario installato (\`~/.local/bin/unportfolio-prices\`):

\`\`\`sh
unportfolio-prices "<questa-cartella>"                              # incrementale
unportfolio-prices "<questa-cartella>" --re-resolve                 # rifà la gara dei simboli
unportfolio-prices "<questa-cartella>" --set X.WBIT=yahoo:WBTC.PA   # binding manuale
\`\`\`

Se il binario non c'è, un solo comando lo installa (self-contained, nessun
runtime) e aggiorna:

\`\`\`sh
curl -fsSL https://unsuite.github.io/unportfolio/init.sh | sh -s -- "<questa-cartella>" --prezzi
\`\`\`

Dal repo sorgente: \`npx vite-node scripts/prices.ts -- <cartella>\`.

## Se modifichi questa cartella

- Le transazioni si aggiungono in \`ledger/movimenti.beancount\` (append).
- Dopo modifiche al ledger valida con \`bean-check ledger/main.beancount\`.
- I prezzi si aggiornano col CLI, non a mano.
`;

/**
 * File "gestiti" dall'app: contenuto generato, non dati utente. Vengono
 * riscritti agli aggiornamenti di formato (vedi store.applyFormatUpgrade), così
 * un AGENTS.md vecchio si allinea da solo. NON includere qui nulla che l'utente
 * possa editare (patrimonio/goals/targets/snapshots/config): quello non si tocca.
 */
export function managedFiles(): Map<string, string> {
  return new Map<string, string>([["AGENTS.md", AGENTS_MD]]);
}

/** Skeleton files for an empty data folder (AGENTS.md incluso). */
export function skeletonFiles(): Map<string, string> {
  return new Map<string, string>([
    ["AGENTS.md", AGENTS_MD],
    [
      "ledger/main.beancount",
      [
        'option "title" "unportfolio"',
        'option "operating_currency" "EUR"',
        "",
        'include "accounts.beancount"',
        'include "movimenti.beancount"',
        'include "prices.beancount"',
        "",
      ].join("\n"),
    ],
    ["ledger/accounts.beancount", "; generato dall'app (open + commodity)\n"],
    ["ledger/movimenti.beancount", "; transazioni importate\n"],
    ["ledger/prices.beancount", "; prezzi campionati\n"],
    ["patrimonio.toml", "# righe del patrimonio\n"],
    ["goals.toml", "# obiettivi\n"],
    ["targets.toml", "# pesi target per il ribilanciamento\n"],
    ["snapshots.csv", "date,account_id,value,currency\n"],
    [
      "config.toml",
      'operating_currency = "EUR"\ndefault_broker = "Directa"\npriorita = []\n\n[prezzi]\nanni = 2\nintervallo = "1wk"\n',
    ],
  ]);
}
