# AGENTS.md — contratto per gli agenti di sviluppo

Questo file è il **contratto per gli agenti che lavorano sul codice** di unportfolio.
Le istruzioni operative complete stanno in [`CLAUDE.md`](./CLAUDE.md); le decisioni
architetturali in [`docs/adr/`](./docs/adr/README.md). Leggili prima di modificare
ciò che coprono.

## Attenzione: esistono DUE `AGENTS.md`

1. **Questo** (`AGENTS.md` di root) = il contratto di sviluppo. Riguarda come si
   scrive il codice del progetto.
2. Un **altro `AGENTS.md` generato dentro la cartella dati dell'utente** — il
   template `AGENTS_MD` in `apps/web/src/app/fs/fileSystem.ts` (triplicato in
   `apps/web/public/init.sh` e `public/init.ps1`, guardato da
   `apps/web/tests/agents-md.test.ts`). È documentazione scritta nei *dati*
   dell'utente, non un contratto di sviluppo. **Non toccarlo** quando lavori su
   questo contratto di root.

## L'essenziale

- **SPA client-only, local-first.** Niente backend, server, database, SSR,
  migrazioni. Dati = file di testo (ledger beancount v2 + sidecar TOML/CSV) via File
  System Access API / OPFS. Prezzi dalla CLI bun `apps/web/scripts/prices.ts`.
  (ADR-0003, ADR-0005)
- **`@unportfolio/core` è puro.** Niente `apps/web`, `react`, DOM, I/O. Imposto da
  Biome + `packages/core/tests/arch.spec.ts`. (ADR-0002)
- **Le viste/route consumano il core, non lo mutano**; leggono dallo store custom e
  da router-context. Routing client-only con TanStack Router, basepath
  `/unportfolio/`, nessun server loader. (ADR-0002, ADR-0008)
- **Soldi con `decimal.js`**, invarianti con property test `fast-check`. (ADR-0004)
- **Conventional commits, messaggi puliti**: niente `Co-Authored-By:` né "Generated
  with …". UI e docs in italiano; identificatori nel codice come sono.

## Comandi

```sh
pnpm turbo run lint typecheck test build   # = pnpm ci
```

## Review

Ogni review esegue `adr-check`, `story-check`, `product-check` (solo-report) prima
del passaggio riga per riga — vedi la sezione *Reviews* in [`CLAUDE.md`](./CLAUDE.md).
