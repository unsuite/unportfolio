# ADR-0003: Build & tooling

- Status: accepted
- Date: 2026-07-09

Le fondamenta di build e tooling di unportfolio: lo stack di base (runtime,
monorepo, framework, styling, strumenti) e la CLI dei prezzi compilata per
piattaforma con bun.

## Stack di base

### Context

unportfolio è una SPA client-only, local-first, con UI in italiano, sviluppata in
buona parte con assistenza AI. Servono default opinionati che favoriscano gli
standard del web, la testabilità e "uno strumento per problema".

### Decision

| Concern | Scelta |
|---|---|
| Runtime | Node.js 24 (`.nvmrc` = 24) |
| Monorepo | pnpm workspaces + Turborepo; niente build step per i package interni |
| Bundler | Vite 6 |
| UI | React 18 |
| Styling | Tailwind 4 (`@tailwindcss/vite`) |
| Numeri | `decimal.js` per la matematica finanziaria (niente float sui soldi) |
| Config utente | TOML via `smol-toml`, CSV parse a mano, ledger beancount v2 |
| Lint/format | Biome (strumento unico, virgolette doppie) |
| Test | Vitest + fast-check ([ADR-0004](./0004-testing.md)) |
| Git hooks | Lefthook + commitlint (conventional commits) |
| Deploy | sito statico su GitHub Pages, basepath `/unportfolio/` ([ADR-0008](./0008-routing.md)) |

Task orchestrati da Turbo:

```sh
pnpm turbo run lint typecheck test build   # = pnpm ci
```

Il grafo Turbo (`turbo.json`): `build` dipende da `^build`, `lint`, `typecheck`;
`typecheck` dipende da `^build`. `test` gira sui sorgenti TypeScript (feedback
rapido), non dipende da `build`.

### Consequences

- \+ Partenza snella; nessun database, container o server da orchestrare in locale.
- \+ Superficie web-standard (File System Access, OPFS, service worker PWA).
- − Tutto gira nel browser dell'utente: niente da nascondere lato server, ma anche
  nessun posto dove mettere segreti o chiamate cross-origin (vedi CLI prezzi).

## CLI dei prezzi compilata per piattaforma (bun)

### Context

I prezzi degli strumenti finanziari si recuperano da fonti esterne che non
espongono CORS: una SPA nel browser non può interrogarle direttamente. Serve un
punto di esecuzione fuori dal browser, ma senza introdurre un backend.

### Decision

`apps/web/scripts/prices.ts` è uno script eseguito **dal terminale dell'utente**,
compilato in binari standalone con bun, uno per piattaforma:

```sh
# apps/web build:bins
for t in darwin-arm64 darwin-x64 linux-x64 linux-arm64 windows-x64; do
  bun build scripts/prices.ts --compile --target=bun-$t \
    --outfile=public/bin/prices-$t
done
```

I binari finiscono in `apps/web/public/bin/` (git-ignorato, vedi `.gitignore`) e
sono serviti come asset scaricabili. Lo script riusa `@unportfolio/core` per
scrivere i prezzi nel ledger dell'utente, mantenendo un solo dominio condiviso tra
SPA e CLI.

### Consequences

- \+ Nessun backend, nessun proxy CORS: il fetch dei prezzi vive dove l'utente ha
  già i suoi dati.
- \+ Un solo dominio (`@unportfolio/core`) alimenta browser e CLI.
- − Servono cinque binari per coprire le piattaforme, ricompilati a ogni release;
  `bun` è una dipendenza di build in più (dichiarata in `onlyBuiltDependencies`).
