import { describe, expect, it } from "vitest";
import {
  parseConfig,
  parseTargets,
  serializeConfig,
  serializeTargets,
} from "../src/core/config/codecs";
import type { RebalanceTarget } from "../src/core/model/config";

describe("config [[pensione]]", () => {
  it("parsa più profili da config.toml", () => {
    const cfg = parseConfig(`
operating_currency = "EUR"

[[pensione]]
nome = "Gabriele"
data_nascita = "1988-10-21"
eta_pensionamento = 73
eta_decesso = 110
spese_annuali = 38000
rendimento_pre = 0.05
rendimento_post = 0.04

[[pensione]]
nome = "Alessandra"
data_nascita = "1990-03-02"
eta_pensionamento = 67
eta_decesso = 100
spese_annuali = 24000
rendimento_pre = 0.04
rendimento_post = 0.03
`);
    expect(cfg.pensioni).toHaveLength(2);
    expect(cfg.pensioni[0]).toEqual({
      nome: "Gabriele",
      dataNascita: "1988-10-21",
      etaPensionamento: 73,
      etaDecesso: 110,
      speseAnnuali: 38000,
      rendimentoPre: 0.05,
      rendimentoPost: 0.04,
      portafogli: [],
    });
    expect(cfg.pensioni[1]?.nome).toBe("Alessandra");
  });

  it("retro-compatibile con la vecchia tabella singola [pensione]", () => {
    const cfg = parseConfig(`
[pensione]
data_nascita = "1988-10-21"
eta_pensionamento = 73
eta_decesso = 110
spese_annuali = 38000
rendimento_pre = 0.05
rendimento_post = 0.04
`);
    expect(cfg.pensioni).toHaveLength(1);
    expect(cfg.pensioni[0]?.nome).toBe("Persona 1");
    expect(cfg.pensioni[0]?.dataNascita).toBe("1988-10-21");
  });

  it("array vuoto se la sezione manca", () => {
    expect(parseConfig(`operating_currency = "EUR"`).pensioni).toEqual([]);
  });

  it("round-trip serialize→parse preserva i profili", () => {
    const cfg = parseConfig(`operating_currency = "EUR"`);
    cfg.pensioni = [
      {
        nome: "Tizio",
        dataNascita: "1990-01-01",
        etaPensionamento: 67,
        etaDecesso: 95,
        speseAnnuali: 30000,
        rendimentoPre: 0.04,
        rendimentoPost: 0.03,
        portafogli: [],
      },
    ];
    const round = parseConfig(serializeConfig(cfg));
    expect(round.pensioni).toEqual(cfg.pensioni);
  });

  it("parsa i portafogli per-persona", () => {
    const cfg = parseConfig(`
[[pensione]]
nome = "Gabriele"
data_nascita = "1988-10-21"
portafogli = ["Liquidità - Gabriele", "Emergency Fund"]
`);
    expect(cfg.pensioni[0]?.portafogli).toEqual(["Liquidità - Gabriele", "Emergency Fund"]);
  });

  it("portafogli per-persona vuoti se la chiave manca", () => {
    const cfg = parseConfig(`
[[pensione]]
nome = "Gabriele"
data_nascita = "1988-10-21"
`);
    expect(cfg.pensioni[0]?.portafogli).toEqual([]);
  });

  it("round-trip dei portafogli per-persona", () => {
    const cfg = parseConfig(`operating_currency = "EUR"`);
    cfg.pensioni = [
      {
        nome: "Tizio",
        dataNascita: "1990-01-01",
        etaPensionamento: 67,
        etaDecesso: 95,
        speseAnnuali: 30000,
        rendimentoPre: 0.04,
        rendimentoPost: 0.03,
        portafogli: ["Investimento a lungo - Plinio 14", "Liquidità - Gabriele"],
      },
    ];
    const round = parseConfig(serializeConfig(cfg));
    expect(round.pensioni[0]?.portafogli).toEqual([
      "Investimento a lungo - Plinio 14",
      "Liquidità - Gabriele",
    ]);
  });

  it("round-trip dei portafogli destinati alla pensione", () => {
    const cfg = parseConfig(`operating_currency = "EUR"`);
    expect(cfg.pensionePortafogli).toEqual([]);
    cfg.pensionePortafogli = ["Investimento a lungo - Plinio 14", "Liquidità - Gabriele"];
    const round = parseConfig(serializeConfig(cfg));
    expect(round.pensionePortafogli).toEqual(cfg.pensionePortafogli);
  });
});

describe("config [[deposito]]", () => {
  it("parsa più conti titoli", () => {
    const cfg = parseConfig(`
operating_currency = "EUR"

[[deposito]]
id = "Directa"
nome = "Directa — Gabriele"
owner = "Gabriele"
broker = "Directa"
aliquota = 0.002

[[deposito]]
id = "DirectaAlessandra"
nome = "Directa — Alessandra"
owner = "Alessandra"
broker = "Directa"
aliquota = 0.001
`);
    expect(cfg.depositi).toHaveLength(2);
    expect(cfg.depositi[0]).toEqual({
      id: "Directa",
      nome: "Directa — Gabriele",
      owner: "Gabriele",
      broker: "Directa",
      aliquota: 0.002,
      periodicita: "annuale",
    });
    expect(cfg.depositi[1]?.aliquota).toBe(0.001);
  });

  it("aliquota e periodicità di default quando mancano", () => {
    const cfg = parseConfig(`
[[deposito]]
id = "Directa"
nome = "Directa"
owner = "Gabriele"
broker = "Directa"
`);
    expect(cfg.depositi[0]?.aliquota).toBe(0.002);
    expect(cfg.depositi[0]?.periodicita).toBe("annuale");
  });

  it("legge la periodicità semestrale", () => {
    const cfg = parseConfig(`
[[deposito]]
id = "Directa"
nome = "Directa"
owner = "Gabriele"
broker = "Directa"
periodicita = "semestrale"
`);
    expect(cfg.depositi[0]?.periodicita).toBe("semestrale");
  });

  it("array vuoto se la sezione manca", () => {
    expect(parseConfig(`operating_currency = "EUR"`).depositi).toEqual([]);
  });

  it("round-trip serialize→parse preserva i depositi", () => {
    const cfg = parseConfig(`operating_currency = "EUR"`);
    cfg.depositi = [
      {
        id: "Directa",
        nome: "Directa — Gabriele",
        owner: "Gabriele",
        broker: "Directa",
        aliquota: 0.002,
        periodicita: "annuale",
      },
      {
        id: "DirectaAlessandra",
        nome: "Directa — Alessandra",
        owner: "Alessandra",
        broker: "Directa",
        aliquota: 0.0015,
        periodicita: "semestrale",
      },
    ];
    const round = parseConfig(serializeConfig(cfg));
    expect(round.depositi).toEqual(cfg.depositi);
  });
});

describe("config formato_dati", () => {
  it("round-trip preserva il marcatore di formato", () => {
    const cfg = parseConfig(`operating_currency = "EUR"`);
    cfg.formatoDati = 3;
    expect(parseConfig(serializeConfig(cfg)).formatoDati).toBe(3);
  });

  it("assente resta assente (cartella pre-versionamento)", () => {
    const cfg = parseConfig(`operating_currency = "EUR"`);
    expect(parseConfig(serializeConfig(cfg)).formatoDati).toBeUndefined();
  });
});

describe("targets.toml", () => {
  it("round-trip preserva peso e flag fisso/escluso", () => {
    const targets: RebalanceTarget[] = [
      { portfolio: "P", commodity: "A", peso: 0.5 },
      { portfolio: "P", commodity: "B", peso: 0.5, fisso: true },
      { portfolio: "P", commodity: "C", peso: 0, escluso: true },
    ];
    expect(parseTargets(serializeTargets(targets))).toEqual(targets);
  });

  it("tiene una riga con solo flag (peso 0) e scarta quelle vuote", () => {
    const text = `
[[target]]
portfolio = "P"
commodity = "A"
peso = 0.0
fisso = true

[[target]]
portfolio = "P"
commodity = "B"
peso = 0.0
`;
    expect(parseTargets(text)).toEqual([{ portfolio: "P", commodity: "A", peso: 0, fisso: true }]);
  });
});
