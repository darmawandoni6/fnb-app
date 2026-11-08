#!/bin/sh
set -eu

DB_URL="${DATABASE_URL:?DATABASE_URL is required}"
psql_cmd="psql $DB_URL -v ON_ERROR_STOP=1"

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
  $psql_cmd <<SQL
BEGIN;
\\i $file
INSERT INTO schema_migrations (version) VALUES ('$version');
COMMIT;
SQL
done
