import { describe, expect, it } from "vitest";
import { book, type InstrumentPosition } from "../src/core/beancount/booking";
import { parse } from "../src/core/beancount/parser";
import { missingAssetAccounts } from "../src/core/config/reconcile";
import type { CommodityInfo } from "../src/core/derive/assets";
import type { PatrimonioAccount } from "../src/core/model/config";

const commodities = new Map<string, CommodityInfo>([
  [
    "IE00BK5BQT80",
    {
      commodity: "IE00BK5BQT80",
      isin: "IE00BK5BQT80",
      ticker: "VWCE",
      assetClass: "ETF",
      taxRate: 0.26,
    },
  ],
  [
    "IT0005547408",
    {
      commodity: "IT0005547408",
      isin: "IT0005547408",
      ticker: "M.510541",
      assetClass: "BOND",
      taxRate: 0.125,
    },
  ],
]);

/** posizioni di un deposito (segmento) per le due commodity di test */
function positionsFor(deposito: string): Map<string, InstrumentPosition> {
  const ledger = `
2024-01-10 * "${deposito}" "Acquisto ETF"
  Assets:Broker:${deposito}:IE00BK5BQT80      2 IE00BK5BQT80 {100.00 EUR}
  Assets:Broker:${deposito}:Cash        -200.00 EUR

2024-01-11 * "${deposito}" "Acquisto BOND"
  Assets:Broker:${deposito}:IT0005547408     50 IT0005547408 {99.00 EUR}
  Assets:Broker:${deposito}:Cash       -4950.00 EUR
`;
  return book(parse(ledger).directives).positions;
}

describe("missingAssetAccounts", () => {
  it("crea un conto per ogni holding senza riga patrimonio", () => {
    const positions = positionsFor("Directa");
    // conto esistente senza deposito: copre l'ETF su qualunque deposito (compat)
    const existing: PatrimonioAccount[] = [
      {
        id: "ie00bk5bqt80-gabriele",
        nome: "Mondo",
        sezione: "asset",
        tipo: "ETF",
        owner: "Gabriele",
        inNetWorth: true,
        valuta: "EUR",
        commodity: "IE00BK5BQT80",
      },
    ];
    const missing = missingAssetAccounts(positions, commodities, existing);
    expect(missing).toHaveLength(1);
    const a = missing[0]!;
    expect(a.commodity).toBe("IT0005547408");
    expect(a.deposito).toBe("Directa");
    expect(a.tipo).toBe("BOND");
    expect(a.owner).toBe(""); // da assegnare
  });

  it("crea un conto distinto per lo stesso ISIN su un altro deposito", () => {
    const positions = positionsFor("DirectaAlessandra");
    // conti già assegnati a un deposito diverso non coprono questo rapporto
    const existing: PatrimonioAccount[] = [...commodities.keys()].map((c) => ({
      id: `${c.toLowerCase()}-directa`,
      nome: c,
      sezione: "asset" as const,
      tipo: "ETF",
      owner: "",
      inNetWorth: true,
      valuta: "EUR",
      commodity: c,
      deposito: "Directa",
    }));
    const missing = missingAssetAccounts(positions, commodities, existing);
    expect(missing).toHaveLength(2);
    expect(missing.every((a) => a.deposito === "DirectaAlessandra")).toBe(true);
  });

  it("è idempotente con conti senza deposito (impianto a deposito unico)", () => {
    const positions = positionsFor("Directa");
    const existing: PatrimonioAccount[] = [...commodities.keys()].map((c) => ({
      id: c.toLowerCase(),
      nome: c,
      sezione: "asset" as const,
      tipo: "ETF",
      owner: "",
      inNetWorth: true,
      valuta: "EUR",
      commodity: c,
    }));
    expect(missingAssetAccounts(positions, commodities, existing)).toHaveLength(0);
  });
});
