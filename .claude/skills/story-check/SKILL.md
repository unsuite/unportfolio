---
name: story-check
description: Verifica che i componenti/viste di apps/web e le loro storie Storybook (e le Foundations dei token) restino allineati, e riporta divergenze più storie da aggiungere. Solo report — non modifica mai file. Usala quando ti si chiede di verificare la copertura Storybook o trovare deriva delle storie, E automaticamente come parte di ogni code review e PR review (vedi CLAUDE.md).
---

# Allineamento Storybook

Produci un **report** su quanto i componenti/viste di `apps/web` e la loro
copertura Storybook (in `apps/design-system`) concordano (vedi
[ADR-0006](../../../docs/adr/0006-design-system.md), sezione *Vetrina Storybook*).
**Non** scaffoldare storie né modificare file — solo divergenze e azioni
raccomandate.

## Gestisci prima il caso "scaffold non presente"

`apps/design-system` (Storybook 10) e `packages/ui-tokens` **arrivano in un passo
successivo** ([ADR-0006]). Se non esistono ancora:

- Dillo esplicitamente in cima al report.
- Enumera comunque i componenti/viste candidati (`apps/web/src/app/views/**`,
  eventuali componenti riusabili) come *superficie futura* da coprire, senza
  segnalarli come "storie mancanti" (non c'è ancora Storybook dove metterle).
- Fermati lì per la parte storie; nessun finding inventato.

Se invece la Storybook esiste, procedi.

## Procedura (con Storybook presente)

1. **Enumera componenti/viste.** Elenca le viste sotto `apps/web/src/app/views/**` e
   ogni componente riusabile esportato. Nota la convenzione di co-locazione delle
   storie decisa in [ADR-0006].

2. **Mappa storie → componenti.** Per ognuno trova la sua `*.stories.tsx`. Segnala:
   - **Storia mancante** — un componente/vista esportato senza storia.
   - **Storia orfana** — una storia il cui componente non esiste più.

3. **Confronta spec ↔ storia.** Per i componenti con storia, leggi le props
   pubbliche (il tipo `*Props` o la firma) e confronta con `argTypes`/`args`/varianti
   renderizzate. Segnala props/varianti supportate ma non esercitate, e `args` che
   referenziano props rimosse.

4. **Controlla token & Foundations.** Se esiste `packages/ui-tokens`: `var(--token)`
   usati nei CSS/Tailwind ma **non definiti** in `@unportfolio/ui-tokens/tokens.css`,
   e gruppi di token non mostrati in alcuna pagina Foundations.

## Formato output

```
# Storybook spec alignment

## Stato scaffold
- apps/design-system / packages/ui-tokens: presenti | non ancora presenti.

## Componenti/viste senza storia
- <Nome> (path) — raccomandato: aggiungere <Nome>.stories.tsx.

## Divergenze spec
- <Nome> — <prop/variante> supportata ma non in nessuna storia. Evidenza: path:line.

## Gap token & Foundations
- var(--x) usato in <file> non definito in tokens.css.
```

Guida con le storie mancanti, poi le divergenze, poi i gap token. Concreto con
`path:line`. Chiudi dicendo che è allineato se non c'è nulla da riportare.
