# ──────────────────────────────────────────────────────────────────────────────
# BOS — single container: React SPA + Laravel API behind Nginx/PHP-FPM,
#   plus the project website (site/) served on bos.sifat.codes.
#   docker build -t bos .
#   docker run -p 8080:8080 -e DB_HOST=... -e DB_DATABASE=... -e DB_USERNAME=... -e DB_PASSWORD=... bos
# Listens on $PORT (default 8080). See DEPLOY.md for all variables.
# ──────────────────────────────────────────────────────────────────────────────

# 1) Frontend build
FROM node:20-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# 2) PHP dependencies
FROM composer:2 AS vendor
WORKDIR /app/backend
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --no-scripts --no-autoloader --prefer-dist --ignore-platform-reqs
COPY backend/ ./
RUN composer dump-autoload --optimize --no-dev --no-scripts \
 && php artisan package:discover --ansi

# 3) Runtime
FROM php:8.3-fpm-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends nginx gettext-base libpq-dev libicu-dev libzip-dev unzip \
 && docker-php-ext-install -j"$(nproc)" pdo_pgsql pdo_mysql bcmath intl zip opcache \
 && apt-get purge -y --auto-remove libicu-dev libzip-dev \
 && apt-get install -y --no-install-recommends libicu72 libzip4 \
 && rm -rf /var/lib/apt/lists/* /etc/nginx/sites-enabled/default

COPY docker/php.ini /usr/local/etc/php/conf.d/zz-bos.ini
COPY docker/zz-env.conf /usr/local/etc/php-fpm.d/zz-env.conf
COPY docker/nginx.conf.template /etc/nginx/templates/bos.conf.template
COPY docker/entrypoint.sh /usr/local/bin/bos-entrypoint

WORKDIR /var/www/backend
COPY --from=vendor /app/backend ./
COPY --from=frontend /app/frontend/dist /var/www/frontend
COPY site/ /var/www/site

RUN chmod +x /usr/local/bin/bos-entrypoint \
 && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache

ENV PORT=8080 \
    APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    DB_CONNECTION=pgsql \
    CACHE_STORE=file \
    SESSION_DRIVER=file \
    QUEUE_CONNECTION=sync

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD php -r 'exit(@file_get_contents("http://127.0.0.1:".getenv("PORT")."/up") === false ? 1 : 0);'

ENTRYPOINT ["bos-entrypoint"]
