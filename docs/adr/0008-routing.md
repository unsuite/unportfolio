# ADR-0008: Routing

- Status: accepted
- Date: 2026-07-09

## Context

Oggi la navigazione tra le 8 sezioni dell'app (Patrimonio, Goals, Pensione,
Ribilanciamento, Movimenti, Prezzi, Impostazioni, Guida) è un **tab switcher
hand-rolled**: uno stato nello store decide quale vista montare. Man mano che le
sezioni crescono servono URL indirizzabili (deep link, back/forward del browser,
ricarica sulla sezione corrente), ma unportfolio resta una **SPA client-only,
local-first**: non c'è alcun server che possa fare da loader, e il deploy è un sito
statico su GitHub Pages sotto il path `/unportfolio/`.

## Decision

Adottiamo **TanStack Router in modalità puramente client-side**. Nel prossimo passo
le 8 tab diventano route:

- Router con `basepath: "/unportfolio/"`, coerente con il deploy statico su GitHub
  Pages ([ADR-0003](./0003-build-and-tooling.md)).
- **Nessun server loader.** I dati non arrivano da un `loader` server-side: arrivano
  dallo **store custom** e da router-context, alimentati dal File System Access
  layer ([ADR-0005](./0005-data-model.md)). Le route sono thin: leggono dallo store,
  chiamano funzioni pure di `@unportfolio/core`, renderizzano
  ([ADR-0002](./0002-architecture-and-boundaries.md) — lo strato viste consuma il
  core, non lo muta).
- Le route **non** toccano il filesystem né importano il core se non funzioni pure;
  l'I/O passa dallo store, come già oggi.

## Consequences

- \+ URL indirizzabili: deep link a una sezione, back/forward, ricarica sul posto.
- \+ Type-safety delle route di TanStack Router senza introdurre un server.
- \+ Il core e lo store non cambiano: il router sostituisce solo il tab switcher.
- − Il routing client-only su GitHub Pages richiede il fallback SPA (404 → index)
  perché il deep-link a `/unportfolio/movimenti` non ha una pagina statica dedicata.
- − Una dipendenza in più (TanStack Router) rispetto al tab switcher a mano.
