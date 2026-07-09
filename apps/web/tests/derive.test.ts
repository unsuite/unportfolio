import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { book } from "../src/core/beancount/booking";
import { parse } from "../src/core/beancount/parser";
import * as codecs from "../src/core/config/codecs";
import {
  goalTarget,
  parseAccounts,
  parseGoals,
  parseSnapshots,
  serializeAccounts,
  serializeGoals,
  serializeSnapshots,
} from "../src/core/config/codecs";
import { deriveAssets, readCommodityInfo } from "../src/core/derive/assets";
import { deriveGoalStatus, linearChain } from "../src/core/derive/goalStatus";
import { derivePatrimonio, portfolioCurrents } from "../src/core/derive/patrimonio";
import { buildPriceTable, hasSample, priceAt } from "../src/core/derive/prices";
import type { Goal } from "../src/core/model/config";

const LEDGER = `
2024-01-01 commodity VWCE
  name: "Vanguard FTSE All-World"
  ticker: "VWCE"
  class: "ETF"
  tax-rate: 0.26

2024-01-01 commodity IT0005547408
  name: "BTP VALORE GN27 EUR"
  class: "BOND"
  tax-rate: 0.125
  maturity: 2027-06-06
  coupon-rate: 0.0333
  coupon-freq: 4

2024-02-26 * "Directa" "Acquisto VWCE"
  Assets:Broker:Directa:VWCE                     10 VWCE {100.00 EUR}
  Assets:Broker:Directa:Cash               -1000.00 EUR

2024-06-03 * "Directa" "Acquisto BTP"
  Assets:Broker:Directa:IT0005547408             50 IT0005547408 {99.20 EUR}
  Assets:Broker:Directa:Cash               -4960.00 EUR

2025-03-31 price VWCE 110.00 EUR
2025-03-31 price IT0005547408 100.00 EUR
2025-06-01 price VWCE 120.00 EUR
`;

describe("price table", () => {
  const table = buildPriceTable(parse(LEDGER).directives);

  it("finds the last price at or before a date", () => {
    expect(priceAt(table, "VWCE", "2025-04-15")!.price.toNumber()).toBe(110);
    expect(priceAt(table, "VWCE", "2025-06-01")!.price.toNumber()).toBe(120);
    expect(priceAt(table, "VWCE", "2025-01-01")).toBeUndefined();
  });

  it("dedupes samples per day", () => {
    expect(hasSample(table, "VWCE", "2025-06-01")).toBe(true);
    expect(hasSample(table, "VWCE", "2025-06-02")).toBe(false);
  });
});

describe("deriveAssets", () => {
  const directives = parse(LEDGER).directives;
  const booked = book(directives);
  const rows = deriveAssets({
    positions: booked.positions,
    commodities: readCommodityInfo(directives),
    prices: buildPriceTable(directives),
    liveQuotes: new Map([["VWCE", new Decimal(125)]]),
    asOf: "2025-06-12",
  });

  it("values ETF with the live quote", () => {
    const vwce = rows.find((r) => r.commodity === "VWCE")!;
    expect(vwce.value!.toNumber()).toBe(1250);
    expect(vwce.unrealizedGain!.toNumber()).toBe(250);
    expect(vwce.taxOnGain!.toNumber()).toBe(-65); // 26%
    expect(vwce.netValue!.toNumber()).toBe(1185);
    expect(vwce.yieldPct!.toNumber()).toBeCloseTo(0.25, 10);
  });

  it("propaga il ticker come metadato di display (commodity = ISIN)", () => {
    const vwce = rows.find((r) => r.commodity === "VWCE")!;
    expect(vwce.ticker).toBe("VWCE");
    // il bond non ha ticker nei metadati → undefined (fallback al commodity)
    const btp = rows.find((r) => r.commodity === "IT0005547408")!;
    expect(btp.ticker).toBeUndefined();
  });

  it("values the bond with sampled price and bond projection", () => {
    const btp = rows.find((r) => r.commodity === "IT0005547408")!;
    expect(btp.value!.toNumber()).toBe(5000); // 50 × 100.00
    expect(btp.unrealizedGain!.toNumber()).toBeCloseTo(40, 10); // 5000 − 4960
    expect(btp.bond).toBeDefined();
    expect(btp.bond!.remainingCoupons).toBeGreaterThan(0);
    // tassa bond 12.5%
    expect(btp.taxOnGain!.toNumber()).toBeCloseTo(-5, 10);
  });

  it("computes a sensible XIRR", () => {
    const vwce = rows.find((r) => r.commodity === "VWCE")!;
    // −1000 il 2024-02-26 → 1250 il 2025-06-12 (~1.29 anni): ~19% annuo
    expect(vwce.xirrAnnual!).toBeGreaterThan(0.15);
    expect(vwce.xirrAnnual!).toBeLessThan(0.25);
  });
});

const ACCOUNTS_TOML = `
[[account]]
id = "cash-ing"
nome = "Liquidity ING"
sezione = "cash"
tipo = "Liquidity"
owner = "Gabriele"
portfolio = "Liquidità - Gabriele"
in_net_worth = true
valuta = "EUR"

[[account]]
id = "mutuo"
nome = "Mutuo Ristrutturazione"
sezione = "debt"
tipo = "Debt"
owner = "Alessandra"
in_net_worth = false
valuta = "EUR"

[[account]]
id = "vwce"
nome = "VWCE"
sezione = "asset"
tipo = "ETF"
owner = "Gabriele"
portfolio = "Investimento a lungo - Plinio 14"
in_net_worth = true
valuta = "EUR"
commodity = "VWCE"
`;

const SNAPSHOTS_CSV = `date,account_id,value,currency
2025-03-31,cash-ing,997.52,EUR
2025-03-31,mutuo,-57009.37,EUR
2025-06-30,cash-ing,1200.00,EUR
`;

describe("patrimonio", () => {
  const directives = parse(LEDGER).directives;
  const accounts = parseAccounts(ACCOUNTS_TOML);
  const snapshots = parseSnapshots(SNAPSHOTS_CSV);
  const statement = derivePatrimonio({
    accounts,
    snapshots,
    directives,
    prices: buildPriceTable(directives),
    liveQuotes: new Map([["VWCE", new Decimal(125)]]),
    asOf: "2025-07-15",
  });

  it("has snapshot dates from the csv", () => {
    expect(statement.dates).toEqual(["2025-03-31", "2025-06-30"]);
  });

  it("reads manual values per snapshot", () => {
    const ing = statement.rows.find((r) => r.account.id === "cash-ing")!;
    expect(ing.values.get("2025-03-31")!.toNumber()).toBe(997.52);
    expect(ing.values.get("2025-06-30")!.toNumber()).toBe(1200);
    expect(ing.live!.toNumber()).toBe(1200); // ultimo snapshot
  });

  it("computes ledger-backed values: units(date) × price(≤date)", () => {
    const vwce = statement.rows.find((r) => r.account.id === "vwce")!;
    expect(vwce.values.get("2025-03-31")!.toNumber()).toBe(1100); // 10 × 110
    expect(vwce.values.get("2025-06-30")!.toNumber()).toBe(1200); // 10 × 120
    expect(vwce.live!.toNumber()).toBe(1250); // 10 × 125 live
  });

  it("excludes non-inNetWorth rows from totals", () => {
    // 2025-03-31: 997.52 + 1100 (mutuo escluso)
    expect(statement.totals.get("2025-03-31")!.toNumber()).toBeCloseTo(2097.52, 2);
  });

  it("aggregates currents per portfolio", () => {
    const currents = portfolioCurrents(statement, "live");
    expect(currents.get("Liquidità - Gabriele")!.toNumber()).toBe(1200);
    expect(currents.get("Investimento a lungo - Plinio 14")!.toNumber()).toBe(1250);
  });

  it("aggregates currents at a reference snapshot date", () => {
    const currents = portfolioCurrents(statement, "2025-03-31");
    expect(currents.get("Liquidità - Gabriele")!.toNumber()).toBe(997.52);
    expect(currents.get("Investimento a lungo - Plinio 14")!.toNumber()).toBe(1100);
  });
});

describe("patrimonio: carry-forward dei conti manuali", () => {
  // cash-b viene registrato solo al primo snapshot; al secondo NON viene
  // ri-messo (workflow reale: si aggiorna solo ciò che è cambiato). Il suo
  // saldo deve persistere (funzione a gradino), non azzerarsi — altrimenti il
  // Δ vs uno snapshot precedente mostrerebbe l'intero valore come variazione.
  const accounts = parseAccounts(`
[[account]]
id = "cash-a"
nome = "Cash A"
sezione = "cash"
tipo = "Liquidity"
owner = "X"
portfolio = "P"
in_net_worth = true
valuta = "EUR"

[[account]]
id = "cash-b"
nome = "Cash B"
sezione = "cash"
tipo = "Liquidity"
owner = "Y"
portfolio = "P"
in_net_worth = true
valuta = "EUR"
`);
  const snapshots = parseSnapshots(`date,account_id,value,currency
2025-03-31,cash-a,1000,EUR
2025-03-31,cash-b,500,EUR
2025-06-30,cash-a,1100,EUR
`);
  const statement = derivePatrimonio({
    accounts,
    snapshots,
    directives: [],
    prices: new Map(),
    asOf: "2025-07-01",
  });

  it("riporta il valore di cash-b al 2025-06-30 (non azzerato)", () => {
    const b = statement.rows.find((r) => r.account.id === "cash-b")!;
    expect(b.values.get("2025-03-31")!.toNumber()).toBe(500);
    expect(b.values.get("2025-06-30")!.toNumber()).toBe(500);
    expect(b.live!.toNumber()).toBe(500);
  });

  it("il totale al 2025-06-30 include cash-b riportato", () => {
    // 1100 (cash-a) + 500 (cash-b carry-forward)
    expect(statement.totals.get("2025-06-30")!.toNumber()).toBe(1600);
  });
});

describe("goal status waterfall (valori del foglio, colonna Q4 2024)", () => {
  // Replica della catena del tab "5. Goal Status":
  // Liq-Gab → Liq-Ale → Liq-Plinio → Emergency → SPP-Gab
  const mkGoal = (portfolio: string, target: number): Goal => ({
    id: portfolio,
    attivo: true,
    tipo: "x",
    owner: "x",
    portfolio,
    target,
  });
  const goals = [
    mkGoal("Liquidità - Gabriele", 23152.66),
    mkGoal("Liquidità - Alessandra", 0),
    mkGoal("Liquidità - Plinio 14", 8300),
    mkGoal("Emergency Fund", 9414.26),
    mkGoal("Spese Previste Prevedibili - Gabriele", 4400),
  ];
  const currents = new Map([
    ["Liquidità - Gabriele", new Decimal(68959.55)],
    ["Liquidità - Alessandra", new Decimal(0)],
    ["Liquidità - Plinio 14", new Decimal(6861.71)],
    ["Emergency Fund", new Decimal(10147.14)],
    ["Spese Previste Prevedibili - Gabriele", new Decimal(5665.394)],
  ]);
  // la cascata del foglio = catena lineare di archi nel grafo
  const status = deriveGoalStatus({
    goals,
    currents,
    priorita: [],
    flussi: linearChain(goals.map((g) => g.portfolio)),
  });

  it("riproduce la cascata del foglio", () => {
    const byP = new Map(status.map((s) => [s.portfolio, s]));
    expect(byP.get("Liquidità - Gabriele")!.esubero.toFixed(2)).toBe("45806.89");
    // Liq-Plinio: con esubero = 6861.71 + 45806.89 + 0 = 52668.60 (foglio D17)
    expect(byP.get("Liquidità - Plinio 14")!.withSurplus.toFixed(2)).toBe("52668.60");
    expect(byP.get("Liquidità - Plinio 14")!.esubero.toFixed(2)).toBe("44368.60");
    // Emergency: 10147.14 + 44368.60 = 54515.74 (foglio D24)
    expect(byP.get("Emergency Fund")!.withSurplus.toFixed(2)).toBe("54515.74");
    expect(byP.get("Emergency Fund")!.esubero.toFixed(2)).toBe("45101.48");
    // SPP-Gab: 5665.394 + 45101.48 = 50766.874 (foglio D31)
    expect(byP.get("Spese Previste Prevedibili - Gabriele")!.withSurplus.toFixed(3)).toBe(
      "50766.874",
    );
  });

  it("completion senza esubero è clampata a 1", () => {
    const plinio = status.find((s) => s.portfolio === "Liquidità - Plinio 14")!;
    expect(plinio.completion.toFixed(4)).toBe("0.8267"); // 6861.71/8300 (foglio D16)
    expect(plinio.completionWithSurplus.toNumber()).toBe(1);
  });

  it("il deficit (esubero negativo) si propaga senza clamp, come nel foglio", () => {
    const s = deriveGoalStatus({
      goals: [mkGoal("A", 100), mkGoal("B", 50)],
      currents: new Map([
        ["A", new Decimal(60)],
        ["B", new Decimal(80)],
      ]),
      priorita: [],
      flussi: [{ da: "A", verso: "B" }],
    });
    expect(s[0]!.esubero.toNumber()).toBe(-40);
    expect(s[1]!.withSurplus.toNumber()).toBe(40); // 80 − 40
  });

  it("senza grafo nessuna propagazione: ogni nodo terminale", () => {
    const s = deriveGoalStatus({
      goals: [mkGoal("A", 100), mkGoal("B", 50)],
      currents: new Map([
        ["A", new Decimal(160)],
        ["B", new Decimal(20)],
      ]),
      priorita: ["A", "B"],
    });
    expect(s[0]!.esubero.toNumber()).toBe(60); // 160 − 100, non travasa
    expect(s[1]!.withSurplus.toNumber()).toBe(20); // niente carry da A
    expect(s[1]!.esubero.toNumber()).toBe(-30);
    expect(s.every((x) => x.verso.length === 0)).toBe(true);
  });
});

describe("goal status a grafo (esubero DAG)", () => {
  const mkGoal = (portfolio: string, target: number): Goal => ({
    id: portfolio,
    attivo: true,
    tipo: "x",
    owner: "x",
    portfolio,
    target,
  });
  // scenario: i goal personali di G prima (Liq-G → SPP-G), poi confluenza
  // in Plinio 14 insieme all'esubero di Alessandra
  const goals = [
    mkGoal("Liq-G", 100),
    mkGoal("SPP-G", 50),
    mkGoal("Liq-A", 80),
    mkGoal("Plinio", 200),
  ];
  const currents = new Map([
    ["Liq-G", new Decimal(150)],
    ["SPP-G", new Decimal(20)],
    ["Liq-A", new Decimal(100)],
    ["Plinio", new Decimal(120)],
  ]);
  const flussi = [
    { da: "Liq-G", verso: "SPP-G" },
    { da: "SPP-G", verso: "Plinio" },
    { da: "Liq-A", verso: "Plinio" },
  ];

  it("propaga lungo gli archi e fonde le confluenze", () => {
    const status = deriveGoalStatus({ goals, currents, priorita: [], flussi });
    const byP = new Map(status.map((s) => [s.portfolio, s]));
    // Liq-G: 150−100 = 50 → SPP-G
    expect(byP.get("Liq-G")!.esubero.toNumber()).toBe(50);
    expect(byP.get("Liq-G")!.verso).toEqual(["SPP-G"]);
    // SPP-G: 20+50 = 70, −50 = 20 → Plinio
    expect(byP.get("SPP-G")!.withSurplus.toNumber()).toBe(70);
    expect(byP.get("SPP-G")!.esubero.toNumber()).toBe(20);
    // Liq-A: 100−80 = 20 → Plinio
    // Plinio: 120 + 20 + 20 = 160 (merge delle due confluenze)
    expect(byP.get("Plinio")!.withSurplus.toNumber()).toBe(160);
    expect(byP.get("Plinio")!.verso).toEqual([]); // terminale
  });

  it("un nodo ha un solo esubero in uscita: la seconda uscita è ignorata", () => {
    // A → B e A → C: solo la prima conta, niente doppio conteggio
    const s = deriveGoalStatus({
      goals: [mkGoal("A", 0), mkGoal("B", 0), mkGoal("C", 0)],
      currents: new Map([
        ["A", new Decimal(100)],
        ["B", new Decimal(0)],
        ["C", new Decimal(0)],
      ]),
      priorita: [],
      flussi: [
        { da: "A", verso: "B" },
        { da: "A", verso: "C" },
      ],
    });
    const byP = new Map(s.map((x) => [x.portfolio, x]));
    expect(byP.get("A")!.verso).toEqual(["B"]); // solo B
    expect(byP.get("B")!.withSurplus.toNumber()).toBe(100); // riceve l'esubero
    expect(byP.get("C")!.withSurplus.toNumber()).toBe(0); // C non riceve nulla
  });

  it("con un ciclo ricade in modalità piatta (ordine priorità, nessun travaso)", () => {
    const ciclico = [...flussi, { da: "Plinio", verso: "Liq-G" }];
    const status = deriveGoalStatus({
      goals,
      currents,
      priorita: ["Liq-G", "SPP-G", "Liq-A", "Plinio"],
      flussi: ciclico,
    });
    // ordine = priorità; ogni nodo terminale (esubero = corrente − target)
    expect(status.map((s) => s.portfolio)).toEqual(["Liq-G", "SPP-G", "Liq-A", "Plinio"]);
    expect(status[3]!.withSurplus.toNumber()).toBe(120); // Plinio current, niente carry
    expect(status.every((x) => x.verso.length === 0)).toBe(true);
  });
});

describe("codecs round-trip", () => {
  it("goals.toml", () => {
    const goals: Goal[] = [
      {
        id: "PC",
        attivo: true,
        tipo: "Spese Previste Prevedibili",
        owner: "Gabriele",
        portfolio: "Spese Previste Prevedibili - Gabriele",
        descrizione: "Cambio PC",
        costoStimato: 3000,
        probabilita: 1,
        dataTarget: "2030-01-01",
      },
      {
        id: "TASSE",
        attivo: false,
        tipo: "Liquidità",
        owner: "Gabriele",
        portfolio: "Liquidità - Gabriele",
        target: 12462.55,
      },
    ];
    const back = parseGoals(serializeGoals(goals));
    expect(back).toEqual(goals);
    expect(goalTarget(back[0]!)).toBe(3000);
    expect(goalTarget(back[1]!)).toBe(12462.55);
  });

  it("accounts.toml", () => {
    const accounts = parseAccounts(ACCOUNTS_TOML);
    expect(parseAccounts(serializeAccounts(accounts))).toEqual(accounts);
    expect(accounts[1]!.inNetWorth).toBe(false);
  });

  it("config.toml con sezione [prezzi]", () => {
    const cfg = {
      operatingCurrency: "EUR",
      defaultBroker: "Directa",
      priorita: ["Liquidità - Gabriele", "Emergency Fund"],
      esuberoFlussi: [{ da: "A", verso: "B" }],
      esuberoLayout: [{ portfolio: "A", x: 10, y: 20 }],
      depositi: [],
      storicoAnni: 3,
      storicoIntervallo: "1d",
      percorsoDati: "/Users/x/dati",
      pensioni: [],
      pensionePortafogli: [],
    };
    const { parseConfig, serializeConfig } = codecs;
    expect(parseConfig(serializeConfig(cfg))).toEqual(cfg);
    // default quando la sezione manca
    const bare = parseConfig('operating_currency = "EUR"\n');
    expect(bare.storicoAnni).toBe(2);
    expect(bare.storicoIntervallo).toBe("1wk");
  });

  it("snapshots.csv", () => {
    const snaps = parseSnapshots(SNAPSHOTS_CSV);
    expect(parseSnapshots(serializeSnapshots(snaps))).toEqual(snaps);
    expect(snaps).toHaveLength(3);
  });
});
