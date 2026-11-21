BEGIN;

CREATE INDEX orders_pending_created_at_idx
    ON orders(created_at) WHERE payment_status = 'BELUM';

CREATE INDEX order_items_ready_updated_at_idx
    ON order_items(updated_at) WHERE status = 'READY';

CREATE INDEX order_items_delivered_at_idx
    ON order_items(delivered_at) WHERE status = 'DELIVERED';

COMMIT;
