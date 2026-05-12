$root = "C:\BellaDolce\PrintAgent\src\BellaDolce.PrintAgent"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Building Bella Dolce Print Agent" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check dotnet installed
$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnet) {
    Write-Host "ERROR: .NET SDK not installed" -ForegroundColor Red
    Write-Host "Download from: https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor Yellow
    exit 1
}

Write-Host "dotnet version:" -ForegroundColor Gray
dotnet --version
Write-Host ""

# Restore packages
Write-Host "Restoring packages..." -ForegroundColor Yellow
dotnet restore $root\BellaDolce.PrintAgent.csproj
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Restore failed" -ForegroundColor Red
    exit 1
}
Write-Host "Restore complete" -ForegroundColor Green
Write-Host ""

# Build Release
Write-Host "Building Release..." -ForegroundColor Yellow
dotnet build $root\BellaDolce.PrintAgent.csproj -c Release --no-restore
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "Build complete" -ForegroundColor Green
Write-Host ""

# Publish self-contained
Write-Host "Publishing self-contained exe..." -ForegroundColor Yellow
dotnet publish $root\BellaDolce.PrintAgent.csproj -c Release -o C:\BellaDolce\PrintAgent\publish --self-contained -r win-x64
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Publish failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  BUILD SUCCESS" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "EXE location: C:\BellaDolce\PrintAgent\publish\BellaDolce.PrintAgent.exe" -ForegroundColor Cyan
Write-Host ""
Write-Host "To run emulator:" -ForegroundColor Yellow
Write-Host "  cd C:\BellaDolce\PrintAgent\publish" -ForegroundColor White
Write-Host "  .\BellaDolce.PrintAgent.exe" -ForegroundColor White