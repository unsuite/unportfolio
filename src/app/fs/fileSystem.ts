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
  const root = await window.showDirectoryPicker({
    mode: "readwrite",
    id: "unportfolio-data",
    startIn: "documents",
  });
  await idbSet("dataDir", root);
  return new DataStore("fsa", root, await opfsBackupDir());
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

/** Skeleton files for an empty data folder. */
export function skeletonFiles(): Map<DataFilePath, string> {
  return new Map<DataFilePath, string>([
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
