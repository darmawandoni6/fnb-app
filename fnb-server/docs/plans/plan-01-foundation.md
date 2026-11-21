# Plan 01 — Foundation: schema and domain alignment

Brings the database and `internal/domain` in line with PRD §5, §6, §10. No HTTP endpoint changes here; every later plan builds on this.

Depends on: nothing.
Blocks: 03, 04, 05, 06, 07, 08.

## 1. Scope

In:

- Migration `000003_prd_alignment.up.sql` / `.down.sql`.
- Enum changes: `order_type`, `order_status`, new `table_session_status`, `payment_gateway`, `payment_log_status`.
- New tables: `table_sessions`, `order_sequence`, `payment_log`, `audit_log`.
- Column additions on `orders`, `order_items`, `settings`.
- Drops: `orders.tracking_token_hash`, `refunds`, `refund_items`.
- `internal/domain`: enums, entities, pure functions (`CalcTotals`, rewritten `AggregateOrderStatus`, `ValidateItemTransition`), repository interfaces.

Out:

- No handler, usecase, or router change. The code will not compile until plan 04 lands; land 01 + 02 + 03 + 04 as one PR series or accept a broken build between commits (see §9).

## 2. Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | Enum values are swapped by creating a new type, casting the column, then dropping the old type. `ALTER TYPE ... ADD VALUE` cannot remove `QR`/`MANUAL`. | PostgreSQL limitation; keeps existing rows. |
| 2 | `order_type` becomes `DINE_IN`/`TAKE_AWAY`; existing `QR` → `DINE_IN`, `MANUAL` → `TAKE_AWAY`. | PRD §10.1. |
| 3 | `order_status` drops `SIAP` and `DIANTAR`. Existing rows with those values are mapped to `DIPROSES`. | PRD §5.1 defines exactly four order states; `SIAP`/`DIANTAR` are item-level concepts. |
| 4 | `settings.tax_percent` is renamed `tax_rate`; `service_rate` added with default `5`. | PRD §10.16. |
| 5 | `orders.tax_percent` is renamed `tax_rate_snapshot`; `service_rate_snapshot` and `service_amount` added. | PRD §6 requires both rates snapshotted. |
| 6 | `orders.tracking_token_hash` is dropped; the customer identity is `table_session_id`. | PRD §10.11 note and §4.6. |
| 7 | `refunds` and `refund_items` are dropped along with `domain/refund.go`. | PRD §1.4: no refund in v1. Cancel never collects money. |
| 8 | `table_sessions.session_token` is plain text with a unique index. | PRD §10.5 deliberate simplification; re-scan must reissue the same token (EC-14). |
| 9 | `table_sessions` gets a partial unique index `(table_id) WHERE status = 'OPEN'`. | One open session per table, enforced by the DB not the usecase (PRD §10.5). |
| 10 | `order_sequence` has no `outlet_id`. | Single outlet in v1 (PRD §10.13). |
| 11 | `order_sequence` rows are taken with `INSERT ... ON CONFLICT DO UPDATE ... RETURNING last_seq`. | Atomic per (type, day), no read-then-write race (EC-18). |
| 12 | `audit_log.actor_id` and `actor_role` are nullable. | Scheduler writes with no user (PRD §10.15). |
| 13 | `payment_log.gateway_ref` is unique and nullable. | Unique per Midtrans transaction; null for manual non-cash (PRD §10.14). |
| 14 | `orders.order_number` is nullable at first, backfilled, then set `NOT NULL` + unique `(order_number)`. | Existing rows need a value. Backfill uses `TA-<YYYYMMDD>-<row_number>` for take away and `DI-<YYYYMMDD>-<row_number>` for dine-in; format for new rows comes from `order_sequence`. |
| 15 | `order_items.menu_name_snapshot` is backfilled from `menus.name`. | PRD §10.12 requires the snapshot; menus may be renamed later. |
| 16 | `order_items.completed_at` and `delivered_at` are nullable; the scheduler fills them. | Grey release: old rows stay null (PRD §10.12). |
| 17 | `orders.customer_name` is backfilled with `'Take Away'`. Then `NOT NULL` and `CHECK (length(trim(customer_name)) > 0)`. | PRD §11.2 makes the name required for every order. |
| 18 | `service_amount` / `tax_amount` use `bigint` rupiah. Rates stay `numeric`. | PRD §6 money rule. |
| 19 | `CalcTotals` returns three components and is the only place that computes tax and service. `CalcTax` is kept as an unexported helper. | One implementation, testable in isolation (PRD §6). |
| 20 | `AggregateOrderStatus` is rewritten to the exact table in PRD §5.3. It takes items + payment status and returns one of four values. | The current version invents `SIAP`/`DIANTAR` order states. |
| 21 | `ValidateItemTransition` allows `DELIVERED → COMPLETED` (manual override), which the current code rejects. | PRD §5.2 and EC-13. |
| 22 | `ValidateItemTransition` rejects every `→ CANCELLED`, because cancel is order-level. | PRD §5.2 note and BR-05. |
| 23 | `OrderType.Valid()` and the enum string constants match the new DB values exactly. | `docs/constants.md` rule 7: no repeated literals. |

## 3. Migration `000003_prd_alignment`

Order matters; the script runs inside one transaction from `scripts/migrate.sh`.

### 3.1 New enum types

```sql
CREATE TYPE table_session_status AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE payment_gateway AS ENUM ('MIDTRANS');
CREATE TYPE payment_log_status AS ENUM ('PENDING', 'SETTLED', 'EXPIRED', 'FAILED');
```

### 3.2 `order_type` swap

```sql
ALTER TYPE order_type RENAME TO order_type_old;
CREATE TYPE order_type AS ENUM ('DINE_IN', 'TAKE_AWAY');
ALTER TABLE orders
    ALTER COLUMN order_type TYPE order_type
    USING (CASE order_type::text
        WHEN 'QR' THEN 'DINE_IN'
        ELSE 'TAKE_AWAY'
    END)::order_type;
DROP TYPE order_type_old;
```

### 3.3 `order_status` trim and `order_item_status` add `COMPLETED`

```sql
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
```

### 3.4 `table_sessions`

```sql
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
```

### 3.5 `order_sequence`

```sql
CREATE TABLE order_sequence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_type order_type NOT NULL,
    date DATE NOT NULL,
    last_seq INTEGER NOT NULL CHECK (last_seq > 0),
    UNIQUE (order_type, date)
);
```

### 3.6 `payment_log`

```sql
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
```

### 3.7 `audit_log`

```sql
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
```

### 3.8 `orders` columns

```sql
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
```

### 3.9 `order_items` columns

```sql
ALTER TABLE order_items
    ADD COLUMN menu_name_snapshot TEXT,
    ADD COLUMN delivered_at TIMESTAMPTZ,
    ADD COLUMN completed_at TIMESTAMPTZ,
    ADD COLUMN updated_by UUID REFERENCES users(id);

UPDATE order_items oi SET menu_name_snapshot = m.name FROM menus m WHERE m.id = oi.menu_id;
ALTER TABLE order_items ALTER COLUMN menu_name_snapshot SET NOT NULL;
ALTER TABLE order_items
    ADD CONSTRAINT order_items_menu_name_snapshot_not_blank CHECK (length(trim(menu_name_snapshot)) > 0);
```

### 3.10 `settings` columns

```sql
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
```

### 3.11 Drops

```sql
DROP TABLE refund_items;
DROP TABLE refunds;
```

### 3.12 Grantees

```sql
GRANT SELECT ON ALL TABLES IN SCHEMA public TO web_anon;
```

### 3.13 `000003_prd_alignment.down.sql`

Reverse in the opposite order: re-create `refunds`/`refund_items` (empty), drop the new columns and constraints, restore `tax_percent`/`tax_rate`, re-create `order_status_old` values, restore `QR`/`MANUAL`, drop the four new tables and three new types. The down migration does not restore `tracking_token_hash` values; document that rollback requires `make reset` in a development environment only.

## 4. `internal/domain` contracts

### 4.1 Enums (`internal/domain/enums.go`)

```go
type OrderStatus string // MENUNGGU DIPROSES SELESAI DIBATALKAN
type OrderItemStatus string // PENDING COOKING READY DELIVERED COMPLETED CANCELLED
type PaymentStatus string // BELUM LUNAS
type PaymentMethod string // CASH NON_CASH
type OrderType string // DINE_IN TAKE_AWAY
type UserRole string // OWNER CASHIER KITCHEN
type StockMovementType string // IN OUT RESTORE ADJUSTMENT
type TableSessionStatus string // OPEN CLOSED
type PaymentGateway string // MIDTRANS
type PaymentLogStatus string // PENDING SETTLED EXPIRED FAILED
```

Add `OrderItemStatusCompleted` to `go` and to the `order_item_status` DB enum.

The `order_item_status` swap belongs to §3.3 in the real migration file; keep it adjacent to the `order_status` swap.

Each type gets `Valid()`. Keep the existing pattern.

### 4.2 Entities

New files:

- `internal/domain/table_session.go` — `TableSession{ID, TableID, Table, SessionToken, Status, StartedAt, EndedAt, ClosedBy, CreatedAt, UpdatedAt}` plus `TableSessionRepository`.
- `internal/domain/order_sequence.go` — `OrderSequence{ID, OrderType, Date, LastSeq}`.
- `internal/domain/payment_log.go` — `PaymentLog{ID, OrderID, Method, Gateway, Amount, Status, GatewayRef, GatewayStatus, CreatedAt}`.
- `internal/domain/audit_log.go` — `AuditLog{ID, Entity, EntityID, Action, FromValue, ToValue, ActorID, ActorRole, CreatedAt}`.

Changed files:

- `internal/domain/order.go` — add `OrderNumber`, `TableSessionID`, `CustomerName`, `CustomerPhone`, `ServiceRateSnapshot`, `ServiceAmount`, `PaymentRef`, `PaidAt`, `AmountReceived`, `ChangeAmount`, `CancelReason`, `CanceledAt`; rename `TaxPercent` → `TaxRateSnapshot`; remove `TrackingTokenHash`.
- `internal/domain/order_item.go` — add `MenuNameSnapshot`, `DeliveredAt`, `CompletedAt`, `UpdatedBy`.
- `internal/domain/setting.go` — add `ServiceRate`, `TaxRate` (rename), five timer fields.
- Delete `internal/domain/refund.go`.

### 4.3 Pure functions (`internal/domain/order_status.go`)

```go
type Totals struct {
    Subtotal int64
    Service  int64
    Tax      int64
    Total    int64
}

// CalcTotals implements PRD §6: service on subtotal, tax on subtotal+service,
// round half up per component, integer rupiah.
func CalcTotals(subtotal int64, serviceRate, taxRate float64) Totals

func AggregateOrderStatus(items []OrderItem, payment PaymentStatus, cancelled bool) OrderStatus
func ValidateItemTransition(from, to OrderItemStatus) error
```

`AggregateOrderStatus` rules, in order:

1. `cancelled == true` → `DIBATALKAN`.
2. `payment == BELUM` → `MENUNGGU`.
3. every item `COMPLETED` or `CANCELLED` → `SELESAI`.
4. otherwise → `DIPROSES`.

`ValidateItemTransition`:

| from | to | allowed |
|---|---|---|
| `PENDING` | `COOKING` | yes |
| `COOKING` | `READY` | yes |
| `READY` | `DELIVERED` | yes |
| `DELIVERED` | `COMPLETED` | yes |
| anything | `CANCELLED` | no (order-level only) |

Everything else returns `CodeInvalidTransition`.

The `cancelled bool` parameter exists because `DIBATALKAN` is not derivable from item status alone once items are `CANCELLED` and payment stays `BELUM`. Callers pass `order.CanceledAt != nil`.

### 4.4 Repository interfaces

- `internal/domain/public_repositories.go`: drop `OrderRepository.GetByTrackingTokenHash`.
- `internal/domain/order_repositories.go`: extend `OrderFilter` with `OrderType`, `SessionID`; keep `List`, `GetByID`.
- New `internal/domain/table_session_repositories.go`: `GetOpenByTableID`, `GetBySessionToken`, `Create`, `Close`.
- New `internal/domain/sequence_repositories.go`: `NextSeq(ctx, orderType, date) (int, error)` implemented as an atomic upsert.
- New `internal/domain/audit_repositories.go`: `Create(ctx, *AuditLog)`, `List(ctx, AuditFilter)`.
- New `internal/domain/payment_log_repositories.go`: `Create`, `GetByGatewayRef`, `MarkSettled`, `MarkExpired`.

## 5. Repository

- `internal/repository/order_sequence_repository.go`:

```go
func (r *OrderSequenceRepository) NextSeq(ctx context.Context, t domain.OrderType, day time.Time) (int, error) {
    var seq int
    err := r.db.WithContext(ctx).Raw(`
        INSERT INTO order_sequence (order_type, date, last_seq)
        VALUES (?, ?, 1)
        ON CONFLICT (order_type, date)
        DO UPDATE SET last_seq = order_sequence.last_seq + 1
        RETURNING last_seq`, t, day).Scan(&seq).Error
    return seq, err
}
```

- `internal/repository/table_session_repository.go` — plain GORM; `GetOpenByTableID` uses `status = 'OPEN'`.
- `internal/repository/audit_repository.go` — insert only, plus a filtered list ordered by `created_at DESC LIMIT 200`.
- `internal/repository/payment_log_repository.go` — insert; `GetByGatewayRef` returns `nil, nil` on not found.

## 6. Usecase

No usecase in this plan. Plan 04 rewrites order usecases on top of §4/§5.

## 7. Tests

`internal/domain/order_status_test.go`:

- `CalcTotals`: table-driven — `50000, 5, 10` → `{50000, 2500, 5250, 57750}`; zero rates; `1` rupiah subtotal with round half up; large value overflow-free.
- `AggregateOrderStatus`: the four rows of PRD §5.3 plus `cancelled = true` and the all-cancelled-items case returning `DIBATALKAN`.
- `ValidateItemTransition`: the full 6×6 matrix, asserting only the four allowed pairs pass.

Delete the old `CalcTax` test rows that no longer match; keep one direct `CalcTax` test if the helper stays exported.

## 8. Verification

```bash
make migrate        # applies 000003 on top of 000001/000002
psql "$DATABASE_URL" -c '\d orders'
psql "$DATABASE_URL" -c "SELECT enum_range(NULL::order_type)"
psql "$DATABASE_URL" -c "SELECT enum_range(NULL::order_status)"
go test ./internal/domain/...
```

Manual checks:

- `refunds` and `refund_items` are gone.
- `orders.order_number` is unique and non-null on pre-existing rows.
- Inserting two `OPEN` sessions for one table fails on the partial unique index.
- `NextSeq` called twice concurrently returns `1` and `2` with no duplicate.

## 9. Docs to update

- `docs/tech-stack.md` — no change.
- `docs/structure.md` — no change.
- `docs/rules.md` — no change.
- `../../../docs/api.md` — no change; endpoint work follows.
- `../../../docs/PRD.md` — no change.

`docs/plans/README.md` gap table: check off the rows this plan closes.

Deliberate sequencing note: after 01 the build is red until 04. Either land 01 with `//nolint`-free dead code removed and accept it, or land 01+02+03+04 as one commit series on a branch. Prefer the branch.
