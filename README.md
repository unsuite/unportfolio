# unportfolio

App web locale per net worth, goals e portafoglio — sostituisce il foglio
"Net Worth". SPA pura (Chrome/Edge), nessun backend: i dati vivono in una
cartella di file in chiaro che scegli tu, versionabile in git.

## Avvio

Monorepo **pnpm + Turborepo** (Node 24). Dalla root:

```sh
pnpm install
pnpm --filter @unportfolio/web dev              # app → http://localhost:5173
pnpm --filter @unportfolio/design-system dev    # Storybook → http://localhost:6006
pnpm turbo run lint typecheck test build        # tutta la pipeline
```

Al primo avvio scegli una cartella dati (o la modalità demo nel browser).
Se la cartella è vuota viene inizializzata con lo scheletro dei file.

### Struttura

```
packages/core            # @unportfolio/core — dominio puro (beancount, math, derive…)
packages/ui-tokens       # design token CSS
packages/{biome,typescript}-config, packages/test-utils   # config + enforcement
apps/web                 # @unportfolio/web — la SPA React (TanStack Router, client-only)
apps/design-system       # Storybook: Foundations (token) + Product/ (revisione PDR)
docs/adr, docs/product   # decisioni (ADR) e decisioni di prodotto (PDR)
.claude/                 # hook, agenti-persona e skill (adr/story/product-check, party…)
```

## Cartella dati

```
AGENTS.md                   # onboarding per LLM: cos'è la cartella, convenzioni, CLI
ledger/main.beancount       # opzioni + include → valido per bean-check / fava
ledger/accounts.beancount   # open + commodity (rigenerato dall'app)
ledger/movimenti.beancount  # transazioni (append per batch di import)
ledger/prices.beancount     # price directives campionate (storico prezzi)
accounts.toml               # righe del Patrimonio (sezione, owner, portfolio…)
goals.toml                  # obiettivi
snapshots.csv               # saldi manuali periodici (conti cash, debiti…)
config.toml                 # proxy CORS, priorità cascata, broker default
```

Il ledger è **beancount v2 valido**: `bean-check ledger/main.beancount`,
`fava ledger/main.beancount` e `bean-query` funzionano senza modifiche.

### Convenzioni ledger

- ETF/azioni: commodity = ticker; bond: commodity = ISIN.
- Bond in **lotti da 100 di nominale** (5.000 € nominale = 50 unità), così il
  prezzo % del nominale è letteralmente il prezzo unitario.
- Vendite con booking **FIFO** nel file; le tasse mostrate dall'app sono
  calcolate sul costo dei lotti aperti.
- Metadati strumento (classe, tassa, scadenza, cedola, sorgente prezzo) sulle
  direttive `commodity`.
- Dedupe import tramite metadato `import-id`: re-importare lo stesso file non
  duplica nulla.

## Import

Tab **Import** → seleziona l'export movimenti del broker. Formati: Directa
(`.csv`, validato su un export reale); BG Saxo quando ci sarà un export di
esempio. Gli strumenti mai visti vengono creati con euristiche (codici
`M.*` = bond MOT) e un warning indica cosa verificare. Nuovi importer si
aggiungono implementando `ImporterPlugin` (`packages/core/src/import/types.ts`) e
registrandoli in `apps/web/src/app/store/importFlow.ts`.

Prezzi da terminale (Yahoo, senza proxy) — un solo comando: risolve i simboli
dall'ISIN (cache self-healing nei metadati commodity) e aggiorna lo storico in
modo incrementale fino alla copertura impostata in `config.toml` `[prezzi]`
(`anni`, `intervallo`):

```sh
# dal repo, dentro apps/web:
pnpm --filter @unportfolio/web exec vite-node scripts/prices.ts -- /percorso/cartella-dati
pnpm --filter @unportfolio/web exec vite-node scripts/prices.ts -- ... --re-resolve   # rifai la gara simboli
pnpm --filter @unportfolio/web exec vite-node scripts/prices.ts -- ... --set X.WBIT=yahoo:WBTC.PA
```

Per chi usa l'app deployata senza il repo, un solo comando (nessun runtime
richiesto, non presuppone il binario installato): `init.sh --prezzi` scarica il
**binario self-contained** (bun `--compile`, ~60-90 MB per piattaforma:
darwin/linux × arm64/x64) in `~/.local/bin` la prima volta e poi lo riusa.

```sh
curl -fsSL https://<sito>/init.sh | sh -s -- /percorso/cartella-dati --prezzi
```

I binari si generano con `pnpm --filter @unportfolio/web build:bins` (da lanciare
prima del deploy; ~330 MB in `apps/web/public/bin`, esclusi da git). Il browser non può conoscere il
percorso assoluto della cartella dati (la File System Access API espone solo
handle opachi): al primo run il CLI lo annota in `config.toml`
(`percorso_dati`) e da lì in poi la UI mostra il comando esatto.

## Setup per nuovi utenti

```sh
curl -fsSL https://<sito>/init.sh | sh -s -- ~/Documents/unportfolio-data https://<sito>
```

Crea la cartella dati skeleton (percorso già annotato), installa il binario
prezzi e apre il sito: resta solo il click su "Scegli la cartella dati"
(richiesto dal browser, non automatizzabile).

## Prezzi

I prezzi si aggiornano solo da terminale (niente CORS, niente proxy):
ETF via Yahoo (simboli risolti dall'ISIN con Yahoo Search + OpenFIGI,
cache self-healing nei metadati commodity), bond MOT via l'endpoint
grafici di Borsa Italiana. Campionamento in `ledger/prices.beancount`
(una `price` directive per giorno e strumento) — lo storico locale,
leggibile da fava.

Le tabelle Assets mostrano sia il **MWRR** (money-weighted, XIRR sui flussi)
sia il **TWRR** (time-weighted, price-only, confini ai buy/sell) per
strumento.

## Estensioni previste (non in v1)

- Ribilanciamento: nuova vista sul selector `assets` + `targets.toml`.
- Calcolo pensione: modulo puro in `src/core/math/`.
- Booking a costo medio: strategia in `src/core/beancount/booking.ts`.
