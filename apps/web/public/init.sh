#!/bin/sh
# unportfolio — setup cartella dati e aggiornamento prezzi.
#
# Uso:
#   curl -fsSL <sito>/init.sh | sh -s -- [cartella] [url-sito]            # onboarding
#   curl -fsSL <sito>/init.sh | sh -s -- <cartella> <url-sito> --prezzi   # aggiorna i prezzi
#
# Onboarding: crea la cartella dati skeleton (ledger beancount + TOML/CSV),
# annota il percorso assoluto in config.toml (il browser non può rilevarlo),
# installa il binario prezzi self-contained se passi <url-sito> e apre il sito.
# Con --prezzi: installa-se-manca il binario (bun --compile, nessun runtime) e
# aggiorna i prezzi della cartella, saltando skeleton e apertura sito. Gli
# argomenti dopo --prezzi (--re-resolve, --set ...) passano al CLI prezzi.
set -eu

# sito canonico da cui scaricare il binario (come claude.ai per Claude): così il
# comando prezzi non deve ripetere l'origin. Sovrascrivibile con un arg http(s)
# esplicito o con la variabile d'ambiente SITE.
SITE_DEFAULT="https://unsuite.github.io/unportfolio"

# versione del formato dati (allineata a src/core/config/format.ts DATA_FORMAT):
# annotata in config.toml come formato_dati, così l'app sa se serve un update.
DATA_FORMAT=1

DIR="${1:-$HOME/Documents/unportfolio-data}"
[ "$#" -gt 0 ] && shift || true

# sito esplicito: primo argomento http(s) rimasto (override del default)
SITE="${SITE:-}"
case "${1:-}" in
  http://* | https://*) SITE="$1"; shift ;;
esac

# modalità prezzi + raccolta degli argomenti extra da girare al CLI
PREZZI=0
for arg in "$@"; do
  [ "$arg" = "--prezzi" ] && PREZZI=1
done
set -- $(for arg in "$@"; do [ "$arg" = "--prezzi" ] || printf '%s ' "$arg"; done)

# --- CLI prezzi: binario self-contained (nessun runtime richiesto) ---
install_prices_bin() {
  [ -n "$SITE" ] || return 0
  # già installato: non riscaricare (il refresh prezzi gira spesso)
  [ -x "$HOME/.local/bin/unportfolio-prices" ] && return 0
  case "$(uname -s)" in
    Darwin) OS=darwin ;;
    Linux) OS=linux ;;
    *) echo "⚠ piattaforma $(uname -s) senza binario precompilato: compila da repo con 'npm run build:bins'"; return 0 ;;
  esac
  case "$(uname -m)" in
    arm64|aarch64) ARCH=arm64 ;;
    x86_64|amd64) ARCH=x64 ;;
    *) echo "⚠ architettura $(uname -m) non supportata dai binari precompilati"; return 0 ;;
  esac
  BIN_DIR="$HOME/.local/bin"
  mkdir -p "$BIN_DIR"
  if curl -fsSL "$SITE/bin/prices-$OS-$ARCH" -o "$BIN_DIR/unportfolio-prices"; then
    chmod +x "$BIN_DIR/unportfolio-prices"
    echo "✓ installato $BIN_DIR/unportfolio-prices (binario autonomo, nessun runtime richiesto)"
    case ":$PATH:" in
      *":$BIN_DIR:"*) ;;
      *)
        echo "  nota: $BIN_DIR non è nel PATH — usa il percorso completo, oppure aggiungi al tuo profilo:"
        echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
        ;;
    esac
  else
    echo "⚠ download del binario fallito da $SITE/bin/prices-$OS-$ARCH — riprova più tardi"
  fi
}

# --- modalità prezzi: installa-se-manca + aggiorna, niente skeleton/sito ---
if [ "$PREZZI" = 1 ]; then
  # senza sito esplicito si usa quello canonico: il binario viene da lì
  SITE="${SITE:-$SITE_DEFAULT}"
  install_prices_bin
  BIN="$HOME/.local/bin/unportfolio-prices"
  [ -x "$BIN" ] || {
    echo "⚠ binario prezzi non disponibile: passa l'url del sito per scaricarlo, es:" >&2
    echo "  curl -fsSL <sito>/init.sh | sh -s -- \"$DIR\" <sito> --prezzi" >&2
    exit 1
  }
  echo "aggiorno i prezzi: $DIR"
  exec "$BIN" "$DIR" "$@"
fi

install_prices_bin

# --- cartella + skeleton (non sovrascrive mai file esistenti) ---
mkdir -p "$DIR/ledger"

put() { # put <path-relativo> <contenuto>
  if [ ! -f "$DIR/$1" ]; then
    printf '%s' "$2" > "$DIR/$1"
    echo "creato $1"
  else
    echo "esiste già $1, non tocco"
  fi
}

put ledger/main.beancount 'option "title" "unportfolio"
option "operating_currency" "EUR"

include "accounts.beancount"
include "movimenti.beancount"
include "prices.beancount"
'
put ledger/accounts.beancount "; generato dall'app (open + commodity)
"
put ledger/movimenti.beancount '; transazioni importate
'
put ledger/prices.beancount '; prezzi campionati
'
put patrimonio.toml '# righe del patrimonio
'
put goals.toml '# obiettivi
'
put snapshots.csv 'date,account_id,value,currency
'

# AGENTS.md: onboarding per un LLM che apre la cartella (duplicato in
# src/app/fs/fileSystem.ts AGENTS_MD). File "gestito": lo riscriviamo sempre
# (non è dato utente), così un re-run allinea la versione. Heredoc quotato:
# nessuna interpolazione.
cat > "$DIR/AGENTS.md" <<'AGENTS_EOF'
# unportfolio — cartella dati

Questa cartella è il database di **unportfolio**, un'app locale per net worth,
portafoglio e obiettivi. Nessun backend: sono file in chiaro, versionabili in
git. Se stai analizzando questa cartella, parti da qui.

## Il ledger è beancount v2 valido

`ledger/` si usa senza conversioni:

```sh
bean-check ledger/main.beancount                        # valida
bean-query ledger/main.beancount "SELECT account, sum(position)"   # interroga
fava ledger/main.beancount                              # UI web
```

- `ledger/main.beancount` — opzioni + `include`: è il punto d'ingresso.
- `ledger/accounts.beancount` — `open` + `commodity` (**rigenerato dall'app**, non editarlo a mano).
- `ledger/movimenti.beancount` — transazioni (append per batch di import).
- `ledger/prices.beancount` — direttive `price` campionate (storico prezzi).

## Convenzioni (rilevanti per l'analisi)

- **La commodity di ogni strumento è l'ISIN**, non il ticker; il ticker è solo
  metadato di display (`ticker` sulla direttiva `commodity`).
- **Bond in lotti da 100 di nominale**: 5.000 € nominali = 50 unità, così il
  prezzo (% del nominale) è letteralmente il prezzo unitario.
- Vendite con booking **FIFO**.
- Metadati strumento (classe, tassa, scadenza, cedola, sorgente prezzo) sulle
  direttive `commodity`.
- Dedupe import via metadato `import-id`: re-importare lo stesso file non duplica.

## File di configurazione (TOML/CSV)

- `patrimonio.toml` — righe del Patrimonio (sezione, owner, portfolio, split).
  L'**etichetta** mostrata di uno strumento è il campo `nome` qui.
- `goals.toml` — obiettivi. `targets.toml` — pesi target del ribilanciamento (vedi sotto).
- `snapshots.csv` — saldi manuali periodici. Header: `date,account_id,value,currency`.
- `config.toml` — `percorso_dati` (path assoluto, annotato dal CLI) e `[prezzi]`
  (`anni`, `intervallo`) che definisce la copertura dello storico.

## Ribilanciamento (targets.toml)

Per ogni `(portfolio, commodity)` `targets.toml` tiene il peso target `peso`
(frazione 0..1) e due flag opzionali che cambiano come lo strumento entra nel
calcolo. **Attenzione a non confonderli:**

- `fisso = true` — posizione **congelata**: non si compra **né si vende**, resta
  al valore corrente (ideale = corrente, "da comprare" = 0). Il suo peso **conta
  ancora** nella percentuale target mostrata, ma il suo valore **esce dal
  montante** da ridistribuire: gli altri si spartiscono `(totale + liquidità −
  fissi)` coi loro pesi rinormalizzati.
- `escluso = true` — **fuori da tutta la matematica**: non entra nel totale, nelle
  percentuali né nel montante, e non ha ideale né "da comprare". Non è solo
  "fuori dai pesi": è ignorato del tutto (riga di solo promemoria).

I due flag sono **mutuamente esclusivi**. Uno strumento senza flag con `peso > 0`
è un normale target ribilanciabile; se non ha riga in `targets.toml` vale 0.

## Aggiornare i prezzi (CLI)

I prezzi si aggiornano **solo da terminale** (niente CORS/proxy): ETF via Yahoo
(simboli risolti dall'ISIN), bond MOT via Borsa Italiana. Campiona una `price`
per giorno/strumento in `ledger/prices.beancount`.

Col binario installato (`~/.local/bin/unportfolio-prices`):

```sh
unportfolio-prices "<questa-cartella>"                              # incrementale
unportfolio-prices "<questa-cartella>" --re-resolve                 # rifà la gara dei simboli
unportfolio-prices "<questa-cartella>" --set X.WBIT=yahoo:WBTC.PA   # binding manuale
```

Se il binario non c'è, un solo comando lo installa (self-contained, nessun
runtime) e aggiorna:

```sh
curl -fsSL https://unsuite.github.io/unportfolio/init.sh | sh -s -- "<questa-cartella>" --prezzi
```

Dal repo sorgente: `npx vite-node scripts/prices.ts -- <cartella>`.

## Se modifichi questa cartella

- Le transazioni si aggiungono in `ledger/movimenti.beancount` (append).
- Dopo modifiche al ledger valida con `bean-check ledger/main.beancount`.
- I prezzi si aggiornano col CLI, non a mano.
AGENTS_EOF
echo "aggiornato AGENTS.md"

ABS_DIR=$(cd "$DIR" && pwd)
if [ ! -f "$DIR/config.toml" ]; then
  printf 'formato_dati = %s\npercorso_dati = "%s"\noperating_currency = "EUR"\ndefault_broker = "Directa"\npriorita = []\n\n[prezzi]\nanni = 2\nintervallo = "1wk"\n' "$DATA_FORMAT" "$ABS_DIR" > "$DIR/config.toml"
  echo "creato config.toml (formato v$DATA_FORMAT, percorso: $ABS_DIR)"
else
  # annota/aggiorna il marcatore di formato (chiave top-level, in testa: una
  # chiave in coda finirebbe dentro [prezzi])
  if grep -q '^formato_dati' "$DIR/config.toml"; then
    sed -i.bak "s/^formato_dati.*/formato_dati = $DATA_FORMAT/" "$DIR/config.toml"
    rm -f "$DIR/config.toml.bak"
  else
    TMP=$(mktemp)
    printf 'formato_dati = %s\n' "$DATA_FORMAT" > "$TMP"
    cat "$DIR/config.toml" >> "$TMP"
    mv "$TMP" "$DIR/config.toml"
  fi
  echo "config.toml al formato v$DATA_FORMAT"
  if ! grep -q '^percorso_dati' "$DIR/config.toml"; then
    TMP=$(mktemp)
    printf 'percorso_dati = "%s"\n' "$ABS_DIR" > "$TMP"
    cat "$DIR/config.toml" >> "$TMP"
    mv "$TMP" "$DIR/config.toml"
    echo "annotato percorso in config.toml: $ABS_DIR"
  fi
fi

echo ""
echo "✓ cartella dati pronta: $ABS_DIR"
if [ -x "$HOME/.local/bin/unportfolio-prices" ]; then
  echo "  aggiorna i prezzi con: ~/.local/bin/unportfolio-prices \"$ABS_DIR\""
fi

# --- apri il sito ---
if [ -n "$SITE" ]; then
  echo "apro $SITE — clicca \"Scegli la cartella dati\" e seleziona: $ABS_DIR"
  if command -v open >/dev/null 2>&1; then open "$SITE"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$SITE"
  else echo "apri manualmente: $SITE"
  fi
else
  echo "apri il sito e clicca \"Scegli la cartella dati\" selezionando: $ABS_DIR"
fi
