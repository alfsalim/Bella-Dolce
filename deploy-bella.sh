#!/bin/bash

# ── Configuration ────────────────────────────────────────
# Prisma: this app ships schema only — containers run `prisma db push` (see entrypoint.sh).
# Do not add empty/placeholder migrations: they break `migrate deploy` (DB with only _prisma_migrations).
# If prod ever had a bad migrate, `db push` on startup still materializes all tables from schema.prisma.

IMAGE_NAME="bella-dolce2-bella-dolce2:latest"
TAR_FILE="bella-dolce.tar"
ZIP_FILE="bella-dolce-production.zip"
CONTAINER_NAME="bella-dolce2"
EXT_PORT=8443
INT_PORT=3000
DB_URL="file:/app/data/dev.db"
JWT_SECRET="${JWT_SECRET:-$(grep '^JWT_SECRET=' "$(dirname "$0")/.env" 2>/dev/null | cut -d= -f2-)}"
JWT_EXPIRES_IN="${JWT_EXPIRES_IN:-$(grep '^JWT_EXPIRES_IN=' "$(dirname "$0")/.env" 2>/dev/null | cut -d= -f2-)}"

# ── Production (Windows) ─────────────────────────────────
PROD_DATA_DIR="C:/Users/CD COMPANY/Bella-Dolce/data"
PROD_BACKUP_DIR="C:/Users/CD COMPANY/Bella-Dolce/backups"
PROD_CERTS_DIR="C:/Users/CD COMPANY/Bella-Dolce/certs"
WINDOWS_TAILSCALE_IP="100.114.12.38"
DEPLOY_MODE="${DEPLOY_MODE:-tailscale}"          # "tailscale", "ssh", or "manual"

# SSH mode: for machines that can't install Tailscale — tunnels to the Windows
# Docker daemon through another machine that IS already on the tailnet.
# Usage: DEPLOY_MODE=ssh SSH_JUMP_HOST=user@host ./deploy-bella.sh --prod
SSH_JUMP_HOST="${SSH_JUMP_HOST:-}"
SSH_TUNNEL_PORT="${SSH_TUNNEL_PORT:-2375}"
# Forward target on the far side of the tunnel: the Windows Tailscale IP if
# SSH_JUMP_HOST is a separate machine, or "localhost" if SSH_JUMP_HOST IS the
# Windows box itself (reached directly via its public IP/SSH).
SSH_REMOTE_HOST="${SSH_REMOTE_HOST:-$WINDOWS_TAILSCALE_IP}"

# ── Dev (Mac local) ──────────────────────────────────────
DEV_CONTAINER_NAME="bella-dolce2-dev"
DEV_EXT_PORT=3501
DEV_DATA_DIR="$HOME/bella-dolce-data"

# ── Helpers ──────────────────────────────────────────────
log_step() { echo ""; echo ">> $1"; }
log_ok()   { echo "   OK  $1"; }
log_info() { echo "   >>  $1"; }
log_warn() { echo "   !!  $1"; }
log_err()  { echo "   ERR $1"; exit 1; }

# ── Schema sync helper ────────────────────────────────────
# Usage: schema_sync <container_name> [docker_host]
schema_sync() {
    local container=$1
    local dhost=${2:-""}
    log_info "Waiting 12s for entrypoint.sh db push to complete..."
    sleep 12
    local logs
    if [ -n "$dhost" ]; then
        logs=$(DOCKER_HOST="$dhost" docker logs "$container" 2>&1)
    else
        logs=$(docker logs "$container" 2>&1)
    fi
    if echo "$logs" | grep -qi "schema\|prisma\|Starting server"; then
        log_ok "Schema sync confirmed in startup logs"
    else
        log_warn "Schema log not found — running manual db push as fallback..."
        if [ -n "$dhost" ]; then
            DOCKER_HOST="$dhost" docker exec "$container" sh -c "npx prisma db push --accept-data-loss --skip-generate"
        else
            docker exec "$container" sh -c "npx prisma db push --accept-data-loss --skip-generate"
        fi
        [ $? -ne 0 ] && log_err "Schema push failed. Check: docker logs $container"
        log_ok "Schema pushed manually"
    fi
}

# ── Incremental: rebuild frontend, copy dist/ into container ──
incremental_frontend() {
    local container=$1 dhost=${2:-""}
    log_step "Incremental: rebuilding frontend"
    npm run build
    [ $? -ne 0 ] && log_err "npm run build failed"
    log_ok "Frontend built"
    if [ -n "$dhost" ]; then
        DOCKER_HOST="$dhost" docker cp dist/. "$container":/app/dist/
    else
        docker cp dist/. "$container":/app/dist/
    fi
    [ $? -ne 0 ] && log_err "docker cp dist/ failed"
    log_ok "Frontend files updated (no restart needed)"
}

# ── Incremental: copy server files + restart container ────────
incremental_server() {
    local container=$1 dhost=${2:-""}
    log_step "Incremental: copying server files + restarting"
    for f in server.ts app.config.ts; do
        if echo "$CHANGED_FILES" | grep -qF "$f"; then
            if [ -n "$dhost" ]; then
                DOCKER_HOST="$dhost" docker cp "$f" "$container":/app/"$f"
            else
                docker cp "$f" "$container":/app/"$f"
            fi
            [ $? -ne 0 ] && log_err "docker cp $f failed"
            log_ok "Copied $f"
        fi
    done
    if [ -n "$dhost" ]; then
        DOCKER_HOST="$dhost" docker restart "$container"
    else
        docker restart "$container"
    fi
    [ $? -ne 0 ] && log_err "docker restart $container failed"
    log_ok "Container restarted"
}

# ── Guard: fallback to full if container not running or port mapping wrong ──────────
incremental_guard() {
    local container=$1 dhost=${2:-""}
    local running
    if [ -n "$dhost" ]; then
        running=$(DOCKER_HOST="$dhost" docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null)
    else
        running=$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null)
    fi
    if [ "$running" != "true" ]; then
        log_warn "Container $container is not running — falling back to full deploy"
        DEPLOY_TYPE="full"
        return
    fi

    # Check port mapping: internal port 3000 must map to external port 3500
    local mapped_port
    if [ -n "$dhost" ]; then
        mapped_port=$(DOCKER_HOST="$dhost" docker inspect -f '{{range $k, $v := .NetworkSettings.Ports}}{{if eq $k "3000/tcp"}}{{range $v}}{{.HostPort}}{{end}}{{end}}{{end}}' "$container" 2>/dev/null)
    else
        mapped_port=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Ports}}{{if eq $k "3000/tcp"}}{{range $v}}{{.HostPort}}{{end}}{{end}}{{end}}' "$container" 2>/dev/null)
    fi

    if [ "$mapped_port" != "$EXT_PORT" ]; then
        log_warn "Port mapping incorrect (got $mapped_port, expected $EXT_PORT) — falling back to full deploy"
        DEPLOY_TYPE="full"
    fi
}

# ── Argument Parsing ──────────────────────────────────────
MODE=""
FULL_DEPLOY=false

for arg in "$@"; do
    case "$arg" in
        --prod) MODE="--prod" ;;
        --dev)  MODE="--dev"  ;;
        --full) FULL_DEPLOY=true ;;
        *) echo "Unknown argument: $arg"; exit 1 ;;
    esac
done

if [ "$MODE" != "--prod" ] && [ "$MODE" != "--dev" ]; then
    echo ""
    echo "Usage:"
    echo "  ./deploy-bella.sh --dev [--full]     Deploy locally on Mac (port $DEV_EXT_PORT)"
    echo "  ./deploy-bella.sh --prod [--full]    Deploy to Windows Server (port $EXT_PORT)"
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
#   CAPTURE CHANGED FILES — must run BEFORE git operations
# ════════════════════════════════════════════════
CHANGED_FILES=""
if git rev-parse HEAD >/dev/null 2>&1; then
    CHANGED_FILES=$(printf "%s\n%s\n%s" \
        "$(git diff --name-only 2>/dev/null)" \
        "$(git diff --name-only --cached 2>/dev/null)" \
        "$(git ls-files --others --exclude-standard 2>/dev/null)" \
        | sort -u | grep -v '^$')
else
    FULL_DEPLOY=true  # No commits yet — always full
fi
log_info "Changed files detected: $(echo "$CHANGED_FILES" | wc -l)"

# ════════════════════════════════════════════════
#   GIT OPERATIONS — Commit and Push changes
# ════════════════════════════════════════════════
log_step "0/4  Git: Add, Commit, and Push changes"

if ! git status --porcelain >/dev/null 2>&1; then
    log_warn "Git command failed — skipping git operations"
else
    GIT_STATUS=$(git status --porcelain)

    if [ -z "$GIT_STATUS" ]; then
        log_info "No changes to commit"
    else
        log_info "Changes detected — committing..."
        echo "$GIT_STATUS" | head -20
        if [ $(echo "$GIT_STATUS" | wc -l) -gt 20 ]; then
            echo "   ... and $(( $(echo "$GIT_STATUS" | wc -l) - 20 )) more files"
        fi

        # Add all changes
        git add -A
        [ $? -ne 0 ] && log_err "Git add failed"
        log_ok "Changes staged"

        # Commit with timestamp
        COMMIT_MSG="Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
        git commit -m "$COMMIT_MSG"
        [ $? -ne 0 ] && log_err "Git commit failed"
        log_ok "Committed: $COMMIT_MSG"

        # Push to remote
        log_info "Pushing to remote..."
        git push
        if [ $? -ne 0 ]; then
            log_warn "Git push failed — continuing with deployment"
        else
            log_ok "Changes pushed to remote"
        fi
    fi
fi

# Re-capture CHANGED_FILES from the committed diff (excludes .env, deploy-bella.sh, etc.)
if git rev-parse HEAD~1 >/dev/null 2>&1; then
    CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -v '^$')
fi
log_info "App files changed: $(echo "$CHANGED_FILES" | grep -c . || echo 0)"

# ════════════════════════════════════════════════
#   DETERMINE DEPLOY TYPE — full vs incremental
# ════════════════════════════════════════════════
needs_full_rebuild() {
    echo "$CHANGED_FILES" | grep -qE \
        '(^|/)package(-lock)?\.json$|(^|/)Dockerfile$|(^|/)entrypoint\.sh$|(^|/)vite\.config\.ts$|(^|/)tsconfig\.json$|(^|/)prisma/schema\.prisma$'
}
has_server_changes() {
    echo "$CHANGED_FILES" | grep -qE '^(server\.ts|app\.config\.ts)$'
}
has_frontend_changes() {
    echo "$CHANGED_FILES" | grep -qE '^(src/|public/|index\.html)'
}

if [ "$FULL_DEPLOY" = true ]; then
    DEPLOY_TYPE="full"
elif [ -z "$CHANGED_FILES" ]; then
    echo ">> Nothing to deploy — no file changes detected. Use --full to force."
    exit 0
elif needs_full_rebuild; then
    DEPLOY_TYPE="full"
    log_info "Full rebuild required (dependency/config/schema change detected)"
elif has_server_changes || has_frontend_changes; then
    DEPLOY_TYPE="incremental"
    log_info "Incremental deploy selected"
else
    echo ">> Nothing to deploy — changed files require no container update."
    exit 0
fi

# ════════════════════════════════════════════════
#   DEV MODE — local Mac Docker
# ════════════════════════════════════════════════
if [ "$MODE" = "--dev" ]; then

    if [ "$DEPLOY_TYPE" = "incremental" ]; then
        incremental_guard "$DEV_CONTAINER_NAME" ""
    fi

    if [ "$DEPLOY_TYPE" = "full" ]; then

        # Step 1: Build for local ARM (native Mac M3)
        log_step "1/4  Building image for local Mac (linux/arm64)"
        log_info "Image    : $IMAGE_NAME"
        log_info "Platform : native ARM64 (Mac M3)"
        docker build -t "$IMAGE_NAME" .
        [ $? -ne 0 ] && log_err "Docker build failed."
        log_ok "Image built"

        # Step 2: Ensure dev data directory exists — never wipe it
        log_step "2/4  Checking dev data directory"
        if [ ! -d "$DEV_DATA_DIR" ]; then
            log_warn "Dev data dir not found — creating $DEV_DATA_DIR"
            mkdir -p "$DEV_DATA_DIR"
            log_ok "Created: $DEV_DATA_DIR"
        else
            log_ok "Dev data exists — preserving: $DEV_DATA_DIR"
        fi

        # Step 3: Stop old dev container
        log_step "3/4  Starting dev container"
        if docker ps -a --format "{{.Names}}" | grep -q "^${DEV_CONTAINER_NAME}$"; then
            log_info "Stopping old dev container..."
            docker stop "$DEV_CONTAINER_NAME" > /dev/null 2>&1
            docker rm "$DEV_CONTAINER_NAME" > /dev/null 2>&1
            log_ok "Old dev container removed"
        fi

        docker run -d \
            --name "$DEV_CONTAINER_NAME" \
            -p "$DEV_EXT_PORT:$INT_PORT" \
            -e PORT="$INT_PORT" \
            -e DATABASE_URL="$DB_URL" \
            -e NODE_ENV=production \
            -e BELLA_HTTP_ONLY=1 \
            -e REDIS_URL="redis://redis:6379" \
            -v "$DEV_DATA_DIR:/app/data" \
            -v "$HOME/bella-dolce-backups:/app/backups" \
            --restart unless-stopped \
            "$IMAGE_NAME"
        [ $? -ne 0 ] && log_err "Failed to start dev container."

        # Step 4: Schema sync
        log_step "4/4  Schema sync"
        schema_sync "$DEV_CONTAINER_NAME"
    else
        log_step "Incremental deploy (dev)"
        has_frontend_changes && incremental_frontend "$DEV_CONTAINER_NAME" ""
        has_server_changes   && incremental_server  "$DEV_CONTAINER_NAME" ""
    fi

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
#   SSH TUNNEL — reach the Windows Docker daemon via a jump host
#   that is already on the tailnet (for machines without Tailscale)
# ════════════════════════════════════════════════
SSH_TUNNEL_PID=""
open_ssh_tunnel() {
    # Password-auth users: open the tunnel yourself in another terminal first
    # (ssh -L 127.0.0.1:2375:<SSH_REMOTE_HOST>:2375 <SSH_JUMP_HOST>) — if the
    # port is already listening, reuse it instead of opening a second one.
    if nc -z 127.0.0.1 "$SSH_TUNNEL_PORT" 2>/dev/null; then
        log_ok "Reusing existing tunnel on 127.0.0.1:${SSH_TUNNEL_PORT}"
        return
    fi
    [ -z "$SSH_JUMP_HOST" ] && log_err "DEPLOY_MODE=ssh requires SSH_JUMP_HOST (e.g. user@host — a machine already on Tailscale that can reach $WINDOWS_TAILSCALE_IP, or the Windows box itself with SSH_REMOTE_HOST=localhost)"
    log_step "Opening SSH tunnel via $SSH_JUMP_HOST"
    ssh -fN -L "127.0.0.1:${SSH_TUNNEL_PORT}:${SSH_REMOTE_HOST}:2375" "$SSH_JUMP_HOST"
    [ $? -ne 0 ] && log_err "Failed to open SSH tunnel via $SSH_JUMP_HOST"
    SSH_TUNNEL_PID=$(pgrep -f "L 127.0.0.1:${SSH_TUNNEL_PORT}:${SSH_REMOTE_HOST}:2375 ${SSH_JUMP_HOST}")
    log_ok "Tunnel open: 127.0.0.1:${SSH_TUNNEL_PORT} -> ${SSH_REMOTE_HOST}:2375"
}
close_ssh_tunnel() {
    [ -n "$SSH_TUNNEL_PID" ] && kill "$SSH_TUNNEL_PID" 2>/dev/null
}
trap close_ssh_tunnel EXIT

# ════════════════════════════════════════════════
#   PROD MODE — Windows Server
# ════════════════════════════════════════════════

if { [ "$DEPLOY_MODE" = "tailscale" ] || [ "$DEPLOY_MODE" = "ssh" ]; } && [ -n "$WINDOWS_TAILSCALE_IP" ]; then

    if [ "$DEPLOY_MODE" = "ssh" ]; then
        open_ssh_tunnel
        REMOTE="tcp://127.0.0.1:${SSH_TUNNEL_PORT}"
    else
        REMOTE="tcp://$WINDOWS_TAILSCALE_IP:2375"
    fi

    if [ "$DEPLOY_TYPE" = "incremental" ]; then
        incremental_guard "$CONTAINER_NAME" "$REMOTE"
    fi

    if [ "$DEPLOY_TYPE" = "full" ]; then
        # Step 1: Stop old container on Windows
        if [ "$DEPLOY_MODE" = "ssh" ]; then
            log_step "1/3  Connecting to Windows via SSH tunnel"
            log_info "Target : $WINDOWS_TAILSCALE_IP:2375 (tunneled through $SSH_JUMP_HOST)"
        else
            log_step "1/3  Connecting to Windows via Tailscale"
            log_info "Target : $WINDOWS_TAILSCALE_IP:2375"
        fi
        log_info "Stopping old container..."
        DOCKER_HOST="$REMOTE" docker stop "$CONTAINER_NAME" 2>/dev/null
        DOCKER_HOST="$REMOTE" docker rm   "$CONTAINER_NAME" 2>/dev/null

        # Step 2: Build and push image
        log_step "2/3  Building and pushing image"

        if DOCKER_HOST="$REMOTE" docker image inspect node:24-slim >/dev/null 2>&1; then
            # Fast path — base image already on Windows, build remotely (context-only transfer)
            log_info "Base image cached on Windows — remote build (few MB transfer)"
            DOCKER_HOST="$REMOTE" docker build --platform linux/amd64 -t "$IMAGE_NAME" .
            [ $? -ne 0 ] && log_err "Remote build failed on Windows."
        else
            # Cold path — base image missing on Windows (first deploy or clean machine)
            # Build on Mac and push compressed image (~120MB vs 400MB raw)
            log_info "Base image not on Windows — building on Mac and pushing compressed (one-time ~120MB)"
            log_info "Subsequent deploys will use fast remote build with layer cache"
            if ! docker info >/dev/null 2>&1; then
                log_err "Mac Docker engine is not running. Open Docker Desktop and wait for the engine to start (green indicator), then retry."
            fi
            docker buildx build --platform linux/amd64 --load -t "$IMAGE_NAME" .
            [ $? -ne 0 ] && log_err "Local build on Mac failed."
            docker save "$IMAGE_NAME" | gzip | DOCKER_HOST="$REMOTE" docker load
            [ $? -ne 0 ] && log_err "Failed to push image to Windows."
            # Also seed node:24-slim so warm-path builds work on next deploy (Windows has no Docker Hub access)
            log_info "Seeding node:24-slim to Windows for future builds..."
            docker buildx build --platform linux/amd64 --load -t node-base-seed - <<'SEED_EOF'
FROM node:24-slim
SEED_EOF
            docker save node-base-seed | gzip | DOCKER_HOST="$REMOTE" docker load && \
                DOCKER_HOST="$REMOTE" docker tag node-base-seed node:24-slim && \
                docker rmi node-base-seed 2>/dev/null || true
            log_ok "Base image seeded on Windows"
        fi
        log_ok "Image ready on Windows"
        [ $? -ne 0 ] && log_err "Docker build failed on Windows."
        log_ok "Image built on Windows"

        # Seed certs from the freshly built image if the host folder doesn't have them
        # yet. The certs volume mount below replaces whatever the image baked in at
        # /app/certs, so without this, server.ts silently falls back to plain HTTP with
        # no error logged. Once seeded, later deploys reuse the same cert instead of
        # regenerating one each time (which would make browsers re-warn on every deploy).
        if ! DOCKER_HOST="$REMOTE" docker run --rm -v "$PROD_CERTS_DIR:/check" "$IMAGE_NAME" \
            sh -c "test -f /check/cert.pem && test -f /check/key.pem" >/dev/null 2>&1; then
            log_info "No certs found in $PROD_CERTS_DIR — seeding from the built image"
            DOCKER_HOST="$REMOTE" docker create --name bella-cert-seed "$IMAGE_NAME" >/dev/null
            DOCKER_HOST="$REMOTE" docker cp "bella-cert-seed:/app/certs/." "$PROD_CERTS_DIR"
            DOCKER_HOST="$REMOTE" docker rm bella-cert-seed >/dev/null
            log_ok "Certs seeded to $PROD_CERTS_DIR"
        else
            log_ok "Certs already present in $PROD_CERTS_DIR — reusing"
        fi

        # Step 3: Start container
        log_step "3/3  Starting container"
        DOCKER_HOST="$REMOTE" docker run -d \
            --name "$CONTAINER_NAME" \
            -p "$EXT_PORT:$INT_PORT" \
            -e PORT="$INT_PORT" \
            -e DATABASE_URL="$DB_URL" \
            -e NODE_ENV=production \
            -e REDIS_URL="redis://redis:6379" \
            -e JWT_SECRET="$JWT_SECRET" \
            -e JWT_EXPIRES_IN="$JWT_EXPIRES_IN" \
            -v "$PROD_DATA_DIR:/app/data" \
            -v "$PROD_BACKUP_DIR:/app/backups" \
            -v "$PROD_CERTS_DIR:/app/certs" \
            --restart unless-stopped \
            "$IMAGE_NAME"
        [ $? -ne 0 ] && log_err "Failed to start container on Windows."

        # Step 3b: Schema sync
        log_step "3b/3  Schema sync"
        schema_sync "$CONTAINER_NAME" "$REMOTE"
    else
        log_step "Incremental deploy (prod)"
        has_frontend_changes && incremental_frontend "$CONTAINER_NAME" "$REMOTE"
        has_server_changes   && incremental_server  "$CONTAINER_NAME" "$REMOTE"
    fi

    STATUS=$(DOCKER_HOST="$REMOTE" docker ps --filter "name=$CONTAINER_NAME" --format "{{.Status}}")
    echo ""
    echo "============================================"
    if [ "$DEPLOY_MODE" = "ssh" ]; then
        echo "   PROD DEPLOYMENT COMPLETE (SSH Tunnel)"
    else
        echo "   PROD DEPLOYMENT COMPLETE (Tailscale)"
    fi
    echo "   Status  : $STATUS"
    echo "   App URL : https://$WINDOWS_TAILSCALE_IP:$EXT_PORT/belladolce"
    echo "============================================"

else

    # ── Manual Deploy — build locally, package for USB/SCP transfer ───────────
    log_step "1/3  Building image locally for manual transfer"
    docker buildx build --platform linux/amd64 -t "$IMAGE_NAME" --load .
    [ $? -ne 0 ] && log_err "Docker build failed."
    log_ok "Image built"

    log_step "2/3  Saving and packaging"
    docker save "$IMAGE_NAME" > "$TAR_FILE"
    [ $? -ne 0 ] && log_err "Failed to save image."
    zip "$ZIP_FILE" "$TAR_FILE"
    [ $? -ne 0 ] && log_err "Failed to create zip."
    ZIP_SIZE=$(du -sh "$ZIP_FILE" | cut -f1)
    log_ok "Package ready: $ZIP_FILE ($ZIP_SIZE)"

    log_step "3/3  Transfer instructions"
    echo ""
    echo "============================================"
    echo "   PROD PACKAGE READY — MANUAL DEPLOY"
    echo "============================================"
    echo "  File     : $ZIP_FILE ($ZIP_SIZE)"
    echo "  Transfer : Copy to Windows Bella-Dolce folder"
    echo "  Deploy   : Run deploy.ps1 on Windows"
    echo "             (deploy.ps1 handles schema sync)"
    echo ""
    echo "  To switch to Tailscale auto-deploy:"
    echo "  1. brew install tailscale && tailscale up"
    echo "  2. Confirm WINDOWS_TAILSCALE_IP=$WINDOWS_TAILSCALE_IP"
    echo "  3. Set DEPLOY_MODE=tailscale  <-- already set"
    echo "============================================"

fi