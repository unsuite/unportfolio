# ADR-0004: Testing

- Status: accepted
- Date: 2026-07-09

Come unportfolio testa il proprio codice: la strategia unit / property / arch, e
come l'infrastruttura e2e si arma da sola quando servirà.

## Strategia di test

### Context

I test devono essere abbastanza veloci da girare a ogni PR e abbastanza affidabili
da fidarsene. Il cuore del valore è nel dominio puro (`packages/core`): matematica
finanziaria, booking FIFO, parsing del ledger. Errori lì sono silenziosi e costosi.

### Decision

| Livello | Strumento | Convenzione |
|---|---|---|
| Unit | Vitest | `.test.ts`, co-locati (`packages/core/tests/`, `apps/web/tests/`) |
| Property-based | Vitest + fast-check | invarianti del dominio (xirr, twrr, booking, reconcile) |
| Architecture | Vitest + `@unportfolio/test-utils` | `packages/core/tests/arch.spec.ts` — confine del core ([ADR-0002](./0002-architecture-and-boundaries.md)) |
| E2E | (self-arming) | glob `**/*.e2e.ts`, nessun test presente ancora |

Regole:

- Il dominio è puro, quindi i suoi test non hanno bisogno di mock: dati in →
  asserzioni sui dati out. Per gli invarianti (una xirr che deve stare in un
  intervallo, un booking FIFO che deve conservare le quantità) si usano **property
  test** con `fast-check` invece di soli esempi.
- L'**arch test** (`packages/core/tests/arch.spec.ts`) è la rete CI gemella della
  regola Biome `noRestrictedImports`: verifica che il core non importi
  `@unportfolio/web`, React o DOM, catturando anche gli `import()` dinamici.
- Test critici documentati come guardie: `apps/web/tests/agents-md.test.ts` tiene
  allineate le tre copie del template `AGENTS_MD` scritto nella cartella dati
  dell'utente (vedi la nota nei file `CLAUDE.md` / `AGENTS.md` di root).
- `test` non dipende da `build` nel grafo Turbo: Vitest gira sui sorgenti
  TypeScript per feedback rapido sulle PR.

### Consequences

- \+ Property test e arch test coprono le due classi di bug più insidiose: la
  matematica sbagliata e la deriva dei confini.
- \+ Nessun database né container: la suite gira ovunque, offline.
- − Gli invarianti property-based richiedono di pensare in termini di proprietà,
  non di esempi; è disciplina in più rispetto a un semplice `expect`.

## E2E self-arming

### Context

Non ci sono ancora test e2e. Aggiungere infrastruttura di enforcement adesso, ma
inerte finché non serve, evita che il primo e2e nasca senza igiene (timeout
impliciti, accesso agli interni di React).

### Decision

`packages/biome-config` spedisce due plugin GritQL — `no-react-internals.grit` e
`no-implicit-e2e-sync.grit` — armati nel root `biome.json` sui glob `**/*.e2e.ts` e
`**/e2e/**/*.ts`. Oggi non c'è nessun file `*.e2e.ts`, quindi i plugin scansionano
il vuoto e si armano da soli appena il primo e2e compare: niente `waitForTimeout()`
impliciti, niente reach dentro `__reactProps$`/`__reactFiber$`.

### Consequences

- \+ Il primo e2e eredita l'igiene senza che nessuno debba ricordarsene.
- \+ Zero attrito oggi: la regola scansiona zero file.
- − Se un giorno si sceglie una convenzione di naming diversa dai glob, i plugin
  vanno riarmati (un solo posto, il root `biome.json`).
