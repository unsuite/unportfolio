# ADR-0009: Import deduplication

- Status: accepted
- Date: 2026-07-10

## Context

L'import dei movimenti da broker (Directa oggi) deve essere **idempotente**:
re-importare un export che si sovrappone a movimenti già a ledger non deve creare
duplicati. La prima soluzione usava un solo meccanismo — un metadato `import-id`
per transazione, hash di contenuto (djb2) dei campi del movimento (broker, data,
tipo, ticker, ISIN, quantità, importo, riferimento ordine, protocollo, occorrenza).
Il dedup confrontava l'`import-id` calcolato con quelli già nel ledger.

Questo si è rotto in produzione. L'`import-id` include `broker`, la cui
rappresentazione testuale è cambiata tra le versioni (i ledger scritti prima della
1.0 avevano `broker=""`, l'importer oggi scrive `"Directa"`). Cambiato un solo
campo, **tutti** gli hash storici smettono di combaciare: il re-import mostrava
l'intero storico come "nuovo" e avrebbe duplicato ogni movimento. Un content-hash
è intrinsecamente fragile — qualsiasi variazione futura nella rappresentazione di
un campo (o nella formula stessa) rompe silenziosamente l'idempotenza per tutto il
ledger esistente, senza errori e senza test che se ne accorgano.

## Decision

Il dedup si fonda su una **chiave naturale broker-stabile**, non sul solo
`import-id`. La chiave usa solo segnali che un export broker autora e che
sopravvivono verbatim nel ledger: **data operazione, riferimento ordine/protocollo,
importo cash, tipo operazione**. È ricostruibile in modo identico sia da un
movimento appena mappato sia da una transazione già letta dal ledger, quindi la
STESSA funzione (`movementKey`) indicizza entrambi i lati — sopravvive a drift di
`broker`/ticker/formula.

```ts
// packages/core/src/import/mapping.ts
export function movementKey(t: TransactionDirective): string {
  const ref = t.meta["ordine"] ?? t.meta["protocollo"] ?? "";
  const cash = t.postings.find((p) => p.account.endsWith(":Cash"));
  const amount = cash?.amount ? cash.amount.number.toString() : "";
  const tipo = t.narration.split(" — ")[0] ?? t.narration;
  return [t.date, ref, amount, tipo].join("|");
}
```

I movimenti legittimamente identici (Directa emette a volte la stessa cedola due
volte in un giorno) sono gestiti come **multiset**: `existingMovementKeys` conta le
occorrenze per chiave, così N copie a ledger assorbono esattamente N copie in
arrivo. In `previewImport` un movimento è duplicato se il suo `import-id` esatto è
già a ledger (fast-path per il re-import della stessa versione) **oppure** se la sua
chiave naturale ha ancora un'occorrenza non consumata (robust-path); l'occorrenza
viene consumata in entrambi i casi.

`import-id` resta come metadato (riferimento leggibile e fast-path), ma non è più
l'unico segnale di dedup. L'idempotenza è protetta da test
(`packages/core/tests/directa-idempotency.test.ts`): round-trip scrittura→lettura,
scenario ledger legacy con `import-id` derivato, riproduzione del drift
`broker "" → "Directa"`, e comportamento multiset.

## Consequences

- \+ Il re-import resta idempotente attraverso i cambi di versione: i 121 movimenti
  storici (broker `""`) vengono riconosciuti anche se l'app oggi scrive `"Directa"`.
- \+ Robusto a drift futuri della formula `import-id` o della rappresentazione dei
  campi: la chiave dipende solo da dati broker-autoritativi già nel ledger.
- \+ I duplicati legittimi sono preservati correttamente (multiset), non collassati.
- − La chiave può in linea di principio collidere per due movimenti realmente
  distinti che condividano (data, riferimento, importo cash, tipo). In pratica il
  riferimento ordine/protocollo è univoco per evento presso il broker, quindi
  collisioni reali non si verificano; se un importer futuro non fornisse né ordine
  né protocollo, la chiave si indebolirebbe e andrebbe rafforzata.
- − Due segnali di dedup (id + chiave naturale) da tenere coerenti; il consumo delle
  occorrenze del multiset dev'essere fatto in entrambi i rami per non sfasare i
  conteggi.
