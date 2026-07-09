# ADR-0002: Architecture & boundaries

- Status: accepted
- Date: 2026-07-09

unportfolio è una **SPA client-only, local-first** (nessun backend, nessun server,
nessun database). L'architettura ruota attorno a una separazione netta: un
**dominio puro** in `packages/core` al centro, e la **app React** in `apps/web` al
bordo, dove vivono DOM, store, File System Access e viste. Questo ADR registra come
i due layer sono tenuti separati in modo meccanico, e come lo strato di
routing/viste consuma il core senza mutarlo.

## Purezza del core

### Context

La logica di dominio — parsing/serializzazione del ledger beancount, booking FIFO,
codec di configurazione, `derive/*`, importer plugin, matematica finanziaria
(xirr/twrr/bond/pension) — deve restare testabile in isolamento, indipendente da
React e dal DOM. Con molto codice scritto da agenti AI la struttura deve essere
esplicita e meccanica, non conoscenza tribale.

### Decision

Due package, un confine:

```
packages/core   → @unportfolio/core — dominio PURO
  beancount/     ast, parser, serializer, booking (FIFO)
  config/        codecs, format, reconcile
  derive/        patrimonio, assets, returns, rebalance, goalStatus, timeline, …
  import/        ImporterPlugin (directa, mapping, types)
  math/          xirr, twrr, bond, pension, returns
  model/         config, movimento
apps/web        → @unportfolio/web — la SPA React 18 + Vite 6 + Tailwind 4
  app/views/     le 8 viste (Patrimonio, Goals, Pensione, …)
  app/store/     store custom (niente redux/zustand)
  app/fs/        File System Access API + OPFS/demo
  app/pwa/       install prompt
```

Regola di dipendenza:

| Layer | Può importare | Non deve importare |
|---|---|---|
| `packages/core` | solo librerie pure (decimal.js, smol-toml, …) | `@unportfolio/web`, qualsiasi `**/app/**`, `react`, `react-dom`, DOM |
| `apps/web` | `@unportfolio/core`, React, DOM, tutto | — (è il bordo, può wire-are tutto) |

Il core **non ha stato**: prende dati (testo del ledger, sidecar TOML/CSV) e
restituisce dati derivati. Nessun I/O, nessun accesso al filesystem, nessun
`window`/`document`. L'I/O verso la cartella dell'utente vive interamente in
`apps/web/src/app/fs/` ([ADR-0005](./0005-data-model.md)).

### Consequences

- \+ Il dominio è unit-testabile con `vitest` senza mock del DOM; le proprietà si
  verificano con `fast-check` ([ADR-0004](./0004-testing.md)).
- \+ Il confine è portabile: lo stesso `@unportfolio/core` alimenta sia la SPA sia
  lo script CLI dei prezzi (`apps/web/scripts/prices.ts`) compilato con bun.
- − Alcuni dati vanno passati esplicitamente al core invece di essere letti dove
  servono; è il costo accettato della purezza.

## Rete doppia sui confini di import

### Context

Il confine del core vale niente se vive solo nella documentazione. Deve fallire in
fretta (pre-commit) e in modo affidabile (CI), senza aggiungere un nuovo strumento
allo stack.

### Decision

Due reti indipendenti, che esprimono la stessa regola:

**1. Biome, a lint-time (pre-commit + CI).** Il root `biome.json` porta un
`overrides` con chiave `packages/core/**` e una regola `noRestrictedImports` che
banna `@unportfolio/web`, `@unportfolio/web/**`, `**/app` e `**/app/**` con un
messaggio che rimanda a questo ADR. Nuove infrastrutture UI che non devono
raggiungere il core si aggiungono a quel gruppo man mano che compaiono.

**2. Arch test, a CI-time.** `packages/core/tests/arch.spec.ts` afferma lo stesso
confine scansionando i sorgenti con `assertLayerBoundaries` da
`@unportfolio/test-utils` (auto-scopre i file del layer, ed essendo costruito su
`getImports` cattura anche gli `import()` dinamici che il linter si perde):

```ts
await assertLayerBoundaries({
  pattern: resolve(__dirname, "../src/**/*.ts"),
  layer: "core",
  forbidden: [/^@unportfolio\/web/, /\/app(\/|$)/, /^react/, /^react-dom/],
});
```

### Consequences

- \+ Le violazioni emergono nell'editor e al pre-commit (Biome), e non possono
  passare la CI anche se un hook viene saltato (arch test).
- \+ La regola è scritta due volte (Biome + test): la ridondanza è la feature.
- − L'override Biome va esteso a mano quando compare un nuovo modulo di UI che il
  core non deve toccare.

## Lo strato viste/routing consuma il core, non lo muta

### Context

Le viste e (dal prossimo passo) le route TanStack Router
([ADR-0008](./0008-routing.md)) hanno bisogno dei dati derivati. Il rischio è che
la logica di dominio coli dentro i componenti React o che una vista muti strutture
del core.

### Decision

Le viste leggono dallo **store custom** (`apps/web/src/app/store/`) e da
**router-context** (client-only, nessun server loader). Chiamano funzioni pure di
`@unportfolio/core` per derivare (patrimonio, returns, rebalance, …) e non
modificano mai le strutture del core in place: il core restituisce nuovi valori,
lo store è l'unico proprietario dello stato dell'app. Le route non importano nulla
dal filesystem o dal core che non sia una funzione pura; l'I/O passa dallo store.

### Consequences

- \+ Cambiare una vista non può rompere un invariante di dominio: il dominio non
  sa che le viste esistono.
- \+ Il passaggio da tab hand-rolled a TanStack Router non tocca il core.
- − Lo store deve orchestrare esplicitamente lettura → derive → render; è il punto
  unico dove il wiring è esplicito.
