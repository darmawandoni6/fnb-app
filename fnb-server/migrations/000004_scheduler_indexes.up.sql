BEGIN;

ALTER TABLE order_items ADD COLUMN ready_at TIMESTAMPTZ;
UPDATE order_items SET ready_at = NOW() WHERE status IN ('READY', 'DELIVERED', 'COMPLETED');

CREATE INDEX orders_pending_created_at_idx
    ON orders(created_at) WHERE payment_status = 'BELUM';

CREATE INDEX order_items_ready_at_idx
    ON order_items(ready_at) WHERE status = 'READY';

CREATE INDEX order_items_delivered_at_idx
    ON order_items(delivered_at) WHERE status = 'DELIVERED';

COMMIT;
