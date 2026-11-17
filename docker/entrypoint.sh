#!/bin/sh
# BOS container start: configure, migrate, then run PHP-FPM + Nginx.
set -e
cd /var/www/backend

# Accept a DATABASE_URL (as many platforms provide) in Laravel's DB_URL.
if [ -z "${DB_URL:-}" ] && [ -n "${DATABASE_URL:-}" ]; then
  export DB_URL="$DATABASE_URL"
fi

if [ "${DB_CONNECTION}" != "sqlite" ] && [ -z "${DB_URL:-}" ] && [ -z "${DB_HOST:-}" ]; then
  echo "BOS: no database configured. Set DATABASE_URL (or DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD)." >&2
  exit 1
fi

# Laravel reads real environment variables; .env only needs to exist.
[ -f .env ] || : > .env

if [ -z "${APP_KEY:-}" ]; then
  echo "BOS WARNING: APP_KEY is not set — generating a temporary one. Set APP_KEY permanently" >&2
  echo "             (e.g. the value printed below) or encrypted data and sessions break on redeploy." >&2
  APP_KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
  export APP_KEY
  echo "             APP_KEY=${APP_KEY}" >&2
fi

: "${APP_URL:=http://localhost:${PORT}}"
: "${FRONTEND_URL:=${APP_URL}}"
export APP_URL FRONTEND_URL

# Wait for the database, then migrate + seed + create the BOS_OWNER_* account.
if [ "${BOS_SKIP_SETUP:-false}" != "true" ]; then
  i=0
  while ! out=$(php artisan migrate --force 2>&1); do
    case "$out" in
      *"Connection refused"*|*"could not connect"*|*"could not translate host"*|*"SQLSTATE[08"*|*"Name or service not known"*|*"timeout expired"*)
        i=$((i + 1))
        if [ "$i" -ge 30 ]; then echo "$out" >&2; echo "BOS: database not reachable after 60s." >&2; exit 1; fi
        echo "BOS: waiting for database… ($i)"; sleep 2 ;;
      *)
        echo "$out" >&2; echo "BOS: migration failed (see above)." >&2; exit 1 ;;
    esac
  done
  php artisan bos:setup
fi

php artisan config:cache
php artisan route:cache
php artisan view:cache >/dev/null 2>&1 || true
chown -R www-data:www-data storage bootstrap/cache

envsubst '${PORT}' < /etc/nginx/templates/bos.conf.template > /etc/nginx/conf.d/bos.conf

php-fpm -D
echo "BOS: listening on port ${PORT}"
exec nginx -g 'daemon off;'
