#!/bin/bash

# ── Configuration ────────────────────────────────────────
IMAGE_NAME="bella-dolce2-bella-dolce2:latest"
TAR_FILE="bella-dolce.tar"
ZIP_FILE="bella-dolce-production.zip"
CONTAINER_NAME="bella-dolce2"
EXT_PORT=3500
INT_PORT=3000
DB_URL="file:/app/data/dev.db"

# ── Production (Windows) ─────────────────────────────────
PROD_DATA_DIR="C:/Users/CD COMPANY/Bella-Dolce/data"
WINDOWS_TAILSCALE_IP="100.114.12.38"     # fill after Tailscale setup
DEPLOY_MODE="manual"         # change to "tailscale" later

# ── Dev (Mac local) ──────────────────────────────────────
DEV_CONTAINER_NAME="bella-dolce2-dev"
DEV_EXT_PORT=3501
DEV_DATA_DIR="$HOME/bella-dolce-data"   # persisted on Mac, never overwritten

# ── Helpers ──────────────────────────────────────────────
log_step() { echo ""; echo "▶▶ $1"; }
log_ok()   { echo "   ✅ $1"; }
log_info() { echo "   ℹ  $1"; }
log_warn() { echo "   ⚠️  $1"; }
log_err()  { echo "   ❌ $1"; exit 1; }

# ── Usage ────────────────────────────────────────────────
MODE=$1
if [ "$MODE" != "--prod" ] && [ "$MODE" != "--dev" ]; then
    echo ""
    echo "Usage:"
    echo "  ./deploy-bella.sh --dev     Deploy locally on Mac (port $DEV_EXT_PORT)"
    echo "  ./deploy-bella.sh --prod    Deploy to Windows Server (port $EXT_PORT)"
    echo ""
    exit 1
fi

echo ""
echo "============================================"
if [ "$MODE" = "--dev" ]; then
    echo "   Bella-Dolce DEV Deployment (Mac)"
else
    echo "   Bella-Dolce PROD Deployment (Windows)"
fi
echo "   $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# ════════════════════════════════════════════════
#   DEV MODE — local Mac Docker
# ════════════════════════════════════════════════
if [ "$MODE" = "--dev" ]; then

    # Step 1: Build for local ARM (native Mac M3)
    log_step "1/3  Building image for local Mac (linux/arm64)"
    log_info "Image    : $IMAGE_NAME"
    log_info "Platform : native ARM64 (Mac M3)"
    docker build -t "$IMAGE_NAME" .
    [ $? -ne 0 ] && log_err "Docker build failed."
    log_ok "Image built"

    # Step 2: Ensure dev data directory exists — never wipe it
    log_step "2/3  Checking dev data directory"
    if [ ! -d "$DEV_DATA_DIR" ]; then
        log_warn "Dev data dir not found — creating $DEV_DATA_DIR"
        mkdir -p "$DEV_DATA_DIR"
        log_ok "Created: $DEV_DATA_DIR"
    else
        log_ok "Dev data exists — preserving: $DEV_DATA_DIR"
    fi

    # Step 3: Stop old dev container (data is safe on host)
    log_step "3/3  Starting dev container"
    if docker ps -a --format "{{.Names}}" | grep -q "^${DEV_CONTAINER_NAME}$"; then
        log_info "Stopping old dev container..."
        docker stop "$DEV_CONTAINER_NAME" | Out-Null 2>/dev/null
        docker rm "$DEV_CONTAINER_NAME" > /dev/null 2>&1
        log_ok "Old dev container removed"
    fi

    docker run -d \
        --name "$DEV_CONTAINER_NAME" \
        -p "$DEV_EXT_PORT:$INT_PORT" \
        -e DATABASE_URL=$DB_URL \
        -e NODE_ENV=production \
        -v "$DEV_DATA_DIR:/app/data" \
        --restart unless-stopped \
        "$IMAGE_NAME"
    [ $? -ne 0 ] && log_err "Failed to start dev container."

    sleep 3
    STATUS=$(docker ps --filter "name=$DEV_CONTAINER_NAME" --format "{{.Status}}")
    echo ""
    echo "============================================"
    echo "   DEV DEPLOYMENT COMPLETE"
    echo "   Container : $DEV_CONTAINER_NAME"
    echo "   Status    : $STATUS"
    echo "   App URL   : http://localhost:$DEV_EXT_PORT"
    echo "   Data Dir  : $DEV_DATA_DIR"
    echo "   NOTE: Data is separate from production"
    echo "============================================"
    exit 0
fi

# ════════════════════════════════════════════════
#   PROD MODE — Windows Server
# ════════════════════════════════════════════════

# Step 1: Build for linux/amd64
log_step "1/4  Building image for linux/amd64 (Windows target)"
log_info "Platform : linux/amd64"
log_info "Image    : $IMAGE_NAME"
docker buildx build --platform linux/amd64 -t "$IMAGE_NAME" --load .
[ $? -ne 0 ] && log_err "Docker build failed."
log_ok "Image built successfully"

# Step 2: Save image
log_step "2/4  Saving image to tar"
docker save "$IMAGE_NAME" > "$TAR_FILE"
[ $? -ne 0 ] && log_err "Failed to save image."
SIZE=$(du -sh "$TAR_FILE" | cut -f1)
log_ok "Saved: $TAR_FILE ($SIZE)"

if [ "$DEPLOY_MODE" = "tailscale" ] && [ -n "$WINDOWS_TAILSCALE_IP" ]; then

    # ── Tailscale Direct Deploy ───────────────────────────
    log_step "3/4  Deploying directly to Windows via Tailscale"
    log_info "Target : $WINDOWS_TAILSCALE_IP:2375"
    log_info "Stopping old container on Windows..."
    DOCKER_HOST="tcp://$WINDOWS_TAILSCALE_IP:2375" docker stop $CONTAINER_NAME 2>/dev/null
    DOCKER_HOST="tcp://$WINDOWS_TAILSCALE_IP:2375" docker rm $CONTAINER_NAME 2>/dev/null

    log_step "4/4  Pushing image and starting container"
    log_info "Streaming image to Windows Docker..."
    docker save "$IMAGE_NAME" | DOCKER_HOST="tcp://$WINDOWS_TAILSCALE_IP:2375" docker load
    [ $? -ne 0 ] && log_err "Failed to push image to Windows."

    DOCKER_HOST="tcp://$WINDOWS_TAILSCALE_IP:2375" docker run -d \
        --name $CONTAINER_NAME \
        -p "$EXT_PORT:$INT_PORT" \
        -e DATABASE_URL=$DB_URL \
        -e NODE_ENV=production \
        -v "$PROD_DATA_DIR:/app/data" \
        --restart unless-stopped \
        "$IMAGE_NAME"
    [ $? -ne 0 ] && log_err "Failed to start container on Windows."

    STATUS=$(DOCKER_HOST="tcp://$WINDOWS_TAILSCALE_IP:2375" docker ps --filter "name=$CONTAINER_NAME" --format "{{.Status}}")
    echo ""
    echo "============================================"
    echo "   PROD DEPLOYMENT COMPLETE (Tailscale)"
    echo "   Status  : $STATUS"
    echo "   App URL : http://$WINDOWS_TAILSCALE_IP:$EXT_PORT"
    echo "============================================"

else

    # ── Manual Deploy ─────────────────────────────────────
    log_step "3/4  Packaging for manual transfer"
    zip "$ZIP_FILE" "$TAR_FILE"
    [ $? -ne 0 ] && log_err "Failed to create zip."
    ZIP_SIZE=$(du -sh "$ZIP_FILE" | cut -f1)
    log_ok "Package ready: $ZIP_FILE ($ZIP_SIZE)"

    log_step "4/4  Transfer instructions"
    echo ""
    echo "============================================"
    echo "   PROD PACKAGE READY — MANUAL DEPLOY"
    echo "============================================"
    echo "  File     : $ZIP_FILE ($ZIP_SIZE)"
    echo "  Transfer : Copy to Windows Bella-Dolce folder"
    echo "  Deploy   : Run deploy.ps1 on Windows"
    echo ""
    echo "  To enable auto-deploy via Tailscale:"
    echo "  1. Install Tailscale on Windows + Mac"
    echo "  2. Set WINDOWS_TAILSCALE_IP in this script"
    echo "  3. Set DEPLOY_MODE=tailscale"
    echo "============================================"

fi