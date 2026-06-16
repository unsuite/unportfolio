import { describe, expect, it } from "vitest";
import { computePension, type PensionInput } from "../src/core/math/pension";

// Caso di riferimento preso dal "foglio 3" dell'utente, verificato al centesimo.
const REF: PensionInput = {
  dataNascita: "1988-10-21",
  etaPensionamento: 73,
  etaDecesso: 110,
  speseAnnuali: 38000,
  rendimentoPre: 0.05,
  rendimentoPost: 0.04,
};

describe("computePension", () => {
  it("riproduce la riga del foglio (età = differenza anni solari)", () => {
    const r = computePension(REF, "2026-06-16");
    expect(r.etaAttuale).toBe(38); // 2026 − 1988
    expect(r.anniAllaPensione).toBe(35); // 73 − 38
    expect(r.anniDaFinanziare).toBe(37); // 110 − 73

    // perpetuità: S / r_post = 38000 / 0,04
    expect(r.targetPensionamentoSenzaErosione).toBeCloseTo(950000, 2);
    // annualità che azzera il capitale: 38000 × (1 − 1,04⁻³⁷)/0,04
    expect(r.targetPensionamentoConErosione).toBeCloseTo(727417.9945, 2);
    // sconto ad oggi al rendimento pre-pensione su 35 anni
    expect(r.targetCorrenteSenzaErosione).toBeCloseTo(172225.7711, 2);
    expect(r.targetCorrenteConErosione).toBeCloseTo(131873.8158, 2);
  });

  it("l'età è la differenza tra anni solari, non l'età anagrafica precisa", () => {
    // a giugno il compleanno di ottobre non è ancora passato, ma usiamo comunque 2026−1988
    const r = computePension(REF, "2026-01-01");
    expect(r.etaAttuale).toBe(38);
  });

  it("con rendimento post = 0 la perpetuità è infinita e l'annualità è S×anni", () => {
    const r = computePension({ ...REF, rendimentoPost: 0 }, "2026-06-16");
    expect(r.targetPensionamentoSenzaErosione).toBe(Number.POSITIVE_INFINITY);
    expect(r.targetPensionamentoConErosione).toBeCloseTo(38000 * 37, 2);
  });

  it("se già in pensione (anni alla pensione ≤ 0) i target correnti non scontano nel passato", () => {
    const r = computePension({ ...REF, etaPensionamento: 38 }, "2026-06-16");
    expect(r.anniAllaPensione).toBe(0);
    // nessuno sconto: corrente == a pensionamento
    expect(r.targetCorrenteSenzaErosione).toBeCloseTo(r.targetPensionamentoSenzaErosione, 2);
    expect(r.targetCorrenteConErosione).toBeCloseTo(r.targetPensionamentoConErosione, 2);
  });
});
