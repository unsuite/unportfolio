---
name: design-check
description: Audita la disciplina di design/UX di unportfolio — token vs valori grezzi, tema light+dark, contrasto AA, focus/tastiera, motion, tooltip — e riporta le violazioni con path:line. Solo report, non modifica mai file. Usala quando ti si chiede di verificare l'aderenza al design system, la qualità visiva/UX o l'accessibilità, E automaticamente come parte di ogni code review e PR review (vedi CLAUDE.md).
---

# Design & UX check

Produci un **report** su quanto UI e stili rispettano la disciplina di design del
progetto: token come unica fonte di verità (ADR-0006), temi light+dark,
accessibilità e coerenza. **Non** modificare file — solo violazioni e azioni
raccomandate, ordinate per gravità.

Lo scope naturale è `packages/ui/**` (il catalogo su CSS Modules) e
`packages/ui-tokens/**`; le viste `apps/web/src/app/views/**` sono ancora dark su
Tailwind e vanno valutate solo se la richiesta le include (segnala la deriva, non
ogni classe).

## Cosa controllare

### 1. Disciplina dei token (ADR-0006)
- **Valori grezzi** dove esiste un token: nei `*.module.css` e negli `style=` inline
  cerca colori (`#hex`, `rgb(`, `hsl(`, nomi come `red`/`white`/`black`) e `px` per
  spaziatura/raggio/font che dovrebbero usare `var(--space-*/--radius-*/--font-size-*)`.
  Ammessi: `color-mix()` di soli token, `currentColor`, `0`, `1px` di bordo,
  percentuali, valori senza token corrispondente (segnalali come "manca un token").
- **Token non definiti**: `var(--x)` usato ma assente da `ui-tokens/tokens.css` o
  `fonts.css` (escludi le custom properties locali definite nello stesso file).
- **Tailwind nel catalogo**: qualsiasi classe utility in `packages/ui` è una
  violazione (il catalogo è CSS Modules puro).

### 2. Temi (light + dark)
- Esiste uno scope `[data-theme="dark"]` (o `prefers-color-scheme`) che rimappa i
  **soli token semantici**? Se manca, segnalalo: i componenti light-first non hanno
  parità in dark.
- I token semantici non devono essere ridefiniti nei componenti (solo consumati).

### 3. Accessibilità
- **Contrasto AA** (≥ 4.5:1 testo normale, ≥ 3:1 testo grande/UI) delle coppie
  testo/superficie e on-color/fondo, **in entrambi i temi**. Calcolalo dai valori
  reali dei token (leggi gli hex da `tokens.css`); riporta le coppie sotto soglia.
- **Focus visibile**: ogni elemento interattivo ha `:focus-visible` con outline sui
  token; nessun `outline: none` senza sostituto.
- **Tastiera**: elementi cliccabili non nativi hanno gestione tastiera/role adeguati;
  preferire elementi nativi.
- **Tooltip nativi**: usi di `title=` come tooltip informativo → raccomanda un
  componente `Tooltip` accessibile.
- Label associate ai controlli; `aria-*` corretti su dialog/tab/segmented.

### 4. Interazione & motion
- Le `transition`/`animation` rispettano `prefers-reduced-motion: reduce`?
- Stati hover/active presenti e coerenti tra componenti gemelli (nessuna deriva).

### 5. Coerenza & gerarchia
- Gerarchia del testo muted (il progetto punta a più livelli, non un solo
  `--color-text-muted` collassato): segnala dove la gerarchia si perde.
- Scale di spaziatura/raggio/tipografia usate in modo coerente tra componenti
  che svolgono lo stesso ruolo.

## Procedura

1. Leggi `packages/ui-tokens/tokens.css` e `fonts.css`: costruisci l'elenco dei
   token definiti e i loro valori (servono per contrasto e per il check "grezzo vs
   token").
2. Scansiona i `*.module.css` e gli `style=` inline nello scope: applica i check 1–5.
3. Per il contrasto, calcola il rapporto WCAG dai valori hex reali (puoi eseguire un
   piccolo snippet inline con `node`/`python3`); valuta light e — se lo scope esiste —
   dark.
4. Aggrega e ordina per gravità (bloccante a11y > deriva token > coerenza).

## Formato output

```
# Design & UX check

## Token discipline
- <file:line> — valore grezzo <valore> dove esiste <--token>. 

## Temi
- Manca lo scope [data-theme="dark"] / token semantico ridefinito in <file>.

## Accessibilità
- Contrasto <coppia> = <ratio>:1 (< AA) nel tema <light|dark>. Evidenza: tokens.css.
- <file:line> — <title= usato come tooltip | focus non visibile | …>.

## Interazione & coerenza
- <file:line> — <deriva/hover/motion/gerarchia>.
```

Guida con i bloccanti di accessibilità, poi la deriva dei token, poi la coerenza.
Concreto con `path:line`. Chiudi dicendo che è allineato se non c'è nulla da
riportare.

> Per un audit **a runtime** (axe-core, stati reali, viewport) serve l'app/Storybook
> in esecuzione: fuori dallo scope di questo check statico. Strumenti esterni utili
> come complemento: skill axe-core/jsx-a11y e validator di token pubblici (vedi la
> issue di redesign).
