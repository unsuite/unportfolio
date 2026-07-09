# Guidances

Raccomandazioni per unportfolio — tutte `status: guidance`, nessuna meccanicamente
imposta. Due tipi, ognuno apre con un banner che dice quale:

- **Non implementato** — cose che il progetto oggi deliberatamente non ha (nessun
  backend, nessuna sincronizzazione cloud, nessun account). Adottale quando
  servono davvero, e registra la scelta come [ADR](../adr/README.md).
- **Raccomandato, non imposto** — pratiche che il progetto non può meccanizzare (il
  vocabolario di design, la disciplina sui dati personali), da applicare dentro i
  confini che invece sono imposti.

| Guidance | Tipo | Copre |
|---|---|---|
| [Design approach](./design-approach.md) | raccomandato | KISS/YAGNI, functional core, dominio puro — quando conviene |
| [Data safety](./data-safety.md) | raccomandato | Non committare ledger/dati personali; gitignore di `*.xlsx`/`*.csv`/`*.pdf` |

Vedi [ADR-0001](../adr/0001-recording-decisions.md) per come le guidance si
relazionano agli ADR.
