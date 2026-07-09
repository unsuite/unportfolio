# Data safety

- Status: guidance

> **Raccomandato, non imposto.** unportfolio è local-first: i dati dell'utente non
> lasciano mai il dispositivo ([ADR-0005](../adr/0005-data-model.md)). Questa
> guidance riguarda l'altra metà del problema — non far finire per sbaglio *dati
> personali* nel repo pubblico. Il `.gitignore` è una rete, non una garanzia: la
> disciplina la mette chi committa.

## Il rischio

Il repo di sviluppo è pubblico. La cartella di lavoro di uno sviluppatore che usa
davvero l'app contiene il **suo** patrimonio: ledger beancount reali, export dei
movimenti bancari, report fiscali. Un `git add .` distratto li pubblicherebbe per
sempre nella storia git.

## La rete: gitignore dei formati sensibili

Il root `.gitignore` esclude per policy i formati in cui arrivano i dati personali:

```gitignore
# dati personali / finanziari — mai nel repo pubblico
*.xlsx
*.csv
*.pdf
# eccezione: fixture di test con dati fittizi
!**/tests/fixtures/*.csv
```

Regole pratiche:

- **Non forzare mai** l'aggiunta di un `.xlsx`/`.csv`/`.pdf` reale con `git add -f`.
  Se ti serve un caso di test, costruisci una **fixture fittizia** sotto
  `**/tests/fixtures/` (l'unica eccezione whitelisted) con dati inventati.
- **Il ledger beancount non è git-ignorato per estensione**: un `*.beancount` reale
  può scivolare dentro. Tieni la tua cartella dati *fuori* dal clone del repo — la
  File System Access API ti lascia scegliere qualsiasi cartella, non serve che stia
  nel progetto.
- Il materiale in [`reference/`](../../reference/README.md) è committato di
  proposito: mettici solo roba **non sensibile o fittizia**. Se un foglio Excel
  reale serve come riferimento, tienilo fuori e linka dove vive, non copiarlo nel
  repo ([ADR-0007](../adr/0007-product-and-reference-spaces.md)).

## Se è già successo

Un file sensibile finito in un commit non si toglie con un semplice `git rm`: resta
nella storia. Va riscritta la storia (`git filter-repo` o simili) e ruotato tutto
ciò che il file esponeva. Meglio non arrivarci: controlla `git status` prima di ogni
commit che tocchi dati.
