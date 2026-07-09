---
name: design-explore
description: Scaffolda 2–3 direzioni di design come pagine-prototipo in Storybook (palette + tipografia + elemento firma) da confrontare a schermo prima di scegliere. Poi la direzione scelta si formalizza con la skill product-decision. Questa SCRIVE file (prototipi throwaway) — conferma brief e numero di direzioni con l'utente prima.
---

# Esplora direzioni di design

Crea 2–3 **pagine-prototipo** in Storybook, una per direzione visiva, così da
confrontare palette, tipografia e l'elemento firma **a schermo** invece che a
parole (vedi ADR-0006/0007 e la skill `frontend-design`). Sono prototipi
**usa-e-getta** per decidere: non sono componenti di catalogo né token definitivi.

> I prototipi possono usare valori grezzi inline: qui si sta *scegliendo* la palette
> e la tipografia, quindi la disciplina "solo `var(--token)`" (ADR-0006) non si
> applica finché la direzione non viene formalizzata. Vivono sotto `Explorations/`,
> separati da `Components/` e `Product/`.

## Prima di scrivere — conferma

1. **Soggetto e job** della pagina (se non è chiaro, fissalo: es. "strumento privato
   per il patrimonio; protagonista = il numero e il suo trend").
2. **Quante direzioni** (2 o 3) e, se l'utente le ha in mente, gli spunti di partenza
   (una per riga: palette dominante, faccia display, elemento firma). Se non li ha,
   proponi tu 3 direzioni **distinte** — evita i tre default AI (cream+serif,
   near-black+acid, broadsheet) a meno che il brief non li chieda.
3. Ricorda il vincolo **local-first/offline**: niente font remoti nei prototipi
   destinati a diventare reali (usa system stack o annota "font X da bundlare woff2").

## Procedura

Per ogni direzione `<slug>` crea
`apps/design-system/src/Explorations/<slug>.stories.tsx` con
`title: "Explorations/<Nome direzione>"` e `tags: ["autodocs"]`, una storia
`Overview` che mostra, in una sola vista:

- **Palette**: swatch dei 4–6 colori nominati (con hex ed etichette di ruolo:
  bg/surface/text/muted×N/accent/positive/negative), in light **e** dark affiancati.
- **Tipografia**: specimen dei ruoli (display, body, numeric/mono) con la type scale
  e le cifre tabellari su un importo di esempio.
- **Elemento firma**: il momento memorabile reso in bozza (per unportfolio: il
  "ledger header" con patrimonio + delta + sparkline finta).
- Una **nota** (2–3 righe) che dichiara la tesi della direzione e la scelta di
  rischio, così la review è leggibile.

Aggiungi/aggiorna una pagina indice `Explorations/README.mdx` che elenca le
direzioni con un link e una riga di sintesi, per il confronto affiancato.

Mantieni ogni pagina **autosufficiente** (stili inline nel file), così le direzioni
non si contaminano tra loro e si cancellano facilmente dopo la scelta.

## Dopo

1. L'utente sceglie una direzione a schermo.
2. Formalizzala con la skill **`product-decision`** (PDR + pagina `Product/*.mdx`).
3. Porta palette/tipografia scelte nei **token** (`ui-tokens/tokens.css` + `fonts.css`,
   con lo scope `[data-theme="dark"]`) e aggiorna le Foundations; poi rifai i
   componenti su quei token. Rimuovi le `Explorations/` non scelte.

## Verifica

Dopo lo scaffold, builda Storybook (`pnpm --filter @unportfolio/design-system build`)
e conferma che le direzioni compaiano sotto `Explorations/` e rendano correttamente.
