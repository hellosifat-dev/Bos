#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# BOS — deploy the latest code: pull, install dependencies, migrate, build.
#
#   sudo bash deploy/update.sh            # pull the current branch and redeploy
#   sudo bash deploy/update.sh --no-pull  # rebuild what is already checked out
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PULL=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-pull) PULL=0; shift ;;
    --dir) APP_DIR="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

WEB_USER="www-data"
log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
svc() { if [[ -d /run/systemd/system ]]; then systemctl "$1" "$2"; else service "$2" "$1"; fi; }

cd "$APP_DIR"
if [[ $PULL -eq 1 ]]; then
  log "Pulling latest code"
  git pull --ff-only
fi

# ── Backend ───────────────────────────────────────────────────────────────────
cd "$APP_DIR/backend"
[[ -f .env ]] || { echo "backend/.env is missing — run deploy/install-debian.sh first." >&2; exit 1; }

log "Installing PHP dependencies"
COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader --no-interaction --no-progress

grep -q '^APP_KEY=base64:' .env || php artisan key:generate --force

php artisan down --retry=15 2>/dev/null || true
trap 'php artisan up >/dev/null 2>&1 || true' EXIT

log "Migrating the database"
php artisan migrate --force
php artisan db:seed --force          # idempotent: refreshes permissions & system roles

log "Caching configuration"
php artisan optimize:clear >/dev/null
php artisan config:cache
php artisan route:cache
php artisan view:cache 2>/dev/null || true

chown -R "$WEB_USER":"$WEB_USER" storage bootstrap/cache
chmod -R ug+rwX storage bootstrap/cache
chgrp "$WEB_USER" .env

# ── Frontend ──────────────────────────────────────────────────────────────────
log "Building the frontend"
cd "$APP_DIR/frontend"
npm ci --no-audit --no-fund
npm run build

php "$APP_DIR/backend/artisan" up
trap - EXIT

PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
svc reload "php${PHP_VER}-fpm" 2>/dev/null || svc restart "php${PHP_VER}-fpm" 2>/dev/null || true

log "Deployed $(git -C "$APP_DIR" rev-parse --short HEAD)"
