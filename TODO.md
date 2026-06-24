# TODO

## Import movimenti

- [x] **Validare l'importer Directa su un export reale** — fatto su
      `Movimenti_G1473_12-6-2026.csv`: banner saltato, date gg-mm-aaaa,
      vendite normalizzate a quantità negativa, 117/117 movimenti quadrati.
      Test in `tests/directa-real.test.ts` (skippato se il file manca).
- [ ] **Importer BG Saxo** — rimandato finché non c'è un export di esempio.
- [~] **Enrichment ticker/descrizione dall'ISIN in import** — ACCANTONATO per
      scelta: l'etichetta visualizzata ora è il `nome` del conto patrimonio,
      curato a mano dall'utente (vedi sotto). Niente enrichment automatico
      OpenFIGI/Yahoo per ora. La logica resterebbe disponibile in
      `scripts/prices.ts` (`candidatesFromIsin`) se un domani lo si volesse.
- [x] Migrazione xlsx rimossa del tutto (codice, script, test, dipendenza
      SheetJS). Il picker sorgente-prezzo in UI è stato scartato: il CLI
      risolve da solo dall'ISIN.

## Prezzi

- [x] **CLI prezzi unificata, ISIN-first** (`scripts/prices.ts`): l'ISIN è la
      fonte di verità; il simbolo in `price-source` è solo una cache
      self-healing (se non risponde, o con `--re-resolve`, rifà la gara dei
      candidati via Yahoo Search + OpenFIGI e aggiorna la cache).
      Aggiornamento **incrementale** fino alla copertura configurata in
      `config.toml` `[prezzi]` (`anni`, `intervallo`), editabile anche da
      Impostazioni. Verificato: run idempotente (+0), alzando anni 2→3 fa
      backfill (+515 directives, bean-check ok).
- [x] X.WBIT risolto: `WBTC.PA` (Parigi, EUR, con storico).
- [x] Comando CLI copiabile nella tab Prezzi.
- [x] **CLI distribuibile**: `npm run build:cli` impacchetta lo script in
      `prices.mjs` autonomo (solo Node ≥ 18), eseguibile direttamente dal sito
      con `curl -fsSL <sito>/prices.mjs | node --input-type=module - <dir>` —
      nessun repo richiesto. Al primo run annota `percorso_dati` in
      config.toml così la UI mostra il comando esatto.
- [x] **init.sh servito dal sito**: `curl -fsSL <sito>/init.sh | sh -s -- [dir] [sito]`
      crea la cartella dati skeleton col percorso già annotato, installa il
      binario prezzi e apre il sito; resta solo il click sul picker
      (richiesto dal browser, non automatizzabile). Comando mostrato
      nell'onboarding; il picker parte da Documenti.
- [x] **Binari self-contained (bun --compile)**: `npm run build:bins` produce
      `public/bin/prices-{darwin,linux}-{arm64,x64}` (~60-90 MB l'uno, nessun
      runtime richiesto); init.sh scarica quello giusto in
      `~/.local/bin/unportfolio-prices`. Da lanciare prima del deploy.
- [x] Binario Windows (`prices-windows-x64.exe`, aggiunto a build:bins).
- [x] **Storico bond MOT risolto**: endpoint grafici di Borsa Italiana
      (`charts.borsaitaliana.it/.../GetPricesWithVolume`, lo stesso delle
      loro pagine) — OHLC giornaliero fino a 10 anni per `ISIN.MOT`,
      integrato nel CLI con downsampling all'intervallo configurato.
      Scaricati 2 anni per tutti e 7 i bond (+742 directives, bean-check ok).
- [x] Rimossa tutta la parte prezzi nel browser (proxy CORS, worker, fetch
      live, incolla manuale, PriceSource): il CLI copre tutto, ETF e bond.
- [x] **TWRR per asset** (`src/core/math/twrr.ts`): time-weighted price-only,
      confini ai buy/sell, valutazioni dallo storico campionato; mostrato in
      Assets accanto al MWRR (= XIRR, rietichettato). Cedole/commissioni
      escluse dal TWRR (price return) — il MWRR le include.
- [x] Tab **Guida** in app: MWRR vs TWRR, come confrontarli, esempi.
- [x] Fallback per bond non-MOT nel CLI: MOT → EuroTLX → gara Yahoo
      dall'ISIN.

## Modello / motore

- [x] **Account compositi (generalizzazione "Fondo pensione Fonte")**: campo
      `split` in accounts.toml (`[[account.split]] classe="Bond" peso=0.4`),
      editabile da UI (form conto in Patrimonio); l'allocazione per classe in
      Analisi distribuisce il valore secondo gli split.
- [x] **Grafo di esubero configurabile (DAG)**: chiave `[[esubero]] da/verso`
      in config.toml; topological sort, confluenze multiple; la colonna
      Esubero in Goals mostra "→ destinazione". Test in `tests/derive.test.ts`.
- [x] **Editor grafico del grafo** (`EsuberoGraph.tsx`, tab Goals): nodi SVG
      trascinabili (posizioni in `[[esubero_pos]]`), drag-to-connect dagli
      handle, click sull'arco per rimuovere, anti-ciclo con feedback,
      auto-layout a colonne + "Riordina". Il textarea in Impostazioni è stato
      rimosso.
- [x] **Il grafo è l'unica fonte di verità**: senza archi nessuna
      propagazione (ogni nodo terminale), così grafo e tabella coincidono
      sempre. `priorita` resta solo ordine di visualizzazione + seed per il
      pulsante "Catena da priorità" (materializza la cascata lineare del
      foglio come archi). Era una incoerenza: prima con grafo vuoto la tabella
      usava comunque la cascata da `priorita`.
- [x] **Tassazione capital gain per strumento da UI**: editabile nella
      sidebar dell'asset (scrive `tax-rate` nella direttiva commodity).
- [x] Ribilanciamento (foglio 6): vista `Ribilancia` su `targets.toml` —
      pesi target per strumento, calcolo ideale data la liquidità, "da
      comprare". I pesi si editano in-app.
- [x] **Calcolo pensione (foglio 3)**: modulo puro `src/core/math/pension.ts`
      (`computePension`, in termini reali, età = differenza anni solari) +
      **multi-persona** via `[[pensione]]` in config.toml (nome libero per voce;
      retro-compatibile con la vecchia tabella `[pensione]`) + tab **Pensione**
      con una card editabile per persona (aggiungi/rimuovi) e una **sintesi
      nucleo** che somma i target correnti di tutte le persone e li confronta col
      capitale destinato alla pensione: **portafogli selezionabili** (checkbox,
      salvati in `pensione_portafogli`; nessuno = patrimonio netto totale).
      Riproduce la riga del foglio al centesimo
      (perpetuità S/r e annualità che azzera il capitale, scontate ad oggi).
      Test in `tests/pension.test.ts` e `tests/config.test.ts`.
- [x] **ISIN come fonte di verità del commodity (non il ticker)**:
      `commodityFor` (`mapping.ts`) ora restituisce sempre l'ISIN per ogni
      strumento; il ticker è solo metadato di display (`ticker` nella direttiva
      commodity), quindi rinominabile editando una sola riga in
      `accounts.beancount` senza toccare movimenti/prezzi. Nomi conto passati a
      `Assets:Broker:<broker>:<ISIN>` e `Income:CapitalGains/Coupons/Dividends:<ISIN>`.
      Migrazione one-shot dei ledger esistenti eseguita sui dati reali (11
      strumenti, booking pulito); lo script di migrazione è stato rimosso dopo
      l'uso. Sblocca l'enrichment in import. Display UI lasciato a ISIN grezzo
      per ora (ticker-come-label = passo separato).

## UI / UX

- [x] **`accounts.toml` rinominato in `patrimonio.toml`**: tolta la collisione
      di nome con `ledger/accounts.beancount` (che resta il piano dei conti +
      direttive commodity). Cutover pulito, riferimenti aggiornati ovunque.
- [x] **Conti asset auto-creati (riconciliazione)**: ogni strumento del ledger
      senza riga in `patrimonio.toml` ottiene un conto di default (owner vuoto =
      da assegnare). Funzione pura `missingAssetAccounts`
      (`src/core/config/reconcile.ts`, test in `tests/reconcile.test.ts`);
      `reconcileAssetAccounts` in `store.ts` chiamata sia all'import sia al load
      directory (idempotente). Garantisce 1:1 commodity↔conto.
- [x] **Etichetta strumenti = `nome` del conto** (non più ISIN/ticker): in
      Patrimonio, Confronto, Ribilancia e Prezzi l'etichetta principale è il
      `nome` del conto, modificabile dal web (matita "Modifica conto" →
      `ContoForm`). I 18 nomi sono stati impostati ai ticker puliti (VWCE…) /
      etichette brevi per i bond (es. "BTP Valore GN27"). `AssetRow.ticker`
      esiste come metadato ma non guida più il display.

- [x] **CRUD da interfaccia senza editare i TOML**: goals (form in Goals),
      account patrimonio (form in Patrimonio, con split compositi), metadati
      strumento + rename + tassa (sidebar Assets).
- [x] **Assegnazione asset → goal in Patrimonio** (non più nella sidebar
      Assets, che ora è in sola lettura e rimanda a Patrimonio): gli asset si
      gestiscono come gli altri account (sezione/owner/portfolio/split) col
      form riga. Gli asset importati senza riga in accounts.toml compaiono in
      una sezione "Asset da assegnare" con tasto "Aggiungi" che apre il form
      precompilato — entrano così nel net worth e nei totali per portfolio.
- [x] **Setup/impostazioni goal da interfaccia** (form CRUD in Goals).
- [x] **Inserimento rapido valori conti non tracciati**: "Nuovo snapshot" ora
      precompila con l'ultimo valore noto di ogni conto — correggi solo ciò
      che è cambiato.
- [x] **Grafici e analisi (tab Analisi)**: andamento valore (net worth globale
      o per portfolio) con area chart, allocazione per classe a barre (con
      gli split compositi), tabella MWRR/TWRR aggregati per portfolio e per
      "tutto l'investito", con colonna timing (M−T). Manca: drill-down per
      owner, grafico prezzi per strumento.
- [x] **Manifest PWA** (`public/manifest.webmanifest` + `icon.svg` + service
      worker minimale `public/sw.js`, registrato in `main.tsx`): rende l'app
      installabile, così Chrome conserva i permessi sulla cartella dati (File
      System Access API) tra i riavvii. Il SW è no-op sul fetch (nessuna cache:
      i bundle Vite hanno hash nel nome).
- [x] **Grafico esplorabile col mouse** (`LineChart` in `charts.tsx`): hover →
      crosshair tratteggiato + dot sul punto + tooltip (data/valore) snappato al
      punto campionato più vicino, posizionato in percentuale (scala col
      `w-full`) e con flip lato a metà larghezza per non uscire dai bordi. Le
      etichette primo/ultimo/min/max agli angoli restano.
## Tooling

- [x] **Biome** (`biome.json`): formatter + linter (preset recommended,
      rilassato dove combatteva lo stile deliberato — `noNonNullAssertion` off,
      a11y off su app mono-utente, `useExhaustiveDependencies` a warning). La
      **regola di confine** `src/core` ↛ `src/app` è un override su `src/core/**`
      con `noRestrictedImports` (pattern `**/app`, `**/app/**`). Script:
      `lint`, `lint:fix`, `format`, `typecheck`, `ci`.
- [x] **CI minima** (`.github/workflows/ci.yml`): `biome ci` + `tsc -b` +
      `vitest run` + `vite build` su push/PR. Pronta per quando il repo avrà
      git/remote (oggi la cartella non è ancora un repo git).
