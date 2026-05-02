# deploy.ps1 - Bella-Dolce Production Deployment

$ZIP_FILE       = "bella-dolce-production.zip"
$TAR_FILE       = "bella-dolce.tar"
$IMAGE_NAME     = "bella-dolce2-bella-dolce2:latest"
$CONTAINER_NAME = "bella-dolce2"
$DATA_DIR       = "C:\Users\CD COMPANY\Bella-Dolce\data"
$BACKUP_DIR     = "C:\Users\CD COMPANY\Bella-Dolce\backups"
$EXT_PORT       = 3500
$INT_PORT       = 3000
$DB_URL         = "file:/app/data/dev.db"

function Log-Step  { param($msg) Write-Host "`n[STEP] $msg" -ForegroundColor Cyan }
function Log-Info  { param($msg) Write-Host "  >>  $msg"   -ForegroundColor White }
function Log-OK    { param($msg) Write-Host "  OK  $msg"   -ForegroundColor Green }
function Log-Warn  { param($msg) Write-Host "  !!  $msg"   -ForegroundColor Yellow }
function Log-Error { param($msg) Write-Host " ERR  $msg"   -ForegroundColor Red }

Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "   Bella-Dolce Production Deployment"        -ForegroundColor Magenta
Write-Host "   $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta

# Step 1: Unzip
Log-Step "1/7  Checking deployment package"
if (Test-Path $ZIP_FILE) {
    Log-Info "Found $ZIP_FILE - extracting..."
    Expand-Archive -Path $ZIP_FILE -DestinationPath "." -Force
    Log-OK "Extracted successfully"
} elseif (Test-Path $TAR_FILE) {
    Log-Warn "No zip found - using existing $TAR_FILE"
} else {
    Log-Error "Neither $ZIP_FILE nor $TAR_FILE found. Aborting."
    exit 1
}

# Step 2: Data directory
Log-Step "2/7  Checking data directory"
if (!(Test-Path $DATA_DIR)) {
    Log-Info "Data directory not found - creating $DATA_DIR"
    New-Item -ItemType Directory -Path $DATA_DIR | Out-Null
    Log-OK "Data directory created"
} else {
    Log-OK "Data directory exists: $DATA_DIR"
}
if (!(Test-Path $BACKUP_DIR)) {
    Log-Info "Backup directory not found - creating $BACKUP_DIR"
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
    Log-OK "Backup directory created"
} else {
    Log-OK "Backup directory exists: $BACKUP_DIR"
}

# Step 3: Load image
Log-Step "3/7  Loading Docker image (may take 1-2 minutes)"
Log-Info "Loading from $TAR_FILE into Docker..."
docker load -i $TAR_FILE
if ($LASTEXITCODE -ne 0) {
    Log-Error "Failed to load Docker image. Check that Docker Desktop is running."
    exit 1
}
Log-OK "Image loaded: $IMAGE_NAME"

# Step 4: Stop old container
Log-Step "4/7  Checking for existing container"
$existing = docker ps -a --filter "name=^/${CONTAINER_NAME}$" --format "{{.Names}}"
if ($existing -eq $CONTAINER_NAME) {
    $oldImage = docker inspect --format "{{.Image}}" $CONTAINER_NAME
    Log-Info "Found container: $CONTAINER_NAME (image: $oldImage)"
    Log-Info "Stopping container..."
    docker stop $CONTAINER_NAME | Out-Null
    Log-Info "Removing container..."
    docker rm $CONTAINER_NAME | Out-Null
    Log-OK "Old container removed"
} else {
    Log-Warn "No existing container found - fresh deployment"
}

# Step 5: Start new container
Log-Step "5/7  Starting new container"
Log-Info "Image     : $IMAGE_NAME"
Log-Info "Name      : $CONTAINER_NAME"
Log-Info "Ports     : $EXT_PORT -> $INT_PORT"
Log-Info "Data Vol  : $DATA_DIR -> /app/data"
Log-Info "DB URL    : $DB_URL"

docker run -d `
    --name $CONTAINER_NAME `
    -p "${EXT_PORT}:${INT_PORT}" `
    -e DATABASE_URL=$DB_URL `
    -e NODE_ENV=production `
    -v "${DATA_DIR}:/app/data" `
    -v "${BACKUP_DIR}:/app/backups" `
    --restart unless-stopped `
    $IMAGE_NAME

if ($LASTEXITCODE -ne 0) {
    Log-Error "Failed to start container. Run: docker logs $CONTAINER_NAME"
    exit 1
}
Log-OK "Container started"

# Step 6: Schema sync (entrypoint.sh runs db push — wait for it to finish)
Log-Step "6/7  Waiting for schema sync via entrypoint.sh"
Log-Info "Waiting 12 seconds for db push to complete..."
Start-Sleep -Seconds 12

$schemaLog = docker logs $CONTAINER_NAME 2>&1 | Select-String "schema"
if ($schemaLog) {
    Log-OK "Schema sync confirmed in startup logs"
} else {
    Log-Warn "entrypoint.sh schema log not found - running manual push as fallback..."
    docker exec $CONTAINER_NAME sh -c "npx prisma db push --accept-data-loss"
    if ($LASTEXITCODE -ne 0) {
        Log-Error "Schema push failed. Run: docker logs $CONTAINER_NAME"
        exit 1
    }
    Log-OK "Schema pushed manually"
}

# Step 7: Verify container is still running after schema sync
Log-Step "7/7  Verifying deployment"
$status  = docker ps --filter "name=^/${CONTAINER_NAME}$" --format "{{.Status}}"
$uptime  = docker ps --filter "name=^/${CONTAINER_NAME}$" --format "{{.RunningFor}}"
$imageId = docker ps --filter "name=^/${CONTAINER_NAME}$" --format "{{.Image}}"

if ($status) {
    Log-OK "Container is running"
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "   DEPLOYMENT SUCCESSFUL"                    -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  Container : $CONTAINER_NAME"               -ForegroundColor White
    Write-Host "  Status    : $status"                       -ForegroundColor White
    Write-Host "  Uptime    : $uptime"                       -ForegroundColor White
    Write-Host "  Image     : $imageId"                      -ForegroundColor White
    Write-Host "  App URL   : https://localhost:$EXT_PORT"    -ForegroundColor White
    Write-Host "  Data Dir  : $DATA_DIR"                     -ForegroundColor White
    Write-Host "  Backups   : $BACKUP_DIR"                   -ForegroundColor White
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
} else {
    Log-Error "Container is NOT running after startup."
    Log-Error "Check logs with: docker logs $CONTAINER_NAME"
    exit 1
}