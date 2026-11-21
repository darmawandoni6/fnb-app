BEGIN;

DROP INDEX IF EXISTS orders_pending_created_at_idx;
DROP INDEX IF EXISTS order_items_ready_updated_at_idx;
DROP INDEX IF EXISTS order_items_delivered_at_idx;

COMMIT;
