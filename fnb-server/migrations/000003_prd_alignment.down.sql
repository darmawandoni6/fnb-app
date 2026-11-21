BEGIN;

-- Re-create refunds and refund_items
CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    actor_id UUID REFERENCES users(id),
    reason TEXT NOT NULL,
    subtotal_amount BIGINT NOT NULL CHECK (subtotal_amount >= 0),
    tax_amount BIGINT NOT NULL CHECK (tax_amount >= 0),
    total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
    payment_method payment_method NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX refunds_order_id_idx ON refunds(order_id);
CREATE INDEX refunds_actor_id_idx ON refunds(actor_id);

CREATE TABLE refund_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_id UUID NOT NULL REFERENCES refunds(id),
    order_item_id UUID NOT NULL REFERENCES order_items(id),
    qty INTEGER NOT NULL CHECK (qty > 0),
    subtotal_amount BIGINT NOT NULL CHECK (subtotal_amount >= 0),
    tax_amount BIGINT NOT NULL CHECK (tax_amount >= 0),
    total_amount BIGINT NOT NULL CHECK (total_amount >= 0)
);
CREATE INDEX refund_items_refund_id_idx ON refund_items(refund_id);
CREATE INDEX refund_items_order_item_id_idx ON refund_items(order_item_id);

-- Reverse settings columns
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_service_rate_range;
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_tax_rate_range;
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_ready_warning_lt_deliver;
ALTER TABLE settings
    DROP COLUMN ready_auto_deliver_warning_minutes,
    DROP COLUMN ready_auto_deliver_minutes,
    DROP COLUMN delivered_auto_complete_minutes,
    DROP COLUMN cash_timeout_minutes,
    DROP COLUMN service_rate;
ALTER TABLE settings RENAME COLUMN tax_rate TO tax_percent;

-- Reverse order_items columns
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_menu_name_snapshot_not_blank;
ALTER TABLE order_items
    DROP COLUMN updated_by,
    DROP COLUMN completed_at,
    DROP COLUMN delivered_at,
    DROP COLUMN menu_name_snapshot;

-- Reverse orders columns
DROP INDEX IF EXISTS orders_payment_status_idx;
DROP INDEX IF EXISTS orders_table_session_id_idx;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_name_not_blank;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_number_unique;
ALTER TABLE orders
    ADD COLUMN tracking_token_hash TEXT UNIQUE;
ALTER TABLE orders
    DROP COLUMN canceled_at,
    DROP COLUMN cancel_reason,
    DROP COLUMN change_amount,
    DROP COLUMN amount_received,
    DROP COLUMN paid_at,
    DROP COLUMN payment_ref,
    DROP COLUMN service_amount,
    DROP COLUMN service_rate_snapshot,
    DROP COLUMN customer_phone,
    DROP COLUMN customer_name,
    DROP COLUMN table_session_id,
    DROP COLUMN order_number;
ALTER TABLE orders RENAME COLUMN tax_rate_snapshot TO tax_percent;

-- Drop new tables
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS payment_log;
DROP TABLE IF EXISTS order_sequence;
DROP TABLE IF EXISTS table_sessions;

-- Restore order_item_status
ALTER TYPE order_item_status RENAME TO order_item_status_new;
CREATE TYPE order_item_status AS ENUM ('PENDING', 'COOKING', 'READY', 'DELIVERED', 'CANCELLED');
ALTER TABLE order_items
    ALTER COLUMN status TYPE order_item_status
    USING (CASE status::text WHEN 'COMPLETED' THEN 'DELIVERED' ELSE status::text END)::order_item_status;
DROP TYPE order_item_status_new;

-- Restore order_status
ALTER TYPE order_status RENAME TO order_status_new;
CREATE TYPE order_status AS ENUM ('MENUNGGU', 'DIPROSES', 'SIAP', 'DIANTAR', 'SELESAI', 'DIBATALKAN');
ALTER TABLE orders
    ALTER COLUMN status TYPE order_status USING status::text::order_status;
DROP TYPE order_status_new;

-- Restore order_type
ALTER TYPE order_type RENAME TO order_type_new;
CREATE TYPE order_type AS ENUM ('QR', 'MANUAL');
ALTER TABLE orders
    ALTER COLUMN order_type TYPE order_type
    USING (CASE order_type::text WHEN 'DINE_IN' THEN 'QR' ELSE 'MANUAL' END)::order_type;
DROP TYPE order_type_new;

-- Drop new enum types
DROP TYPE IF EXISTS payment_log_status;
DROP TYPE IF EXISTS payment_gateway;
DROP TYPE IF EXISTS table_session_status;

COMMIT;
