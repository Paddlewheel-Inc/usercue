#!/usr/bin/env bash
#
# UserCue VPS installer
#
#   curl -fsSL https://raw.githubusercontent.com/Paddlewheel-Inc/usercue/main/install.sh | sudo bash
#   curl -fsSL .../install.sh | sudo bash -s -- --domain feedback.example.com
#
# Re-running on an existing install upgrades it and keeps your .env.
#
# Options (flag / env var):
#   --domain  / USERCUE_DOMAIN   Public domain (enables HTTPS via Caddy)
#   --port    / USERCUE_PORT     Port for plain-HTTP mode (default 3000)
#   --dir     / USERCUE_DIR      Install directory (default /opt/usercue)
#   --branch  / USERCUE_BRANCH   Git branch/tag to deploy (default main)
#   --yes, -y                    Never prompt
#   --force, -f                  Continue even if the domain doesn't point at this server
#   NO_COLOR=1                   Disable colors

set -euo pipefail

REPO_URL="${USERCUE_REPO:-https://github.com/Paddlewheel-Inc/usercue.git}"
BRANCH="${USERCUE_BRANCH:-main}"
INSTALL_DIR="${USERCUE_DIR:-/opt/usercue}"
DOMAIN="${USERCUE_DOMAIN:-}"
PORT="${USERCUE_PORT:-3000}"
ASSUME_YES=0
FORCE=0

# ---------- output helpers ----------
if [ -t 1 ] && [ -t 2 ] && [ -z "${NO_COLOR:-}" ]; then
  B=$'\033[1m'; R=$'\033[31m'; G=$'\033[32m'; Y=$'\033[33m'; C=$'\033[36m'; D=$'\033[90m'; N=$'\033[0m'
else
  B=""; R=""; G=""; Y=""; C=""; D=""; N=""
fi

case "${LC_ALL:-${LC_CTYPE:-${LANG:-}}}" in
  *UTF-8*|*utf-8*|*UTF8*|*utf8*) SYM_OK="✔"; SYM_ERR="✖"; SYM_WARN="⚠"; SYM_ARROW="➜" ;;
  *)                             SYM_OK="OK"; SYM_ERR="x"; SYM_WARN="!"; SYM_ARROW="==>" ;;
esac

step() { printf '\n%s%s%s %s%s%s\n' "$G" "$SYM_ARROW" "$N" "$B" "$*" "$N"; }
info() { printf '    %s%s%s\n' "$D" "$*" "$N"; }
ok()   { printf '    %s%s%s %s\n' "$G" "$SYM_OK" "$N" "$*"; }
warn() { printf '%s%s warn%s  %s\n' "$Y" "$SYM_WARN" "$N" "$*" >&2; }
die()  { printf '%s%s error%s %s\n' "$R" "$SYM_ERR" "$N" "$*" >&2; exit 1; }

# ---------- arguments ----------
usage() {
  cat <<EOF
${B}UserCue Installer${N}

  --domain <host>   Public domain (enables automatic HTTPS)
  --port <number>   Port for plain-HTTP mode (default 3000)
  --dir <path>      Install directory (default /opt/usercue)
  --branch <name>   Git branch or tag (default main)
  --yes, -y         Don't prompt
  --force, -f       Continue even if the domain doesn't point at this server yet
  -h, --help        Show this help
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --domain)   DOMAIN="${2:-}";      shift 2 ;;
    --port)     PORT="${2:-}";        shift 2 ;;
    --dir)      INSTALL_DIR="${2:-}"; shift 2 ;;
    --branch)   BRANCH="${2:-}";      shift 2 ;;
    --yes|-y)   ASSUME_YES=1;         shift ;;
    --force|-f) FORCE=1;              shift ;;
    -h|--help)  usage; exit 0 ;;
    *) die "Unknown option: $1 (try --help)" ;;
  esac
done

DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%%/*}"

have_tty() { { true </dev/tty; } 2>/dev/null; }

ask() {   # ask "question" "default"
  local q="$1" def="${2:-}" ans=""
  if [ "$ASSUME_YES" -eq 1 ] || ! have_tty; then echo "$def"; return; fi
  read -r -p "$q" ans </dev/tty || true
  echo "${ans:-$def}"
}

# ---------- preflight ----------
[ "$(id -u)" -eq 0 ] || die "Run as root, e.g.:  curl -fsSL <url> | sudo bash"
[ "$(uname -s)" = "Linux" ] || die "This installer only supports Linux."
case "$(uname -m)" in x86_64|aarch64|arm64) ;; *) warn "Untested CPU architecture: $(uname -m)" ;; esac
case "$PORT" in ''|*[!0-9]*) die "--port must be a number" ;; esac

pkg_install() {
  if   command -v apt-get >/dev/null; then DEBIAN_FRONTEND=noninteractive apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$@"
  elif command -v dnf     >/dev/null; then dnf install -y -q "$@"
  elif command -v yum     >/dev/null; then yum install -y -q "$@"
  else die "No supported package manager found. Install these manually and re-run: $*"
  fi
}

step "Checking prerequisites"
for bin in curl git; do
  command -v "$bin" >/dev/null || { info "Installing $bin..."; pkg_install "$bin" ca-certificates; }
done
ok "curl and git are installed"

# ---------- docker ----------
step "Checking Docker"
if ! command -v docker >/dev/null; then
  info "Docker not found, installing via get.docker.com..."
  curl -fsSL https://get.docker.com | sh
fi
if command -v systemctl >/dev/null; then systemctl enable --now docker >/dev/null 2>&1 || true; fi
docker info >/dev/null 2>&1 || die "Docker is installed but the daemon isn't running. Try: systemctl start docker"
docker compose version >/dev/null 2>&1 || die "The 'docker compose' plugin is missing. Install it (apt install docker-compose-plugin) and re-run."
COMPOSE_VER="$(docker compose version --short 2>/dev/null | sed 's/^v//')"
ok "Docker is ready (compose $COMPOSE_VER)"

# ---------- domain / mode ----------
SERVER_IP="$(curl -4 -fsS --max-time 5 https://ifconfig.me 2>/dev/null || curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"

if [ -z "$DOMAIN" ]; then
  DOMAIN="$(ask $'\n'"Domain for UserCue (e.g. feedback.example.com), or press Enter to use http://${SERVER_IP:-<server-ip>}:${PORT} : " "")"
  DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%%/*}"
fi

if [ -n "$DOMAIN" ]; then
  # !override in the compose file needs Compose >= 2.24.4
  if [ "$(printf '%s\n%s\n' "2.24.4" "$COMPOSE_VER" | sort -V | head -n1)" != "2.24.4" ]; then
    die "Docker Compose $COMPOSE_VER is too old for HTTPS mode (need >= 2.24.4). Update Docker and re-run."
  fi
  resolved="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || true)"
  if [ -z "$resolved" ] || { [ -n "$SERVER_IP" ] && [ "$resolved" != "$SERVER_IP" ]; }; then
    msg="$DOMAIN resolves to '${resolved:-nothing}' but this server is $SERVER_IP. Add an A record pointing to it (on Cloudflare use DNS-only, not proxied), or HTTPS certificate issuance will fail."
    if [ "$FORCE" -eq 1 ]; then
      warn "$msg Continuing because of --force. Caddy will keep retrying until DNS is correct."
    else
      die "$msg Re-run with --force to install anyway."
    fi
  else
    ok "$DOMAIN points at this server ($resolved)"
  fi
  PUBLIC_URL="https://$DOMAIN"
  COOKIE_SECURE="true"
else
  PUBLIC_URL="http://${SERVER_IP:-localhost}:$PORT"
  COOKIE_SECURE="false"
fi

# ---------- fetch code ----------
step "Fetching UserCue into $INSTALL_DIR"
if [ -d "$INSTALL_DIR/.git" ]; then
  git -C "$INSTALL_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$INSTALL_DIR" checkout -q "$BRANCH" 2>/dev/null || true
  git -C "$INSTALL_DIR" reset --hard "FETCH_HEAD" -q
  ok "Updated existing install"
else
  [ -e "$INSTALL_DIR" ] && [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ] && die "$INSTALL_DIR exists and isn't a UserCue checkout. Use --dir to pick another location."
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  ok "Cloned repository"
fi
cd "$INSTALL_DIR"

# ---------- .env ----------
rand() { if command -v openssl >/dev/null; then openssl rand -hex 32; else head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; fi; }

step "Configuring"
if [ -f .env ]; then
  info "Existing .env found, keeping your secrets and settings."
  if [ -n "$DOMAIN" ]; then
    sed -i -E "s|^PUBLIC_URL=.*|PUBLIC_URL=$PUBLIC_URL|; s|^COOKIE_SECURE=.*|COOKIE_SECURE=$COOKIE_SECURE|" .env
  fi
  PORT="$(grep -E '^PORT=' .env | tail -n1 | cut -d= -f2 || echo "$PORT")"; PORT="${PORT:-3000}"
else
  # A leftover Postgres volume has the old password baked in and breaks a fresh .env
  if docker volume ls -q | grep -qx 'usercue_postgres'; then
    warn "Found a Postgres volume from a previous install, but no .env to match it."
    wipe="$(ask "    Delete that old database and start fresh? [y/N] " "n")"
    case "$wipe" in
      y|Y|yes) docker compose down -v --remove-orphans >/dev/null 2>&1 || docker volume rm usercue_postgres usercue_uploads >/dev/null 2>&1 || true ;;
      *) die "Aborting so your old data isn't touched. Remove it with 'docker volume rm usercue_postgres usercue_uploads' (this DELETES it) and re-run." ;;
    esac
  fi
  umask 077
  cat > .env <<EOF
# Generated by install.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
# BACK THIS FILE UP. SECRET_KEY encrypts OAuth secrets and webhook URLs in the database;
# if you lose it, those stored values become unreadable.
PORT=$PORT
PUBLIC_URL=$PUBLIC_URL
USERCUE_IMAGE=${USERCUE_IMAGE:-ghcr.io/paddlewheel-inc/usercue:latest}
COOKIE_SECURE=$COOKIE_SECURE
POSTGRES_PASSWORD=$(rand)
SECRET_KEY=$(rand)

# Optional: email staff invites via Resend (can also be configured in the settings page)
RESEND_API_KEY=
RESEND_FROM=UserCue <noreply@example.com>
EOF
  umask 022
  ok "Wrote .env with freshly generated secrets"
fi

# ---------- HTTPS via Caddy ----------
if [ -n "$DOMAIN" ]; then
  info "Setting up Caddy for automatic HTTPS on $DOMAIN"
  cat > Caddyfile <<EOF
$DOMAIN {
	encode gzip
	reverse_proxy app:$PORT
}
EOF
  cat > docker-compose.override.yml <<'EOF'
# Generated by install.sh - adds automatic HTTPS in front of UserCue.
services:
  app:
    ports: !override
      - "127.0.0.1:${PORT:-3000}:${PORT:-3000}"
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    dns:
      - 1.1.1.1
      - 8.8.8.8
    ports:
      - "81:81"
      - "445:445"
      - "445:445/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app
volumes:
  caddy_data:
  caddy_config:
EOF
fi

# ---------- firewall (ufw, only if already active) ----------
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q '^Status: active'; then
  step "Opening firewall ports (ufw)"
  if [ -n "$DOMAIN" ]; then ufw allow 80/tcp >/dev/null; ufw allow 443 >/dev/null; else ufw allow "$PORT"/tcp >/dev/null; fi
  ok "Firewall updated"
fi

# ---------- build & start ----------
step "Pulling UserCue and starting it"
docker compose pull
docker compose up -d --remove-orphans

step "Waiting for UserCue to come up"
ready=0
for _ in $(seq 1 90); do
  if curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:$PORT" 2>/dev/null; then ready=1; break; fi
  sleep 2
done

if [ "$ready" -ne 1 ]; then
  warn "UserCue didn't respond within 3 minutes. Last app logs:"
  docker compose logs --tail 60 app || true
  die "Install did not finish cleanly. Fix the error above and re-run this script (it's safe to re-run)."
fi

cat <<EOF

${G}${B}${SYM_OK} UserCue is running.${N}

  URL:        ${C}${B}$PUBLIC_URL${N}
  Install:    $INSTALL_DIR
  Config:     $INSTALL_DIR/.env   ${Y}${B}(back this up!)${N}${N}

Useful commands (run from $INSTALL_DIR):
  docker compose logs -f app      ${D}# view logs${N}
  docker compose restart          ${D}# restart${N}
  docker compose down             ${D}# stop${N}

To upgrade: re-run the install command. Your .env and data are kept.
EOF

if [ -z "$DOMAIN" ]; then
  warn "Running over plain HTTP. Re-run with --domain <your-domain> to enable HTTPS."
else
  info "The HTTPS cert is issued shortly after start. If the site doesn't load, check: docker compose logs caddy"
fi
