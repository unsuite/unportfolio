# Product decisions

Il **log granulare delle decisioni di prodotto & design** — un file per scelta. È
deliberatamente ciò che gli [ADR](../adr/README.md) *non* sono: gli ADR sono una
piccola fondazione tematica *per partire allineati*, non un log per singola
decisione ([ADR-0001](../adr/0001-recording-decisions.md)). Le scelte di prodotto
sono molte e frequenti, quindi hanno il loro spazio.

| Spazio | Contiene | Natura |
|---|---|---|
| [`../adr/`](../adr/README.md) | decisioni architetturali | poche, tematiche, immutabili |
| **`decisions/`** | decisioni di prodotto/design (PDR) | molte, granulari, la fonte di verità |
| [`../../reference/`](../../reference/README.md) | input grezzo (fogli Excel, CSV, PDF, prototipi) | storia read-only, in quarantena |

## Scrivere un PDR

1. Copia [`decisions/template.md`](./decisions/template.md) in
   `decisions/NNNN-titolo-kebab.md` (prossimo numero libero). Oppure lascia che la
   skill `product-decision` lo scaffoldi.
2. Tienilo breve: Context, Decision, Rationale, Consequences. Linka il materiale in
   `reference/` da cui attinge.
3. I PDR sono **append-only**: non riscrivere una decisione accettata per farle dire
   altro; scrivine una nuova e marca la vecchia `superseded by PDR-NNNN`. (Stessa
   regola degli ADR.)

## Rivedere un PDR (con stakeholder non tecnici)

Il `.md` è la fonte di verità; **Storybook è la superficie di review**. Ogni PDR
avrà una pagina sotto `Product/` in `apps/design-system` che renderizza il markdown
(`?raw`) e affianca il prototipo e il "prima" — una schermata, senza leggere
marksdown nel repo. Vedi [ADR-0007](../adr/0007-product-and-reference-spaces.md) per
il perché di questi spazi.

> La *forma* — un log PDR renderizzato per la review — è pronta all'uso; le
> decisioni sono contenuto del progetto. `apps/design-system` arriva in un passo
> successivo ([ADR-0006](../adr/0006-design-system.md)): finché non c'è, le pagine di
> review non esistono ancora e `product-check` lo segnala senza inventare errori.
