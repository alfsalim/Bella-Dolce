# ============================================
# BellaDolce Print Agent — Smart Installer
# Run in PowerShell as Administrator
# ============================================

$serviceName = "BellaDolcePrintAgent"
$displayName = "Bella Dolce Print Agent"
$description = "Thermal receipt printer agent for Bella Dolce POS system"
$installPath = "C:\BellaDolce\PrintAgent"
$exePath = "$installPath\BellaDolce.PrintAgent.exe"
$configPath = "$installPath\appsettings.json"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Bella Dolce Print Agent — Installer" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# CHECK ADMIN
# ============================================
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Run this script as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell > Run as Administrator" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Running as Administrator" -ForegroundColor Green

# ============================================
# CHECK PUBLISH FOLDER EXISTS
# ============================================
$publishSource = Split-Path -Parent $PSScriptRoot
$publishFolder = "$publishSource\publish"

if (-not (Test-Path "$publishFolder\BellaDolce.PrintAgent.exe")) {
    Write-Host ""
    Write-Host "ERROR: Published exe not found at:" -ForegroundColor Red
    Write-Host "  $publishFolder\BellaDolce.PrintAgent.exe" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Run this first:" -ForegroundColor Yellow
    Write-Host "  cd $publishSource\src\BellaDolce.PrintAgent" -ForegroundColor White
    Write-Host '  dotnet publish -c Release -r win-x64 --self-contained true -o "' + $publishFolder + '"' -ForegroundColor White
    exit 1
}
Write-Host "[OK] Published exe found" -ForegroundColor Green

# ============================================
# STOP EXISTING SERVICE IF RUNNING
# ============================================
$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host ""
    Write-Host "Existing service found. Stopping..." -ForegroundColor Yellow
    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    sc.exe delete $serviceName | Out-Null
    Start-Sleep -Seconds 2
    Write-Host "[OK] Old service removed" -ForegroundColor Green
}

# ============================================
# COPY FILES TO INSTALL PATH
# ============================================
Write-Host ""
Write-Host "Copying files to $installPath ..." -ForegroundColor Yellow

if (Test-Path $installPath) {
    Remove-Item "$installPath\*" -Recurse -Force -ErrorAction SilentlyContinue
}
else {
    New-Item -ItemType Directory -Path $installPath -Force | Out-Null
}

Copy-Item -Path "$publishFolder\*" -Destination $installPath -Recurse -Force
New-Item -ItemType Directory -Path "$installPath\logs" -Force | Out-Null
New-Item -ItemType Directory -Path "$installPath\output" -Force | Out-Null

Write-Host "[OK] Files copied" -ForegroundColor Green

# ============================================
# DETECT PRINTERS
# ============================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Printer Selection" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$printers = Get-Printer | Where-Object { $_.Name -notlike "Microsoft*" -and $_.Name -notlike "Fax*" -and $_.Name -notlike "OneNote*" }

if ($printers.Count -eq 0) {
    Write-Host "No physical printers detected." -ForegroundColor Yellow
    Write-Host "Defaulting to EMULATOR mode." -ForegroundColor Yellow
    $selectedMode = "emulator"
    $selectedPrinter = ""
}
else {
    Write-Host "Found $($printers.Count) printer(s):" -ForegroundColor White
    Write-Host ""

    $i = 1
    foreach ($p in $printers) {
        $driver = if ($p.DriverName) { $p.DriverName } else { "Unknown driver" }
        $port = if ($p.PortName) { $p.PortName } else { "Unknown port" }
        Write-Host "  [$i] $($p.Name)" -ForegroundColor White -NoNewline
        Write-Host "  ($driver — $port)" -ForegroundColor Gray
        $i++
    }

    Write-Host ""
    Write-Host "  [0] Skip — use EMULATOR mode (no real printing)" -ForegroundColor DarkGray
    Write-Host ""

    do {
        $selection = Read-Host "Select printer [0-$($printers.Count)]"
    } while ($selection -notmatch '^\d+$' -or [int]$selection -lt 0 -or [int]$selection -gt $printers.Count)

    $selection = [int]$selection

    if ($selection -eq 0) {
        $selectedMode = "emulator"
        $selectedPrinter = ""
        Write-Host ""
        Write-Host "[OK] EMULATOR mode selected" -ForegroundColor Green
    }
    else {
        $selectedMode = "thermal"
        $selectedPrinter = $printers[$selection - 1].Name
        Write-Host ""
        Write-Host "[OK] Printer selected: $selectedPrinter" -ForegroundColor Green
    }
}

# ============================================
# WRITE APPSETTINGS.JSON
# ============================================
$config = @{
    PrintAgent = @{
        Mode               = $selectedMode
        PrinterName        = $selectedPrinter
        Port               = 5555
        EmulatorOutputFolder = "$installPath\output"
    }
    Logging = @{
        LogLevel = @{
            Default = "Information"
        }
    }
} | ConvertTo-Json -Depth 3

Set-Content -Path $configPath -Value $config -Encoding UTF8
Write-Host "[OK] Configuration saved" -ForegroundColor Green

# ============================================
# INSTALL AS WINDOWS SERVICE
# ============================================
Write-Host ""
Write-Host "Installing Windows Service..." -ForegroundColor Yellow

sc.exe create $serviceName binPath= "`"$exePath`"" start= auto DisplayName= "`"$displayName`"" | Out-Null
sc.exe description $serviceName "`"$description`"" | Out-Null
sc.exe failure $serviceName reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null

Write-Host "[OK] Service installed" -ForegroundColor Green

# ============================================
# START SERVICE
# ============================================
Write-Host "Starting service..." -ForegroundColor Yellow
Start-Service -Name $serviceName
Start-Sleep -Seconds 3

$svc = Get-Service -Name $serviceName
if ($svc.Status -eq "Running") {
    Write-Host "[OK] Service running" -ForegroundColor Green
}
else {
    Write-Host "[WARN] Service status: $($svc.Status)" -ForegroundColor Yellow
    Write-Host "Check logs at: $installPath\logs\" -ForegroundColor Yellow
}

# ============================================
# HEALTH CHECK
# ============================================
Write-Host ""
Write-Host "Testing health endpoint..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5555/health" -TimeoutSec 5
    Write-Host "[OK] Agent responding: $($response.status)" -ForegroundColor Green
}
catch {
    Write-Host "[WARN] Agent not responding yet. May need a few seconds." -ForegroundColor Yellow
}

# ============================================
# DONE
# ============================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  INSTALLATION COMPLETE" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Mode:     $selectedMode" -ForegroundColor White
if ($selectedPrinter) {
    Write-Host "  Printer:  $selectedPrinter" -ForegroundColor White
}
Write-Host "  Port:     5555" -ForegroundColor White
Write-Host "  Logs:     $installPath\logs\" -ForegroundColor White
Write-Host "  Config:   $configPath" -ForegroundColor White
Write-Host ""
Write-Host "  To change printer later:" -ForegroundColor Yellow
Write-Host "    1. Edit $configPath" -ForegroundColor White
Write-Host "    2. Change PrinterName and Mode" -ForegroundColor White
Write-Host "    3. Restart-Service $serviceName" -ForegroundColor White
Write-Host ""
Write-Host "  Or re-run this installer to pick a new printer." -ForegroundColor Yellow
Write-Host ""