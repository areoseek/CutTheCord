#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# CutTheCord — Self-Hosted Setup Script
# ─────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="${SCRIPT_DIR}/docker"

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

info()    { printf "${CYAN}▸${RESET} %s\n" "$*"; }
success() { printf "${GREEN}✔${RESET} %s\n" "$*"; }
warn()    { printf "${YELLOW}⚠${RESET} %s\n" "$*"; }
error()   { printf "${RED}✖${RESET} %s\n" "$*"; }
die()     { error "$*"; exit 1; }
ask()     { printf "${CYAN}?${RESET} %s" "$*"; }

# Graceful Ctrl+C
cleanup() {
    echo ""
    warn "Setup cancelled by user."
    exit 130
}
trap cleanup INT

# Mask a password: show first and last char, stars in between
mask_password() {
    local pw="$1"
    local len=${#pw}
    if [[ $len -le 2 ]]; then
        printf '%s' '***'
    else
        printf '%s%s%s' "${pw:0:1}" "$(printf '%*s' $((len - 2)) '' | tr ' ' '*')" "${pw: -1}"
    fi
}

# Prompt with default value
prompt_default() {
    local prompt_text="$1"
    local default="$2"
    local varname="$3"
    ask "${prompt_text} [${default}]: "
    local input
    read -r input
    eval "${varname}=\"\${input:-${default}}\""
}

# ════════════════════════════════════════════════════════════
# 1. BANNER
# ════════════════════════════════════════════════════════════

clear
printf "${BOLD}${CYAN}"
cat << 'BANNER'

   ██████╗██╗   ██╗████████╗ ████████╗██╗  ██╗███████╗
  ██╔════╝██║   ██║╚══██╔══╝ ╚══██╔══╝██║  ██║██╔════╝
  ██║     ██║   ██║   ██║       ██║   ███████║█████╗
  ██║     ██║   ██║   ██║       ██║   ██╔══██║██╔══╝
  ╚██████╗╚██████╔╝   ██║       ██║   ██║  ██║███████╗
   ╚═════╝ ╚═════╝    ╚═╝       ╚═╝   ╚═╝  ╚═╝╚══════╝
   ██████╗ ██████╗ ██████╗ ██████╗
  ██╔════╝██╔═══██╗██╔══██╗██╔══██╗
  ██║     ██║   ██║██████╔╝██║  ██║
  ██║     ██║   ██║██╔══██╗██║  ██║
  ╚██████╗╚██████╔╝██║  ██║██████╔╝
   ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝

BANNER
printf "${RESET}"
echo ""
printf "  ${BOLD}Self-Hosted Setup${RESET}\n"
printf "  ${DIM}This script will configure and deploy CutTheCord on your machine.${RESET}\n"
printf "  ${DIM}It will: collect settings, generate config files, build & start${RESET}\n"
printf "  ${DIM}Docker containers, create your admin account, and verify health.${RESET}\n"
echo ""
printf "  ${DIM}Press Ctrl+C at any time to cancel.${RESET}\n"
echo ""

# ════════════════════════════════════════════════════════════
# 2. PREREQUISITES
# ════════════════════════════════════════════════════════════

printf "${BOLD}── Prerequisites ──${RESET}\n"

missing=()

if command -v docker &>/dev/null; then
    success "docker $(docker --version 2>/dev/null | head -1 | sed 's/Docker version /v/' | sed 's/,.*//')"
else
    missing+=("docker")
fi

if docker compose version &>/dev/null 2>&1; then
    success "docker compose $(docker compose version --short 2>/dev/null)"
else
    missing+=("docker compose (v2 plugin)")
fi

if command -v curl &>/dev/null; then
    success "curl"
else
    missing+=("curl")
fi

if command -v openssl &>/dev/null; then
    success "openssl"
else
    missing+=("openssl")
fi

if [[ ${#missing[@]} -gt 0 ]]; then
    echo ""
    error "Missing required tools:"
    for tool in "${missing[@]}"; do
        printf "  ${RED}-${RESET} %s\n" "$tool"
    done
    echo ""
    info "Install them and re-run this script."
    info "  Docker:         https://docs.docker.com/engine/install/"
    info "  Docker Compose: comes with Docker Desktop, or install the plugin"
    info "  curl/openssl:   use your package manager (apt, dnf, pacman, etc.)"
    exit 1
fi
echo ""

# ════════════════════════════════════════════════════════════
# 3. NETWORK CONFIG
# ════════════════════════════════════════════════════════════

printf "${BOLD}── Network Configuration ──${RESET}\n"

DETECTED_IP="$(hostname -I 2>/dev/null | awk '{print $1}')" || DETECTED_IP=""

if [[ -n "${DETECTED_IP}" ]]; then
    info "Detected LAN IP: ${BOLD}${DETECTED_IP}${RESET}"
    ask "Use this IP? (Y/n): "
    read -r use_detected
    if [[ "${use_detected,,}" == "n" ]]; then
        ask "Enter your LAN IP: "
        read -r HOST_IP
        [[ -z "${HOST_IP}" ]] && die "LAN IP cannot be empty."
    else
        HOST_IP="${DETECTED_IP}"
    fi
else
    warn "Could not auto-detect LAN IP."
    ask "Enter your LAN IP: "
    read -r HOST_IP
    [[ -z "${HOST_IP}" ]] && die "LAN IP cannot be empty."
fi
success "LAN IP: ${HOST_IP}"

EXTERNAL_ACCESS="n"
LIVEKIT_SCHEME="ws"
ask "Enable external (WAN) access? (y/N): "
read -r EXTERNAL_ACCESS
if [[ "${EXTERNAL_ACCESS,,}" == "y" ]]; then
    ask "Enter WAN IP or domain: "
    read -r WAN_HOST
    [[ -z "${WAN_HOST}" ]] && die "WAN IP/domain cannot be empty."
    # Use wss:// if it looks like a domain (contains a dot and not just an IP)
    if [[ "${WAN_HOST}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        LIVEKIT_SCHEME="ws"
    else
        LIVEKIT_SCHEME="wss"
    fi
    success "WAN host: ${WAN_HOST} (scheme: ${LIVEKIT_SCHEME})"
fi
echo ""

# ════════════════════════════════════════════════════════════
# 4. PORT CONFIG
# ════════════════════════════════════════════════════════════

printf "${BOLD}── Port Configuration ──${RESET}\n"

prompt_default "Web client port"      "3000" WEB_PORT
prompt_default "Admin dashboard port" "3001" ADMIN_PORT
prompt_default "LiveKit WS port"      "7880" LIVEKIT_PORT

success "Ports: web=${WEB_PORT}, admin=${ADMIN_PORT}, livekit=${LIVEKIT_PORT}"
echo ""

# ════════════════════════════════════════════════════════════
# 5. DATABASE CONFIG
# ════════════════════════════════════════════════════════════

printf "${BOLD}── Database Configuration ──${RESET}\n"

prompt_default "PostgreSQL username" "ctc"        POSTGRES_USER
prompt_default "Database name"       "cutthecord" POSTGRES_DB

while true; do
    ask "PostgreSQL password: "
    read -rs POSTGRES_PASSWORD
    echo ""
    [[ -z "${POSTGRES_PASSWORD}" ]] && { warn "Password cannot be empty."; continue; }
    ask "Confirm password: "
    read -rs POSTGRES_PASSWORD_CONFIRM
    echo ""
    if [[ "${POSTGRES_PASSWORD}" != "${POSTGRES_PASSWORD_CONFIRM}" ]]; then
        warn "Passwords do not match. Try again."
    else
        break
    fi
done

success "Database: ${POSTGRES_USER}@${POSTGRES_DB}"
echo ""

# ════════════════════════════════════════════════════════════
# 6. SECRETS
# ════════════════════════════════════════════════════════════

printf "${BOLD}── Secrets ──${RESET}\n"

ask "Auto-generate secrets? (Y/n): "
read -r AUTO_SECRETS

if [[ "${AUTO_SECRETS,,}" != "n" ]]; then
    JWT_SECRET="$(openssl rand -base64 32)"
    LIVEKIT_API_KEY="$(openssl rand -hex 8)"
    LIVEKIT_API_SECRET="$(openssl rand -base64 32)"
    success "JWT secret generated"
    success "LiveKit API key generated: ${LIVEKIT_API_KEY}"
    success "LiveKit API secret generated"
else
    ask "JWT secret (min 32 chars): "
    read -r JWT_SECRET
    [[ ${#JWT_SECRET} -lt 32 ]] && die "JWT secret must be at least 32 characters."

    ask "LiveKit API key: "
    read -r LIVEKIT_API_KEY
    [[ -z "${LIVEKIT_API_KEY}" ]] && die "LiveKit API key cannot be empty."

    ask "LiveKit API secret (min 32 chars): "
    read -r LIVEKIT_API_SECRET
    [[ ${#LIVEKIT_API_SECRET} -lt 32 ]] && die "LiveKit API secret must be at least 32 characters."

    success "Secrets set"
fi
echo ""

# ════════════════════════════════════════════════════════════
# 7. ADMIN USER
# ════════════════════════════════════════════════════════════

printf "${BOLD}── Admin Account ──${RESET}\n"

while true; do
    ask "Admin username (3-32 chars): "
    read -r ADMIN_USER
    if [[ -z "${ADMIN_USER}" || ${#ADMIN_USER} -lt 3 || ${#ADMIN_USER} -gt 32 ]]; then
        warn "Username must be between 3 and 32 characters."
    else
        break
    fi
done

while true; do
    ask "Admin password (min 6 chars): "
    read -rs ADMIN_PASS
    echo ""
    if [[ ${#ADMIN_PASS} -lt 6 ]]; then
        warn "Password must be at least 6 characters."
        continue
    fi
    ask "Confirm password: "
    read -rs ADMIN_PASS_CONFIRM
    echo ""
    if [[ "${ADMIN_PASS}" != "${ADMIN_PASS_CONFIRM}" ]]; then
        warn "Passwords do not match. Try again."
    else
        break
    fi
done

success "Admin user: ${ADMIN_USER}"
echo ""

# ════════════════════════════════════════════════════════════
# 8. CONFIRMATION
# ════════════════════════════════════════════════════════════

# Build the LiveKit URL
if [[ "${EXTERNAL_ACCESS,,}" == "y" ]]; then
    LIVEKIT_URL="${LIVEKIT_SCHEME}://${WAN_HOST}:${LIVEKIT_PORT}"
else
    LIVEKIT_URL="ws://${HOST_IP}:${LIVEKIT_PORT}"
fi

DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@ctc-postgres:5432/${POSTGRES_DB}"

echo ""
printf "${BOLD}══════════════════════════════════════════════════${RESET}\n"
printf "${BOLD}  Configuration Summary${RESET}\n"
printf "${BOLD}══════════════════════════════════════════════════${RESET}\n"
echo ""
printf "  ${BOLD}Network${RESET}\n"
printf "    LAN IP:          %s\n" "${HOST_IP}"
if [[ "${EXTERNAL_ACCESS,,}" == "y" ]]; then
    printf "    WAN host:        %s\n" "${WAN_HOST}"
fi
printf "    LiveKit URL:     %s\n" "${LIVEKIT_URL}"
echo ""
printf "  ${BOLD}Ports${RESET}\n"
printf "    Web client:      %s\n" "${WEB_PORT}"
printf "    Admin dashboard: %s\n" "${ADMIN_PORT}"
printf "    LiveKit WS:      %s\n" "${LIVEKIT_PORT}"
echo ""
printf "  ${BOLD}Database${RESET}\n"
printf "    User:            %s\n" "${POSTGRES_USER}"
printf "    Password:        %s\n" "$(mask_password "${POSTGRES_PASSWORD}")"
printf "    Database:        %s\n" "${POSTGRES_DB}"
echo ""
printf "  ${BOLD}Secrets${RESET}\n"
printf "    JWT secret:      %s\n" "$(mask_password "${JWT_SECRET}")"
printf "    LK API key:      %s\n" "${LIVEKIT_API_KEY}"
printf "    LK API secret:   %s\n" "$(mask_password "${LIVEKIT_API_SECRET}")"
echo ""
printf "  ${BOLD}Admin Account${RESET}\n"
printf "    Username:        %s\n" "${ADMIN_USER}"
printf "    Password:        %s\n" "$(mask_password "${ADMIN_PASS}")"
echo ""
printf "${BOLD}══════════════════════════════════════════════════${RESET}\n"
echo ""

ask "Proceed with deployment? (Y/n): "
read -r PROCEED
if [[ "${PROCEED,,}" == "n" ]]; then
    warn "Setup cancelled."
    exit 0
fi
echo ""

# ════════════════════════════════════════════════════════════
# 9. GENERATE CONFIG FILES
# ════════════════════════════════════════════════════════════

printf "${BOLD}── Generating Configuration ──${RESET}\n"

# Warn if .env already exists
ENV_FILE="${DOCKER_DIR}/.env"
if [[ -f "${ENV_FILE}" ]]; then
    warn "docker/.env already exists — it will be overwritten."
    ask "Continue? (Y/n): "
    read -r OVERWRITE
    if [[ "${OVERWRITE,,}" == "n" ]]; then
        warn "Setup cancelled."
        exit 0
    fi
fi

# Write docker/.env
cat > "${ENV_FILE}" << ENVEOF
# CutTheCord — Generated by setup.sh on $(date -Iseconds)
# Re-run setup.sh to regenerate, or edit manually.

# ── PostgreSQL ──
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}

# ── Connection URLs ──
DATABASE_URL=${DATABASE_URL}
REDIS_URL=redis://ctc-redis:6379

# ── JWT ──
JWT_SECRET=${JWT_SECRET}

# ── LiveKit (Voice/Video) ──
LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
LIVEKIT_URL=${LIVEKIT_URL}

# ── Ports ──
WEB_PORT=${WEB_PORT}
ADMIN_PORT=${ADMIN_PORT}

# ── Host ──
HOST_IP=${HOST_IP}
ENVEOF

success "Written docker/.env"

# Generate livekit.yaml from template
LIVEKIT_TEMPLATE="${DOCKER_DIR}/livekit/livekit.yaml.template"
LIVEKIT_CONFIG="${DOCKER_DIR}/livekit/livekit.yaml"

if [[ ! -f "${LIVEKIT_TEMPLATE}" ]]; then
    die "LiveKit template not found at ${LIVEKIT_TEMPLATE}"
fi

sed \
    -e "s/__HOST_IP__/${HOST_IP}/g" \
    -e "s/__LIVEKIT_API_KEY__/${LIVEKIT_API_KEY}/g" \
    -e "s|__LIVEKIT_API_SECRET__|${LIVEKIT_API_SECRET}|g" \
    "${LIVEKIT_TEMPLATE}" > "${LIVEKIT_CONFIG}"

# Update port in livekit.yaml if non-default
if [[ "${LIVEKIT_PORT}" != "7880" ]]; then
    sed -i "s/^port: 7880/port: ${LIVEKIT_PORT}/" "${LIVEKIT_CONFIG}"
fi

success "Written docker/livekit/livekit.yaml"
echo ""

# ════════════════════════════════════════════════════════════
# 10. DEPLOY
# ════════════════════════════════════════════════════════════

printf "${BOLD}── Deploying Containers ──${RESET}\n"
info "Running docker compose up -d --build (this may take a few minutes)..."
echo ""

if ! (cd "${DOCKER_DIR}" && docker compose up -d --build 2>&1); then
    die "Docker compose failed. Check the output above for errors."
fi

echo ""
success "Docker compose completed"
echo ""

# ════════════════════════════════════════════════════════════
# 11. HEALTH CHECK
# ════════════════════════════════════════════════════════════

printf "${BOLD}── Health Check ──${RESET}\n"
info "Waiting for services to become healthy (up to 3 minutes)..."

HEALTH_URL="http://localhost:${WEB_PORT}"
MAX_WAIT=180
INTERVAL=5
ELAPSED=0
SPINNER_CHARS='|/-\'

while [[ $ELAPSED -lt $MAX_WAIT ]]; do
    # Spinner
    idx=$(( (ELAPSED / INTERVAL) % 4 ))
    spin_char="${SPINNER_CHARS:$idx:1}"

    if curl -sf "${HEALTH_URL}" -o /dev/null 2>/dev/null; then
        printf "\r${GREEN}✔${RESET} Web client responded after %ds               \n" "$ELAPSED"
        break
    fi

    printf "\r  ${DIM}%s${RESET} Waiting... (%ds / %ds)" "${spin_char}" "$ELAPSED" "$MAX_WAIT"
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

if [[ $ELAPSED -ge $MAX_WAIT ]]; then
    warn "Health check timed out after ${MAX_WAIT}s."
    warn "Services may still be starting. Check with: docker compose -f ${DOCKER_DIR}/docker-compose.yml ps"
fi

# Show container status
echo ""
info "Container status:"
(cd "${DOCKER_DIR}" && docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null) || \
    (cd "${DOCKER_DIR}" && docker compose ps 2>/dev/null) || true
echo ""

# ════════════════════════════════════════════════════════════
# 12. CREATE ADMIN USER
# ════════════════════════════════════════════════════════════

printf "${BOLD}── Creating Admin Account ──${RESET}\n"

# Give the admin API a moment if needed
sleep 2

ADMIN_URL="http://localhost:${ADMIN_PORT}/admin/users"
ADMIN_PAYLOAD=$(printf '{"username":"%s","password":"%s","is_global_admin":true}' \
    "${ADMIN_USER}" "${ADMIN_PASS}")

ADMIN_RESPONSE=$(curl -sf -X POST "${ADMIN_URL}" \
    -H 'Content-Type: application/json' \
    -d "${ADMIN_PAYLOAD}" 2>&1) && ADMIN_OK=true || ADMIN_OK=false

if [[ "${ADMIN_OK}" == "true" ]]; then
    success "Admin user '${ADMIN_USER}' created"
else
    warn "Could not create admin user automatically."
    warn "The API may not be ready yet. You can create the admin manually:"
    printf "  ${DIM}curl -X POST http://localhost:${ADMIN_PORT}/admin/users \\${RESET}\n"
    printf "  ${DIM}  -H 'Content-Type: application/json' \\${RESET}\n"
    printf "  ${DIM}  -d '{\"username\":\"${ADMIN_USER}\",\"password\":\"YOUR_PASS\",\"is_global_admin\":true}'${RESET}\n"
fi
echo ""

# ════════════════════════════════════════════════════════════
# 13. SUCCESS SUMMARY
# ════════════════════════════════════════════════════════════

printf "${GREEN}${BOLD}"
printf "══════════════════════════════════════════════════\n"
printf "  CutTheCord is running!\n"
printf "══════════════════════════════════════════════════${RESET}\n"
echo ""
printf "  ${BOLD}Web Client:${RESET}      http://%s:%s\n" "${HOST_IP}" "${WEB_PORT}"
printf "  ${BOLD}Admin Dashboard:${RESET} http://%s:%s\n" "${HOST_IP}" "${ADMIN_PORT}"
echo ""
printf "  ${BOLD}Admin Login:${RESET}     %s / (the password you set)\n" "${ADMIN_USER}"
echo ""
printf "  ${BOLD}Manage:${RESET}\n"
printf "    ${DIM}docker compose -f %s/docker-compose.yml down${RESET}    # stop\n"   "${DOCKER_DIR}"
printf "    ${DIM}docker compose -f %s/docker-compose.yml up -d${RESET}   # start\n"  "${DOCKER_DIR}"
printf "    ${DIM}docker compose -f %s/docker-compose.yml logs -f${RESET}  # logs\n"  "${DOCKER_DIR}"
echo ""

# ════════════════════════════════════════════════════════════
# 14. OPTIONAL APP BUILDS
# ════════════════════════════════════════════════════════════

printf "${BOLD}── Optional App Builds ──${RESET}\n"
echo ""

# ── Linux Desktop App ──
ask "Build Linux desktop app? (y/N): "
read -r BUILD_DESKTOP
if [[ "${BUILD_DESKTOP,,}" == "y" ]]; then
    if command -v pnpm &>/dev/null && command -v node &>/dev/null; then
        DESKTOP_DIR="${SCRIPT_DIR}/packages/desktop"
        if [[ -d "${DESKTOP_DIR}" ]]; then
            info "Installing dependencies..."
            (cd "${DESKTOP_DIR}" && pnpm install 2>&1) || { warn "pnpm install failed."; }
            info "Building Linux app (this may take a minute)..."
            if (cd "${DESKTOP_DIR}" && pnpm run build:linux 2>&1); then
                APPIMAGE=$(find "${DESKTOP_DIR}/out" -name '*.AppImage' -type f 2>/dev/null | head -1)
                if [[ -n "${APPIMAGE}" ]]; then
                    success "Desktop app built: ${APPIMAGE}"
                else
                    success "Build completed. Check ${DESKTOP_DIR}/out/ for output."
                fi
            else
                warn "Desktop build failed. Check output above."
            fi
        else
            warn "packages/desktop directory not found."
        fi
    else
        warn "pnpm and/or node not found. Install them first:"
        info "  Node: https://nodejs.org/"
        info "  pnpm: npm install -g pnpm"
    fi
    echo ""
fi

# ── Android APK ──
ask "Build Android APK? (y/N): "
read -r BUILD_ANDROID
if [[ "${BUILD_ANDROID,,}" == "y" ]]; then
    ANDROID_DIR="${SCRIPT_DIR}/packages/android"
    if [[ ! -d "${ANDROID_DIR}" ]]; then
        warn "packages/android directory not found."
    elif [[ -z "${ANDROID_HOME:-}" ]]; then
        warn "ANDROID_HOME is not set. Install Android SDK and set ANDROID_HOME."
        info "  https://developer.android.com/studio"
    elif [[ -z "${JAVA_HOME:-}" ]]; then
        warn "JAVA_HOME is not set. Install JDK 17+ and set JAVA_HOME."
    else
        ask "Server URL to bake into APK (e.g. http://${HOST_IP}:${WEB_PORT}): "
        read -r ANDROID_SERVER_URL
        ANDROID_SERVER_URL="${ANDROID_SERVER_URL:-http://${HOST_IP}:${WEB_PORT}}"

        CAP_CONFIG="${ANDROID_DIR}/capacitor.config.ts"
        if [[ -f "${CAP_CONFIG}" ]]; then
            sed -i "s|url:.*|url: '${ANDROID_SERVER_URL}',|" "${CAP_CONFIG}"
            success "Updated capacitor.config.ts with server URL"
        fi

        info "To build the APK, run:"
        printf "  ${DIM}cd %s${RESET}\n" "${ANDROID_DIR}"
        printf "  ${DIM}pnpm install${RESET}\n"
        printf "  ${DIM}npx cap sync android${RESET}\n"
        printf "  ${DIM}cd android && ./gradlew assembleDebug${RESET}\n"
        info "The APK will be at: android/app/build/outputs/apk/debug/app-debug.apk"
    fi
    echo ""
fi

# ── Done ──
printf "${GREEN}${BOLD}Setup complete!${RESET}\n"
