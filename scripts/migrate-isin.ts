// Migrazione one-shot: commodity = ISIN per TUTTI gli strumenti.
//
// Storia: prima il commodity beancount era l'ISIN per i bond ma il ticker
// Directa (sanitizzato) per ETF/azioni. Ora `commodityFor` usa sempre l'ISIN
// (src/core/import/mapping.ts) e il ticker è solo metadato di display sulla
// direttiva commodity. Questo script porta i ledger ESISTENTI allo stesso
// formato: rinomina il commodity (currency) e il leaf dei conti per-strumento
// in accounts.beancount / movimenti.beancount / prices.beancount, e il campo
// `commodity` in patrimonio.toml. I bond, già su ISIN, restano invariati.
//
// La mappa ticker→ISIN si ricava dalle direttive `commodity` (hanno già sia
// `currency` sia il meta `isin`). È idempotente: se ogni currency è già l'ISIN
// non scrive nulla. Validazione finale col motore di booking del progetto
// (stessi controlli bilanci/FIFO dell'app), perché bean-check non è richiesto.
//
// Uso:
//   npx vite-node scripts/migrate-isin.ts -- <cartella-dati>
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Directive } from "../src/core/beancount/ast";
import { book } from "../src/core/beancount/booking";
import { parse } from "../src/core/beancount/parser";
import { serialize } from "../src/core/beancount/serializer";
import { sanitizeAccountSegment } from "../src/core/import/mapping";

const args = process.argv.slice(2).filter((a) => a !== "--");
const dataDir = args.find((a) => !a.startsWith("--"));
if (!dataDir) {
  console.error("uso: vite-node scripts/migrate-isin.ts -- <cartella-dati>");
  process.exit(1);
}

const ledgerDir = join(dataDir, "ledger");
const FILES = {
  accounts: join(ledgerDir, "accounts.beancount"),
  movimenti: join(ledgerDir, "movimenti.beancount"),
  prices: join(ledgerDir, "prices.beancount"),
};
const tomlPath = join(dataDir, "patrimonio.toml");

// --- 1. mappa currency-attuale → ISIN dalle direttive commodity ----------
const accountsText = readFileSync(FILES.accounts, "utf8");
const accountsLedger = parse(accountsText);

const cur2isin = new Map<string, string>(); // es. "VWCE" → "IE00BK5BQT80"
const leaf2isin = new Map<string, string>(); // leaf conto es. "X-36BZ" → ISIN
for (const d of accountsLedger.directives) {
  if (d.kind !== "commodity") continue;
  const isin = d.meta["isin"];
  if (!isin || isin === d.currency) continue; // bond: già ISIN, no-op
  cur2isin.set(d.currency, isin);
  leaf2isin.set(sanitizeAccountSegment(d.currency), isin);
}

if (cur2isin.size === 0) {
  console.log("già migrato: ogni commodity è già il suo ISIN. Niente da fare.");
  process.exit(0);
}

console.log(`strumenti da migrare: ${cur2isin.size}`);
for (const [cur, isin] of cur2isin) console.log(`  ${cur} → ${isin}`);

// --- 2. funzioni di rimappatura ------------------------------------------
const remapCur = (cur: string): string => cur2isin.get(cur) ?? cur;

/** Rimappa il leaf di un conto per-strumento (Assets:Broker:* o Income:*). */
function remapAccount(account: string): string {
  if (!account.startsWith("Assets:Broker:") && !account.startsWith("Income:")) return account;
  const i = account.lastIndexOf(":");
  const leaf = account.slice(i + 1);
  const isin = leaf2isin.get(leaf);
  return isin ? `${account.slice(0, i + 1)}${isin}` : account;
}

/** Muta una direttiva in-place; ritorna true se è cambiata (→ va riformattata). */
function migrateDirective(d: Directive): boolean {
  let changed = false;
  const setIfChanged = (oldV: string, newV: string) => {
    if (oldV !== newV) changed = true;
    return newV;
  };
  switch (d.kind) {
    case "commodity":
      d.currency = setIfChanged(d.currency, remapCur(d.currency));
      break;
    case "price":
      d.currency = setIfChanged(d.currency, remapCur(d.currency));
      break;
    case "open":
      d.account = setIfChanged(d.account, remapAccount(d.account));
      d.currencies = d.currencies.map((c) => setIfChanged(c, remapCur(c)));
      break;
    case "balance":
      d.account = setIfChanged(d.account, remapAccount(d.account));
      d.amount.currency = setIfChanged(d.amount.currency, remapCur(d.amount.currency));
      break;
    case "transaction": {
      if (d.meta["instrument"])
        d.meta["instrument"] = setIfChanged(d.meta["instrument"], remapCur(d.meta["instrument"]));
      for (const p of d.postings) {
        p.account = setIfChanged(p.account, remapAccount(p.account));
        if (p.amount)
          p.amount.currency = setIfChanged(p.amount.currency, remapCur(p.amount.currency));
        if (p.cost?.currency)
          p.cost.currency = setIfChanged(p.cost.currency, remapCur(p.cost.currency));
        if (p.meta["instrument"])
          p.meta["instrument"] = setIfChanged(p.meta["instrument"], remapCur(p.meta["instrument"]));
      }
      break;
    }
  }
  if (changed) delete (d as { src?: string }).src; // forza riformattazione
  return changed;
}

// --- 3. backup + migrazione dei tre file ---------------------------------
function backup(path: string) {
  const bak = `${path}.premigrate.bak`;
  if (existsSync(bak)) {
    console.log(`backup già presente, non sovrascritto: ${bak}`);
    return;
  }
  copyFileSync(path, bak);
  console.log(`backup: ${bak}`);
}

let totalChanged = 0;
for (const path of [FILES.accounts, FILES.movimenti, FILES.prices]) {
  backup(path);
  const ledger = path === FILES.accounts ? accountsLedger : parse(readFileSync(path, "utf8"));
  let n = 0;
  for (const d of ledger.directives) if (migrateDirective(d)) n++;
  writeFileSync(path, serialize(ledger));
  totalChanged += n;
  console.log(`${path.split("/").pop()}: ${n} direttive riscritte`);
}

// --- 4. patrimonio.toml: campo commodity ---------------------------------
backup(tomlPath);
const tomlText = readFileSync(tomlPath, "utf8");
let tomlChanged = 0;
const tomlOut = tomlText
  .split("\n")
  .map((line) => {
    const m = line.match(/^(\s*commodity\s*=\s*)"([^"]+)"(.*)$/);
    if (!m) return line;
    const isin = cur2isin.get(m[2]!);
    if (!isin) return line;
    tomlChanged++;
    return `${m[1]}"${isin}"${m[3]}`;
  })
  .join("\n");
writeFileSync(tomlPath, tomlOut);
console.log(`patrimonio.toml: ${tomlChanged} campi commodity riscritti`);

// --- 5. validazione col motore di booking del progetto -------------------
const merged = [
  readFileSync(FILES.accounts, "utf8"),
  readFileSync(FILES.movimenti, "utf8"),
  readFileSync(FILES.prices, "utf8"),
].join("\n");
const result = book(parse(merged).directives);
if (result.errors.length > 0) {
  console.error(`\n❌ validazione FALLITA: ${result.errors.length} errori di booking`);
  for (const e of result.errors.slice(0, 10)) console.error(`  - ${e}`);
  console.error("\nRipristina dai file *.premigrate.bak se necessario.");
  process.exit(1);
}

console.log(
  `\n✅ migrazione completata: ${totalChanged} direttive nel ledger + ${tomlChanged} in patrimonio.toml. Booking pulito (0 errori).`,
);
