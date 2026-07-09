import { Decimal } from "decimal.js";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Directive, Posting, TransactionDirective } from "../src/core/beancount/ast";
import { parse } from "../src/core/beancount/parser";
import { formatDirective, serialize } from "../src/core/beancount/serializer";

const FIXTURE = `option "title" "Net Worth"
option "operating_currency" "EUR"

include "accounts.beancount"

; conti broker
2024-01-01 open Assets:Broker:Directa:Cash EUR
2024-01-01 open Assets:Broker:Directa:VWCE VWCE "FIFO"
2024-01-01 open Income:Coupons:IT0005547408
2024-01-01 open Expenses:Taxes:Withholding

2024-05-02 commodity IT0005547408
  name: "BTP VALORE GN27 EUR"
  isin: "IT0005547408"
  class: "BOND"
  maturity: 2027-06-06
  coupon-rate: 0.0333
  coupon-freq: 4
  tax-rate: 0.125
  price-source: "borsa-italiana:IT0005547408.MOT"

2024-02-26 * "Directa" "Acquisto VWCE" #directa
  ordine: "Q5710082457287"
  Assets:Broker:Directa:VWCE                       2 VWCE {114.19 EUR}
  Assets:Broker:Directa:Cash                 -228.38 EUR

2024-02-26 * "Directa" "Commissioni"
  ordine: "Q5710082457287"
  Expenses:Taxes:Withholding                    1.50 EUR
  Assets:Broker:Directa:Cash                   -1.50 EUR

2025-06-10 * "Directa" "Cedola obb. BTP VALORE GN27"
  Assets:Broker:Directa:Cash                   40.63 EUR
  Income:Coupons:IT0005547408                 -40.63 EUR

2025-06-10 ! "Vendita parziale con prezzo"
  Assets:Broker:Directa:VWCE -1 VWCE {114.19 EUR, 2024-02-26} @ 130.00 EUR
  Assets:Broker:Directa:Cash 130.00 EUR

2025-06-11 price VWCE 131.42 EUR
2025-06-11 price IT0005547408 99.85 EUR

2025-06-30 balance Assets:Broker:Directa:Cash -59.25 EUR

2026-01-01 close Assets:Broker:Directa:VWCE

; direttiva non modellata, va preservata
2025-01-01 note Assets:Broker:Directa:Cash "promemoria"
`;

describe("parser", () => {
  it("round-trips the fixture losslessly", () => {
    expect(serialize(parse(FIXTURE))).toBe(FIXTURE);
  });

  it("round-trips without trailing newline", () => {
    const noNl = FIXTURE.trimEnd();
    expect(serialize(parse(noNl))).toBe(noNl);
  });

  it("parses options and includes", () => {
    const f = parse(FIXTURE);
    const opts = f.directives.filter((d) => d.kind === "option");
    expect(opts).toHaveLength(2);
    expect(opts[0]).toMatchObject({ name: "title", value: "Net Worth" });
    const incs = f.directives.filter((d) => d.kind === "include");
    expect(incs[0]).toMatchObject({ path: "accounts.beancount" });
  });

  it("parses commodity metadata", () => {
    const f = parse(FIXTURE);
    const c = f.directives.find((d) => d.kind === "commodity");
    expect(c).toBeDefined();
    if (c?.kind !== "commodity") throw new Error("unreachable");
    expect(c.currency).toBe("IT0005547408");
    expect(c.meta["class"]).toBe("BOND");
    expect(c.meta["maturity"]).toBe("2027-06-06");
    expect(c.meta["tax-rate"]).toBe("0.125");
    expect(c.meta["name"]).toBe("BTP VALORE GN27 EUR");
  });

  it("parses a buy transaction with cost basis", () => {
    const f = parse(FIXTURE);
    const txns = f.directives.filter((d): d is TransactionDirective => d.kind === "transaction");
    const buy = txns[0]!;
    expect(buy.payee).toBe("Directa");
    expect(buy.narration).toBe("Acquisto VWCE");
    expect(buy.tags).toEqual(["directa"]);
    expect(buy.meta["ordine"]).toBe("Q5710082457287");
    const [leg, cash] = buy.postings as [Posting, Posting];
    expect(leg.amount!.number.toNumber()).toBe(2);
    expect(leg.amount!.currency).toBe("VWCE");
    expect(leg.cost!.number!.toNumber()).toBe(114.19);
    expect(leg.cost!.currency).toBe("EUR");
    expect(cash.amount!.number.toNumber()).toBe(-228.38);
  });

  it("parses sell with cost date and unit price", () => {
    const f = parse(FIXTURE);
    const sell = f.directives.filter(
      (d): d is TransactionDirective => d.kind === "transaction",
    )[3]!;
    expect(sell.flag).toBe("!");
    const leg = sell.postings[0]!;
    expect(leg.cost!.date).toBe("2024-02-26");
    expect(leg.price).toMatchObject({ kind: "unit" });
    expect(leg.price!.amount.number.toNumber()).toBe(130);
  });

  it("parses price and balance directives", () => {
    const f = parse(FIXTURE);
    const prices = f.directives.filter((d) => d.kind === "price");
    expect(prices).toHaveLength(2);
    expect(prices[1]).toMatchObject({ currency: "IT0005547408" });
    const bal = f.directives.find((d) => d.kind === "balance");
    if (bal?.kind !== "balance") throw new Error("unreachable");
    expect(bal.amount.number.toNumber()).toBe(-59.25);
  });

  it("preserves unknown directives as raw", () => {
    const f = parse(FIXTURE);
    const raws = f.directives.filter((d) => d.kind === "raw");
    expect(raws.some((r) => r.src.includes("2025-01-01 note"))).toBe(true);
  });

  it("strips comments outside strings only", () => {
    const src =
      '2024-01-01 * "pranzo ; con punto e virgola" ; commento\n  Expenses:Taxes:Withholding 1.00 EUR\n  Assets:Broker:Directa:Cash -1.00 EUR\n';
    const f = parse(src);
    const t = f.directives[0]!;
    if (t.kind !== "transaction") throw new Error("expected txn");
    expect(t.narration).toBe("pranzo ; con punto e virgola");
    expect(serialize(f)).toBe(src);
  });

  it("supports thousands separators in numbers", () => {
    const f = parse("2024-01-01 price VWCE 1,153.20 EUR\n");
    const p = f.directives[0]!;
    if (p.kind !== "price") throw new Error("expected price");
    expect(p.amount.number.toNumber()).toBe(1153.2);
  });
});

describe("serializer (formatted output)", () => {
  it("formatted directives re-parse to the same semantics", () => {
    const txn: TransactionDirective = {
      kind: "transaction",
      date: "2026-01-15",
      flag: "*",
      payee: "Directa",
      narration: "Acquisto VWCE",
      tags: ["import"],
      links: [],
      meta: { ordine: "A1B2C3" },
      postings: [
        {
          account: "Assets:Broker:Directa:VWCE",
          amount: { number: new Decimal(10), currency: "VWCE" },
          cost: { number: new Decimal("115.32"), currency: "EUR" },
          meta: {},
        },
        {
          account: "Assets:Broker:Directa:Cash",
          amount: { number: new Decimal("-1153.20"), currency: "EUR" },
          meta: {},
        },
      ],
    };
    const text = formatDirective(txn);
    const back = parse(text).directives[0]!;
    if (back.kind !== "transaction") throw new Error("expected txn");
    expect(back.payee).toBe("Directa");
    expect(back.meta["ordine"]).toBe("A1B2C3");
    expect(back.postings[0]!.cost!.number!.toString()).toBe("115.32");
    expect(back.postings[1]!.amount!.number.toString()).toBe("-1153.2");
  });

  it("quotes strings with embedded quotes", () => {
    const d: Directive = {
      kind: "option",
      name: "title",
      value: 'my "ledger"',
    };
    const back = parse(formatDirective(d)).directives[0]!;
    if (back.kind !== "option") throw new Error("expected option");
    expect(back.value).toBe('my "ledger"');
  });
});

describe("property: lossless round-trip", () => {
  const accountArb = fc
    .tuple(
      fc.constantFrom("Assets", "Income", "Expenses", "Liabilities", "Equity"),
      fc.array(
        fc
          .tuple(
            fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")),
            fc.stringMatching(/^[A-Za-z0-9-]{0,8}$/),
          )
          .map(([h, t]) => h + t),
        { minLength: 1, maxLength: 3 },
      ),
    )
    .map(([root, parts]) => [root, ...parts].join(":"));

  const currencyArb = fc.constantFrom("EUR", "USD", "VWCE", "IT0005547408");
  const numArb = fc
    .integer({ min: -10_000_000, max: 10_000_000 })
    .map((n) => new Decimal(n).div(100));
  const dateArb = fc
    .date({
      min: new Date("2020-01-01T00:00:00Z"),
      max: new Date("2030-12-31T00:00:00Z"),
    })
    .map((d) => d.toISOString().slice(0, 10));
  const narrationArb = fc.stringMatching(/^[ -~]{0,30}$/); // printable ASCII

  const txnArb: fc.Arbitrary<TransactionDirective> = fc
    .record({
      date: dateArb,
      narration: narrationArb,
      postings: fc.array(
        fc.record({
          account: accountArb,
          number: numArb,
          currency: currencyArb,
          withCost: fc.boolean(),
        }),
        { minLength: 1, maxLength: 4 },
      ),
    })
    .map(({ date, narration, postings }) => ({
      kind: "transaction" as const,
      date,
      flag: "*",
      narration,
      tags: [],
      links: [],
      meta: {},
      postings: postings.map((p): Posting => {
        const posting: Posting = {
          account: p.account,
          amount: { number: p.number, currency: p.currency },
          meta: {},
        };
        if (p.withCost) posting.cost = { number: new Decimal("100.5"), currency: "EUR" };
        return posting;
      }),
    }));

  it("serialize(parse(serialize(file))) === serialize(file)", () => {
    fc.assert(
      fc.property(fc.array(txnArb, { maxLength: 10 }), (txns) => {
        const text = txns.map(formatDirective).join("\n");
        expect(serialize(parse(text))).toBe(text);
      }),
      { numRuns: 200 },
    );
  });

  it("formatted transactions re-parse with identical values", () => {
    fc.assert(
      fc.property(txnArb, (txn) => {
        const back = parse(formatDirective(txn)).directives[0];
        if (back?.kind !== "transaction")
          throw new Error("expected transaction, got " + back?.kind);
        expect(back.date).toBe(txn.date);
        expect(back.narration).toBe(txn.narration);
        expect(back.postings).toHaveLength(txn.postings.length);
        for (let i = 0; i < txn.postings.length; i++) {
          const a = txn.postings[i]!;
          const b = back.postings[i]!;
          expect(b.account).toBe(a.account);
          expect(b.amount!.number.equals(a.amount!.number)).toBe(true);
          expect(b.amount!.currency).toBe(a.amount!.currency);
        }
      }),
      { numRuns: 200 },
    );
  });
});
