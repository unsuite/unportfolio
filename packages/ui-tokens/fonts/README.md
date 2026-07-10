# Font self-hosted

Local-first/offline: i font vivono **nel repo** e non si scaricano a runtime.

## Famiglia attuale — Geist (SIL OFL 1.1)

- `Geist-Variable.woff2` → token `--font-display` e `--font-sans` (nome famiglia
  `"Registro Grotesk"`).
- `GeistMono-Variable.woff2` → token `--font-mono` (nome famiglia `"Registro Mono"`),
  per dati/importi/righe beancount con cifre tabellari.
- `OFL.txt` → licenza (Copyright Vercel, in collaborazione con basement.studio). La
  OFL richiede che il testo di licenza sia distribuito **insieme** ai font: non
  rimuoverlo.

Sono file **variable** (un solo woff2 per famiglia copre tutti i pesi 100–900), ~70
KB l'uno. Le `@font-face` sono in `../fonts.css`.

## Sostituire con un'altra famiglia OFL

1. Scarica i `.woff2` (e la relativa licenza OFL) di un font **OFL** e mettili qui.
2. Aggiorna `src:` nelle `@font-face` di `../fonts.css`. I nomi famiglia
   (`"Registro Grotesk"` / `"Registro Mono"`) sono già in testa agli stack dei token:
   cambiando solo la sorgente, i componenti non cambiano.
3. Verifica sempre la licenza: OFL consente self-hosting e redistribuzione; molti
   font commerciali no.
