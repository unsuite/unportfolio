# Font self-hosted (opzionale)

Local-first/offline: **niente font remoti**. Le famiglie in `../fonts.css` usano lo
stack di sistema, che è già un neo-grotesque su ogni piattaforma e rende bene da
subito. Per dare più carattere al display (e cifre tabellari dedicate ai dati) si
può **bundlare un woff2 con licenza aperta (OFL)** — resta offline perché il file
vive nel repo, non viene scaricato a runtime.

## Come aggiungere una famiglia

1. Scarica i `.woff2` di un font **OFL** (es. display grotesk: _Space Grotesk_,
   _Hanken Grotesk_, _Geist_; mono: _Geist Mono_, _JetBrains Mono_, _IBM Plex Mono_)
   e mettili qui in `packages/ui-tokens/fonts/`.
2. Aggiungi la `@font-face` in `../fonts.css`, es.:

   ```css
   @font-face {
     font-family: "Registro Grotesk";
     src: url("./fonts/registro-grotesk.woff2") format("woff2");
     font-weight: 400 700;
     font-display: swap;
   }
   ```

3. Il nome famiglia (`"Registro Grotesk"` / `"Registro Mono"`) è già in testa agli
   stack `--font-display` / `--font-mono`: appena la `@font-face` esiste, i token lo
   usano; altrimenti ricadono sul sistema. Nessun cambel nei componenti.

> Verifica sempre la **licenza** del font prima di committarlo (OFL consente il
> self-hosting e la redistribuzione; molti font commerciali no).
