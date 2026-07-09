# PDR-0001: Direzione visiva "Registro"

- Status: accepted
- Date: 2026-07-09
- Reviewers: Gabriele Consiglio

## Context

unportfolio funziona ma "sembra un default": scala di grigi generica, accento blu
da template, nessuna personalità tipografica, controlli e tabelle densi senza
gerarchia. La [issue #6](https://github.com/unsuite/unportfolio/issues/6) apre il
redesign per renderlo **più usabile e accattivante**, con una tesi: è uno
*strumento privato e preciso per il patrimonio*, dove **il numero è il
protagonista** e sotto c'è testo semplice (ledger beancount).

Abbiamo esplorato quattro direzioni come prototipi Storybook (skill
`design-explore`, sotto `Explorations/`): A "Ledger strumentale" (dark/ottone),
B "Carta e inchiostro" (light/grotesk+teal), C "Terminale quieto" (dark
mono-forward), D "Registro" (sintesi di B+C). Vedi
[`apps/design-system/src/Explorations/`](../../../apps/design-system/src/Explorations/).

## Decision

Adottiamo la direzione **D "Registro"** — una sola identità in **due temi
(light + dark)**, che è già la coppia che vivrà nello scope `[data-theme="dark"]`
dei token ([ADR-0006](../../adr/0006-design-system.md)).

**Tipografia (2 famiglie, da bundlare woff2 — offline, local-first):**
- **Display** grotesk (candidato: Founders Grotesk) per il numero-protagonista e i
  titoli.
- **Numeric/dati** monospazio con cifre tabellari (candidato: Berkeley/Commit Mono)
  per importi, righe conto e la microriga `ledger/*.beancount` — onora l'anima
  plain-text.
- Body sul grotesk, ad alta leggibilità.

**Colore — un unico inchiostro teal come guida**, semantica gain/loss armonizzata,
gerarchia muted a 2–3 livelli (da fissare in fase token). Valori di partenza:

| Ruolo | Light | Dark |
|---|---|---|
| bg | `#FAFAF7` | `#0C0F0E` |
| surface | `#FFFFFF` | `#121615` |
| border | `#E4E4DE` | `#232B28` |
| text | `#1B1F23` | `#D6DEDA` |
| muted-1 | `#5A6169` | `#8A968F` |
| muted-2 | `#8A9098` | `#5C665F` |
| accent · teal | `#0F766E` | `#3FB6A9` |
| positive | `#12805C` | `#63B98A` |
| negative | `#C2413B` | `#D6706A` |

**Elemento firma — il "ledger header":** patrimonio netto grande in grotesk (cifre
tabellari) + sottolineatura teal + chip di delta in mono + microriga beancount +
sparkline. È l'unico elemento audace; tutto il resto resta quieto.

## Rationale

- **A (solo dark/ottone):** elegante ma monotema e l'ottone rischia il "lussuoso";
  perde le radici plain-text.
- **B (solo light/grotesk+teal):** calmo e ordinato ma monotema e senza l'anima
  del ledger.
- **C (solo mono):** autentico rispetto al beancount ma denso e "tecnico" da solo,
  può intimidire chi arriva dal foglio di calcolo.
- **D (scelta):** grotesk per il numero, mono per i dati, teal condiviso — nasce
  **già come coppia light+dark**, quindi allinea il redesign al lavoro sui token
  invece di rimandarlo.

## Consequences

- \+ Identità distintiva e non-templated, con i numeri protagonisti e l'anima
  beancount onorata.
- \+ Coppia light/dark pronta: guida diretta per lo scope `[data-theme="dark"]` dei
  token e per il pass sui componenti di `packages/ui`.
- \+ Base per sostituire i tooltip `title=` nativi, la gerarchia muted collassata e
  la palette zinc grezza segnalati nella issue #6.
- − Due famiglie tipografiche da mantenere in armonia e **font da bundlare woff2**
  (nessun font remoto: vincolo local-first/offline).
- − Il **teal deve reggere il contrasto AA** su testo/superfici in **entrambi** i
  temi: da verificare con `design-check` prima di congelare i valori.
- − I valori qui sono un punto di partenza: muted a 2–3 livelli ed elevazione/motion
  si fissano in fase token.

<!--
Si renderizza in Storybook sotto `Product/` via una pagina che importa questo file
`?raw` e incorpora il prototipo Explorations/D. Vedi
docs/adr/0007-product-and-reference-spaces.md.
-->
