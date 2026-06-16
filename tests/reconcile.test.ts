import { describe, expect, it } from "vitest";
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

describe("missingAssetAccounts", () => {
  it("crea un conto per ogni commodity senza riga patrimonio", () => {
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
    const missing = missingAssetAccounts(commodities, existing);
    expect(missing).toHaveLength(1);
    const a = missing[0]!;
    expect(a.commodity).toBe("IT0005547408");
    expect(a.nome).toBe("IT0005547408"); // default = ISIN
    expect(a.sezione).toBe("asset");
    expect(a.tipo).toBe("BOND");
    expect(a.owner).toBe(""); // da assegnare
    expect(a.inNetWorth).toBe(true);
    expect(a.id).not.toBe("ie00bk5bqt80-gabriele"); // id stabile e distinto
  });

  it("è idempotente: nessun conto mancante quando tutto è assegnato", () => {
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
    expect(missingAssetAccounts(commodities, existing)).toHaveLength(0);
  });
});
