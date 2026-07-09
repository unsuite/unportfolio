# ADR-0007: Product-decision and reference spaces

- Status: accepted
- Date: 2026-07-09

## Context

unportfolio prende molte decisioni di **prodotto & design** (come modellare un
goal, quale flusso di import, come presentare il ribilanciamento) e parte da
**materiale pregresso**: fogli di calcolo Excel del patrimonio, export CSV dei
movimenti, report PDF. Due esigenze che gli ADR non coprono bene:

1. Gli ADR sono deliberatamente una *piccola fondazione tematica*, non un log per
   singola decisione ([ADR-0001](./0001-recording-decisions.md)). Le scelte di
   prodotto sono numerose e frequenti; forzarle negli ADR gonfierebbe il record
   architetturale o le lascerebbe non registrate.
2. Il materiale di riferimento è eterogeneo (fogli Excel, CSV, PDF, screenshot),
   potenzialmente grande e sensibile, e non deve mai entrare in build/lint/test —
   ma dovrebbe restare esplorabile dallo stesso clone.

Le decisioni di prodotto devono anche essere **rivedibili da persone non tecniche**,
che non leggono markdown in un repo.

## Decision

Tre spazi:

- **`docs/product/`** — il **log granulare delle decisioni di prodotto** (PDR), un
  file markdown per decisione, append-only (stessa immutabilità degli ADR). È la
  *fonte di verità* per le scelte di prodotto/design, complementare a `docs/adr/`.
- **`reference/`** — una **quarantena** top-level per l'input grezzo. Il materiale
  è tenuto fuori dal toolchain: non è un package del workspace (Turbo/pnpm lo
  ignorano) ed è escluso da Biome, così `pnpm lint`/`format` non lo toccano.
  Attenzione: i dati personali (`.xlsx`, `.csv`, `.pdf`) sono git-ignorati per
  policy (vedi [la guidance data-safety](../guidances/data-safety.md)) — in
  `reference/` va solo materiale non sensibile o fittizio, altrimenti si linka
  dove vive.
- **Una sezione `Product/` nella Storybook** di `apps/design-system` — la
  **superficie di review**. Una pagina MDX per PDR importa il markdown `?raw` e lo
  renderizza con il blocco `Markdown` (nessuna duplicazione), affiancando il
  prototipo e il "prima" pescato da `reference/`. Gli stakeholder rivedono lì.

Questi spazi arrivano come **forma**: i README, il template PDR, l'esclusione da
Biome, e le skill `product-decision` / `product-check`. Le decisioni, il materiale
di riferimento e le pagine di review sono contenuto del progetto da riempire.
`apps/design-system` non esiste ancora: le skill gestiscono con grazia il caso in
cui la Storybook non c'è ([ADR-0006](./0006-design-system.md)).

## Consequences

- \+ Le decisioni di prodotto hanno una casa adatta alla loro cadenza senza diluire
  gli ADR architetturali.
- \+ L'intera evoluzione — foglio Excel → prototipo → decisione — è esplorabile da
  un clone e rivedibile da persone non tecniche su una schermata Storybook.
- \+ Il materiale di riferimento non può rompere la CI: è fuori da ogni strumento
  per costruzione.
- − Un'altra convenzione da imparare (ADR vs PDR vs reference); i README e
  `product-check` ne portano il peso.
