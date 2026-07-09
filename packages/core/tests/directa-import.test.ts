import { book, holdingKey } from "@unportfolio/core/beancount/booking";
import {
  directaImporter,
  parseItalianDate,
  parseItalianNumber,
} from "@unportfolio/core/import/directa";
import { mapMovimenti } from "@unportfolio/core/import/mapping";
import type { InstrumentInfo } from "@unportfolio/core/model/movimento";
import { describe, expect, it } from "vitest";

const CSV = [
  "Estratto conto Directa - conto 12345",
  "",
  "Data operazione;Data valuta;Tipo operazione;Ticker;Isin;Protocollo;Descrizione;Quantità;Importo euro;Importo Divisa;Divisa;Riferimento ordine",
  '02/06/2026;04/06/2026;Acquisto;VWCE;IE00BK5BQT80;;"VANGUARD FTSE ALL-WORLD UCITS";2;-262,84;0;EUR;Q9999',
  "02/06/2026;04/06/2026;Commissioni;VWCE;IE00BK5BQT80;;VANGUARD FTSE ALL-WORLD UCITS;0;-5,00;0;EUR;Q9999",
  "05/06/2026;05/06/2026;Conferimento con bonifico;;;12345678;;0;1.500,00;0;EUR;",
  "06/06/2026;09/06/2026;Vendita;VWCE;IE00BK5BQT80;;VANGUARD FTSE ALL-WORLD UCITS;-1;135,10;0;EUR;Q10000",
  "07/06/2026;07/06/2026;Bollo portafoglio titoli*;;;;;0;-12,30;0;EUR;",
].join("\n");

const VWCE: InstrumentInfo = {
  ticker: "VWCE",
  isin: "IE00BK5BQT80",
  assetClass: "ETF",
  taxRate: 0.26,
  currency: "EUR",
};

describe("parser numeri e date italiane", () => {
  it("numeri", () => {
    expect(parseItalianNumber("-262,84")!.toNumber()).toBe(-262.84);
    expect(parseItalianNumber("1.500,00")!.toNumber()).toBe(1500);
    expect(parseItalianNumber("1,234.56")!.toNumber()).toBe(1234.56);
    expect(parseItalianNumber("")).toBeUndefined();
  });
  it("date", () => {
    expect(parseItalianDate("02/06/2026")).toBe("2026-06-02");
    expect(parseItalianDate("2-6-2026")).toBe("2026-06-02");
    expect(parseItalianDate("2026-06-02")).toBe("2026-06-02");
    expect(parseItalianDate("boh")).toBeUndefined();
  });
});

describe("directa CSV importer", () => {
  it("sniffa i CSV con le intestazioni giuste", () => {
    expect(directaImporter.sniff({ name: "movimenti.csv", text: CSV })).toBe(true);
    expect(directaImporter.sniff({ name: "altro.csv", text: "a;b;c\n1;2;3" })).toBe(false);
  });

  it("salta il banner e legge i movimenti", () => {
    const r = directaImporter.parse({ name: "movimenti.csv", text: CSV });
    expect(r.warnings).toEqual([]);
    expect(r.movimenti).toHaveLength(5);
    const buy = r.movimenti[0]!;
    expect(buy).toMatchObject({
      tipo: "Acquisto",
      ticker: "VWCE",
      dataOperazione: "2026-06-02",
      dataValuta: "2026-06-04",
      riferimentoOrdine: "Q9999",
    });
    expect(buy.importoEuro.toNumber()).toBe(-262.84);
    expect(buy.quantita.toNumber()).toBe(2);
    expect(r.movimenti[2]!.protocollo).toBe("12345678");
  });

  it("mappa e quadra a libro mastro", () => {
    const r = directaImporter.parse({ name: "movimenti.csv", text: CSV });
    const mapped = mapMovimenti(r.movimenti, {
      instrument: (k) => (k === "VWCE" || k === "IE00BK5BQT80" ? VWCE : undefined),
      defaultBroker: "Directa",
    });
    expect(mapped.warnings).toEqual([]);
    expect(mapped.transactions).toHaveLength(5);
    const booked = book(mapped.transactions);
    expect(booked.errors).toEqual([]);
    const cash = booked.balances.get("Assets:Broker:Directa:Cash")!.get("EUR")!;
    // -262,84 -5 +1500 +135,10 -12,30
    expect(cash.toFixed(2)).toBe("1354.96");
    const pos = booked.positions.get(holdingKey("Directa", "IE00BK5BQT80"))!;
    expect(pos.units.toNumber()).toBe(1);
    expect(pos.realizedGain.toFixed(2)).toBe("3.68"); // 135,10 − 131,42
  });
});
