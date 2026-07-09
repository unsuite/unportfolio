# reference/

Materiale grezzo da cui unportfolio è costruito, tenuto in un posto solo così che
l'intera evoluzione sia esplorabile da un clone: fogli di calcolo di partenza,
export dei movimenti, screenshot del vecchio flusso su spreadsheet, prototipi.

È **input, non una decisione** — le decisioni che informa vivono in
[`docs/product/`](../docs/product/README.md) (prodotto/design) e
[`docs/adr/`](../docs/adr/README.md) (architettura). Un elemento di `reference/` è
*storia read-only*: non lo modifichi per cambiare il progetto, scrivi una decisione
che lo supera.

## Regole

- **In quarantena dal toolchain.** Niente qui è un package del workspace. È ignorato
  da Biome, mai type-checkato, mai buildato, mai testato. Turbo e pnpm non lo
  vedono.
- **Attenzione ai dati personali.** Il patrimonio reale non va qui: i formati
  sensibili (`*.xlsx`, `*.csv`, `*.pdf`) sono git-ignorati per policy (vedi
  [la guidance data-safety](../docs/guidances/data-safety.md)). In `reference/` va
  solo materiale **non sensibile o fittizio**. Se un foglio reale serve come
  riferimento, tienilo fuori dal repo e linka dove vive.
- **Organizza per tipo, data ciò che lasci.** Layout suggerito (non obbligatorio):

  ```
  reference/
    spreadsheets/   # fogli di partenza (anonimizzati / fittizi)
    exports/        # export di movimenti di esempio
    prototypes/     # prototipi esportati, reference di design, screenshot
  ```

- **Mandalo in pensione.** Quando un riferimento è stato del tutto digerito in
  decisioni e codice, può essere archiviato o rimosso — dillo nella decisione che
  lo chiude.

> Questa cartella parte vuota di proposito — riempila con il materiale del progetto,
> non sensibile.
