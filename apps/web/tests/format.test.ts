import { describe, expect, it } from "vitest";
import {
  applyMigrations,
  DATA_FORMAT,
  DATA_FORMAT_MIN,
  dataVersionLabel,
  formatStatus,
  type Migration,
  runMigrations,
} from "../src/core/config/format";

describe("dataVersionLabel", () => {
  it("mostra la revisione intera come N.0", () => {
    expect(dataVersionLabel(1)).toBe("1.0");
    expect(dataVersionLabel(0)).toBe("0.0");
    expect(dataVersionLabel(2)).toBe("2.0");
  });
});

describe("formatStatus", () => {
  it("pari alla versione corrente = ok", () => {
    expect(formatStatus(DATA_FORMAT)).toBe("ok");
  });

  it("più recente dell'app = app-vecchia", () => {
    expect(formatStatus(DATA_FORMAT + 1)).toBe("app-vecchia");
  });

  it("sopra il minimo ma sotto il corrente = consigliato", () => {
    // costruito solo se c'è spazio fra MIN e DATA_FORMAT
    if (DATA_FORMAT > DATA_FORMAT_MIN) {
      expect(formatStatus(DATA_FORMAT_MIN)).toBe("consigliato");
    }
  });

  it("sotto il minimo = richiesto", () => {
    expect(formatStatus(DATA_FORMAT_MIN - 1)).toBe("richiesto");
  });
});

describe("applyMigrations", () => {
  const reg: Record<number, Migration> = {
    0: (f) => new Map([...f, ["step", `${f.get("step") ?? ""}0`]]),
    1: (f) => new Map([...f, ["step", `${f.get("step") ?? ""}1`]]),
    2: (f) => new Map([...f, ["step", `${f.get("step") ?? ""}2`]]),
  };

  it("applica i passi in sequenza da `from` a `to` (esclusivo)", () => {
    const out = applyMigrations(new Map(), 0, 3, reg);
    expect(out.get("step")).toBe("012");
  });

  it("parte dalla versione giusta", () => {
    const out = applyMigrations(new Map(), 1, 3, reg);
    expect(out.get("step")).toBe("12");
  });

  it("salta i passi senza voce nel registro", () => {
    const sparse: Record<number, Migration> = { 1: reg[1]! };
    const out = applyMigrations(new Map(), 0, 3, sparse);
    expect(out.get("step")).toBe("1");
  });

  it("from == to non fa nulla", () => {
    const out = applyMigrations(new Map([["step", "x"]]), 2, 2, reg);
    expect(out.get("step")).toBe("x");
  });
});

describe("runMigrations", () => {
  it("porta una cartella vecchia fino a DATA_FORMAT", () => {
    const { to } = runMigrations(new Map(), DATA_FORMAT_MIN);
    expect(to).toBe(DATA_FORMAT);
  });

  it("non tocca una cartella già alla versione corrente", () => {
    const files = new Map([["a", "1"]]);
    const { files: out, to } = runMigrations(files, DATA_FORMAT);
    expect(to).toBe(DATA_FORMAT);
    expect(out).toBe(files); // stessa istanza: nessuna copia
  });

  it("non tocca una cartella più recente dell'app", () => {
    const { to } = runMigrations(new Map(), DATA_FORMAT + 2);
    expect(to).toBe(DATA_FORMAT + 2);
  });
});
