# PrivacyPrint connector — one-time Windows install (PowerShell, admin NOT required).
#
# Copies the connector to %LOCALAPPDATA%\PrivacyPrint\connector, writes a
# pre-authenticated .env, bundles SumatraPDF (real printing needs it on
# Windows) and registers an auto-start on login. After this the shopkeeper
# does nothing: the connector stays online and any installed printer is used
# automatically (PRINTER_NAME is intentionally NOT set).
#
#   powershell -ExecutionPolicy Bypass -File install-windows.ps1 -ApiUrl https://api.example.com -TenantId TENANT-002 -Passcode privacyprint-demo
param(
  [string]$ApiUrl = "http://localhost:3001",
  [Parameter(Mandatory = $true)][string]$TenantId,
  [string]$Passcode = "privacyprint-demo",
  [string]$SourceDir = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
$InstallRoot = Join-Path $env:LOCALAPPDATA "PrivacyPrint"
$Dest = Join-Path $InstallRoot "connector"
$SumatraDir = Join-Path $InstallRoot "sumatra"
$SumatraExe = Join-Path $SumatraDir "SumatraPDF.exe"
$SumatraUrl = "https://www.sumatrapdfreader.org/dl/rel/SumatraPDF-prerel.zip"

Write-Host "Installing PrivacyPrint connector..."
New-Item -ItemType Directory -Force -Path $Dest, $SumatraDir | Out-Null

# Copy the connector sources (no node_modules needed — zero runtime deps).
Copy-Item -Recurse -Force -Path (Join-Path $SourceDir "src"), (Join-Path $SourceDir "package.json") -Destination $Dest

# Node.js check with an actionable message.
try { $null = node --version } catch {
  Write-Error "Node.js >= 18 is required (https://nodejs.org). Install it, then re-run this installer."
  exit 1
}

# SumatraPDF: required for real printing on Windows. Download if missing.
if (-not (Test-Path $SumatraExe)) {
  Write-Host "Downloading SumatraPDF (needed for real printing on Windows)..."
  $zip = Join-Path $env:TEMP "SumatraPDF.zip"
  Invoke-WebRequest -Uri $SumatraUrl -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath $SumatraDir -Force
  Remove-Item $zip
  # The zip may nest the exe one level deep.
  if (-not (Test-Path $SumatraExe)) {
    $found = Get-ChildItem -Recurse -Filter "SumatraPDF.exe" -Path $SumatraDir | Select-Object -First 1
    if ($found) { Copy-Item $found.FullName $SumatraExe }
  }
  if (-not (Test-Path $SumatraExe)) {
    Write-Warning "SumatraPDF could not be fetched — the connector will run in PDF fallback mode. Re-run the installer later or download SumatraPDF manually and place it at $SumatraExe."
  }
}

$envFile = Join-Path $Dest ".env"
@"
API_BASE_URL=$ApiUrl
SHOP_TENANT_ID=$TenantId
SHOP_PASSCODE=$Passcode
POLL_INTERVAL_MS=3000
WIN_PRINT_TOOL=$SumatraExe
"@ | Set-Content -Encoding UTF8 -Path $envFile

# Auto-start on login for the current user.
$taskName = "PrivacyPrintConnector"
$action = New-ScheduledTaskAction -Execute "node" -Argument "--env-file=.env src\index.js" -WorkingDirectory $Dest
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host ""
Write-Host "Installed and started. It will run at every login."
Write-Host "  status:   Get-ScheduledTask $taskName | Get-ScheduledTaskInfo"
Write-Host "  printers: cd '$Dest'; npm run printers  (or run src\listPrinters.js)"
Write-Host "Plug the printer in over USB or Wi-Fi and install its driver — it is picked up automatically."
