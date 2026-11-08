BEGIN;

ALTER TABLE refunds
    ALTER COLUMN actor_id SET NOT NULL;

ALTER TABLE settings
    DROP COLUMN is_open;

COMMIT;
