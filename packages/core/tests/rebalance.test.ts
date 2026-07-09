import { type RebalanceInput, rebalance } from "@unportfolio/core/derive/rebalance";
import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";

const mk = (
  commodity: string,
  corrente: number,
  peso: number,
  opts?: { fisso?: boolean; escluso?: boolean },
): RebalanceInput => ({
  commodity,
  corrente: new Decimal(corrente),
  peso,
  fisso: opts?.fisso ?? false,
  escluso: opts?.escluso ?? false,
});

const eur = (d: Decimal) => Math.round(d.toNumber() * 100) / 100;

describe("rebalance", () => {
  it("distribuisce il montante coi pesi normalizzati (caso base)", () => {
    const res = rebalance([mk("A", 100, 0.5), mk("B", 100, 0.5)], new Decimal(0));
    expect(eur(res.totale)).toBe(200);
    expect(eur(res.futuro)).toBe(200);
    expect(res.totalePesi).toBe(1);
    expect(eur(res.rows[0]!.ideale)).toBe(100);
    expect(eur(res.rows[0]!.delta)).toBe(0);
  });

  it("normalizza i pesi che non sommano a 1", () => {
    // pesi 0,6 + 0,6 = 1,2 → normalizzati a 50/50 su 200
    const res = rebalance([mk("A", 150, 0.6), mk("B", 50, 0.6)], new Decimal(0));
    expect(res.totalePesi).toBeCloseTo(1.2, 10);
    expect(eur(res.rows[0]!.ideale)).toBe(100);
    expect(eur(res.rows[1]!.ideale)).toBe(100);
    expect(eur(res.rows[0]!.delta)).toBe(-50);
    expect(eur(res.rows[1]!.delta)).toBe(50);
  });

  it("aggiunge la liquidità al montante", () => {
    const res = rebalance([mk("A", 100, 0.5), mk("B", 100, 0.5)], new Decimal(100));
    expect(eur(res.futuro)).toBe(300);
    expect(eur(res.rows[0]!.ideale)).toBe(150);
    expect(eur(res.rows[0]!.delta)).toBe(50);
  });

  it("fisso: ideale = corrente, delta 0, e toglie il suo valore dal montante", () => {
    // A fisso a 60; B+C si spartiscono (100+40+60... ) futuro − 60
    // totale = 60+20+20 = 100, liq 0, futuro 100, montante = 100 − 60 = 40
    // B,C pesi 0,5/0,5 → 20 ciascuno
    const res = rebalance(
      [mk("A", 60, 0.9, { fisso: true }), mk("B", 20, 0.5), mk("C", 20, 0.5)],
      new Decimal(0),
    );
    expect(eur(res.rows[0]!.ideale)).toBe(60); // = corrente
    expect(eur(res.rows[0]!.delta)).toBe(0);
    // il peso del fisso entra nel totale mostrato ma non nel divisore
    expect(res.totalePesi).toBeCloseTo(1.9, 10); // 0,9 + 0,5 + 0,5
    expect(res.pesiNonFissi).toBe(1); // solo B + C
    expect(eur(res.rows[1]!.ideale)).toBe(20);
    expect(eur(res.rows[2]!.ideale)).toBe(20);
  });

  it("fisso assorbe la liquidità: il montante per gli altri cresce", () => {
    // totale 100 (A60 fisso, B20, C20), liq 40, futuro 140, montante 140−60=80
    const res = rebalance(
      [mk("A", 60, 0, { fisso: true }), mk("B", 20, 0.5), mk("C", 20, 0.5)],
      new Decimal(40),
    );
    expect(eur(res.rows[0]!.delta)).toBe(0);
    expect(eur(res.rows[1]!.ideale)).toBe(40);
    expect(eur(res.rows[2]!.ideale)).toBe(40);
  });

  it("escluso: fuori dal totale, dalle % e senza ideale/delta", () => {
    // X escluso a 500; A+B rimangono su totale 200
    const res = rebalance(
      [mk("A", 100, 0.5), mk("B", 100, 0.5), mk("X", 500, 0, { escluso: true })],
      new Decimal(0),
    );
    expect(eur(res.totale)).toBe(200); // esclude X
    expect(eur(res.totaleEscluso)).toBe(500);
    const x = res.rows[2]!;
    expect(x.correntePct).toBe(0);
    expect(eur(x.ideale)).toBe(0);
    expect(eur(x.delta)).toBe(0);
    // A resta al 50% del totale non-escluso
    expect(res.rows[0]!.correntePct).toBeCloseTo(0.5, 10);
    expect(eur(res.rows[0]!.ideale)).toBe(100);
  });

  it("l'escluso non riduce il montante da investire (solo si sfila)", () => {
    // A100 B100 target, X escluso, liq 100 → futuro 300 su A,B
    const res = rebalance(
      [mk("A", 100, 0.5), mk("B", 100, 0.5), mk("X", 999, 0, { escluso: true })],
      new Decimal(100),
    );
    expect(eur(res.futuro)).toBe(300);
    expect(eur(res.rows[0]!.ideale)).toBe(150);
  });

  it("fisso + escluso combinati", () => {
    // A fisso 50, B target, X escluso; totale non-escluso = 50+50=100, liq 0
    // montante = 100 − 50 = 50, B unico non-fisso → 50
    const res = rebalance(
      [mk("A", 50, 0, { fisso: true }), mk("B", 50, 1), mk("X", 300, 0, { escluso: true })],
      new Decimal(0),
    );
    expect(eur(res.totale)).toBe(100);
    expect(eur(res.rows[0]!.delta)).toBe(0);
    expect(eur(res.rows[1]!.ideale)).toBe(50);
    expect(eur(res.rows[1]!.delta)).toBe(0);
  });

  it("fisso: conta nel totale mostrato ma la liquidità resta tutta investita", () => {
    // A fisso 30 (peso 0,2), B/C target 0,4/0,4, liq 10
    // totale 110, futuro 120 ; totalePesi mostrato = 0,2+0,4+0,4 = 1,0
    // montante = 120−30 = 90 → B,C 45 ciascuno
    const res = rebalance(
      [mk("A", 30, 0.2, { fisso: true }), mk("B", 40, 0.4), mk("C", 40, 0.4)],
      new Decimal(10),
    );
    expect(res.totalePesi).toBeCloseTo(1, 10);
    expect(res.pesiNonFissi).toBeCloseTo(0.8, 10);
    // l'ideale complessivo eguaglia il futuro: nessuna liquidità lasciata ferma
    const sommaIdeali = res.rows.reduce((t, r) => t.add(r.ideale), new Decimal(0));
    expect(eur(sommaIdeali)).toBe(120);
    // da comprare totale = liquidità
    const sommaDelta = res.rows.reduce((t, r) => t.add(r.delta), new Decimal(0));
    expect(eur(sommaDelta)).toBe(10);
  });

  it("nessun peso: ideali a zero, delta = −corrente", () => {
    const res = rebalance([mk("A", 100, 0), mk("B", 100, 0)], new Decimal(0));
    expect(res.totalePesi).toBe(0);
    expect(eur(res.rows[0]!.ideale)).toBe(0);
    expect(eur(res.rows[0]!.delta)).toBe(-100);
  });
});
