# ADR-0001: Recording decisions

- Status: accepted
- Date: 2026-07-09

## Context

Le decisioni architetturali hanno bisogno di una casa che viaggi con il repo. Un
unico grande documento di architettura è difficile da consumare in modo
incrementale (sia per persone sia per agenti AI) e tende a essere riscritto sul
posto, perdendo la storia delle decisioni. Serve invece un formato leggero e
append-only. Allo stesso tempo unportfolio vuole un insieme *piccolo e coerente* di
decisioni di partenza — non una lista lunga di record granulari da ricostruire in
testa.

## Decision

Registriamo le decisioni architetturali come **ADR numerati** in `docs/adr/`,
formato MADR-lite (Status / Date / Context / Decision / Consequences), numerati in
sequenza (`0001`, `0002`, …). Un ADR può essere **tematico**: decisioni collegate
sono raggruppate in un file sotto sezioni `## ` (es. `0002-architecture-and-boundaries.md`
copre la purezza del core, i confini di import, la doppia rete Biome + arch test).
Cita una decisione specifica con file più ancora di heading, es.
`docs/adr/0002-architecture-and-boundaries.md#purezza-del-core`.

**Immutabilità.** Un ADR accettato è immutabile nel significato: cambiare una
decisione significa scriverne una nuova che supera la vecchia
(`superseded by ADR-NNNN`). Gli ADR sono append-only.

**Guidances vs ADR.** Pratiche che il progetto raccomanda ma non meccanizza (il
vocabolario di design, la sicurezza dei dati personali) sono raccomandazioni, non
decisioni ratificate: vivono in `docs/guidances/` (ognuna con un banner che dice di
che tipo è), separate da `docs/adr/`. Promuovi una guidance ad ADR quando la adotti
come regola vincolante.

**PDR vs ADR.** Le decisioni di prodotto/design sono molte e frequenti: hanno il
loro spazio granulare in `docs/product/` (vedi
[ADR-0007](./0007-product-and-reference-spaces.md)), non qui.

## Consequences

- \+ Il progetto parte da un piccolo insieme di ADR tematici leggibili in una sola
  sessione (o caricabili in un contesto AI), più guidance chiaramente etichettate
  da adottare su richiesta.
- \+ `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` e i commenti nel codice puntano a
  sezioni ADR specifiche invece che a un monolite.
- \+ Le guidance non si spacciano per decisioni ratificate: nessuno scambia un
  suggerimento per qualcosa che il progetto già garantisce.
- − Registrare una decisione è disciplina manuale; niente la forza. La review deve
  chiedersi "questo cambiamento richiede un ADR — o una guidance?".
