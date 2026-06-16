import { describe, expect, it } from "vitest";
import { parseConfig, serializeConfig } from "../src/core/config/codecs";

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
