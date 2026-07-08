#Requires -Version 5
# unportfolio — setup cartella dati e aggiornamento prezzi (Windows / PowerShell).
#
# Uso (onboarding):
#   irm <sito>/init.ps1 | iex
#   & ([scriptblock]::Create((irm <sito>/init.ps1))) -Dir <cartella> -Site <url-sito>
# Uso (aggiorna i prezzi):
#   & ([scriptblock]::Create((irm <sito>/init.ps1))) -Dir <cartella> -Prezzi
#
# Onboarding: crea la cartella dati skeleton (ledger beancount + TOML/CSV),
# annota il percorso assoluto in config.toml (il browser non può rilevarlo),
# installa il binario prezzi se passi -Site e apre il sito: lì basta un click
# su "Scegli la cartella dati" e selezionare la cartella appena creata.
# Con -Prezzi: installa-se-manca il binario (nessun runtime) e aggiorna i prezzi
# della cartella, saltando skeleton e apertura sito. Gli argomenti extra
# (-Prezzi ... --re-resolve, --set ...) passano al CLI prezzi.
param(
  [string]$Dir  = "$HOME\Documents\unportfolio-data",
  [string]$Site = $env:SITE,
  [switch]$Prezzi,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Rest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# sito canonico da cui scaricare il binario (come init.sh SITE_DEFAULT): iniettato
# da SITE_URL nel build (vedi vite.config.ts), fallback qui sotto. Sovrascrivibile
# con -Site o la variabile d'ambiente SITE.
$SiteDefault = "https://unsuite.github.io/unportfolio"

# --- CLI prezzi: binario self-contained (nessun runtime richiesto) ---
function Install-PricesBin {
  if (-not $Site) { return }
  $binDir = Join-Path $env:LOCALAPPDATA "unportfolio\bin"
  $target = Join-Path $binDir "unportfolio-prices.exe"
  # già installato: non riscaricare (il refresh prezzi gira spesso)
  if (Test-Path -LiteralPath $target) { return }
  if (-not [Environment]::Is64BitOperatingSystem) {
    Write-Host "⚠ architettura non x64: nessun binario precompilato per Windows"
    return
  }
  New-Item -ItemType Directory -Force -Path $binDir | Out-Null
  try {
    Invoke-WebRequest -UseBasicParsing -Uri "$Site/bin/prices-windows-x64.exe" -OutFile $target
    Write-Host "✓ installato $target (binario autonomo, nessun runtime richiesto)"
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if (($userPath -split ";") -notcontains $binDir) {
      Write-Host "  nota: $binDir non è nel PATH — usa il percorso completo, oppure aggiungilo:"
      Write-Host "    setx PATH `"`$env:Path;$binDir`""
    }
  } catch {
    Write-Host "⚠ download del binario fallito da $Site/bin/prices-windows-x64.exe — riprova più tardi"
  }
}

# --- modalità prezzi: installa-se-manca + aggiorna, niente skeleton/sito ---
if ($Prezzi) {
  # senza sito esplicito si usa quello canonico: il binario viene da lì
  if (-not $Site) { $Site = $SiteDefault }
  Install-PricesBin
  $bin = Join-Path $env:LOCALAPPDATA "unportfolio\bin\unportfolio-prices.exe"
  if (-not (Test-Path -LiteralPath $bin)) {
    Write-Host "⚠ binario prezzi non disponibile: passa -Site per scaricarlo, es:"
    Write-Host "  ... -Dir `"$Dir`" -Site <sito> -Prezzi"
    exit 1
  }
  Write-Host "aggiorno i prezzi: $Dir"
  & $bin $Dir @Rest
  exit $LASTEXITCODE
}

Install-PricesBin

# --- cartella + skeleton (non sovrascrive mai file esistenti) ---
New-Item -ItemType Directory -Force -Path (Join-Path $Dir "ledger") | Out-Null

# scrive senza BOM e con newline LF, per restare identico a init.sh
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
function Put($rel, $content) {
  $path = Join-Path $Dir $rel
  if (-not (Test-Path -LiteralPath $path)) {
    [System.IO.File]::WriteAllText($path, ($content -replace "`r`n", "`n"), $utf8NoBom)
    Write-Host "creato $rel"
  } else {
    Write-Host "esiste già $rel, non tocco"
  }
}

Put "ledger\main.beancount" @'
option "title" "unportfolio"
option "operating_currency" "EUR"

include "accounts.beancount"
include "movimenti.beancount"
include "prices.beancount"
'@
Put "ledger\accounts.beancount" @'
; generato dall'app (open + commodity)
'@
Put "ledger\movimenti.beancount" @'
; transazioni importate
'@
Put "ledger\prices.beancount" @'
; prezzi campionati
'@
Put "patrimonio.toml" @'
# righe del patrimonio
'@
Put "goals.toml" @'
# obiettivi
'@
Put "snapshots.csv" @'
date,account_id,value,currency
'@

# AGENTS.md: onboarding per un LLM che apre la cartella (duplicato in
# src/app/fs/fileSystem.ts AGENTS_MD e public/init.sh).
Put "AGENTS.md" @'
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
- `goals.toml` — obiettivi. `targets.toml` — pesi target del ribilanciamento.
- `snapshots.csv` — saldi manuali periodici. Header: `date,account_id,value,currency`.
- `config.toml` — `percorso_dati` (path assoluto, annotato dal CLI) e `[prezzi]`
  (`anni`, `intervallo`) che definisce la copertura dello storico.

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
'@

$absDir = (Resolve-Path -LiteralPath $Dir).Path
# TOML basic string: i backslash di Windows vanno raddoppiati (come JSON.stringify)
$tomlPath = $absDir -replace "\\", "\\"
$configPath = Join-Path $Dir "config.toml"
if (-not (Test-Path -LiteralPath $configPath)) {
  $config = "percorso_dati = `"$tomlPath`"`noperating_currency = `"EUR`"`ndefault_broker = `"Directa`"`npriorita = []`n`n[prezzi]`nanni = 2`nintervallo = `"1wk`"`n"
  [System.IO.File]::WriteAllText($configPath, $config, $utf8NoBom)
  Write-Host "creato config.toml (percorso annotato: $absDir)"
} elseif (-not (Select-String -Path $configPath -Pattern '^percorso_dati' -Quiet)) {
  # prepend: una chiave top-level in coda finirebbe dentro [prezzi]
  $existing = [System.IO.File]::ReadAllText($configPath)
  [System.IO.File]::WriteAllText($configPath, "percorso_dati = `"$tomlPath`"`n$existing", $utf8NoBom)
  Write-Host "annotato percorso in config.toml: $absDir"
}

Write-Host ""
Write-Host "✓ cartella dati pronta: $absDir"
$bin = Join-Path $env:LOCALAPPDATA "unportfolio\bin\unportfolio-prices.exe"
if (Test-Path -LiteralPath $bin) {
  Write-Host "  aggiorna i prezzi con: `"$bin`" `"$absDir`""
}

# --- apri il sito ---
if ($Site) {
  Write-Host "apro $Site — clicca `"Scegli la cartella dati`" e seleziona: $absDir"
  Start-Process $Site
} else {
  Write-Host "apri il sito e clicca `"Scegli la cartella dati`" selezionando: $absDir"
}
