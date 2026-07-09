---
name: issues
description: Gestisce le issue GitHub con gh — le tria in milestone di release e in un campo di priorità P0–P3 su un GitHub Project (v2). Scopre repo/owner/project a runtime (mai hardcoded) e bootstrappa la struttura se manca. Usala quando ti si chiede di creare, triare, prioritizzare o organizzare issue, pianificare una release, o impostare la board.
---

# Gestione e triage delle issue

Organizza le issue GitHub con la CLI `gh` seguendo la convenzione del progetto:

- **Milestone = release/versioni** (es. `v0.1`, `v0.2`). Ogni issue punta ad al più
  una milestone di release.
- **Priorità = `P0`–`P3`**, memorizzata come **campo single-select su un GitHub
  Project (v2)** (`P0` = critico … `P3` = basso).
- **Status** vive sulla board del Project (Todo/In Progress/Done).

Questa skill muta GitHub (crea milestone/project/campi, edita issue). **Mostra sempre
il piano e conferma prima di ogni create/edit che non sia una richiesta singola
esplicita**, e mai creare un Project a livello di org/utente senza conferma
esplicita.

## Resta generica — scopri, non hardcodare

```sh
gh repo view --json nameWithOwner,owner,name
OWNER=$(gh repo view --json owner --jq .owner.login)
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
```

## Discovery & bootstrap

1. **Milestone (release).** Elenca, poi crea su richiesta:
   ```sh
   gh api "repos/$REPO/milestones?state=all" --jq '.[] | {title,state,due_on}'
   gh api "repos/$REPO/milestones" -f title="v0.1" -f state=open -f description="…"
   ```

2. **Project (v2).** Trova un project di `$OWNER`; se ce ne sono più, chiedi. Ispeziona
   i campi:
   ```sh
   gh project list --owner "$OWNER" --format json
   gh project field-list <NUMERO> --owner "$OWNER" --format json
   ```
   Se manca un project adatto o il campo `Priority`, proponi di crearli (conferma
   prima):
   ```sh
   gh project create --owner "$OWNER" --title "unportfolio board"
   gh project field-create <NUMERO> --owner "$OWNER" \
     --name "Priority" --data-type SINGLE_SELECT \
     --single-select-options "P0,P1,P2,P3"
   ```
   Nota: i campi Iteration non si creano da `gh` (solo web UI); le milestone coprono
   la pianificazione delle release.

## Workflow di triage (per issue o batch)

Per ogni issue:

1. Milestone: `gh issue edit <N> -R "$REPO" --milestone "v0.1"`.
2. Aggiungi al Project: `gh project item-add <NUMERO> --owner "$OWNER" --url <url>`.
3. Priorità (richiede ID risolti dal JSON):
   ```sh
   gh project field-list <NUMERO> --owner "$OWNER" --format json   # → field id, options[].id
   gh project item-list  <NUMERO> --owner "$OWNER" --format json   # → item id della issue
   gh project item-edit --project-id <PROJECT_ID> --id <ITEM_ID> \
     --field-id <PRIORITY_FIELD_ID> --single-select-option-id <P1_OPTION_ID>
   ```
   Batch: risolvi gli ID una volta, poi cicla.

## Altre azioni

- **Crea + tria** una nuova issue: `gh issue create -R "$REPO" --title … --body …
  --milestone …`, poi aggiungi al project e setta la priorità.
- **Organizza / report.** Raggruppa le issue aperte per milestone e priorità;
  fai emergere quelle **non triate** (senza milestone, non in board, senza priorità).
- **Pianifica una release.** Mostra cosa c'è in una milestone, cosa è senza priorità,
  e quale lavoro P0/P1 è ancora aperto.

## Guardrail

- Conferma prima di creare milestone, project o campi. Gli edit a una singola issue
  esplicita non richiedono conferma extra.
- Se `gh` non è autenticato (`gh auth status`), fermati e dillo all'utente.
- Risolvi gli ID freschi a ogni run; mai cachare un ID di project/campo/opzione.
- Rispetta la struttura esistente: se il project ha già uno schema di priorità
  diverso, fallo emergere e chiedi prima di divergere.
