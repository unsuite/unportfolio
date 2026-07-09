# Design approach

- Status: guidance

> **Raccomandato, non imposto.** unportfolio impone meccanicamente i *confini
> strutturali* (vedi [Architecture & boundaries](../adr/0002-architecture-and-boundaries.md):
> la purezza del core, la rete Biome + arch test). Tutto ciò che segue è vocabolario
> di design che raccomandiamo dentro quei confini — disciplina di modellazione, non
> qualcosa che un linter può verificare. Usalo dove conviene; ignoralo dove no.

## La regola sopra le altre: YAGNI / KISS

I confini sono stretti *proprio perché* lasciano semplice il codice dentro. **Non**
aggiungere astrazione per sé stessa. Non introdurre uno store manager esterno
(redux/zustand) finché lo store custom regge; non introdurre TanStack Router prima
del passo che lo prevede ([ADR-0008](../adr/0008-routing.md)). Prendi un pattern
quando il dolore è reale, non in anticipo.

## Functional core, imperative shell

È la stessa idea del confine core/app, detta in termini FP: tieni `packages/core`
un **nucleo funzionale puro** (dati in → dati out, nessun I/O, nessun DOM), e spingi
gli effetti collaterali nel **guscio** (`apps/web`: lo store orchestra, il layer
`fs/` fa I/O verso la cartella dell'utente). Se una funzione del core ha bisogno del
filesystem, della rete o dell'orologio, è un odore: passale il dato dall'esterno.

## Soldi: mai float

La matematica finanziaria (xirr, twrr, bond, pension, booking FIFO) usa
`decimal.js`, non `number`. Un arrotondamento silenzioso su un patrimonio è un bug
che non si vede finché non fa male. Gli invarianti si verificano con property test
`fast-check` ([ADR-0004](../adr/0004-testing.md)).

## Il beancount è la fonte di verità

Il ledger resta un beancount v2 valido: non inventare estensioni di sintassi dove
un sidecar TOML/CSV basta. Ciò che beancount non modella naturalmente (goal,
target, config, snapshot) vive nei sidecar, non forzato dentro le transazioni.

## Clean code — le parti noiose che ripagano

Nomi che rivelano l'intento, funzioni piccole, niente codice morto, test che si
leggono come specifiche. Niente di nuovo; è la base che i confini imposti danno per
scontata. I documenti e la UI sono in italiano; gli identificatori nel codice
restano come sono.
