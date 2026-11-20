#!/usr/bin/env sh
# Nightly PostgreSQL backup with 14-day retention. Add to cron:  0 2 * * * /opt/smartward/deploy/backup.sh
set -eu
cd "$(dirname "$0")"
mkdir -p backups
STAMP=$(date +%Y-%m-%d)
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "backups/smartward-$STAMP.dump"
find backups -name "smartward-*.dump" -mtime +14 -delete
echo "Backup written: backups/smartward-$STAMP.dump"
