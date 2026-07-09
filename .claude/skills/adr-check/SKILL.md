---
name: adr-check
description: Valuta il codice di unportfolio rispetto agli ADR in docs/adr/ (e alle raccomandazioni in docs/guidances/) e riporta disallineamenti più decisioni che andrebbero registrate come nuovo/aggiornato ADR. Solo report — non modifica mai file. Usala quando ti si chiede di verificare l'allineamento agli ADR, trovare deriva architetturale o auditare le decisioni, E automaticamente come parte di ogni code review e PR review (vedi CLAUDE.md).
---

# Assessment di allineamento agli ADR

Produci un **report** che confronta il codice con le decisioni architetturali
registrate. **Non** modificare file, non creare ADR, non applicare fix — solo
findings e azioni raccomandate.

## Procedura

1. **Carica le decisioni.** Leggi `docs/adr/README.md` (l'indice) e le sezioni `## `
   di ogni `docs/adr/NNNN-*.md` (gli ADR sono tematici — un file per area, più
   decisioni dentro). Leggi anche le "Regole di architettura" in `CLAUDE.md` — la
   forma distillata e verificabile di più ADR. Scorri anche `docs/guidances/`:
   quelle sono **raccomandazioni, non regole imposte** — verificabili solo dove il
   codice adotta davvero il concern, mai violabili prima.

2. **Deriva la matrice di controllo a runtime — non hardcodarla.** L'insieme di ADR
   evolve (decisioni aggiunte, rinumerate, superate), quindi costruisci la matrice
   *ora* da ciò che hai appena letto: per ogni ADR accettato, trasforma la sua
   `## Decision` in una o più regole verificabili. Salta gli ADR
   `deprecated`/`superseded` e segui il link alla sostituzione. Lega ogni regola
   all'ADR da cui viene leggendo il file, mai recitando un numero a memoria.

3. **Cerca violazioni.** Preferisci il tooling esistente agli ad-hoc grep dove
   esiste:
   - la override Biome `noRestrictedImports` su `packages/core/**` (confine del
     core, [ADR-0002]);
   - `packages/core/tests/arch.spec.ts` con `assertLayerBoundaries` /
     `assertNo* ` da `@unportfolio/test-utils`;
   - i plugin GritQL self-arming su `**/*.e2e.ts` ([ADR-0004]).
   Per le regole non meccanizzate (i soldi non toccano float / `decimal.js`, il
   ledger resta beancount v2 valido, le viste non fanno I/O ma passano dallo store,
   nessun backend/DB) cerca nei sorgenti. Registra ogni hit come `path:line` con una
   riga di spiegazione, e nota quando una regola è già coperta da Biome/arch test e
   regge (è un check che passa, non un finding).

4. **Trova decisioni non registrate.** Segnala scelte a livello di architettura
   presenti nel codice ma non coperte da alcun ADR — es. un nuovo package top-level,
   una nuova dipendenza esterna che plasma l'architettura (uno store manager, un
   router diverso da TanStack Router), un nuovo layer, una deviazione intenzionale
   da un ADR accettato. Per ognuna proponi l'ADR da scrivere (titolo + una riga di
   rationale) seguendo `docs/adr/template.md`.

5. **Gestisci i casi vuoti.** `apps/design-system` e `packages/ui-tokens` potrebbero
   non esistere ancora, e non esistono e2e: molti check non avranno file da
   scansionare. Dillo chiaramente invece di riportare falsi pass.

## Formato output

```
# ADR assessment

## Violazioni di ADR esistenti
- [severità] ADR-NNNN — <regola>. Evidenza: path:line. Azione: …

## Decisioni non registrate (ADR da creare)
- <titolo proposto> — <perché serve un ADR>. Status suggerito: proposed.

## Check che passano (breve)
- ADR-NNNN — <regola>: imposta da <override Biome / arch test>, regge.
```

Severità: **blocker** (viola un ADR accettato in codice spedito), **warning**
(deriva o parziale), **note** (merita una decisione, non ancora sbagliato). Guida
con i blocker. Se è pulito, dillo.
