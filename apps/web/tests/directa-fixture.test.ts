import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { book, holdingKey } from "../src/core/beancount/booking";
import { directaImporter } from "../src/core/import/directa";
import { mapMovimenti, provisionalInstrument } from "../src/core/import/mapping";
import type { InstrumentInfo } from "../src/core/model/movimento";

// CSV dummy con dati fittizi, committato in repo (vedi eccezione in .gitignore):
// esercita banner da saltare, date gg-mm-aaaa, numeri italiani, cedola, bond
// M.* / ETF e la quadratura del libro mastro, senza dipendere da file personali.
const CSV_PATH = join(__dirname, "fixtures", "directa-dummy.csv");
const text = readFileSync(CSV_PATH, "utf8");
const parsed = directaImporter.parse({ name: "directa-dummy.csv", text });

// registro costruito al volo con l'euristica degli strumenti provvisori
// (come fa l'app quando importa un CSV su un ledger vergine)
const byKey = new Map<string, InstrumentInfo>();
for (const m of parsed.movimenti) {
  if (!m.ticker || !m.isin || byKey.has(m.ticker)) continue;
  const info = provisionalInstrument(m);
  if (info) {
    byKey.set(m.ticker, info);
    byKey.set(m.isin, info);
  }
}

describe("export Directa (fixture dummy)", () => {
  it("sniffa il fixture", () => {
    expect(directaImporter.sniff({ name: "directa-dummy.csv", text })).toBe(true);
  });

  it("salta il banner e legge tutte le righe", () => {
    expect(parsed.warnings).toEqual([]);
    expect(parsed.movimenti).toHaveLength(7);
  });

  it("converte date gg-mm-aaaa e numeri italiani", () => {
    const conf = parsed.movimenti.find((m) => m.tipo === "Conferimento con bonifico")!;
    expect(conf.dataOperazione).toBe("2026-01-05");
    expect(conf.importoEuro.toNumber()).toBe(10000);
    const btp = parsed.movimenti.find((m) => m.tipo === "Acquisto" && m.ticker === "M.510541")!;
    expect(btp.dataOperazione).toBe("2026-01-10");
    expect(btp.dataValuta).toBe("2026-01-13");
    expect(btp.importoEuro.toNumber()).toBe(-5000);
  });

  it("normalizza le vendite a quantità negativa", () => {
    const vendite = parsed.movimenti.filter((m) => m.tipo === "Vendita");
    expect(vendite).toHaveLength(1);
    for (const v of vendite) expect(v.quantita.isNegative()).toBe(true);
  });

  it("gli strumenti provvisori classificano bond M.* ed ETF", () => {
    const btp = byKey.get("M.510541")!;
    expect(btp.assetClass).toBe("BOND");
    expect(btp.taxRate).toBe(0.125);
    expect(btp.priceSource).toBe("borsa-italiana:IT0001234567.MOT");
    const etf = byKey.get("VWCE")!;
    expect(etf.assetClass).toBe("ETF");
    expect(etf.taxRate).toBe(0.26);
  });

  it("mappa e quadra: ogni movimento ha il suo cash leg", () => {
    const mapped = mapMovimenti(parsed.movimenti, {
      instrument: (k) => byKey.get(k),
      defaultBroker: "Directa",
    });
    expect(mapped.warnings).toEqual([]);
    expect(mapped.transactions).toHaveLength(7);
    const booked = book(mapped.transactions);
    expect(booked.errors).toEqual([]);
    // invariante: saldo cash = somma degli Importo euro
    const sum = parsed.movimenti.reduce((s, m) => s + m.importoEuro.toNumber(), 0);
    const cash = booked.balances.get("Assets:Broker:Directa:Cash")!.get("EUR")!;
    expect(cash.toNumber()).toBeCloseTo(sum, 2);
    expect(cash.toFixed(2)).toBe("5092.70");
    // posizioni (commodity = ISIN): BTP aperto, ETF chiuso dopo la vendita
    expect(
      booked.positions.get(holdingKey("Directa", "IT0001234567"))!.units.toNumber(),
    ).toBeGreaterThan(0);
    expect(booked.positions.get(holdingKey("Directa", "IE00BK5BQT80"))!.units.toNumber()).toBe(0);
  });
});
