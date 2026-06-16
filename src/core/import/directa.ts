import { Decimal } from "decimal.js";
import type { RawMovimento } from "../model/movimento";
import type { ImporterPlugin, ImportFile, ImportResult } from "./types";

/**
 * Importer per l'export movimenti / estratto conto di Directa (CSV).
 *
 * Tollerante su: separatore (";" o ","), decimali italiani ("1.234,56"),
 * date in formato gg/mm/aaaa, gg-mm-aaaa o ISO. Le colonne sono riconosciute
 * dalle intestazioni (stesse del foglio Movimenti: Data operazione, Data
 * valuta, Tipo operazione, Ticker, Isin, Protocollo, Descrizione, Quantità,
 * Importo euro, Divisa, Riferimento ordine).
 *
 * NOTA: tracciato ricostruito dal foglio dell'utente; da validare con un
 * export reale — il riconoscimento è volutamente per nome colonna, non per
 * posizione.
 */

function detectSeparator(headerLine: string): string {
  const semis = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semis >= commas ? ";" : ",";
}

/** CSV line split with quoted-field support. */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const HEADER_ALIASES: Record<string, string[]> = {
  dataOperazione: ["data operazione", "data op", "data"],
  dataValuta: ["data valuta", "valuta data"],
  tipo: ["tipo operazione", "tipo movimento", "causale", "operazione"],
  ticker: ["ticker", "simbolo"],
  isin: ["isin"],
  protocollo: ["protocollo"],
  descrizione: ["descrizione", "descrizione titolo", "titolo"],
  quantita: ["quantita", "quantita titoli", "qta"],
  importoEuro: ["importo euro", "importo eur", "importo e", "importo"],
  divisa: ["divisa", "valuta"],
  riferimentoOrdine: ["riferimento ordine", "rif ordine", "riferimento"],
};

function mapHeaders(headers: string[]): Map<string, number> {
  const normalized = headers.map(normalizeHeader);
  const out = new Map<string, number>();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const idx = normalized.indexOf(alias);
      if (idx >= 0) {
        out.set(field, idx);
        break;
      }
    }
  }
  return out;
}

export function parseItalianNumber(raw: string): Decimal | undefined {
  const s = raw.trim().replace(/\s|€/g, "");
  if (s === "") return undefined;
  let normalized: string;
  if (s.includes(",") && s.includes(".")) {
    normalized =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    normalized = s.replace(",", ".");
  } else {
    normalized = s;
  }
  try {
    return new Decimal(normalized);
  } catch {
    return undefined;
  }
}

export function parseItalianDate(raw: string): string | undefined {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (!m) return undefined;
  let [, d, mo, y] = m as unknown as [string, string, string, string];
  if (y.length === 2) y = (Number(y) > 70 ? "19" : "20") + y;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export const directaImporter: ImporterPlugin = {
  id: "directa-csv",
  label: "Directa — movimenti (CSV)",
  sniff(file: ImportFile): boolean {
    if (!/\.(csv|txt)$/i.test(file.name) || !file.text) return false;
    const head = file.text.slice(0, 2000).toLowerCase();
    return head.includes("tipo operazione") && head.includes("importo");
  },
  parse(file: ImportFile): ImportResult {
    if (!file.text) throw new Error("file CSV senza contenuto testuale");
    const warnings: string[] = [];
    const lines = file.text.split(/\r?\n/).filter((l) => l.trim() !== "");
    // l'intestazione può non essere la prima riga (banner/intestazioni conto)
    let headerIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      if (normalizeHeader(lines[i]!).includes("tipo operazione")) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx < 0) throw new Error('intestazione non trovata (manca "Tipo operazione")');
    const sep = detectSeparator(lines[headerIdx]!);
    const headers = splitCsvLine(lines[headerIdx]!, sep);
    const col = mapHeaders(headers);
    for (const required of ["dataOperazione", "tipo", "importoEuro"]) {
      if (!col.has(required)) throw new Error(`colonna obbligatoria mancante: ${required}`);
    }

    const get = (cells: string[], field: string): string | undefined => {
      const i = col.get(field);
      const v = i !== undefined ? cells[i] : undefined;
      return v === undefined || v.trim() === "" ? undefined : v.trim();
    };

    const movimenti: RawMovimento[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cells = splitCsvLine(lines[i]!, sep);
      const tipo = get(cells, "tipo");
      if (!tipo) continue;
      const dataOp = parseItalianDate(get(cells, "dataOperazione") ?? "");
      const importo = parseItalianNumber(get(cells, "importoEuro") ?? "");
      if (!dataOp || importo === undefined) {
        warnings.push(`riga ${i + 1}: data o importo non riconosciuti, saltata`);
        continue;
      }
      const dataValuta = parseItalianDate(get(cells, "dataValuta") ?? "");
      let quantita = parseItalianNumber(get(cells, "quantita") ?? "") ?? new Decimal(0);
      // l'export riporta le vendite con quantità positiva: forma canonica = negativa
      if (tipo === "Vendita") quantita = quantita.abs().neg();
      const mov: RawMovimento = {
        broker: "Directa",
        dataOperazione: dataOp,
        dataValuta: dataValuta ?? dataOp,
        tipo,
        quantita,
        importoEuro: importo,
        divisa: get(cells, "divisa") ?? "EUR",
      };
      const ticker = get(cells, "ticker");
      if (ticker) mov.ticker = ticker;
      const isin = get(cells, "isin");
      if (isin) mov.isin = isin;
      const protocollo = get(cells, "protocollo");
      if (protocollo) mov.protocollo = protocollo;
      const descrizione = get(cells, "descrizione");
      if (descrizione) mov.descrizione = descrizione;
      const rif = get(cells, "riferimentoOrdine");
      if (rif) mov.riferimentoOrdine = rif;
      movimenti.push(mov);
    }
    return { movimenti, instruments: [], warnings };
  },
};
