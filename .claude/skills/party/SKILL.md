---
name: party
description: Avvia un panel di esperti multi-agente INTERATTIVO — spawna un agente indipendente e persistente per concern (architect, domain, design-system, QA, release) e facilita una tavola rotonda dal vivo che l'utente guida turno per turno, con una sintesi all'uscita. Usala quando l'utente vuole un panel, una tavola rotonda, o prospettive genuinamente indipendenti da interrogare avanti e indietro su un problema, feature o trade-off.
---

# Party — panel multi-agente interattivo

Una tavola rotonda dal vivo sostenuta da **veri subagent indipendenti** (contesti
separati, disaccordo genuino) che l'utente può interrogare attraverso i turni. Il
meccanismo: spawna una volta un **agente di background persistente per lente**, poi
**continua ciascuno via SendMessage** a ogni turno dell'utente — il loop principale
è il facilitatore (Pia), mai un agente separato.

Invocare questa skill **è** l'opt-in esplicito all'orchestrazione multi-agente. Ogni
turno messaggia più agenti vivi — costo e latenza reali; usala per decisioni che lo
meritano.

## Tool

Caricali prima (deferred): `ToolSearch` → `select:Agent,SendMessage,TaskStop`. Usa
`Agent` (con `run_in_background: true` e `subagent_type` sulla persona) per spawnare
ogni panelist; `SendMessage` (all'id/nome dell'agente) per continuarlo col contesto
intatto; `TaskStop` per smontarli all'uscita.

## Il roster (ognuno è un subagent in `.claude/agents/`)

Le persone vivono come subagent di prima classe — spawnale per `subagent_type`; il
loro carattere e la loro lente stanno nella definizione, non qui duplicati. Ognuno
legge il repo a runtime per fondarsi.

- `architect` — **Ada**: layering, confini core/app, store/router-context, ADR.
- `domain` — **Bruno**: purezza del core, correttezza beancount, matematica tipata,
  importer plugin. (Niente DB/persistenza — non esistono.)
- `design-system` — **Dana**: ui-tokens, Storybook, token, a11y, UX delle viste.
- `qa` — **Quinn**: testabilità avversariale, property test fast-check, arch test.
- `release` — **Remo**: CI, Turbo, build, deploy GitHub Pages, CLI prezzi, versioning.

Scegli le lenti rilevanti (min 3 per una vera varietà); salta quelle chiaramente
irrilevanti per risparmiare costo.

## Modello per agente

Ogni lente può girare sul proprio modello — passa `model` allo spawn `Agent`
(`opus` | `sonnet` | `haiku` | `fable`). Omettilo per **ereditare il modello di
sessione** (default sicuro). Se l'utente imposta un profilo all'invocazione,
onoralo. Il modello è fissato allo spawn — `SendMessage` continua sull'agente creato.

## Come gira

1. **Apertura.** Prendi il topic dagli args (se manca, chiedi una volta cosa
   decidere). Spawna ogni lente scelta come `Agent` di background col suo
   `subagent_type`, passando il topic come domanda del panel. Tieni una mappa
   `lente → agentId`. Raccogli la posizione d'apertura di ciascuno e presenta il
   giro, facilitando: come Pia, inquadra il topic in una riga e **guida con le
   tensioni**, non con un riassunto ordinato.

2. **Facilita ogni turno.** A ogni messaggio dell'utente:
   - Se si rivolge a una lente (`@architect …`), `SendMessage` a quell'agente. Se
     chiede alla stanza, messaggia gli agenti rilevanti.
   - Per creare vero dibattito, rilancia l'affermazione di un agente a un altro e
     chiedi la replica (`SendMessage` con il punto dell'altro citato).
   - Presenta le risposte in carattere (`🏛 architect: …`), turni brevi, e **fai
     emergere il disaccordo — mai fabbricare consenso**.
   - Riusa gli STESSI agentId ogni turno perché il contesto persista; non ri-spawnare.

3. **Resta nel panel** attraverso i turni finché l'utente non esce.

Quando spawni o messaggi un agente, dagli solo il contesto del panel che gli serve:
il topic, i punti rilevanti degli altri panelist, la domanda dell'utente. Carattere,
lente e regole di grounding vivono già nella sua definizione in `.claude/agents/`.

## Convergenza & uscita

Quando l'utente dice "esci dalla party" o la decisione si risolve, **sintetizza**
(tu, come Pia — o un agente finale per un passaggio neutro):

```
## Party wrap-up — {topic}
**Decisione:** … (o la scelta aperta chiave se davvero irrisolta)
**Consenso:** …
**Disaccordi:** quale lente sostiene cosa (preserva il dissenso)
**Azioni:** owner → task
**ADR / guidance candidati:** titolo — perché, e se è una decisione `docs/adr/` o
una raccomandazione `docs/guidances/` (passa la palla a `adr-check`; template in
`docs/adr/template.md`)
```

Poi **`TaskStop`** gli agenti spawnati e torna alla modalità normale. Non scrivere
mai file dalla party — produce raccomandazioni; agire su di esse è un passo separato.
