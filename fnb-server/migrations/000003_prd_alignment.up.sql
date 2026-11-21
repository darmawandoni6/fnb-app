BEGIN;

-- 3.1 New enum types
CREATE TYPE table_session_status AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE payment_gateway AS ENUM ('MIDTRANS');
CREATE TYPE payment_log_status AS ENUM ('PENDING', 'SETTLED', 'EXPIRED', 'FAILED');

-- 3.2 order_type swap
ALTER TYPE order_type RENAME TO order_type_old;
CREATE TYPE order_type AS ENUM ('DINE_IN', 'TAKE_AWAY');
ALTER TABLE orders
    ALTER COLUMN order_type TYPE order_type
    USING (CASE order_type::text
        WHEN 'QR' THEN 'DINE_IN'
        ELSE 'TAKE_AWAY'
    END)::order_type;
DROP TYPE order_type_old;

-- 3.3 order_status trim and order_item_status add COMPLETED
UPDATE orders SET status = 'DIPROSES' WHERE status IN ('SIAP', 'DIANTAR');

ALTER TYPE order_status RENAME TO order_status_old;
CREATE TYPE order_status AS ENUM ('MENUNGGU', 'DIPROSES', 'SELESAI', 'DIBATALKAN');
ALTER TABLE orders
    ALTER COLUMN status TYPE order_status USING status::text::order_status;
DROP TYPE order_status_old;

ALTER TYPE order_item_status RENAME TO order_item_status_old;
CREATE TYPE order_item_status AS ENUM ('PENDING','COOKING','READY','DELIVERED','COMPLETED','CANCELLED');
ALTER TABLE order_items
    ALTER COLUMN status TYPE order_item_status USING status::text::order_item_status;
DROP TYPE order_item_status_old;

-- 3.4 table_sessions
CREATE TABLE table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES tables(id),
    session_token TEXT NOT NULL UNIQUE,
    status table_session_status NOT NULL DEFAULT 'OPEN',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX table_sessions_table_id_idx ON table_sessions(table_id);
CREATE UNIQUE INDEX table_sessions_one_open_per_table_idx
    ON table_sessions(table_id) WHERE status = 'OPEN';

-- 3.5 order_sequence
CREATE TABLE order_sequence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_type order_type NOT NULL,
    date DATE NOT NULL,
    last_seq INTEGER NOT NULL CHECK (last_seq > 0),
    UNIQUE (order_type, date)
);

-- 3.6 payment_log
CREATE TABLE payment_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    method payment_method NOT NULL,
    gateway payment_gateway,
    amount BIGINT NOT NULL CHECK (amount >= 0),
    status payment_log_status NOT NULL,
    gateway_ref TEXT UNIQUE,
    gateway_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX payment_log_order_id_idx ON payment_log(order_id);

-- 3.7 audit_log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    from_value TEXT,
    to_value TEXT,
    actor_id UUID REFERENCES users(id),
    actor_role user_role,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_log_entity_idx ON audit_log(entity, entity_id);
CREATE INDEX audit_log_created_at_idx ON audit_log(created_at);

-- 3.8 orders columns
ALTER TABLE orders
    ADD COLUMN order_number TEXT,
    ADD COLUMN table_session_id UUID REFERENCES table_sessions(id),
    ADD COLUMN customer_name TEXT,
    ADD COLUMN customer_phone TEXT,
    ADD COLUMN service_rate_snapshot NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN service_amount BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN payment_ref TEXT,
    ADD COLUMN paid_at TIMESTAMPTZ,
    ADD COLUMN amount_received BIGINT,
    ADD COLUMN change_amount BIGINT,
    ADD COLUMN cancel_reason TEXT,
    ADD COLUMN canceled_at TIMESTAMPTZ;

ALTER TABLE orders RENAME COLUMN tax_percent TO tax_rate_snapshot;

-- backfill
UPDATE orders SET customer_name = COALESCE(NULLIF(trim(customer_name), ''), 'Take Away');
UPDATE orders o SET order_number = sub.number
FROM (
    SELECT id,
           CASE o.order_type WHEN 'DINE_IN' THEN 'DI-' ELSE 'TA-' END
             || to_char(o.created_at, 'YYYYMMDD') || '-'
             || lpad(row_number() OVER (
                    PARTITION BY o.order_type, o.created_at::date
                    ORDER BY o.created_at, o.id)::text, 3, '0') AS number
    FROM orders o
) sub
WHERE o.id = sub.id;

-- seed the sequence so new numbers continue after the backfill
INSERT INTO order_sequence (order_type, date, last_seq)
SELECT order_type, created_at::date, count(*)
FROM orders GROUP BY order_type, created_at::date
ON CONFLICT (order_type, date) DO UPDATE SET last_seq = GREATEST(order_sequence.last_seq, EXCLUDED.last_seq);

ALTER TABLE orders
    ALTER COLUMN order_number SET NOT NULL,
    ALTER COLUMN customer_name SET NOT NULL;
ALTER TABLE orders ADD CONSTRAINT orders_order_number_unique UNIQUE (order_number);
ALTER TABLE orders ADD CONSTRAINT orders_customer_name_not_blank CHECK (length(trim(customer_name)) > 0);

ALTER TABLE orders DROP COLUMN tracking_token_hash;
CREATE INDEX orders_table_session_id_idx ON orders(table_session_id);
CREATE INDEX orders_payment_status_idx ON orders(payment_status);

-- 3.9 order_items columns
ALTER TABLE order_items
    ADD COLUMN menu_name_snapshot TEXT,
    ADD COLUMN delivered_at TIMESTAMPTZ,
    ADD COLUMN completed_at TIMESTAMPTZ,
    ADD COLUMN updated_by UUID REFERENCES users(id);

UPDATE order_items oi SET menu_name_snapshot = m.name FROM menus m WHERE m.id = oi.menu_id;
ALTER TABLE order_items ALTER COLUMN menu_name_snapshot SET NOT NULL;
ALTER TABLE order_items
    ADD CONSTRAINT order_items_menu_name_snapshot_not_blank CHECK (length(trim(menu_name_snapshot)) > 0);

-- 3.10 settings columns
ALTER TABLE settings RENAME COLUMN tax_percent TO tax_rate;
ALTER TABLE settings
    ADD COLUMN service_rate NUMERIC NOT NULL DEFAULT 5 CHECK (service_rate >= 0),
    ADD COLUMN cash_timeout_minutes INTEGER NOT NULL DEFAULT 15 CHECK (cash_timeout_minutes > 0),
    ADD COLUMN delivered_auto_complete_minutes INTEGER NOT NULL DEFAULT 5 CHECK (delivered_auto_complete_minutes > 0),
    ADD COLUMN ready_auto_deliver_minutes INTEGER NOT NULL DEFAULT 10 CHECK (ready_auto_deliver_minutes > 0),
    ADD COLUMN ready_auto_deliver_warning_minutes INTEGER NOT NULL DEFAULT 2 CHECK (ready_auto_deliver_warning_minutes >= 0),
    ADD CONSTRAINT settings_ready_warning_lt_deliver CHECK (ready_auto_deliver_warning_minutes < ready_auto_deliver_minutes),
    ADD CONSTRAINT settings_tax_rate_range CHECK (tax_rate >= 0 AND tax_rate <= 100),
    ADD CONSTRAINT settings_service_rate_range CHECK (service_rate >= 0 AND service_rate <= 100);

-- 3.11 Drops
DROP TABLE refund_items;
DROP TABLE refunds;

-- 3.12 Grantees
GRANT SELECT ON ALL TABLES IN SCHEMA public TO web_anon;

COMMIT;
