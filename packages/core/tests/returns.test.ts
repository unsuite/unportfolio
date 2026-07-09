import type { TransactionDirective } from "@unportfolio/core/beancount/ast";
import { parse } from "@unportfolio/core/beancount/parser";
import { buildPriceTable } from "@unportfolio/core/derive/prices";
import { deriveReturns } from "@unportfolio/core/derive/returns";
import { type TrDay, trIndex } from "@unportfolio/core/math/returns";
import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";

const D = (n: number) => new Decimal(n);
const day = (date: string, value: number, flow = 0, income = 0): TrDay => ({
  date,
  value: D(value),
  flow: D(flow),
  income: D(income),
});
const last = (pts: { index: number }[]) => pts[pts.length - 1]!.index;

describe("trIndex (indice total-return)", () => {
  it("apprezzamento puro: segue i rapporti di prezzo", () => {
    const pts = trIndex([
      day("2025-01-01", 1000, 1000), // buy 10 @ 100
      day("2025-01-02", 1100), // 10 @ 110
      day("2025-01-03", 1210), // 10 @ 121
    ]);
    expect(pts[0]!.index).toBe(1);
    expect(pts[1]!.index).toBeCloseTo(1.1, 10);
    expect(last(pts)).toBeCloseTo(1.21, 10);
  });

  it("cedola reinvestita: entra come rendimento (total return)", () => {
    const pts = trIndex([
      day("2025-01-01", 1000, 1000),
      day("2025-01-02", 1000, 0, 50), // prezzo fermo, cedola 50
    ]);
    expect(last(pts)).toBeCloseTo(1.05, 10);
  });

  it("neutralità dei flussi: aggiungere capitale non è rendimento", () => {
    const pts = trIndex([
      day("2025-01-01", 1000, 1000),
      day("2025-01-02", 2000, 1000), // raddoppio la posizione a prezzo invariato
      day("2025-01-03", 2200), // +10% di prezzo
    ]);
    expect(pts[1]!.index).toBeCloseTo(1.0, 10); // il versamento non muove l'indice
    expect(last(pts)).toBeCloseTo(1.1, 10);
  });

  it("vendita in gain: cattura la performance, non il disinvestimento", () => {
    const pts = trIndex([
      day("2025-01-01", 1000, 1000),
      day("2025-01-02", 0, -1100), // vendo tutto a 110 (proventi 1100)
    ]);
    expect(last(pts)).toBeCloseTo(1.1, 10);
  });

  it("chiusura e riapertura: nessuna divisione per zero", () => {
    const pts = trIndex([
      day("2025-01-01", 1000, 1000),
      day("2025-01-02", 0, -1000), // vendo a costo
      day("2025-01-03", 500, 500), // riapro
      day("2025-01-04", 550), // +10%
    ]);
    expect(pts[1]!.index).toBeCloseTo(1.0, 10);
    expect(last(pts)).toBeCloseTo(1.1, 10);
  });

  it("parte solo dal primo giorno con valore positivo", () => {
    const pts = trIndex([
      day("2025-01-01", 0), // niente ancora
      day("2025-01-02", 1000, 1000),
      day("2025-01-03", 1100),
    ]);
    expect(pts.length).toBe(2);
    expect(pts[0]!.date).toBe("2025-01-02");
    expect(last(pts)).toBeCloseTo(1.1, 10);
  });
});

describe("deriveReturns (estrazione dal ledger)", () => {
  // acquisto 10 @ 100, prezzo sale a 110, cedola 50 → total return = 15%
  // (10% prezzo + 5% cedola), mentre valore−investito coglie solo i 100 di prezzo.
  const LEDGER = `
2025-01-01 * "acquisto"
  Assets:Broker:Directa:XS0001   10 XS0001 {100 EUR}
  Assets:Cash                  -1000 EUR

2025-01-02 * "cedola"
  Assets:Cash                     50 EUR
  Income:Coupons:XS0001          -50 EUR

2025-01-01 price XS0001 100 EUR
2025-01-02 price XS0001 110 EUR
`;
  const directives = parse(LEDGER).directives;
  const txns = directives.filter((d): d is TransactionDirective => d.kind === "transaction");
  const prices = buildPriceTable(directives);
  const r = deriveReturns(
    [{ commodity: "XS0001", deposito: "Directa" }],
    txns,
    prices,
    "2025-01-02",
  );

  it("indice total-return include la cedola (15%)", () => {
    expect(r.index[0]!.index).toBe(1);
    expect(r.index[r.index.length - 1]!.index).toBeCloseTo(1.15, 8);
  });

  it("investito vs valore: cattura solo il prezzo (la cedola è cash uscito)", () => {
    const last = r.invested[r.invested.length - 1]!;
    expect(last.invested).toBeCloseTo(1000, 6); // capitale versato
    expect(last.value).toBeCloseTo(1100, 6); // valore di mercato (10 × 110)
  });
});
