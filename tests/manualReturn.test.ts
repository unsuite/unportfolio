import { describe, expect, it } from "vitest";
import { deriveManualReturn } from "../src/core/derive/manualReturn";
import type { PatrimonioAccount, SnapshotEntry } from "../src/core/model/config";

const base: PatrimonioAccount = {
  id: "dep",
  nome: "Deposito",
  sezione: "asset",
  tipo: "High Yield Savings",
  owner: "x",
  inNetWorth: true,
  valuta: "EUR",
};

const snaps = (rows: [string, number][]): SnapshotEntry[] =>
  rows.map(([date, value]) => ({ date, accountId: "dep", value, currency: "EUR" }));

describe("deriveManualReturn", () => {
  it("ritorna undefined senza carico", () => {
    expect(deriveManualReturn(base, snaps([["2024-01-01", 1000]]), "2025-01-01")).toBeUndefined();
  });

  it("conto aperto: valore = ultimo snapshot, fine = asOf, lordo = netto", () => {
    const acc = { ...base, carico: 10_000, caricoDal: "2024-01-01" };
    const r = deriveManualReturn(
      acc,
      snaps([
        ["2024-01-01", 10_000],
        ["2024-12-31", 10_500],
      ]),
      "2025-01-01",
    )!;
    expect(r.closed).toBe(false);
    expect(r.valoreLordo).toBe(10_500);
    expect(r.valoreNetto).toBe(10_500);
    expect(r.resaLorda).toBeCloseTo(0.05, 6);
    expect(r.plNetto).toBe(500);
    expect(r.to).toBe("2025-01-01");
    // ~1 anno → CAGR ≈ resa totale
    expect(r.cagrLordo!).toBeCloseTo(0.05, 2);
  });

  it("data inizio dedotta dal primo snapshot se caricoDal assente", () => {
    const acc = { ...base, carico: 100 };
    const r = deriveManualReturn(
      acc,
      snaps([
        ["2020-06-01", 100],
        ["2024-06-01", 200],
      ]),
      "2025-06-01",
    )!;
    expect(r.from).toBe("2020-06-01");
  });

  it("posizione chiusa: usa ricavato lordo/netto e data uscita", () => {
    const acc = {
      ...base,
      carico: 96.56,
      caricoDal: "2016-03-14",
      uscitaLordo: 19_829.75,
      uscitaNetto: 14_500.82,
      uscitaIl: "2025-12-29",
    };
    const r = deriveManualReturn(acc, snaps([["2024-12-31", 25_000]]), "2026-06-15")!;
    expect(r.closed).toBe(true);
    expect(r.to).toBe("2025-12-29");
    expect(r.valoreLordo).toBe(19_829.75);
    expect(r.plNetto).toBeCloseTo(14_404.26, 2);
    // resa lorda ~205x
    expect(r.resaLorda).toBeGreaterThan(200);
    expect(r.cagrLordo!).toBeGreaterThan(0.5); // ~+72%/anno su ~9,8 anni
  });

  it("CAGR assente sotto i 90 giorni", () => {
    const acc = { ...base, carico: 1000, caricoDal: "2025-01-01" };
    const r = deriveManualReturn(
      acc,
      snaps([
        ["2025-01-01", 1000],
        ["2025-02-01", 1100],
      ]),
      "2025-02-15",
    )!;
    expect(r.cagrLordo).toBeUndefined();
    expect(r.resaLorda).toBeCloseTo(0.1, 6);
  });
});
