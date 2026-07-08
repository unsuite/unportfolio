#Requires -Version 5
# unportfolio — init della cartella dati (Windows / PowerShell).
#
# Uso:
#   irm <sito>/init.ps1 | iex
# oppure con parametri (cartella e/o sito):
#   & ([scriptblock]::Create((irm <sito>/init.ps1))) -Dir <cartella> -Site <url-sito>
#
# Crea la cartella dati con i file skeleton (ledger beancount + TOML/CSV),
# annota il percorso assoluto in config.toml (il browser non può rilevarlo)
# e — se passi -Site — scarica la CLI prezzi e apre il sito: lì basta un click
# su "Scegli la cartella dati" e selezionare la cartella appena creata
# (richiesto dal browser, non automatizzabile per sicurezza).
param(
  [string]$Dir  = "$HOME\Documents\unportfolio-data",
  [string]$Site = $env:SITE
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# --- CLI prezzi: binario self-contained (nessun runtime richiesto) ---
function Install-PricesBin {
  if (-not $Site) { return }
  if (-not [Environment]::Is64BitOperatingSystem) {
    Write-Host "⚠ architettura non x64: nessun binario precompilato per Windows"
    return
  }
  $binDir = Join-Path $env:LOCALAPPDATA "unportfolio\bin"
  New-Item -ItemType Directory -Force -Path $binDir | Out-Null
  $target = Join-Path $binDir "unportfolio-prices.exe"
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
