// Aggiornamento prezzi unificato, basato sull'ISIN come fonte di verità.
//
// Per ogni strumento (non bond) del registro:
//   1. usa il simbolo in cache (`price-source`) se funziona ancora;
//   2. altrimenti — o con --re-resolve — rifà la gara dei candidati
//      (Yahoo Search + OpenFIGI a partire dall'ISIN, sonda valuta/storico)
//      e aggiorna la cache in accounts.beancount;
//   3. scarica lo storico in modo INCREMENTALE fino alla copertura
//      configurata in config.toml ([prezzi] anni / intervallo) e appende
//      le price directives mancanti (dedupe per giorno).
//
// Uso:
//   npx vite-node scripts/prices.ts -- <cartella-dati> [--re-resolve]
//   npx vite-node scripts/prices.ts -- <cartella-dati> --set X.WBIT=yahoo:WBTC.PA
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Decimal } from "decimal.js";
import type { PriceDirective } from "../src/core/beancount/ast";
import { parse } from "../src/core/beancount/parser";
import { formatDirective, serialize } from "../src/core/beancount/serializer";
import { parseConfig } from "../src/core/config/codecs";
import { readCommodityInfo } from "../src/core/derive/assets";
import { buildPriceTable, hasSample } from "../src/core/derive/prices";

const UA = { "User-Agent": "Mozilla/5.0 (unportfolio prices)" };

const args = process.argv.slice(2).filter((a) => a !== "--");
const dataDir = args.find((a) => !a.startsWith("--"));
const reResolve = args.includes("--re-resolve");
const sets = args
  .map((a, i) => (a === "--set" ? args[i + 1] : undefined))
  .filter((s): s is string => !!s);
if (!dataDir) {
  console.error(
    "uso: vite-node scripts/prices.ts -- <cartella-dati> [--re-resolve] [--set COMMODITY=yahoo:SYMBOL]",
  );
  process.exit(1);
}

const accountsPath = join(dataDir, "ledger", "accounts.beancount");
const pricesPath = join(dataDir, "ledger", "prices.beancount");
const configPath = join(dataDir, "config.toml");
const config = parseConfig(readFileSync(configPath, "utf8"));

// L'app nel browser non può conoscere il percorso assoluto della cartella
// (la File System Access API non lo espone): lo annotiamo noi nel config,
// così la UI mostra il comando esatto da copiare. Edit mirato, non
// riserializziamo il file per non toccare il resto.
function recordDataPath(): void {
  const absPath = resolve(dataDir!);
  if (config.percorsoDati === absPath) return;
  let text = readFileSync(configPath, "utf8");
  const line = `percorso_dati = ${JSON.stringify(absPath)}`;
  if (/^percorso_dati\s*=.*$/m.test(text)) text = text.replace(/^percorso_dati\s*=.*$/m, line);
  else text = line + "\n" + text; // in testa: mai dentro una tabella [..]
  writeFileSync(configPath, text);
  console.log(`annotato percorso cartella in config.toml: ${absPath}`);
}
recordDataPath();

const EXCHANGE_PREFERENCE = [".MI", ".DE", ".PA", ".AS", ".L", ".SW", ".SG"];
const FIGI_TO_YAHOO: Record<string, string> = {
  IM: ".MI",
  GR: ".DE",
  GY: ".DE",
  FP: ".PA",
  NA: ".AS",
  LN: ".L",
  SW: ".SW",
  SE: ".SW",
  GS: ".SG",
};

interface Series {
  points: { date: string; close: number }[];
  currency: string;
  symbol: string;
}

/** Serie storica nel periodo richiesto; undefined se il simbolo non risponde. */
async function fetchSeries(
  symbol: string,
  fromEpoch: number,
  toEpoch: number,
): Promise<Series | undefined> {
  try {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?period1=${fromEpoch}&period2=${toEpoch}&interval=${config.storicoIntervallo}`;
    const res = await fetch(url, { headers: UA });
    if (!res.ok) return undefined;
    const d = (await res.json()) as {
      chart?: {
        result?: {
          timestamp?: number[];
          indicators?: { quote?: { close?: (number | null)[] }[] };
          meta?: { currency?: string; regularMarketPrice?: number };
        }[];
      };
    };
    const r = d.chart?.result?.[0];
    if (!r?.meta) return undefined;
    const closes = r.indicators?.quote?.[0]?.close ?? [];
    const points: Series["points"] = [];
    for (let i = 0; i < (r.timestamp?.length ?? 0); i++) {
      const close = closes[i];
      if (close === null || close === undefined) continue;
      points.push({
        date: new Date(r.timestamp![i]! * 1000).toISOString().slice(0, 10),
        close,
      });
    }
    // anche senza serie, un live price valido conferma che il simbolo esiste
    if (points.length === 0 && !r.meta.regularMarketPrice) return undefined;
    return { points, currency: r.meta.currency ?? "EUR", symbol };
  } catch {
    return undefined;
  }
}

/** Bond MOT: endpoint grafici di Borsa Italiana (lo stesso usato dalle loro pagine). */
async function fetchBondSeries(isinMot: string): Promise<Series | undefined> {
  const timeframe =
    config.storicoAnni <= 1
      ? "1y"
      : config.storicoAnni <= 2
        ? "2y"
        : config.storicoAnni <= 5
          ? "5y"
          : "10y";
  try {
    const res = await fetch(
      "https://charts.borsaitaliana.it/charts/services/ChartWService.asmx/GetPricesWithVolume",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...UA },
        body: JSON.stringify({
          request: {
            SampleTime: "1d",
            TimeFrame: timeframe,
            RequestedDataSetType: "ohlc",
            ChartPriceType: "price",
            Key: isinMot,
            OffSet: 0,
            FromDate: null,
            ToDate: null,
            UseDelay: false,
            KeyType: "Topic",
            KeyType2: "Topic",
            Language: "it-IT",
          },
        }),
      },
    );
    if (!res.ok) return undefined;
    const d = (await res.json()) as { d?: [number, number, ...number[]][] };
    if (!d.d || d.d.length === 0) return undefined;
    // [timestamp_ms, close, open, high, low, ...]; downsample all'intervallo configurato
    const bucketOf = (ts: number): string => {
      const date = new Date(ts);
      if (config.storicoIntervallo === "1d") return String(ts);
      if (config.storicoIntervallo === "1mo")
        return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
      return String(Math.floor(ts / (7 * 86400_000))); // 1wk
    };
    const lastPerBucket = new Map<string, { date: string; close: number }>();
    for (const row of d.d) {
      lastPerBucket.set(bucketOf(row[0]), {
        date: new Date(row[0]).toISOString().slice(0, 10),
        close: row[1],
      });
    }
    return {
      points: [...lastPerBucket.values()],
      currency: "EUR",
      symbol: isinMot,
    };
  } catch {
    return undefined;
  }
}

async function candidatesFromIsin(isin: string): Promise<string[]> {
  const out = new Set<string>();
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${isin}&quotesCount=8&newsCount=0`,
      { headers: UA },
    );
    const d = (await res.json()) as { quotes?: { symbol?: string }[] };
    for (const q of d.quotes ?? []) if (q.symbol) out.add(q.symbol);
  } catch {
    /* fonte non disponibile */
  }
  try {
    const res = await fetch("https://api.openfigi.com/v3/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...UA },
      body: JSON.stringify([{ idType: "ID_ISIN", idValue: isin }]),
    });
    const d = (await res.json()) as { data?: { ticker?: string; exchCode?: string }[] }[];
    for (const m of d[0]?.data ?? []) {
      const suffix = m.exchCode ? FIGI_TO_YAHOO[m.exchCode] : undefined;
      if (m.ticker && suffix) out.add(`${m.ticker}${suffix}`);
    }
  } catch {
    /* fonte non disponibile */
  }
  out.add(`${isin}.SG`); // i listini tedeschi quotano spesso per ISIN
  return [...out];
}

function rank(s: Series): number {
  let score = 0;
  if (s.currency === "EUR") score += 100;
  if (s.points.length > 5) score += 50;
  const pref = EXCHANGE_PREFERENCE.findIndex((x) => s.symbol.endsWith(x));
  score += pref >= 0 ? 20 - pref : 0;
  return score;
}

const main = async () => {
  const accountsText = readFileSync(accountsPath, "utf8");
  const ledger = parse(accountsText);
  const commodities = readCommodityInfo(ledger.directives);
  const pricesText = readFileSync(pricesPath, "utf8");
  const existing = buildPriceTable(parse(pricesText).directives);

  const now = Math.floor(Date.now() / 1000);
  const from = now - config.storicoAnni * 365 * 86400;
  console.log(
    `copertura target: ${config.storicoAnni} anni, intervallo ${config.storicoIntervallo}`,
  );

  const manualBindings = new Map<string, string>();
  for (const s of sets) {
    const [commodity, binding] = s.split("=") as [string, string?];
    if (commodity && binding) manualBindings.set(commodity, binding);
  }

  const newDirectives: PriceDirective[] = [];
  const rebindings = new Map<string, string>();

  for (const [commodity, info] of commodities) {
    if (!info.isin) {
      console.log(`~ ${commodity}: nessun ISIN nei metadati, salto`);
      continue;
    }

    if (info.assetClass === "BOND") {
      // catena: MOT → EuroTLX (stesso endpoint Borsa Italiana) → gara Yahoo
      let series =
        (await fetchBondSeries(`${info.isin}.MOT`)) ?? (await fetchBondSeries(`${info.isin}.ETLX`));
      if (!series) {
        const probed = (
          await Promise.all(
            (await candidatesFromIsin(info.isin)).map((sym) => fetchSeries(sym, from, now)),
          )
        ).filter((s): s is Series => !!s && s.currency === "EUR");
        probed.sort((a, b) => rank(b) - rank(a));
        series = probed[0];
      }
      if (!series) {
        console.log(`✗ ${commodity} (${info.isin}): nessuna fonte (MOT, EuroTLX, Yahoo)`);
        continue;
      }
      let added = 0;
      for (const p of series.points) {
        if (hasSample(existing, commodity, p.date)) continue;
        newDirectives.push({
          kind: "price",
          date: p.date,
          currency: commodity,
          amount: { number: new Decimal(p.close).toDecimalPlaces(4), currency: "EUR" },
          meta: {},
        });
        added++;
      }
      console.log(
        `✓ ${commodity} via ${series.symbol}: +${added} nuovi (${series.points.length} nel periodo)`,
      );
      continue;
    }

    const manual = manualBindings.get(commodity);
    const cached = manual ?? info.priceSource;
    const cachedSymbol = cached?.startsWith("yahoo:") ? cached.slice("yahoo:".length) : undefined;

    let series: Series | undefined;
    // 1. simbolo in cache, se ancora valido
    if (cachedSymbol && !reResolve) series = await fetchSeries(cachedSymbol, from, now);

    // 2. cache assente/rotta o --re-resolve: gara dei candidati dall'ISIN
    if (!series || reResolve) {
      const probed = (
        await Promise.all(
          (await candidatesFromIsin(info.isin)).map((sym) => fetchSeries(sym, from, now)),
        )
      ).filter((s): s is Series => !!s && s.currency === "EUR");
      probed.sort((a, b) => rank(b) - rank(a));
      const best = probed[0];
      if (best && (!series || best.symbol !== cachedSymbol)) {
        series = best;
        rebindings.set(commodity, `yahoo:${best.symbol}`);
      }
    }
    if (manual) rebindings.set(commodity, manual);

    if (!series) {
      console.log(`✗ ${commodity} (${info.isin}): nessuna fonte EUR funzionante`);
      continue;
    }

    let added = 0;
    for (const p of series.points) {
      if (hasSample(existing, commodity, p.date)) continue;
      newDirectives.push({
        kind: "price",
        date: p.date,
        currency: commodity,
        amount: {
          number: new Decimal(p.close).toDecimalPlaces(4),
          currency: series.currency,
        },
        meta: {},
      });
      added++;
    }
    const flag = rebindings.has(commodity) ? ` → ${rebindings.get(commodity)}` : "";
    console.log(
      `✓ ${commodity} via ${series.symbol}${flag}: +${added} nuovi (${series.points.length} nel periodo)`,
    );
  }

  if (rebindings.size > 0) {
    for (const d of ledger.directives) {
      if (d.kind === "commodity" && rebindings.has(d.currency)) {
        d.meta["price-source"] = rebindings.get(d.currency)!;
        delete d.src;
      }
    }
    writeFileSync(accountsPath, serialize(ledger));
    console.log(`aggiornati ${rebindings.size} price-source in accounts.beancount`);
  }

  if (newDirectives.length === 0) {
    console.log("storico già completo: nessun nuovo prezzo");
    return;
  }
  newDirectives.sort((a, b) =>
    a.date === b.date ? a.currency.localeCompare(b.currency) : a.date.localeCompare(b.date),
  );
  const out =
    pricesText +
    (pricesText.endsWith("\n") ? "" : "\n") +
    `\n; aggiornamento incrementale (${config.storicoAnni}y/${config.storicoIntervallo})\n` +
    newDirectives.map(formatDirective).join("");
  writeFileSync(pricesPath, out);
  console.log(`aggiunte ${newDirectives.length} price directives`);
};

void main();
