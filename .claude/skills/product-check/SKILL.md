---
name: product-check
description: Verifica che le decisioni di prodotto (PDR in docs/product/decisions/) e le loro pagine di review Storybook Product/*.mdx restino allineate, e riporta deriva più decisioni prive di superficie di review. Solo report — non modifica mai file. Usala quando ti si chiede di verificare la copertura delle decisioni di prodotto o trovare deriva, E automaticamente come parte di ogni code review e PR review (vedi CLAUDE.md).
---

# Allineamento delle decisioni di prodotto

Produci un **report** su quanto il log PDR e la sua superficie di review Storybook
concordano (vedi [ADR-0007](../../../docs/adr/0007-product-and-reference-spaces.md)).
**Non** scaffoldare pagine né modificare file — solo divergenze e azioni
raccomandate. È il gemello lato-prodotto di `adr-check` e `story-check`.

## Gestisci prima il caso "scaffold non presente"

`apps/design-system` (dove vivono le pagine `Product/*.mdx`) **arriva in un passo
successivo** ([ADR-0006](../../../docs/adr/0006-design-system.md)). Se non esiste
ancora:

- Dillo in cima al report.
- Enumera comunque i PDR in `docs/product/decisions/` e nota che, per ognuno
  `accepted`, la pagina di review **non esiste ancora** perché la Storybook non
  c'è — è lavoro futuro, non un errore. Non inventare "pagine mancanti" come
  violazioni.

Se la Storybook esiste, procedi.

## Procedura (con Storybook presente)

1. **Enumera i PDR.** Elenca `docs/product/decisions/NNNN-*.md` (ignora
   `template.md`). Nota numero, titolo, `Status`.

2. **Mappa pagine → PDR.** Per ogni `apps/design-system/src/Product/*.mdx` leggi il
   percorso dell'import `?raw`. Segnala:
   - **Pagina mancante** — un PDR `accepted` senza una `Product/*.mdx` che lo importa.
   - **Import rotto** — una pagina che importa un `docs/product/decisions/*.md`
     inesistente.
   - **Pagina orfana** — una pagina il cui PDR importato non esiste più.
   - **Prosa duplicata** — una pagina che incolla il testo invece di renderizzarlo
     con `<Markdown>{pdr}</Markdown>` (il markdown deve restare la fonte unica).

3. **Controlla i link a reference.** Per ogni PDR e pagina, risolvi ogni percorso
   `reference/…` e asset di prototipo referenziato. Segnala link a materiale
   `reference/` inesistente e `<iframe>` ancora sul placeholder su una decisione
   `accepted`.

4. **Controlla immutabilità & status.** Segnala `superseded by PDR-NNNN` che punta a
   un PDR mancante, e (dove la git history è disponibile) un `## Decision` riscritto
   nel significato invece che superato.

## Note

- Solo report. Raccomanda `product-decision` per ciò che va scritto.
- `reference/` è input in quarantena: controlla che sia *linkato* correttamente, mai
  che linti o buildi (è escluso dal toolchain per costruzione).
