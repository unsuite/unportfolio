import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { TransactionDirective } from "../src/core/beancount/ast";
import { parse } from "../src/core/beancount/parser";
import { formatDirective } from "../src/core/beancount/serializer";
import { directaImporter } from "../src/core/import/directa";
import {
  existingImportIds,
  existingMovementKeys,
  mapMovimenti,
  movementKey,
  provisionalInstrument,
} from "../src/core/import/mapping";
import type { InstrumentInfo, RawMovimento } from "../src/core/model/movimento";

const FIXTURE = readFileSync(new URL("./fixtures/directa-dummy.csv", import.meta.url), "utf8");

/** Build the provisional-instrument lookup previewImport uses. */
function instrumentsFor(movimenti: RawMovimento[]): (k: string) => InstrumentInfo | undefined {
  const byKey = new Map<string, InstrumentInfo>();
  for (const m of movimenti) {
    if (!m.ticker || !m.isin || byKey.has(m.ticker) || byKey.has(m.isin)) continue;
    const info = provisionalInstrument(m);
    if (!info) continue;
    byKey.set(m.ticker, info);
    byKey.set(m.isin, info);
  }
  return (k) => byKey.get(k);
}

/** Map a CSV the way previewImport does (provisional instruments included). */
function mapCsv(text: string): TransactionDirective[] {
  const { movimenti } = directaImporter.parse({ name: "x.csv", text });
  return mapMovimenti(movimenti, { instrument: instrumentsFor(movimenti) }).transactions;
}

/** The dedupe decision used by previewImport, kept pure for testing. */
function newAgainst(
  ledger: TransactionDirective[],
  incoming: TransactionDirective[],
): TransactionDirective[] {
  const existingIds = existingImportIds(ledger);
  const remaining = existingMovementKeys(ledger);
  return incoming.filter((t) => {
    const key = movementKey(t);
    const avail = remaining.get(key) ?? 0;
    const dup = existingIds.has(t.meta["import-id"]!) || avail > 0;
    if (dup) {
      if (avail > 0) remaining.set(key, avail - 1);
      return false;
    }
    return true;
  });
}

/** Simulate persistence: serialize to a ledger file and parse it back. */
function roundTrip(txns: TransactionDirective[]): TransactionDirective[] {
  const text = txns.map((d) => formatDirective(d)).join("\n");
  return parse(text).directives.filter(
    (d): d is TransactionDirective => d.kind === "transaction",
  );
}

describe("Directa re-import idempotency", () => {
  it("re-importing the same file after write→parse adds nothing", () => {
    const first = mapCsv(FIXTURE);
    expect(first.length).toBeGreaterThan(0);
    const ledger = roundTrip(first);
    expect(newAgainst(ledger, mapCsv(FIXTURE))).toHaveLength(0);
  });

  it("dedupes even when the stored import-id has drifted (legacy ledger)", () => {
    // A ledger written by an older version whose import-id formula differs
    // (here: every stored id garbled). The natural key must still match.
    const ledger = roundTrip(mapCsv(FIXTURE)).map((t) => ({
      ...t,
      meta: { ...t.meta, "import-id": `legacy-${t.meta["import-id"]}` },
    }));
    // sanity: the fast path alone would now see everything as new
    const idsOnly = existingImportIds(ledger);
    const incoming = mapCsv(FIXTURE);
    expect(incoming.every((t) => !idsOnly.has(t.meta["import-id"]!))).toBe(true);
    // but the robust natural-key path deduplicates all of them
    expect(newAgainst(ledger, incoming)).toHaveLength(0);
  });

  it("reproduces the broker \"\" → \"Directa\" drift that broke dedup", () => {
    // Rebuild a movement the way the pre-1.0 importer did (broker empty) and
    // confirm its import-id differs from today's while its natural key matches.
    const [m] = directaImporter.parse({ name: "x.csv", text: FIXTURE }).movimenti;
    const raw: RawMovimento = m!;
    const today = mapMovimenti([raw], { instrument: () => undefined }).transactions;
    const legacy = mapMovimenti([{ ...raw, broker: "" }], {
      instrument: () => undefined,
    }).transactions;
    // the conferimento maps without an instrument, so both produce one txn
    expect(today).toHaveLength(1);
    expect(legacy).toHaveLength(1);
    expect(today[0]!.meta["import-id"]).not.toBe(legacy[0]!.meta["import-id"]);
    expect(movementKey(today[0]!)).toBe(movementKey(legacy[0]!));
  });

  it("is a multiset: a ledger copy absorbs one incoming, an extra copy is new", () => {
    const { movimenti } = directaImporter.parse({ name: "x.csv", text: FIXTURE });
    const instrument = instrumentsFor(movimenti);
    // one mapMovimenti call over the doubled list, so in-batch repeats get their
    // occurrence bumped exactly like a real import of a file with duplicate rows
    const single = mapMovimenti(movimenti, { instrument }).transactions;
    const doubled = mapMovimenti([...movimenti, ...movimenti], { instrument }).transactions;
    const ledger = roundTrip(single);
    // ledger holds one copy of each movement; the doubled import must leave
    // exactly one fresh copy per movement (the second occurrence)
    expect(newAgainst(ledger, doubled)).toHaveLength(single.length);
  });
});
