# deploy.ps1 - Bella-Dolce Production Deployment (builds from source on this machine)
# Run from inside the extracted source folder (e.g. downloaded as a GitHub ZIP).

$IMAGE_NAME     = "bella-dolce2-bella-dolce2:latest"
$CONTAINER_NAME = "bella-dolce2"
$DATA_DIR       = "C:\Users\CD COMPANY\Bella-Dolce\data"
$BACKUP_DIR     = "C:\Users\CD COMPANY\Bella-Dolce\backups"
$CERTS_DIR      = "C:\Users\CD COMPANY\Bella-Dolce\certs"
$ENV_FILE       = "C:\Users\CD COMPANY\Bella-Dolce\.env"
$EXT_PORT       = 443
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

# Step 1: Load secrets from a stable .env outside the source folder — the source is a
# fresh download every deploy and .env is gitignored, so it can't live alongside it.
Log-Step "1/6  Loading secrets from $ENV_FILE"
if (!(Test-Path $ENV_FILE)) {
    Log-Error "$ENV_FILE not found. Create it with JWT_SECRET=... and JWT_EXPIRES_IN=... before deploying."
    exit 1
}
$envVars = @{}
Get-Content $ENV_FILE | ForEach-Object {
    if ($_ -match '^\s*([A-Z_]+)=(.*)$') {
        $envVars[$Matches[1]] = $Matches[2]
    }
}
$JWT_SECRET     = $envVars['JWT_SECRET']
$JWT_EXPIRES_IN = $envVars['JWT_EXPIRES_IN']
if (-not $JWT_SECRET -or -not $JWT_EXPIRES_IN) {
    Log-Error "JWT_SECRET or JWT_EXPIRES_IN missing from $ENV_FILE"
    exit 1
}
Log-OK "Secrets loaded"

# Step 2: Build the image from source (current directory)
Log-Step "2/6  Building image from source"
docker build -t $IMAGE_NAME .
if ($LASTEXITCODE -ne 0) {
    Log-Error "Docker build failed."
    exit 1
}
Log-OK "Image built: $IMAGE_NAME"

# Step 3: Data/backup/certs directories
Log-Step "3/6  Checking data/backup/certs directories"
foreach ($dir in @($DATA_DIR, $BACKUP_DIR, $CERTS_DIR)) {
    if (!(Test-Path $dir)) {
        Log-Info "Not found - creating $dir"
        New-Item -ItemType Directory -Path $dir | Out-Null
        Log-OK "Created: $dir"
    } else {
        Log-OK "Exists: $dir"
    }
}

# Step 4: Stop old container
Log-Step "4/6  Checking for existing container"
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
Log-Step "5/6  Starting new container"
Log-Info "Image     : $IMAGE_NAME"
Log-Info "Name      : $CONTAINER_NAME"
Log-Info "Ports     : $EXT_PORT -> $INT_PORT"
Log-Info "Data Vol  : $DATA_DIR -> /app/data"
Log-Info "DB URL    : $DB_URL"

docker run -d `
    --name $CONTAINER_NAME `
    -p "${EXT_PORT}:${INT_PORT}" `
    -e PORT=$INT_PORT `
    -e DATABASE_URL=$DB_URL `
    -e NODE_ENV=production `
    -e REDIS_URL="redis://redis:6379" `
    -e JWT_SECRET=$JWT_SECRET `
    -e JWT_EXPIRES_IN=$JWT_EXPIRES_IN `
    -v "${DATA_DIR}:/app/data" `
    -v "${BACKUP_DIR}:/app/backups" `
    -v "${CERTS_DIR}:/app/certs" `
    --restart unless-stopped `
    $IMAGE_NAME

if ($LASTEXITCODE -ne 0) {
    Log-Error "Failed to start container. Run: docker logs $CONTAINER_NAME"
    exit 1
}
Log-OK "Container started"

# Step 6: Schema sync (entrypoint.sh runs db push — wait for it to finish) + verify
Log-Step "6/6  Waiting for schema sync via entrypoint.sh"
Log-Info "Waiting 12 seconds for db push to complete..."
Start-Sleep -Seconds 12

$schemaLog = docker logs $CONTAINER_NAME 2>&1 | Select-String "schema"
if ($schemaLog) {
    Log-OK "Schema sync confirmed in startup logs"
} else {
    Log-Warn "entrypoint.sh schema log not found - running manual push as fallback..."
    docker exec $CONTAINER_NAME sh -c "npx prisma db push --accept-data-loss --skip-generate"
    if ($LASTEXITCODE -ne 0) {
        Log-Error "Schema push failed. Run: docker logs $CONTAINER_NAME"
        exit 1
    }
    Log-OK "Schema pushed manually"
}

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
