#!/bin/sh
# unportfolio — init della cartella dati.
#
# Uso:
#   curl -fsSL <sito>/init.sh | sh -s -- [cartella] [url-sito]
#
# Crea la cartella dati con i file skeleton (ledger beancount + TOML/CSV),
# annota il percorso assoluto in config.toml (il browser non può rilevarlo)
# e apre il sito: lì basta un click su "Scegli la cartella dati" e
# selezionare la cartella appena creata (richiesto dal browser, non
# automatizzabile per sicurezza).
set -eu

DIR="${1:-$HOME/Documents/unportfolio-data}"
SITE="${2:-${SITE:-}}"

# --- CLI prezzi: binario self-contained (nessun runtime richiesto) ---
install_prices_bin() {
  [ -n "$SITE" ] || return 0
  case "$(uname -s)" in
    Darwin) OS=darwin ;;
    Linux) OS=linux ;;
    *) echo "⚠ piattaforma $(uname -s) senza binario precompilato: usa 'curl <sito>/prices.mjs | node --input-type=module -' (serve Node ≥ 18)"; return 0 ;;
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
    echo "⚠ download del binario fallito: in alternativa 'curl $SITE/prices.mjs | node --input-type=module -' (serve Node ≥ 18)"
  fi
}
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

ABS_DIR=$(cd "$DIR" && pwd)
if [ ! -f "$DIR/config.toml" ]; then
  printf 'percorso_dati = "%s"\noperating_currency = "EUR"\ndefault_broker = "Directa"\npriorita = []\n\n[prezzi]\nanni = 2\nintervallo = "1wk"\n' "$ABS_DIR" > "$DIR/config.toml"
  echo "creato config.toml (percorso annotato: $ABS_DIR)"
elif ! grep -q '^percorso_dati' "$DIR/config.toml"; then
  # prepend: una chiave top-level in coda finirebbe dentro [prezzi]
  TMP=$(mktemp)
  printf 'percorso_dati = "%s"\n' "$ABS_DIR" > "$TMP"
  cat "$DIR/config.toml" >> "$TMP"
  mv "$TMP" "$DIR/config.toml"
  echo "annotato percorso in config.toml: $ABS_DIR"
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
