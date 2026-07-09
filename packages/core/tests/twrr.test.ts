import { book } from "@unportfolio/core/beancount/booking";
import { parse } from "@unportfolio/core/beancount/parser";
import { deriveAssets, readCommodityInfo } from "@unportfolio/core/derive/assets";
import { buildPriceTable, priceAt } from "@unportfolio/core/derive/prices";
import { twrr } from "@unportfolio/core/math/twrr";
import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";

const D = (n: number | string) => new Decimal(n);

describe("twrr (puro)", () => {
  const prices = new Map([
    ["2025-01-01", D(100)],
    ["2025-07-01", D(110)],
    ["2026-01-01", D(121)],
  ]);
  const p = (d: string) => prices.get(d);

  it("elimina l'effetto dei flussi: +10% per periodo → 21% cumulato", () => {
    // compra 10 @100; a metà compra altri 10 (prezzo 110); fine a 121
    const r = twrr(
      [
        { date: "2025-01-01", unitsAfter: D(10) },
        { date: "2025-07-01", unitsAfter: D(20) },
      ],
      p,
      "2026-01-01",
    )!;
    expect(r.cumulative).toBeCloseTo(0.21, 10);
    expect(r.annualized).toBeCloseTo(0.21, 2); // periodo ≈ 1 anno
    expect(r.from).toBe("2025-01-01");
  });

  it("il MWRR invece pesa i flussi (sanity del confronto)", () => {
    // stesso scenario: il MWRR è < 21% se il secondo flusso rende solo il 10%
    // qui verifichiamo solo che TWRR ignori la dimensione del secondo flusso
    const big = twrr(
      [
        { date: "2025-01-01", unitsAfter: D(10) },
        { date: "2025-07-01", unitsAfter: D(1000) }, // flusso enorme
      ],
      p,
      "2026-01-01",
    )!;
    expect(big.cumulative).toBeCloseTo(0.21, 10); // identico
  });

  it("posizione chiusa: la misura finisce alla vendita totale", () => {
    const r = twrr(
      [
        { date: "2025-01-01", unitsAfter: D(10) },
        { date: "2025-07-01", unitsAfter: D(0) }, // vende tutto a 110
      ],
      p,
      "2026-01-01",
    )!;
    expect(r.cumulative).toBeCloseTo(0.1, 10);
  });

  it("prezzo mancante a un confine: flusso neutro", () => {
    const r = twrr(
      [
        { date: "2025-01-01", unitsAfter: D(10) },
        { date: "2025-03-15", unitsAfter: D(20) }, // nessun prezzo a questa data
      ],
      (d) => (d === "2025-03-15" ? undefined : prices.get(d)),
      "2026-01-01",
    )!;
    // il tratto senza prezzo non genera rendimento fittizio: resta il 21%
    expect(r.cumulative).toBeCloseTo(0.21, 10);
  });

  it("senza alcun prezzo → undefined", () => {
    expect(
      twrr([{ date: "2025-01-01", unitsAfter: D(10) }], () => undefined, "2026-01-01"),
    ).toBeUndefined();
  });
});

describe("twrr integrato in deriveAssets", () => {
  const LEDGER = `
2025-01-01 commodity VWCE
  class: "ETF"
  tax-rate: 0.26

2025-01-01 * "Acquisto"
  Assets:Broker:Directa:VWCE 10 VWCE {100.00 EUR}
  Assets:Broker:Directa:Cash -1000.00 EUR

2025-07-01 * "Acquisto"
  Assets:Broker:Directa:VWCE 10 VWCE {110.00 EUR}
  Assets:Broker:Directa:Cash -1100.00 EUR

2025-01-01 price VWCE 100.00 EUR
2025-07-01 price VWCE 110.00 EUR
2025-12-31 price VWCE 121.00 EUR
`;

  it("espone twrr accanto al MWRR", () => {
    const directives = parse(LEDGER).directives;
    const booked = book(directives);
    const table = buildPriceTable(directives);
    expect(priceAt(table, "VWCE", "2025-07-01")!.price.toNumber()).toBe(110);
    const rows = deriveAssets({
      positions: booked.positions,
      commodities: readCommodityInfo(directives),
      prices: table,
      asOf: "2026-01-01",
    });
    const vwce = rows.find((r) => r.commodity === "VWCE")!;
    expect(vwce.twrr).toBeDefined();
    expect(vwce.twrr!.cumulative).toBeCloseTo(0.21, 10);
    expect(vwce.xirrAnnual).toBeDefined(); // MWRR presente e distinto
  });
});
