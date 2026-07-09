import type { IsoDate } from "@unportfolio/core/beancount/ast";
import { deriveBolloTitoli } from "@unportfolio/core/derive/bollo";
import type { PatrimonioRow } from "@unportfolio/core/derive/patrimonio";
import type { Deposito, PatrimonioAccount } from "@unportfolio/core/model/config";
import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";

function account(id: string, deposito?: string): PatrimonioAccount {
  const a: PatrimonioAccount = {
    id,
    nome: id,
    sezione: "asset",
    tipo: "ETF",
    owner: "",
    inNetWorth: true,
    valuta: "EUR",
  };
  if (deposito) a.deposito = deposito;
  return a;
}

function row(
  id: string,
  deposito: string | undefined,
  values: Record<string, number>,
  live?: number,
): PatrimonioRow {
  const v = new Map<IsoDate, Decimal | undefined>();
  for (const [d, n] of Object.entries(values)) v.set(d, new Decimal(n));
  const r: PatrimonioRow = { account: account(id, deposito), values: v };
  if (live !== undefined) r.live = new Decimal(live);
  return r;
}

const dep = (
  id: string,
  owner: string,
  aliquota: number,
  periodicita: Deposito["periodicita"] = "annuale",
): Deposito => ({
  id,
  nome: `Directa — ${owner}`,
  owner,
  broker: "Directa",
  aliquota,
  periodicita,
});

describe("deriveBolloTitoli", () => {
  it("applica aliquote diverse per deposito", () => {
    const depositi = [dep("DG", "Gabriele", 0.002), dep("DA", "Alessandra", 0.001)];
    const rows = [row("a", "DG", {}, 10000), row("b", "DA", {}, 5000)];
    const { righe, totale } = deriveBolloTitoli({ rows, depositi, when: "live" });
    const dg = righe.find((r) => r.id === "DG")!;
    const da = righe.find((r) => r.id === "DA")!;
    expect(dg.bollo.toNumber()).toBe(20); // 10000 × 0,20%
    expect(da.bollo.toNumber()).toBe(5); // 5000 × 0,10%
    expect(totale.toNumber()).toBe(25);
  });

  it("somma più conti nello stesso deposito", () => {
    const depositi = [dep("DG", "Gabriele", 0.002)];
    const rows = [row("a", "DG", {}, 3000), row("b", "DG", {}, 7000)];
    const { righe } = deriveBolloTitoli({ rows, depositi, when: "live" });
    expect(righe[0]!.valore.toNumber()).toBe(10000);
    expect(righe[0]!.bollo.toNumber()).toBe(20);
  });

  it("esclude i conti senza deposito e usa l'aliquota di default", () => {
    const depositi = [dep("DG", "Gabriele", 0.002)];
    const rows = [row("a", "DG", {}, 1000), row("b", undefined, {}, 999999)];
    const { righe, totale } = deriveBolloTitoli({ rows, depositi, when: "live" });
    expect(righe).toHaveLength(1);
    expect(totale.toNumber()).toBe(2); // solo il conto del deposito
  });

  it("mostra i depositi configurati anche senza conti (valore 0)", () => {
    const depositi = [dep("DG", "Gabriele", 0.002), dep("DA", "Alessandra", 0.002)];
    const { righe } = deriveBolloTitoli({
      rows: [row("a", "DG", {}, 1000)],
      depositi,
      when: "live",
    });
    const da = righe.find((r) => r.id === "DA")!;
    expect(da.valore.toNumber()).toBe(0);
    expect(da.bollo.toNumber()).toBe(0);
  });

  it("è coerente tra live e una data snapshot", () => {
    const depositi = [dep("DG", "Gabriele", 0.002)];
    const rows = [row("a", "DG", { "2025-12-31": 8000 }, 9000)];
    const atDate = deriveBolloTitoli({ rows, depositi, when: "2025-12-31" });
    const atLive = deriveBolloTitoli({ rows, depositi, when: "live" });
    expect(atDate.righe[0]!.bollo.toNumber()).toBe(16); // 8000 × 0,20%
    expect(atLive.righe[0]!.bollo.toNumber()).toBe(18); // 9000 × 0,20%
  });

  it("usa l'aliquota di default per un deposito non in config", () => {
    const rows = [row("a", "DX", {}, 1000)];
    const { righe } = deriveBolloTitoli({ rows, depositi: [], when: "live" });
    expect(righe[0]!.aliquota).toBe(0.002);
    expect(righe[0]!.bollo.toNumber()).toBe(2);
    expect(righe[0]!.periodicita).toBe("annuale");
    expect(righe[0]!.bolloPeriodo.toNumber()).toBe(2);
  });

  it("periodicità semestrale: addebito = metà del bollo annuo", () => {
    const depositi = [dep("DG", "Gabriele", 0.002, "semestrale")];
    const rows = [row("a", "DG", {}, 10000)];
    const { righe } = deriveBolloTitoli({ rows, depositi, when: "live" });
    expect(righe[0]!.bollo.toNumber()).toBe(20); // annuo invariato
    expect(righe[0]!.periodi).toBe(2);
    expect(righe[0]!.bolloPeriodo.toNumber()).toBe(10); // 20 / 2
  });

  it("periodicità trimestrale: addebito = un quarto del bollo annuo", () => {
    const depositi = [dep("DG", "Gabriele", 0.002, "trimestrale")];
    const rows = [row("a", "DG", {}, 10000)];
    const { righe } = deriveBolloTitoli({ rows, depositi, when: "live" });
    expect(righe[0]!.bollo.toNumber()).toBe(20); // annuo invariato
    expect(righe[0]!.periodi).toBe(4);
    expect(righe[0]!.bolloPeriodo.toNumber()).toBe(5); // 20 / 4
  });
});
