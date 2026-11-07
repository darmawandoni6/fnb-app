BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE order_status AS ENUM (
    'MENUNGGU', 'DIPROSES', 'SIAP', 'DIANTAR', 'SELESAI', 'DIBATALKAN'
);
CREATE TYPE order_item_status AS ENUM (
    'PENDING', 'COOKING', 'READY', 'DELIVERED', 'CANCELLED'
);
CREATE TYPE payment_status AS ENUM ('BELUM', 'LUNAS');
CREATE TYPE payment_method AS ENUM ('CASH', 'NON_CASH');
CREATE TYPE order_type AS ENUM ('QR', 'MANUAL');
CREATE TYPE user_role AS ENUM ('OWNER', 'CASHIER', 'KITCHEN');
CREATE TYPE stock_movement_type AS ENUM ('IN', 'OUT', 'RESTORE', 'ADJUSTMENT');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);

CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number TEXT NOT NULL UNIQUE,
    qr_token TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES menu_categories(id),
    name TEXT NOT NULL,
    price BIGINT NOT NULL CHECK (price >= 0),
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX menus_category_id_idx ON menus(category_id);

CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    stock_qty NUMERIC NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
    min_stock NUMERIC NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE recipe_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id UUID NOT NULL REFERENCES menus(id),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    qty_used NUMERIC NOT NULL CHECK (qty_used > 0),
    UNIQUE (menu_id, ingredient_id)
);
CREATE INDEX recipe_items_ingredient_id_idx ON recipe_items(ingredient_id);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID REFERENCES tables(id),
    created_by UUID REFERENCES users(id),
    order_type order_type NOT NULL,
    tracking_token_hash TEXT UNIQUE,
    status order_status NOT NULL,
    subtotal_amount BIGINT NOT NULL CHECK (subtotal_amount >= 0),
    tax_percent NUMERIC NOT NULL DEFAULT 0 CHECK (tax_percent >= 0),
    tax_amount BIGINT NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
    payment_status payment_status NOT NULL,
    payment_method payment_method,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX orders_table_id_idx ON orders(table_id);
CREATE INDEX orders_created_by_idx ON orders(created_by);
CREATE INDEX orders_status_idx ON orders(status);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    menu_id UUID NOT NULL REFERENCES menus(id),
    qty INTEGER NOT NULL CHECK (qty > 0),
    note TEXT,
    price BIGINT NOT NULL CHECK (price >= 0),
    status order_item_status NOT NULL,
    cancelled_at TIMESTAMPTZ
);
CREATE INDEX order_items_order_id_idx ON order_items(order_id);
CREATE INDEX order_items_menu_id_idx ON order_items(menu_id);

CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    order_id UUID REFERENCES orders(id),
    order_item_id UUID REFERENCES order_items(id),
    qty NUMERIC NOT NULL,
    type stock_movement_type NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX stock_movements_ingredient_id_idx ON stock_movements(ingredient_id);
CREATE INDEX stock_movements_order_id_idx ON stock_movements(order_id);
CREATE INDEX stock_movements_order_item_id_idx ON stock_movements(order_item_id);

CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    actor_id UUID NOT NULL REFERENCES users(id),
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

CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cafe_name TEXT NOT NULL,
    tax_percent NUMERIC NOT NULL DEFAULT 0 CHECK (tax_percent >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON ALL TABLES IN SCHEMA public TO web_anon;

COMMIT;
