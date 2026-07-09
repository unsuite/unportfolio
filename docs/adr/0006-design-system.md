# ADR-0006: Design system

- Status: accepted
- Date: 2026-07-09

La fondazione visiva condivisa di unportfolio: design token come CSS custom
properties in `packages/ui-tokens`, una vetrina Storybook in `apps/design-system`,
e l'integrazione con Tailwind 4. Questo ADR descrive decisioni che si
concretizzeranno in un passo successivo: gli strumenti sono progettati adesso, il
codice arriva quando la vetrina viene aggiunta.

## Design token

### Context

Componenti e viste hanno bisogno di valori condivisi (colori, spaziature, raggi,
tipografia) con una singola fonte di verità. Le opzioni vanno da pipeline di build
(style-dictionary) a CSS custom properties scritte a mano. unportfolio preferisce
il minor numero di build step e zero tooling da mantenere finché non serve davvero.

### Decision

I design token vivranno nel package `@unportfolio/ui-tokens` come **plain CSS
custom properties** in `tokens.css` — nessuna pipeline, nessun build step, nessun
formato intermedio.

- I componenti referenziano i token via `var(--token-name)` e **non duplicano** mai
  i valori grezzi.
- La SPA (`apps/web`), Tailwind 4 e Storybook importano
  `@unportfolio/ui-tokens/tokens.css`.
- Tailwind 4 consuma i token via `@theme` / `var(--…)`: i token restano la fonte,
  Tailwind è lo strato di utility sopra di essi.
- Un tema scuro si aggiunge come scope `[data-theme="dark"]` che rimappa solo i
  token semantici di colore, senza toccare i consumatori.

### Consequences

- \+ Zero build step e zero dipendenze per i token; cambia un valore e tutto si
  aggiorna.
- \+ I token sono nativi del browser (cascade, theming via `:root`, override per
  scope).
- − Nessuna generazione multi-piattaforma né type dei nomi dei token: se servissero,
  serve una pipeline e questo ADR va superato.

## Vetrina Storybook

### Context

I componenti condivisi e i token hanno bisogno di un posto dove svilupparli in
isolamento, documentarli e verificarne l'accessibilità. È anche la **superficie di
review** dove le decisioni di prodotto (PDR) diventano pagine leggibili
([ADR-0007](./0007-product-and-reference-spaces.md)).

### Decision

Storybook vivrà in `apps/design-system` (Storybook 10, su Vite) come app di tooling
generica.

- Le storie dei componenti sono co-locate e aggregate via glob.
- Le pagine `Product/*.mdx` importano i PDR da `docs/product/decisions/*.md` con
  `?raw` e li renderizzano con il blocco `Markdown` — "battezzare i documenti":
  nessuna duplicazione, il markdown resta la fonte di verità.
- A11y con l'addon Storybook: violazioni riportate, non bloccanti finché non si
  decide di renderle tali.

`apps/design-system` e `packages/ui-tokens` **non esistono ancora**: le skill che li
toccano (`story-check`, `product-check`, `product-decision`) gestiscono con
grazia il caso "scaffold non ancora presente", come fa l'e2e self-arming
([ADR-0004](./0004-testing.md)).

### Consequences

- \+ I componenti si sviluppano in isolamento; le decisioni di prodotto hanno una
  superficie di review per stakeholder non tecnici.
- \+ La build di Storybook gira in CI: una storia rotta o un import mancante fanno
  fallire la build.
- − Una dipendenza pesante in più (Storybook + Vite) nel monorepo, solo per
  dev/docs.
