#!/bin/sh
set -eu

DB_URL="${DATABASE_URL:?DATABASE_URL is required}"

if command -v psql >/dev/null 2>&1; then
  psql_cmd="psql $DB_URL -v ON_ERROR_STOP=1"
elif podman ps --format '{{.Names}}' 2>/dev/null | grep -q 'fnb-server_db_1'; then
  psql_cmd="podman exec -i fnb-server_db_1 psql -U postgres -d fnb-app -v ON_ERROR_STOP=1"
elif [ -n "${COMPOSE:-}" ]; then
  psql_cmd="$COMPOSE exec -T db psql -U postgres -d fnb-app -v ON_ERROR_STOP=1"
else
  psql_cmd="podman-compose exec -T db psql -U postgres -d fnb-app -v ON_ERROR_STOP=1"
fi

$psql_cmd -c 'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())'

if ! $psql_cmd -tAc "SELECT 1 FROM schema_migrations WHERE version = '000001_initial'" | grep -q 1; then
  $psql_cmd -c "INSERT INTO schema_migrations (version) VALUES ('000001_initial') ON CONFLICT DO NOTHING"
fi

for file in migrations/*.up.sql; do
  version=$(basename "$file" .up.sql)
  [ "$version" = "000001_initial" ] && continue
  if $psql_cmd -tAc "SELECT 1 FROM schema_migrations WHERE version = '$version'" | grep -q 1; then
    continue
  fi
  {
    cat "$file"
    echo "INSERT INTO schema_migrations (version) VALUES ('$version');"
  } | $psql_cmd
done
