import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { book } from "../src/core/beancount/booking";
import { directaImporter } from "../src/core/import/directa";
import { mapMovimenti, provisionalInstrument } from "../src/core/import/mapping";
import type { InstrumentInfo } from "../src/core/model/movimento";

const CSV_PATH = join(__dirname, "..", "Movimenti_G1473_12-6-2026.csv");

describe.skipIf(!existsSync(CSV_PATH))("export Directa reale", () => {
  const text = readFileSync(CSV_PATH, "latin1");
  const parsed = directaImporter.parse({ name: "Movimenti_G1473.csv", text });

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

  it("sniffa l'export reale", () => {
    expect(directaImporter.sniff({ name: "Movimenti_G1473_12-6-2026.csv", text })).toBe(true);
  });

  it("salta il banner e legge tutte le righe", () => {
    expect(parsed.warnings).toEqual([]);
    expect(parsed.movimenti).toHaveLength(117);
  });

  it("converte date gg-mm-aaaa e numeri italiani", () => {
    const first = parsed.movimenti[0]!; // 10-06-2026 Cedola obb.
    expect(first.dataOperazione).toBe("2026-06-10");
    expect(first.dataValuta).toBe("2026-06-13");
    expect(first.importoEuro.toNumber()).toBe(100);
    expect(first.protocollo).toBe("65411118");
    expect(first.riferimentoOrdine).toBeUndefined(); // solo spazi nel file
  });

  it("normalizza le vendite a quantità negativa", () => {
    const vendite = parsed.movimenti.filter((m) => m.tipo === "Vendita");
    expect(vendite).toHaveLength(2);
    for (const v of vendite) expect(v.quantita.isNegative()).toBe(true);
  });

  it("gli strumenti provvisori classificano i bond M.* correttamente", () => {
    const btp = byKey.get("M.510541")!;
    expect(btp.assetClass).toBe("BOND");
    expect(btp.taxRate).toBe(0.125);
    expect(btp.priceSource).toBe("borsa-italiana:IT0005547408.MOT");
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
    expect(mapped.transactions).toHaveLength(117);
    const booked = book(mapped.transactions);
    expect(booked.errors).toEqual([]);
    // invariante: saldo cash = somma degli Importo euro
    const sum = parsed.movimenti.reduce((s, m) => s + m.importoEuro.toNumber(), 0);
    const cash = booked.balances.get("Assets:Broker:Directa:Cash")!.get("EUR")!;
    expect(cash.toNumber()).toBeCloseTo(sum, 2);
    // posizioni note: BTP VALORE 5000 nominale → 50 unità; X25E chiuso
    // (commodity = ISIN per tutti gli strumenti, anche gli ETF)
    expect(booked.positions.get("IT0005547408")!.units.toNumber()).toBe(50);
    expect(booked.positions.get("LU0290357846")!.units.toNumber()).toBe(0);
  });
});
