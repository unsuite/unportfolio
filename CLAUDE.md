# CLAUDE.md — unportfolio

## Cos'è unportfolio

Una **SPA client-only, local-first** (UI in italiano) per il patrimonio personale e
il portafoglio di investimenti — sostituisce un foglio di calcolo. **Niente backend,
niente server, niente database, niente SSR, niente migrazioni.** I dati sono file di
testo semplice in una cartella scelta dall'utente (un ledger **beancount** v2
`ledger/*.beancount` + sidecar TOML/CSV: `accounts.toml`, `goals.toml`,
`config.toml`, `targets.toml`, `snapshots.csv`), letti dal browser via **File System
Access API** (più una modalità OPFS/demo). I prezzi si recuperano solo dal terminale
(CLI `apps/web/scripts/prices.ts` compilata con bun) per aggirare la mancanza di
CORS.

Le decisioni architetturali sono ADR numerati in `docs/adr/` (tematici — un file per
area); le raccomandazioni non imposte vivono in `docs/guidances/`. Leggi l'ADR
rilevante prima di cambiare ciò che copre. Vedi [ADR-0001](docs/adr/0001-recording-decisions.md).

**Registra le decisioni condivise nel repo.** Ogni decisione di
progetto/architettura deve vivere in forma condivisa nel repo — un ADR in
`docs/adr/` (o un doc `docs/guidances/` per una raccomandazione), un PDR in
`docs/product/`, o un commento nel file interessato — mai solo in una nota privata o
locale all'agente.

## I DUE `AGENTS.md` — non confonderli

1. Il **`AGENTS.md` di root** (in questo repo) è il **contratto per gli agenti di
   sviluppo**: come si lavora sul codice. È quello che affianca questo CLAUDE.md.
2. C'è un **altro `AGENTS.md` generato dentro la cartella dati dell'utente**:
   il template `AGENTS_MD` in `apps/web/src/app/fs/fileSystem.ts` (triplicato in
   `apps/web/public/init.sh` e `public/init.ps1`, guardato da
   `apps/web/tests/agents-md.test.ts`). È **documentazione scritta nei dati
   dell'utente**, non un contratto di sviluppo. **Non toccare** quel file né le sue
   copie quando lavori sul contratto di root.

## Convenzioni

Fonte di verità: `CONTRIBUTING.md`.

### Branch naming

```
{type}/{issue-id}/{short-slug}
```

Esempi: `feat/42/tanstack-router`, `chore/no-issue/fix-typo`.

### Commit

Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.

**Messaggi di commit puliti: NIENTE trailer `Co-Authored-By:` né righe "Generated
with …".**

### Comandi

```sh
pnpm turbo run lint typecheck test build   # = pnpm ci
```

## Regole di architettura

- `@unportfolio/core` (`packages/core`) è **puro**: niente import da
  `@unportfolio/web`, da `**/app/**`, da `react`/`react-dom`, niente DOM. Imposto due
  volte: override Biome `noRestrictedImports` su `packages/core/**` + arch test
  `packages/core/tests/arch.spec.ts` (`assertLayerBoundaries`). Tienili in sync
  (ADR-0002).
- Il core **non fa I/O**: prende dati, restituisce dati derivati. Tutto l'I/O verso
  la cartella dell'utente vive in `apps/web/src/app/fs/` (ADR-0005).
- Lo **strato viste/route consuma il core, non lo muta**: le viste leggono dallo
  **store custom** (`apps/web/src/app/store/`) e da router-context, chiamano funzioni
  pure del core, e non modificano strutture del core in place (ADR-0002, ADR-0008).
- **Routing client-only** con TanStack Router, basepath `/unportfolio/`, **nessun
  server loader** — i dati vengono dallo store (ADR-0008).
- **Soldi con `decimal.js`, mai float.** Gli invarianti finanziari (xirr, twrr,
  booking FIFO) si verificano con property test `fast-check` (ADR-0004).
- Il **ledger resta un beancount v2 valido**; ciò che beancount non modella va nei
  sidecar TOML/CSV, non forzato nelle transazioni (ADR-0005).
- I **file gestiti** ("file gestiti") sono auto-riallineati alla loro forma canonica;
  avvisa l'utente al riallineo (ADR-0005).
- `.test.ts` = unit test (co-locati). Arch test in `packages/core/tests/arch.spec.ts`.
  Igiene e2e self-arming sui glob `**/*.e2e.ts` (ADR-0004).

## Reviews

Ogni code review e PR review DEVE anche eseguire le skill `adr-check`,
`story-check`, `product-check` e `design-check` e integrarne i findings. Tutte
solo-report (non modificano file). Eseguile in testa, prima del passaggio riga per
riga:

- `adr-check` — codice vs `docs/adr/` (e `docs/guidances/`): violazioni + decisioni
  che richiedono un nuovo/aggiornato ADR.
- `story-check` — viste/componenti di `apps/web` vs le storie Storybook di
  `apps/design-system` (gestisce il caso "Storybook non ancora presente").
- `product-check` — PDR in `docs/product/decisions/` vs le pagine Storybook
  `Product/*.mdx` (idem).
- `design-check` — disciplina di design/UX: token vs valori grezzi, tema light+dark,
  contrasto AA, focus/tastiera, motion, tooltip (scope: `packages/ui` e `ui-tokens`).

Per *registrare* una decisione di prodotto/design (e la sua pagina di review), usa la
skill `product-decision` — scrive il PDR + l'MDX che lo renderizza. Per *esplorare*
2–3 direzioni visive come prototipi Storybook prima di scegliere, usa `design-explore`.

**Consegna il feedback sulla PR.** Quando la review ha una PR GitHub, posta i
findings come **commenti inline sulla PR** ancorati alle righe rilevanti, non solo
come riassunto in chat. Preferisci `/code-review --comment`. Senza PR (diff locale),
un report in chat va bene.

## Percorsi chiave

- ADR: `docs/adr/` (indice in `docs/adr/README.md`) · Guidances: `docs/guidances/`
- Decisioni di prodotto: `docs/product/` (log PDR) · review in Storybook `Product/`
  (in arrivo) · input grezzo in `reference/` (quarantena) — vedi ADR-0007
- Contributing: `CONTRIBUTING.md`
- Confine del core: override Biome in `biome.json` + `packages/core/tests/arch.spec.ts`
  (`@unportfolio/test-utils`)
- Skill di review: `.claude/skills/adr-check/`, `story-check/`, `product-check/` ·
  Scaffolding: `.claude/skills/product-decision/`
