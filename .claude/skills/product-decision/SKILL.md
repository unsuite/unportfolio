---
name: product-decision
description: Scaffolda una decisione di prodotto/design (PDR) e la sua pagina di review Storybook insieme — un record markdown in docs/product/decisions/ più una pagina Product/*.mdx che lo renderizza e ne incorpora il prototipo. Usala quando ti si chiede di registrare una decisione di prodotto o design, aggiungere un PDR, o preparare una decisione per la review con stakeholder. Questa SCRIVE file (a differenza dei check solo-report); conferma titolo e contenuto con l'utente prima.
---

# Scaffolda una decisione di prodotto

Crea un **PDR** e la **pagina Storybook** che lo renderizza per la review, tenendo
il markdown come fonte unica di verità (vedi
[ADR-0007](../../../docs/adr/0007-product-and-reference-spaces.md)).

## Procedura

1. **Conferma l'intento.** Ottieni titolo e sostanza (contesto, la scelta, perché).
   Se l'utente sta solo esplorando, fermati — un PDR registra una decisione *presa*.

2. **Scegli il numero.** Elenca `docs/product/decisions/NNNN-*.md`, prendi il prossimo
   `NNNN` libero (padding a 4). Mai riusare o rinumerare gli esistenti (append-only).

3. **Scrivi il PDR.** Copia `docs/product/decisions/template.md` in
   `docs/product/decisions/NNNN-titolo-kebab.md` e riempi Status/Date/Reviewers,
   Context, Decision, Rationale, Consequences. Data di oggi. Breve, in forma attiva,
   in italiano. Linka il materiale in `reference/` da cui attinge, per path relativo.

4. **Scrivi la pagina Storybook — se lo scaffold esiste.** `apps/design-system`
   **arriva in un passo successivo** ([ADR-0006](../../../docs/adr/0006-design-system.md)).
   - Se `apps/design-system/src/Product/` non esiste ancora: scrivi il solo PDR e
     **avvisa l'utente** che la pagina di review verrà creata quando la Storybook
     sarà in piedi. Non creare un'app Storybook da zero qui.
   - Se esiste: crea `apps/design-system/src/Product/<TitoloPascalOKebab>.mdx` che
     - `import pdr from '../../../../docs/product/decisions/NNNN-….md?raw'`
     - ha `<Meta title="Product/<Titolo leggibile>" />`
     - rende con `<Markdown>{pdr}</Markdown>` (non duplicare la prosa — renderizzala)
     - aggiunge l'`iframe` del prototipo (chiedi l'URL o lascia il placeholder) e,
       dove utile, screenshot da `reference/`.

5. **Aggiorna l'indice.** Aggiungi la decisione a eventuali liste in
   `docs/product/README.md` se il progetto ne tiene una. Non inventare una narrativa
   che non c'è.

6. **Report.** Di' all'utente i file creati e come rivedere: quando la Storybook
   esiste, `pnpm --filter @unportfolio/design-system dev` e apri `Product/<titolo>`.

## Guardrail

- Il markdown è la fonte di verità; l'MDX la **renderizza**. Non farli mai divergere.
- Testi in italiano; i path e i nomi di file/regole restano verbatim.
