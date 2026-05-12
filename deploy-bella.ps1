# ── Configuration ────────────────────────────────────────
$IMAGE_NAME = "bella-dolce2-bella-dolce2:latest"
$TAR_FILE = "bella-dolce.tar"
$CONTAINER_NAME = "bella-dolce2"
$EXT_PORT = 3500
$INT_PORT = 3500
$DB_URL = "file:/app/data/dev.db"

# ── Production (Windows Prod) ────────────────────────────
$PROD_DATA_DIR = "C:/Users/CD COMPANY/Bella-Dolce/data"
$PROD_BACKUP_DIR = "C:/Users/CD COMPANY/Bella-Dolce/backups"
$WINDOWS_TAILSCALE_IP = "100.114.12.38"

# ── Dev (Windows local) ─────────────────────────────────
$DEV_CONTAINER_NAME = "bella-dolce2-dev"
$DEV_EXT_PORT = 3501
$DEV_DATA_DIR = "$env:USERPROFILE\bella-dolce-data"
$DEV_BACKUP_DIR = "$env:USERPROFILE\bella-dolce-backups"

# ── Helpers ──────────────────────────────────────────────
function Log-Step($msg)  { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Log-Ok($msg)    { Write-Host "   OK $msg" -ForegroundColor Green }
function Log-Info($msg)  { Write-Host "   >> $msg" -ForegroundColor Gray }
function Log-Warn($msg)  { Write-Host "   !! $msg" -ForegroundColor Yellow }
function Log-Err($msg)   { Write-Host "   ERR $msg" -ForegroundColor Red; exit 1 }

function Schema-Sync {
    param(
        [string]$ContainerName,
        [string]$DockerHost = ""
    )
    Log-Info "Waiting 12s for entrypoint.sh db push to complete..."
    Start-Sleep -Seconds 12

    $envArgs = @()
    if ($DockerHost -ne "") {
        $env:DOCKER_HOST = $DockerHost
    }

    $logs = docker logs $ContainerName 2>&1 | Out-String

    if ($logs -match "schema|prisma|Starting server") {
        Log-Ok "Schema sync confirmed in startup logs"
    } else {
        Log-Warn "Schema log not found - running manual db push..."
        docker exec $ContainerName sh -c "npx prisma db push --accept-data-loss --skip-generate"
        if ($LASTEXITCODE -ne 0) { Log-Err "Schema push failed. Check: docker logs $ContainerName" }
        Log-Ok "Schema pushed manually"
    }

    if ($DockerHost -ne "") {
        Remove-Item Env:\DOCKER_HOST -ErrorAction SilentlyContinue
    }
}

# ── Parse arguments ──────────────────────────────────────
$MODE = $args[0]
if ($MODE -ne "--prod" -and $MODE -ne "--dev") {
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  .\deploy-bella.ps1 --dev   Deploy locally on Windows (port $DEV_EXT_PORT)"
    Write-Host "  .\deploy-bella.ps1 --prod  Deploy to Prod Windows Server (port $EXT_PORT)"
    Write-Host ""
    exit 1
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host ""
Write-Host "============================================"
if ($MODE -eq "--dev") {
    Write-Host "  Bella-Dolce DEV Deployment (Windows)"
} else {
    Write-Host "  Bella-Dolce PROD Deployment (Windows)"
}
Write-Host "  $timestamp"
Write-Host "============================================"

# ════════════════════════════════════════════════
# GIT OPERATIONS — Commit and Push changes
# ════════════════════════════════════════════════
Log-Step "0/4 Git: Add, Commit, and Push changes"

# Check if there are changes
$gitStatus = git status --porcelain 2>&1
if ($LASTEXITCODE -ne 0) {
    Log-Warn "Git command failed - skipping git operations"
} elseif ([string]::IsNullOrWhiteSpace($gitStatus)) {
    Log-Info "No changes to commit"
} else {
    Log-Info "Changes detected - committing..."
    Log-Info "Changes: `n$gitStatus"

    # Add all changes
    git add -A
    if ($LASTEXITCODE -ne 0) { Log-Err "Git add failed" }
    Log-Ok "Changes staged"

    # Commit with timestamp
    $commitMsg = "Deploy: $timestamp"
    git commit -m $commitMsg
    if ($LASTEXITCODE -ne 0) { Log-Err "Git commit failed" }
    Log-Ok "Committed: $commitMsg"

    # Push to remote
    Log-Info "Pushing to remote..."
    git push
    if ($LASTEXITCODE -ne 0) { Log-Warn "Git push failed - continuing with deployment" }
    Log-Ok "Changes pushed to remote"
}

# ════════════════════════════════════════════════
# DEV MODE — local Windows Docker
# ════════════════════════════════════════════════
if ($MODE -eq "--dev") {

    # Step 1: Build image
    Log-Step "1/4 Building image for local Windows"
    Log-Info "Image: $IMAGE_NAME"
    docker build -t $IMAGE_NAME .
    if ($LASTEXITCODE -ne 0) { Log-Err "Docker build failed." }
    Log-Ok "Image built"

    # Step 2: Ensure dev data directory exists
    Log-Step "2/4 Checking dev data directory"
    if (-not (Test-Path $DEV_DATA_DIR)) {
        Log-Warn "Dev data dir not found - creating $DEV_DATA_DIR"
        New-Item -ItemType Directory -Path $DEV_DATA_DIR -Force | Out-Null
        Log-Ok "Created: $DEV_DATA_DIR"
    } else {
        Log-Ok "Dev data exists - preserving: $DEV_DATA_DIR"
    }
    if (-not (Test-Path $DEV_BACKUP_DIR)) {
        New-Item -ItemType Directory -Path $DEV_BACKUP_DIR -Force | Out-Null
    }

    # Step 3: Stop old dev container and start new one
    Log-Step "3/4 Starting dev container"
    $existing = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq $DEV_CONTAINER_NAME }
    if ($existing) {
        Log-Info "Stopping old dev container..."
        docker stop $DEV_CONTAINER_NAME 2>$null | Out-Null
        docker rm $DEV_CONTAINER_NAME 2>$null | Out-Null
        Log-Ok "Old dev container removed"
    }

    docker run -d `
        --name $DEV_CONTAINER_NAME `
        -p "${DEV_EXT_PORT}:${INT_PORT}" `
        -e "DATABASE_URL=$DB_URL" `
        -e "NODE_ENV=production" `
        -e "BELLA_HTTP_ONLY=1" `
        -v "${DEV_DATA_DIR}:/app/data" `
        -v "${DEV_BACKUP_DIR}:/app/backups" `
        --restart unless-stopped `
        $IMAGE_NAME
    if ($LASTEXITCODE -ne 0) { Log-Err "Failed to start dev container." }

    # Step 4: Schema sync
    Log-Step "4/4 Schema sync"
    Schema-Sync -ContainerName $DEV_CONTAINER_NAME

    $status = docker ps --filter "name=$DEV_CONTAINER_NAME" --format "{{.Status}}"
    Write-Host ""
    Write-Host "============================================"
    Write-Host "  DEV DEPLOYMENT COMPLETE"
    Write-Host "  Container : $DEV_CONTAINER_NAME"
    Write-Host "  Status    : $status"
    Write-Host "  App URL   : http://localhost:$DEV_EXT_PORT"
    Write-Host "  Data Dir  : $DEV_DATA_DIR"
    Write-Host "============================================"
    exit 0
}

# ════════════════════════════════════════════════
# PROD MODE — Deploy to Windows Prod via Tailscale
# ════════════════════════════════════════════════

$REMOTE = "tcp://${WINDOWS_TAILSCALE_IP}:2375"

# Step 1: Stop old container on Prod
Log-Step "1/3 Connecting to Prod Windows via Tailscale"
Log-Info "Target: ${WINDOWS_TAILSCALE_IP}:2375"
Log-Info "Stopping old container..."
$env:DOCKER_HOST = $REMOTE
docker stop $CONTAINER_NAME 2>$null | Out-Null
docker rm $CONTAINER_NAME 2>$null | Out-Null
Remove-Item Env:\DOCKER_HOST -ErrorAction SilentlyContinue

# Step 2: Build and push image
Log-Step "2/3 Building and pushing image"

# Check if base image exists on prod
$env:DOCKER_HOST = $REMOTE
$baseCheck = docker image inspect node:24-slim 2>$null
Remove-Item Env:\DOCKER_HOST -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    # Fast path — base image cached on Prod, build remotely
    Log-Info "Base image cached on Prod - remote build"
    $env:DOCKER_HOST = $REMOTE
    docker build --platform linux/amd64 -t $IMAGE_NAME .
    $buildResult = $LASTEXITCODE
    Remove-Item Env:\DOCKER_HOST -ErrorAction SilentlyContinue
    if ($buildResult -ne 0) { Log-Err "Remote build failed on Prod." }
} else {
    # Cold path — build locally and push
    Log-Info "Base image not on Prod - building locally and pushing"
    docker build --platform linux/amd64 -t $IMAGE_NAME .
    if ($LASTEXITCODE -ne 0) { Log-Err "Local build failed." }

    Log-Info "Saving and transferring image (this may take a few minutes)..."
    docker save $IMAGE_NAME | docker -H $REMOTE load
    if ($LASTEXITCODE -ne 0) { Log-Err "Failed to push image to Prod." }

    # Seed base image on Prod for future fast builds
    Log-Info "Seeding node:24-slim to Prod for future builds..."
    docker pull --platform linux/amd64 node:24-slim 2>$null
    docker save node:24-slim | docker -H $REMOTE load
    Log-Ok "Base image seeded on Prod"
}
Log-Ok "Image ready on Prod"

# Step 3: Start container on Prod
Log-Step "3/3 Starting container on Prod"
$env:DOCKER_HOST = $REMOTE
docker run -d `
    --name $CONTAINER_NAME `
    -p "${EXT_PORT}:${INT_PORT}" `
    -e "DATABASE_URL=$DB_URL" `
    -e "NODE_ENV=production" `
    -e "BELLA_HTTP_ONLY=1" `
    -v "${PROD_DATA_DIR}:/app/data" `
    -v "${PROD_BACKUP_DIR}:/app/backups" `
    --restart unless-stopped `
    $IMAGE_NAME
if ($LASTEXITCODE -ne 0) {
    Remove-Item Env:\DOCKER_HOST -ErrorAction SilentlyContinue
    Log-Err "Failed to start container on Prod."
}
Remove-Item Env:\DOCKER_HOST -ErrorAction SilentlyContinue

# Schema sync
Log-Step "3b/3 Schema sync"
Schema-Sync -ContainerName $CONTAINER_NAME -DockerHost $REMOTE

$env:DOCKER_HOST = $REMOTE
$status = docker ps --filter "name=$CONTAINER_NAME" --format "{{.Status}}"
Remove-Item Env:\DOCKER_HOST -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "============================================"
Write-Host "  PROD DEPLOYMENT COMPLETE (Tailscale)"
Write-Host "  Status  : $status"
Write-Host "  App URL : https://${WINDOWS_TAILSCALE_IP}:${EXT_PORT}"
Write-Host "============================================"