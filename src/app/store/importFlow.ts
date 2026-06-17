import type { Directive, TransactionDirective } from "../../core/beancount/ast";
import { readCommodityInfo } from "../../core/derive/assets";
import { directaImporter } from "../../core/import/directa";
import {
  buildAccountsDirectives,
  existingImportIds,
  mapMovimenti,
  provisionalInstrument,
} from "../../core/import/mapping";
import type { ImporterPlugin, ImportFile } from "../../core/import/types";
import type { InstrumentInfo } from "../../core/model/movimento";
import {
  allDirectives,
  appendToLedger,
  getState,
  reconcileAssetAccounts,
  writeAccountsLedger,
} from "./store";

// Target: export movimenti dai broker (Directa oggi, BG Saxo quando avremo
// un export di esempio).
export const importers: ImporterPlugin[] = [directaImporter];

/** Strumenti già noti al ledger (direttive commodity) come InstrumentInfo. */
function ledgerInstruments(): Map<string, InstrumentInfo> {
  const out = new Map<string, InstrumentInfo>();
  for (const [commodity, info] of readCommodityInfo(allDirectives())) {
    const inst: InstrumentInfo = {
      ticker: info.ticker ?? commodity,
      isin: info.isin ?? commodity,
      assetClass:
        info.assetClass === "BOND" || info.assetClass === "STOCK" ? info.assetClass : "ETF",
      taxRate: info.taxRate,
      currency: "EUR",
    };
    if (info.name) inst.name = info.name;
    if (info.maturity) inst.maturity = info.maturity;
    if (info.couponRate !== undefined) inst.couponRate = info.couponRate;
    if (info.couponFrequency !== undefined) inst.couponFrequency = info.couponFrequency;
    if (info.priceSource) inst.priceSource = info.priceSource;
    out.set(commodity, inst);
    if (info.ticker) out.set(info.ticker, inst);
    if (info.isin) out.set(info.isin, inst);
  }
  return out;
}

export interface ImportPreview {
  importer: ImporterPlugin;
  newTransactions: TransactionDirective[];
  duplicates: number;
  instruments: InstrumentInfo[];
  warnings: string[];
}

export function previewImport(file: ImportFile, deposito?: string): ImportPreview {
  const importer = importers.find((i) => i.sniff(file));
  if (!importer) throw new Error("nessun importer riconosce questo file");
  const result = importer.parse(file);
  const byKey = ledgerInstruments(); // fallback: registro già nel ledger
  for (const i of result.instruments) {
    byKey.set(i.ticker, i);
    byKey.set(i.isin, i);
  }
  // strumenti mai visti: registro provvisorio (classe/tassa da confermare)
  const provisional: InstrumentInfo[] = [];
  for (const m of result.movimenti) {
    if (!m.ticker || !m.isin || byKey.has(m.ticker) || byKey.has(m.isin)) continue;
    const info = provisionalInstrument(m);
    if (!info) continue;
    byKey.set(m.ticker, info);
    byKey.set(m.isin, info);
    provisional.push(info);
    result.warnings.push(
      `nuovo strumento ${m.ticker} (${m.isin}): classe ${info.assetClass} e tassa ${info.taxRate} stimate — verifica nei metadati commodity` +
        (info.assetClass === "BOND" ? ", aggiungi maturity/cedola per la matematica bond" : ""),
    );
  }
  const instruments = [...result.instruments, ...provisional];
  const mapped = mapMovimenti(result.movimenti, {
    instrument: (k) => byKey.get(k),
    defaultBroker: getState().config.defaultBroker,
    ...(deposito ? { deposito } : {}),
  });
  const existing = existingImportIds(allDirectives());
  const newTransactions = mapped.transactions.filter((t) => !existing.has(t.meta["import-id"]!));
  return {
    importer,
    newTransactions,
    duplicates: mapped.transactions.length - newTransactions.length,
    instruments,
    warnings: [...result.warnings, ...mapped.warnings],
  };
}

/** Append new transactions and regenerate accounts.beancount (opens + commodities). */
export async function applyImport(preview: ImportPreview): Promise<void> {
  if (preview.newTransactions.length > 0) {
    await appendToLedger(
      "ledger/movimenti.beancount",
      preview.newTransactions,
      `import ${preview.importer.id} — ${new Date().toISOString().slice(0, 16)} — ${preview.newTransactions.length} movimenti`,
    );
  }
  // regenerate opens from ALL transactions; merge commodity directives
  const all = allDirectives(getState());
  const allTxns = all.filter((d): d is TransactionDirective => d.kind === "transaction");
  const generated = buildAccountsDirectives(allTxns, preview.instruments);
  const generatedCommodities = new Set(
    generated.filter((d) => d.kind === "commodity").map((d) => d.currency),
  );
  // keep hand-kept / previous commodity directives the new import doesn't know
  const preserved: Directive[] = all.filter(
    (d) => d.kind === "commodity" && !generatedCommodities.has(d.currency),
  );
  await writeAccountsLedger([...generated, ...preserved]);
  // ogni nuovo strumento importato ottiene subito un conto patrimonio
  await reconcileAssetAccounts();
}
