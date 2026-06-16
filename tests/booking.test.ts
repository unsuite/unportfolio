import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { book } from "../src/core/beancount/booking";
import { parse } from "../src/core/beancount/parser";
import { projectToMaturity, remainingCoupons } from "../src/core/math/bond";
import { xirr } from "../src/core/math/xirr";

const LEDGER = `
2024-02-12 * "Directa" "Conferimento con bonifico"
  Assets:Broker:Directa:Cash                  4000 EUR
  Equity:Conferimenti                        -4000 EUR

2024-02-26 * "Directa" "Acquisto VWCE"
  Assets:Broker:Directa:VWCE                     2 VWCE {114.19 EUR}
  Assets:Broker:Directa:Cash               -228.38 EUR

2024-02-26 * "Directa" "Commissioni"
  instrument: "VWCE"
  Expenses:Fees:Broker                        1.50 EUR
  Assets:Broker:Directa:Cash                 -1.50 EUR

2024-03-15 * "Directa" "Acquisto VWCE"
  Assets:Broker:Directa:VWCE                     3 VWCE {120.00 EUR}
  Assets:Broker:Directa:Cash               -360.00 EUR

2024-06-03 * "Directa" "Acquisto BTP"
  Assets:Broker:Directa:IT0005547408            50 IT0005547408 {99.20 EUR}
  Assets:Broker:Directa:Cash              -4960.00 EUR

2025-06-10 * "Directa" "Cedola obb."
  Assets:Broker:Directa:Cash                 41.63 EUR
  Income:Coupons:IT0005547408               -41.63 EUR

2025-06-10 * "Directa" "Rit.cedola obb."
  instrument: "IT0005547408"
  Expenses:Taxes:Withholding                  5.20 EUR
  Assets:Broker:Directa:Cash                 -5.20 EUR

2025-07-01 * "Directa" "Vendita VWCE"
  Assets:Broker:Directa:VWCE                    -4 VWCE {} @ 130.00 EUR
  Assets:Broker:Directa:Cash                520.00 EUR
  Income:CapitalGains:VWCE
`;

describe("booking", () => {
  const result = book(parse(LEDGER).directives);

  it("has no errors", () => {
    expect(result.errors).toEqual([]);
  });

  it("tracks cash balance", () => {
    const cash = result.balances.get("Assets:Broker:Directa:Cash")!.get("EUR")!;
    // 4000 -228.38 -1.50 -360 -4960 +41.63 -5.20 +520
    expect(cash.toFixed(2)).toBe("-993.45");
  });

  it("books FIFO lots on partial sell", () => {
    const pos = result.positions.get("VWCE")!;
    // bought 2 @114.19 + 3 @120, sold 4 → FIFO removes 2@114.19 + 2@120
    expect(pos.units.toNumber()).toBe(1);
    expect(pos.lots).toHaveLength(1);
    expect(pos.lots[0]!.costPerUnit.toNumber()).toBe(120);
    expect(pos.costBasis.toNumber()).toBe(120);
  });

  it("computes realized gain FIFO", () => {
    const pos = result.positions.get("VWCE")!;
    // proceeds 520 − cost removed (2×114.19 + 2×120 = 468.38) = 51.62
    expect(pos.realizedGain.toFixed(2)).toBe("51.62");
    expect(pos.sellProceeds.toNumber()).toBe(520);
  });

  it("fills the elided capital-gains posting", () => {
    const cg = result.balances.get("Income:CapitalGains:VWCE")!.get("EUR")!;
    expect(cg.toFixed(2)).toBe("-51.62"); // income negative in ledger
  });

  it("accumulates buy cost (prezzo di carico, negative)", () => {
    const pos = result.positions.get("VWCE")!;
    expect(pos.buyCost.toFixed(2)).toBe("-588.38"); // −(228.38+360)
  });

  it("attributes fees via instrument metadata", () => {
    const pos = result.positions.get("VWCE")!;
    expect(pos.fees.toFixed(2)).toBe("-1.50");
  });

  it("attributes coupons and withholding to the bond", () => {
    const pos = result.positions.get("IT0005547408")!;
    expect(pos.income.toFixed(2)).toBe("41.63");
    expect(pos.withholding.toFixed(2)).toBe("-5.20");
  });

  it("collects per-instrument cash flows for XIRR", () => {
    const pos = result.positions.get("VWCE")!;
    const flows = pos.cashFlows.map((f) => [f.date, f.amount.toNumber()]);
    expect(flows).toEqual([
      ["2024-02-26", -228.38],
      ["2024-02-26", -1.5],
      ["2024-03-15", -360],
      ["2025-07-01", 520],
    ]);
  });

  it("flags unbalanced transactions", () => {
    const bad = book(
      parse(
        '2024-01-01 * "sbilanciata"\n  Assets:Broker:Directa:Cash 100 EUR\n  Equity:Conferimenti -90 EUR\n',
      ).directives,
    );
    expect(bad.errors).toHaveLength(1);
    expect(bad.errors[0]).toContain("does not balance");
  });

  it("flags overselling", () => {
    const bad = book(
      parse(
        '2024-01-01 * "buy"\n  Assets:Broker:Directa:VWCE 1 VWCE {100 EUR}\n  Assets:Broker:Directa:Cash -100 EUR\n\n2024-02-01 * "sell troppo"\n  Assets:Broker:Directa:VWCE -2 VWCE {} @ 100 EUR\n  Assets:Broker:Directa:Cash 200 EUR\n  Income:CapitalGains:VWCE\n',
      ).directives,
    );
    expect(bad.errors.some((e) => e.includes("exceeds held lots"))).toBe(true);
  });
});

describe("xirr", () => {
  it("matches Excel XIRR on the documented example", () => {
    // Example from Microsoft XIRR docs → 0.373362535 (37.34%)
    const r = xirr([
      { date: "2008-01-01", amount: -10000 },
      { date: "2008-03-01", amount: 2750 },
      { date: "2008-10-30", amount: 4250 },
      { date: "2009-02-15", amount: 3250 },
      { date: "2009-04-01", amount: 2750 },
    ]);
    expect(r).toBeDefined();
    expect(r!).toBeCloseTo(0.373362535, 6);
  });

  it("returns ~10% for a one-year double-flow", () => {
    const r = xirr([
      { date: "2024-01-01", amount: -1000 },
      { date: "2024-12-31", amount: 1100 },
    ]);
    expect(r!).toBeCloseTo(0.1, 2);
  });

  it("handles negative returns", () => {
    const r = xirr([
      { date: "2024-01-01", amount: -1000 },
      { date: "2025-01-01", amount: 800 },
    ]);
    expect(r!).toBeCloseTo(-0.2, 2);
  });

  it("returns undefined without a sign change", () => {
    expect(
      xirr([
        { date: "2024-01-01", amount: 100 },
        { date: "2025-01-01", amount: 200 },
      ]),
    ).toBeUndefined();
  });
});

describe("bond math", () => {
  it("counts remaining coupons like COUPNUM", () => {
    // semiannual bond maturing 2030-12-01, as of 2026-06-12:
    // coupons: 2026-12-01, 2027-06-01, ..., 2030-12-01 → 9
    expect(remainingCoupons("2026-06-12", "2030-12-01", 2)).toBe(9);
    // annual: 2026-09-14, 2027-09-14, 2028-09-14, 2029-09-14 → 4
    expect(remainingCoupons("2026-06-12", "2029-09-14", 1)).toBe(4);
    expect(remainingCoupons("2031-01-01", "2030-12-01", 2)).toBe(0);
  });

  it("projects a bond held to maturity", () => {
    // 50 units (5000 face), bought at 99.20 → buyCost −4960, 3.33% quarterly, tax 12.5%
    const p = projectToMaturity("2026-06-12", new Decimal(50), new Decimal(-4960), {
      maturity: "2027-06-06",
      couponRate: 0.0333,
      frequency: 4,
      taxRate: 0.125,
    });
    expect(p.remainingCoupons).toBe(4); // 2026-09-06, 2026-12-06, 2027-03-06, 2027-06-06
    // coupon value = 5000 × 0.0333 / 4 × 4 = 166.50
    expect(p.remainingCouponValue.toFixed(2)).toBe("166.50");
    // gross = 5000 − 4960 + 166.50 = 206.50; net = 206.50 × 0.875 = 180.69
    expect(p.grossRemainingGain.toFixed(2)).toBe("206.50");
    expect(p.netRemainingGain.toFixed(4)).toBe("180.6875");
    // net value at maturity = 180.6875 + 4960
    expect(p.netValueAtMaturity.toFixed(4)).toBe("5140.6875");
  });
});
