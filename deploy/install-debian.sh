#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# BOS — one-time server setup for Debian 12 (bookworm) / Debian 13 (trixie).
#
#   sudo bash deploy/install-debian.sh --domain bos.example.com [--email you@example.com]
#
# Installs Nginx, PHP-FPM, PostgreSQL, Composer and Node.js; clones the repo into
# /var/www/bos; creates the database; writes backend/.env; builds and starts the app.
# Safe to re-run: existing database, .env and checkout are kept.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN=""
EMAIL=""                       # for Let's Encrypt; omit to skip HTTPS
APP_DIR="/var/www/bos"
REPO="https://github.com/hellosifat-dev/Bos.git"
BRANCH="main"
DB_NAME="bos"
DB_USER="bos"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email)  EMAIL="$2"; shift 2 ;;
    --dir)    APP_DIR="$2"; shift 2 ;;
    --repo)   REPO="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

[[ $EUID -eq 0 ]] || { echo "Run as root (sudo)." >&2; exit 1; }
[[ -n "$DOMAIN" ]] || { echo "Usage: $0 --domain your.domain [--email you@example.com]" >&2; exit 1; }

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

# Start/reload a service with systemd when present, otherwise SysV `service` (containers).
svc() {
  if [[ -d /run/systemd/system ]]; then systemctl "$1" "$2"; else service "$2" "$1"; fi
}

# ── 1. Packages ───────────────────────────────────────────────────────────────
log "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q --no-install-recommends \
  ca-certificates curl git unzip openssl nginx postgresql \
  php-fpm php-cli php-pgsql php-mbstring php-xml php-curl php-zip php-bcmath php-intl \
  composer nodejs npm

PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
echo "PHP ${PHP_VER}, Node $(node -v), Composer $(composer --version 2>/dev/null | awk '{print $3}')"
if (( NODE_MAJOR < 18 )); then
  echo "Node.js 18+ is required (found $(node -v))." >&2; exit 1
fi

svc start postgresql
svc enable "php${PHP_VER}-fpm" 2>/dev/null || true
svc start "php${PHP_VER}-fpm"

# ── 2. Code ───────────────────────────────────────────────────────────────────
if [[ -d "$APP_DIR/.git" ]]; then
  log "Repository already present at $APP_DIR"
else
  log "Cloning $REPO ($BRANCH) into $APP_DIR"
  git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
git config --global --add safe.directory "$APP_DIR"

# ── 3. Database ───────────────────────────────────────────────────────────────
ENV_FILE="$APP_DIR/backend/.env"
if [[ -f "$ENV_FILE" ]]; then
  log "Keeping existing $ENV_FILE"
else
  log "Creating PostgreSQL database '$DB_NAME'"
  DB_PASS="$(openssl rand -hex 16)"
  if su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'\"" | grep -q 1; then
    su postgres -c "psql -c \"ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';\"" >/dev/null
  else
    su postgres -c "psql -c \"CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';\"" >/dev/null
  fi
  if ! su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\"" | grep -q 1; then
    su postgres -c "createdb -O ${DB_USER} ${DB_NAME}"
  fi

  SCHEME="http"; [[ -n "$EMAIL" ]] && SCHEME="https"
  log "Writing $ENV_FILE"
  sed \
    -e "s|^APP_ENV=.*|APP_ENV=production|" \
    -e "s|^APP_DEBUG=.*|APP_DEBUG=false|" \
    -e "s|^APP_URL=.*|APP_URL=${SCHEME}://${DOMAIN}|" \
    -e "s|^FRONTEND_URL=.*|FRONTEND_URL=${SCHEME}://${DOMAIN}|" \
    -e "s|^DB_CONNECTION=.*|DB_CONNECTION=pgsql|" \
    -e "s|^DB_HOST=.*|DB_HOST=127.0.0.1|" \
    -e "s|^DB_PORT=.*|DB_PORT=5432|" \
    -e "s|^DB_DATABASE=.*|DB_DATABASE=${DB_NAME}|" \
    -e "s|^DB_USERNAME=.*|DB_USERNAME=${DB_USER}|" \
    -e "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS}|" \
    -e "s|^LOG_LEVEL=.*|LOG_LEVEL=warning|" \
    -e "s|^SANCTUM_STATEFUL_DOMAINS=.*|SANCTUM_STATEFUL_DOMAINS=${DOMAIN}|" \
    "$APP_DIR/backend/.env.example" > "$ENV_FILE"
  chmod 640 "$ENV_FILE"
fi

# ── 4. Build & migrate ────────────────────────────────────────────────────────
log "Building the application"
bash "$APP_DIR/deploy/update.sh" --no-pull --dir "$APP_DIR"

# ── 5. Nginx ──────────────────────────────────────────────────────────────────
log "Configuring Nginx for $DOMAIN"
sed -e "s|__DOMAIN__|${DOMAIN}|g" \
    -e "s|__APP_DIR__|${APP_DIR}|g" \
    -e "s|__PHP_SOCK__|/run/php/php${PHP_VER}-fpm.sock|g" \
    "$APP_DIR/deploy/nginx/bos.conf" > /etc/nginx/sites-available/bos.conf
# Servers without IPv6 cannot bind [::]:80.
if [[ ! -s /proc/net/if_inet6 ]]; then
  sed -i '/listen \[::\]:80;/d' /etc/nginx/sites-available/bos.conf
fi
ln -sf /etc/nginx/sites-available/bos.conf /etc/nginx/sites-enabled/bos.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
svc enable nginx 2>/dev/null || true
svc restart nginx

# ── 6. HTTPS (optional) ───────────────────────────────────────────────────────
if [[ -n "$EMAIL" ]]; then
  log "Requesting a Let's Encrypt certificate"
  apt-get install -y -q --no-install-recommends certbot python3-certbot-nginx
  certbot --nginx --non-interactive --agree-tos --redirect -m "$EMAIL" -d "$DOMAIN" \
    || echo "certbot failed — check that ${DOMAIN} points to this server, then run: certbot --nginx -d ${DOMAIN}"
fi

log "Done"
cat <<MSG
BOS is installed at ${APP_DIR} and served on http${EMAIL:+s}://${DOMAIN}

Next steps:
  1. Create the first owner account (works without email):
       cd ${APP_DIR}/backend && sudo -u www-data php artisan bos:create-owner you@example.com "Your Name"
  2. Configure outgoing email (MAIL_* in ${ENV_FILE}) so sign-up codes and
     password-reset links are delivered, then run: bash ${APP_DIR}/deploy/update.sh --no-pull
  3. To deploy new commits from '${BRANCH}' later:  sudo bash ${APP_DIR}/deploy/update.sh
MSG
