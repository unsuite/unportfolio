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

Adottiamo **TanStack Router in modalità puramente client-side** (code-based route
tree, `apps/web/src/app/router.tsx`). Le 8 tab diventano route figlie di un root
route che rende il guscio (header + nav `<Link>` + banner + `<Outlet/>` + footer);
`/` reindirizza a `/patrimonio`.

- **Hash history** (`createHashHistory()`): le route vivono dopo il `#`
  (`/unportfolio/#/movimenti`). Così il deep-link e la ricarica sul posto funzionano
  su GitHub Pages **senza** alcun fallback lato server — l'host serve sempre lo stesso
  `index.html` sotto `/unportfolio/` ([ADR-0003](./0003-build-and-tooling.md)) e il
  routing avviene interamente nel client. Niente `basepath` sul path perché la parte
  indirizzabile sta nell'hash.
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
- \+ Il core e lo store non cambiano: il router sostituisce solo il tab switcher
  (guscio spostato in `Shell`, `App` fa solo gate onboarding → `RouterProvider`).
- \+ Con la hash history il deep-link e la ricarica funzionano su GitHub Pages senza
  alcuna configurazione server (niente trucco `404.html`).
- − URL con `#`, esteticamente meno puliti di una browser history; accettabile per una
  SPA local-first senza SSR né SEO.
- − Una dipendenza in più (TanStack Router) rispetto al tab switcher a mano.
