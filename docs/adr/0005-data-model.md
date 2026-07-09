# ADR-0005: Data model

- Status: accepted
- Date: 2026-07-09

Dove vivono i dati di unportfolio e come vi si accede. **Non c'è database.** I dati
sono file di testo semplice in una cartella scelta dall'utente, letti e scritti dal
browser via File System Access API. Questo ADR sostituisce l'idea di
"data & migrations" di un backend: qui non c'è schema server, non c'è migrazione,
non c'è Postgres.

## Ledger beancount + sidecar TOML/CSV

### Context

unportfolio nasce per sostituire un foglio di calcolo di patrimonio/investimenti.
L'utente deve **possedere** i propri dati in un formato leggibile, diffabile,
versionabile con git se vuole — non prigioniero di un database applicativo. Deve
poterli aprire con un editor di testo e capirli.

### Decision

I dati stanno in una cartella di file di testo semplice:

```
<cartella scelta dall'utente>/
  ledger/*.beancount      # ledger beancount v2 valido — la fonte di verità contabile
  accounts.toml           # metadati dei conti
  goals.toml              # obiettivi
  config.toml             # configurazione dell'app
  targets.toml            # allocazioni target per il ribilanciamento
  snapshots.csv           # snapshot storici del patrimonio
  AGENTS.md               # documentazione scritta NELLA cartella dati (vedi nota sotto)
```

- Il **ledger beancount** è la fonte di verità contabile: `packages/core/beancount`
  ne contiene ast/parser/serializer/booking (FIFO). Deve restare un ledger
  beancount v2 valido, apribile con gli strumenti beancount standard.
- I **sidecar** (TOML via `smol-toml`, CSV a mano) portano ciò che beancount non
  modella naturalmente: goal, target, config, snapshot. I loro codec vivono in
  `packages/core/config` e `packages/core/model`.

> Nota — c'è un file `AGENTS.md` scritto DENTRO la cartella dati dell'utente
> (template `AGENTS_MD` in `apps/web/src/app/fs/fileSystem.ts`, triplicato in
> `public/init.sh` e `public/init.ps1`, guardato da `apps/web/tests/agents-md.test.ts`).
> È tutt'altra cosa dal `AGENTS.md` di root del repo (il contratto per gli agenti
> di sviluppo). Non confonderli.

### Consequences

- \+ L'utente possiede i dati in chiaro: leggibili, diffabili, versionabili, mai
  bloccati in un DB proprietario.
- \+ Il core resta puro: prende testo, restituisce dati derivati.
- − Nessun vincolo di integrità referenziale imposto da un DB: la coerenza è
  responsabilità del parser/booking e degli invarianti testati
  ([ADR-0004](./0004-testing.md)).

## Accesso local-first: File System Access + OPFS/demo

### Context

Una SPA client-only deve leggere e scrivere la cartella dell'utente senza upload a
un server. Al tempo stesso serve un modo di provare l'app senza concedere subito
l'accesso a una cartella reale.

### Decision

L'accesso ai file vive interamente in `apps/web/src/app/fs/` — l'unico punto che
tocca l'I/O ([ADR-0002](./0002-architecture-and-boundaries.md)):

- **Modalità cartella reale:** File System Access API. L'utente sceglie una
  cartella, l'app ottiene handle persistenti e legge/scrive lì.
- **Modalità OPFS/demo:** Origin Private File System per provare l'app senza toccare
  una cartella reale. Stessa interfaccia, storage effimero/privato.

Nessun dato lascia mai il dispositivo: non c'è un endpoint dove inviarlo.

### Consequences

- \+ Local-first vero: i dati non transitano da alcun server.
- \+ La modalità demo consente di provare l'app a costo zero di fiducia.
- − Dipendenza dal supporto browser alla File System Access API; il fallback OPFS
  copre la prova ma non la persistenza su cartella reale.

## Invariante dei "file gestiti" (auto-riallineo)

### Context

L'app scrive un sottoinsieme dei file della cartella (i "file gestiti" / *managed
files*: i sidecar e le porzioni di ledger che genera). Se questi divergono dallo
stato interno, l'utente vede dati incoerenti tra editor e app.

### Decision

I file gestiti sono **auto-riallineati**: quando l'app rileva che un file gestito
sul disco è disallineato rispetto a ciò che dovrebbe scrivere, lo riscrive per
riportarlo in forma canonica, e avvisa l'utente del riallineo (comportamento già
presente nello store). L'utente resta libero di modificare a mano ciò che non è
gestito; ciò che è gestito ha una forma canonica che l'app mantiene.

### Consequences

- \+ Editor di testo e app convergono sempre sulla stessa forma canonica.
- \+ Nessuna migrazione: la forma canonica è definita dai codec, e riscriverla è
  idempotente.
- − L'utente deve capire quali file sono gestiti (documentato nell'`AGENTS.md` della
  cartella dati) per non stupirsi di un riallineo.
