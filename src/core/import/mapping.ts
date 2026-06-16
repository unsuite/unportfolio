import { Decimal } from "decimal.js";
import type {
  CommodityDirective,
  Directive,
  Meta,
  OpenDirective,
  Posting,
  TransactionDirective,
} from "../beancount/ast";
import type { InstrumentInfo, RawMovimento } from "../model/movimento";

/**
 * Mapping of broker movements to double-entry transactions.
 *
 * Conventions:
 * - commodity = ISIN for every instrument; the ticker is display-only metadata
 *   on the commodity directive (so renaming a ticker never touches the ledger)
 * - bond units = face value / 100, so the %-of-face price is the unit price
 * - every movement has cash effect = importoEuro on Assets:Broker:<broker>:Cash
 * - dedupe via `import-id` transaction metadata (stable content hash)
 */

export interface MappingContext {
  /** lookup by ticker OR isin */
  instrument(key: string): InstrumentInfo | undefined;
  defaultBroker?: string;
}

export interface MappingOutput {
  transactions: TransactionDirective[];
  warnings: string[];
}

const ZERO = new Decimal(0);

export function sanitizeAccountSegment(s: string): string {
  return s.replace(/[^A-Za-z0-9-]/g, "-").replace(/^([a-z])/, (m) => m.toUpperCase());
}

/**
 * Strumento provvisorio per ticker/ISIN mai visti: i codici "M.*" sono
 * obbligazioni nel listino Directa; il resto si assume ETF. Classe e tassa
 * vanno confermate nei metadati commodity.
 */
export function provisionalInstrument(m: RawMovimento): InstrumentInfo | undefined {
  if (!m.ticker || !m.isin) return undefined;
  const isBond = m.ticker.startsWith("M.");
  const info: InstrumentInfo = {
    ticker: m.ticker,
    isin: m.isin,
    assetClass: isBond ? "BOND" : "ETF",
    taxRate: isBond ? 0.125 : 0.26,
    currency: m.divisa || "EUR",
  };
  if (m.descrizione) info.name = m.descrizione;
  if (isBond) info.priceSource = `borsa-italiana:${m.isin}.MOT`;
  return info;
}

export function commodityFor(info: InstrumentInfo): string {
  // ISIN is the source of truth for every instrument; the ticker is kept as
  // display-only metadata on the commodity directive.
  return info.isin;
}

export function instrumentAccount(broker: string, info: InstrumentInfo): string {
  return `Assets:Broker:${sanitizeAccountSegment(broker)}:${sanitizeAccountSegment(commodityFor(info))}`;
}

export function cashAccount(broker: string): string {
  return `Assets:Broker:${sanitizeAccountSegment(broker)}:Cash`;
}

/** Stable content hash (djb2) used as dedupe key. */
export function importId(m: RawMovimento, occurrence: number): string {
  const key = [
    m.broker,
    m.dataOperazione,
    m.tipo,
    m.ticker ?? "",
    m.isin ?? "",
    m.quantita.toString(),
    m.importoEuro.toString(),
    m.riferimentoOrdine ?? "",
    m.protocollo ?? "",
    String(occurrence),
  ].join("|");
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

type CounterAccount =
  | { account: string; perInstrument?: false }
  | { prefix: "Income:Coupons" | "Income:Dividends"; perInstrument: true };

/** Operation table: tipo operazione → counter account for the cash flow. */
const OPERATION_TABLE: Record<string, CounterAccount> = {
  "Conferimento con bonifico": { account: "Equity:Conferimenti" },
  Prelievo: { account: "Equity:Conferimenti" },
  Commissioni: { account: "Expenses:Fees:Broker" },
  "Bollo portafoglio titoli*": { account: "Expenses:Taxes:Bollo" },
  "Bollo portafoglio titoli": { account: "Expenses:Taxes:Bollo" },
  "Ratei pass.obb.": { prefix: "Income:Coupons", perInstrument: true },
  "Cedola obb.": { prefix: "Income:Coupons", perInstrument: true },
  Dividendi: { prefix: "Income:Dividends", perInstrument: true },
  "Rit.cedola obb.": { account: "Expenses:Taxes:Withholding" },
  "Rit.ratei pass.obb.": { account: "Expenses:Taxes:Withholding" },
  "Rit.credito disaggio": { account: "Expenses:Taxes:Withholding" },
  "Rit. etf": { account: "Expenses:Taxes:Withholding" },
};

function baseMeta(m: RawMovimento, occurrence: number): Meta {
  const meta: Meta = { "import-id": importId(m, occurrence) };
  if (m.riferimentoOrdine) meta["ordine"] = m.riferimentoOrdine;
  if (m.protocollo) meta["protocollo"] = m.protocollo;
  return meta;
}

export function movimentoToTransaction(
  m: RawMovimento,
  ctx: MappingContext,
  occurrence = 0,
): TransactionDirective | string {
  const broker = m.broker || ctx.defaultBroker || "Unknown";
  const cash = cashAccount(broker);
  const narration = m.descrizione?.trim() ? `${m.tipo} — ${m.descrizione.trim()}` : m.tipo;
  const meta = baseMeta(m, occurrence);
  const date = m.dataOperazione;

  const mkTxn = (postings: Posting[]): TransactionDirective => ({
    kind: "transaction",
    date,
    flag: "*",
    payee: broker,
    narration,
    tags: [],
    links: [],
    meta,
    postings,
  });

  const cashPosting: Posting = {
    account: cash,
    amount: { number: m.importoEuro, currency: m.divisa || "EUR" },
    meta: {},
  };

  const info = m.ticker || m.isin ? ctx.instrument(m.ticker || m.isin!) : undefined;

  if (m.tipo === "Acquisto") {
    if (!info) return `strumento sconosciuto per acquisto: ${m.ticker ?? m.isin}`;
    if (m.quantita.lte(0)) return `acquisto con quantità non positiva: ${m.ticker}`;
    const units = info.assetClass === "BOND" ? m.quantita.div(100) : m.quantita;
    const costPerUnit = m.importoEuro.neg().div(units).toDecimalPlaces(8);
    return mkTxn([
      {
        account: instrumentAccount(broker, info),
        amount: { number: units, currency: commodityFor(info) },
        cost: { number: costPerUnit, currency: m.divisa || "EUR" },
        meta: {},
      },
      cashPosting,
    ]);
  }

  if (m.tipo === "Vendita") {
    if (!info) return `strumento sconosciuto per vendita: ${m.ticker ?? m.isin}`;
    // l'export Directa riporta le vendite con quantità POSITIVA: normalizziamo
    const qty = m.quantita.abs().neg();
    if (qty.isZero()) return `vendita con quantità zero: ${m.ticker}`;
    const units = info.assetClass === "BOND" ? qty.div(100) : qty;
    return mkTxn([
      {
        account: instrumentAccount(broker, info),
        amount: { number: units, currency: commodityFor(info) },
        cost: {}, // FIFO reduction
        price: {
          kind: "total",
          amount: { number: m.importoEuro.abs(), currency: m.divisa || "EUR" },
        },
        meta: {},
      },
      cashPosting,
      { account: `Income:CapitalGains:${sanitizeAccountSegment(commodityFor(info))}`, meta: {} },
    ]);
  }

  const op = OPERATION_TABLE[m.tipo];
  if (!op) return `tipo operazione non gestito: "${m.tipo}"`;

  let counterAccount: string;
  if (op.perInstrument) {
    if (!info) return `strumento sconosciuto per ${m.tipo}: ${m.ticker ?? m.isin}`;
    counterAccount = `${op.prefix}:${sanitizeAccountSegment(commodityFor(info))}`;
  } else {
    counterAccount = op.account;
    if (info) meta["instrument"] = commodityFor(info);
  }

  if (m.importoEuro.equals(ZERO)) return `movimento a importo zero: ${m.tipo}`;

  return mkTxn([
    {
      account: counterAccount,
      amount: { number: m.importoEuro.neg(), currency: m.divisa || "EUR" },
      meta: {},
    },
    cashPosting,
  ]);
}

export function mapMovimenti(movimenti: RawMovimento[], ctx: MappingContext): MappingOutput {
  const transactions: TransactionDirective[] = [];
  const warnings: string[] = [];
  const seen = new Map<string, number>();
  for (const m of movimenti) {
    const contentKey = importId(m, 0);
    const occurrence = seen.get(contentKey) ?? 0;
    seen.set(contentKey, occurrence + 1);
    const r = movimentoToTransaction(m, ctx, occurrence);
    if (typeof r === "string") warnings.push(`${m.dataOperazione}: ${r}`);
    else transactions.push(r);
  }
  return { transactions, warnings };
}

function excelTaxRate(raw: number): number {
  return raw > 1 ? raw / 100 : raw; // tolerate "26.0" meaning 26%
}

/** Generate open + commodity directives for everything the transactions need. */
export function buildAccountsDirectives(
  transactions: TransactionDirective[],
  instruments: InstrumentInfo[],
  opts: { openDate?: string } = {},
): Directive[] {
  const openDate = opts.openDate ?? "2000-01-01";
  const accounts = new Map<string, Set<string>>(); // account → currencies
  const heldAtCost = new Set<string>(); // accounts holding lots → FIFO booking
  for (const t of transactions) {
    for (const p of t.postings) {
      let curs = accounts.get(p.account);
      if (!curs) {
        curs = new Set();
        accounts.set(p.account, curs);
      }
      if (p.amount) curs.add(p.amount.currency);
      if (p.cost !== undefined) heldAtCost.add(p.account);
    }
  }
  const opens: OpenDirective[] = [...accounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([account, curs]) => {
      const d: OpenDirective = {
        kind: "open",
        date: openDate,
        account,
        currencies: [...curs].sort(),
        meta: {},
      };
      if (heldAtCost.has(account)) d.booking = "FIFO";
      return d;
    });

  const commodities: CommodityDirective[] = instruments
    .slice()
    .sort((a, b) => commodityFor(a).localeCompare(commodityFor(b)))
    .map((info) => {
      const meta: Meta = {
        isin: info.isin,
        ticker: info.ticker,
        class: info.assetClass,
        "tax-rate": String(excelTaxRate(info.taxRate)),
      };
      if (info.name) meta["name"] = info.name;
      if (info.maturity) meta["maturity"] = info.maturity;
      if (info.couponRate !== undefined) meta["coupon-rate"] = String(info.couponRate);
      if (info.couponFrequency !== undefined) meta["coupon-freq"] = String(info.couponFrequency);
      if (info.priceSource) meta["price-source"] = info.priceSource;
      return {
        kind: "commodity",
        date: openDate,
        currency: commodityFor(info),
        meta,
      };
    });

  return [...opens, ...commodities];
}

/** import-ids already present in a ledger, for idempotent re-imports. */
export function existingImportIds(directives: Directive[]): Set<string> {
  const ids = new Set<string>();
  for (const d of directives) {
    if (d.kind === "transaction" && d.meta["import-id"]) ids.add(d.meta["import-id"]);
  }
  return ids;
}
