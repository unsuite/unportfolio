# Contribuire a unportfolio

unportfolio è una **SPA client-only, local-first** (monorepo pnpm + Turborepo) per
il patrimonio personale. Niente backend, database o server: i dati sono file di
testo nella cartella dell'utente (vedi [ADR-0005](./docs/adr/0005-data-model.md)).

## Per iniziare

```bash
pnpm install
pnpm dev            # avvia apps/web in watch mode via Turbo
```

## Comandi

```bash
pnpm turbo run lint typecheck test build   # oppure: pnpm ci
pnpm test                                  # tutti i test (Vitest) via Turbo
pnpm lint:fix                              # Biome --write
```

Node 24 (`.nvmrc`). Package manager: **pnpm**. Task: **turbo**.

## Struttura

| Package | Nome | Cos'è |
|---|---|---|
| `packages/core` | `@unportfolio/core` | dominio **puro**: beancount, config, derive, import, math, model |
| `apps/web` | `@unportfolio/web` | la SPA React 18 + Vite 6 + Tailwind 4 (viste, store, fs, pwa) |
| `packages/biome-config` | `@unportfolio/biome-config` | config Biome + 2 plugin GritQL (e2e self-arming) |
| `packages/typescript-config` | `@unportfolio/typescript-config` | tsconfig condivisi |
| `packages/test-utils` | `@unportfolio/test-utils` | helper degli arch test (`assertLayerBoundaries`) |

In arrivo (passi successivi): `apps/design-system` (Storybook 10) e
`packages/ui-tokens` (design token) — vedi [ADR-0006](./docs/adr/0006-design-system.md).

## Branch naming

```
{type}/{issue-id}/{short-slug}
```

| Segmento | Valori | Esempio |
|---|---|---|
| `type` | `feat`, `fix`, `chore`, `refactor`, `docs`, `test` | `feat` |
| `issue-id` | numero issue del tracker, oppure `no-issue` | `42` |
| `short-slug` | 2-4 parole kebab-case | `tanstack-router` |

Esempi: `feat/42/tanstack-router`, `fix/57/xirr-arrotondamento`,
`chore/no-issue/bump-deps`.

## Commit

Conventional commits, imposti da **commitlint + Lefthook**. Commit piccoli e
descrittivi.

```
feat: aggiungi la vista Ribilanciamento
fix: gestisci il ledger vuoto nel parser
chore: aggiorna vite a 6.1
```

**Messaggi puliti: NIENTE trailer `Co-Authored-By:` né righe "Generated with …".**

## Naming di file & codice

| Contesto | Convenzione | Esempio |
|---|---|---|
| File | `camelCase` / `kebab-case` come nel package | `fileSystem.ts`, `goalStatus.ts` |
| Componenti React | `PascalCase` | `PatrimonioView.tsx` |
| Funzioni / variabili | `camelCase` | `derivePatrimonio` |
| Tipi / interfacce | `PascalCase` | `ImporterPlugin` |
| Costanti | `SCREAMING_SNAKE_CASE` | `AGENTS_MD` |

UI e documentazione in **italiano**; gli identificatori nel codice restano come sono.

## Il confine core/app

- `@unportfolio/core` è **puro**: non importa `@unportfolio/web`, nulla sotto
  `**/app/**`, `react`/`react-dom`, né tocca il DOM o fa I/O.
- Tutto l'I/O verso la cartella dell'utente vive in `apps/web/src/app/fs/`.
- Le viste/route **consumano** il core (funzioni pure) e leggono lo stato dallo
  **store custom** — non mutano le strutture del core.

Le violazioni sono catturate due volte: **Biome `noRestrictedImports`** (override su
`packages/core/**`, pre-commit + CI) e l'**arch test**
`packages/core/tests/arch.spec.ts` (`@unportfolio/test-utils`). Vedi
[ADR-0002](./docs/adr/0002-architecture-and-boundaries.md).

## Soldi e correttezza

- La matematica finanziaria usa **`decimal.js`**, mai `number`.
- Il **ledger resta un beancount v2 valido**; ciò che beancount non modella va nei
  sidecar TOML/CSV.

## Testing

Strategia in [ADR-0004](./docs/adr/0004-testing.md). Le regole operative:

- **Bug → prima il test rosso.** Prima di correggere un bug, scrivi un test che
  fallisce *per la ragione giusta* (riproduce il difetto), poi fallo passare.
- **Scegli il livello per ciò che stai provando:**
  - `*.test.ts` — **unit**: logica pura del dominio, helper. Co-locati in
    `packages/core/tests/` e `apps/web/tests/`.
  - **property test** con `fast-check` — per gli invarianti finanziari (xirr, twrr,
    booking FIFO, reconcile): proprietà, non solo esempi.
  - **arch test** — `packages/core/tests/arch.spec.ts` tiene il core puro.
  - **e2e** — igiene self-arming sui glob `**/*.e2e.ts`; nessun e2e presente ancora.
- Il dominio è puro: i suoi test non hanno bisogno di mock.

## Sicurezza dei dati

Il repo è pubblico e la tua cartella di lavoro può contenere dati finanziari reali.
`*.xlsx`, `*.csv`, `*.pdf` sono **git-ignorati** per policy (eccezione: fixture in
`**/tests/fixtures/*.csv`). Non forzarne mai l'aggiunta. Vedi
[la guidance data-safety](./docs/guidances/data-safety.md).

## Letture ulteriori

Decisioni architetturali: [`docs/adr/`](./docs/adr/README.md). Raccomandazioni non
imposte: [`docs/guidances/`](./docs/guidances/README.md). Decisioni di prodotto:
[`docs/product/`](./docs/product/README.md). Un cambiamento architetturale
significativo atterra con un ADR nuovo o aggiornato ([ADR-0001](./docs/adr/0001-recording-decisions.md)).
