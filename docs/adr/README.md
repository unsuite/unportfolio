# Architecture Decision Records

Le decisioni architetturali di unportfolio sono registrate come ADR — **tematici**,
un file per area, in formato [MADR-lite](./template.md). Vedi
[ADR-0001](./0001-recording-decisions.md) per il processo (incluso come gli ADR si
relazionano alle raccomandazioni in [`../guidances/`](../guidances/README.md)).

| ADR | Titolo | Status |
|---|---|---|
| [0001](./0001-recording-decisions.md) | Recording decisions | accepted |
| [0002](./0002-architecture-and-boundaries.md) | Architecture & boundaries | accepted |
| [0003](./0003-build-and-tooling.md) | Build & tooling | accepted |
| [0004](./0004-testing.md) | Testing | accepted |
| [0005](./0005-data-model.md) | Data model | accepted |
| [0006](./0006-design-system.md) | Design system | accepted |
| [0007](./0007-product-and-reference-spaces.md) | Product-decision & reference spaces | accepted |
| [0008](./0008-routing.md) | Routing | accepted |

## Scrivere un nuovo ADR

1. Copia [`template.md`](./template.md) in `NNNN-titolo-kebab.md` (prossimo numero
   libero), oppure estendi un ADR tematico esistente con una nuova sezione `## `.
2. Tienilo breve: Context (perché serve una decisione), Decision (cosa facciamo),
   Consequences (trade-off, entrambi i segni).
3. Gli ADR sono **append-only**: non riscrivere una decisione accettata per farle
   dire qualcosa di diverso — scrivine una nuova e marca la vecchia come
   `superseded by ADR-NNNN`.
4. Aggiungi una riga alla tabella indice qui sopra.

Pattern che unportfolio **non** implementa oggi (nessun backend, database, auth
server-side) non sono decisioni: dove ha senso una raccomandazione vive in
[`../guidances/`](../guidances/README.md), non qui.
