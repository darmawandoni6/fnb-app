# Draft Plan — Public Customer API (M1)

Source: `docs/api.md` → "Public — customer", `docs/PRD.md` §5–§6, `docs/flow.md`.
Decisions settled through design review rounds 1–5, then revised during doc review (2026-11-08).

## 1. Scope

| # | Method | Path | Auth |
|---|---|---|---|
| 1 | GET | `/public/tables/:qr_token/menu` | none |
| 2 | POST | `/public/tables/:qr_token/orders` | none |
| 3 | GET | `/public/orders/:tracking_token` | none |
| 4 | POST | `/public/orders/:tracking_token/cancel` | none |

`qr_token` is public (printed on the QR). `tracking_token` is a secret: only its SHA-256 hash is stored in `orders.tracking_token_hash`.
Response envelope: `docs/api-response.md` (`Success()` + `domain.AppError`).

## 2. Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Cancel payload | `{"item_id":"uuid"}` |
| 2 | Transaction ownership | Hybrid: repository opens the tx, usecase supplies the steps |
| 3 | Tx handle | Interface declared in the `usecase` package (consumer side) |
| 4 | Totals when `BELUM` | Unchanged on cancel (matches `flow.md`) |
| 5 | Totals when `LUNAS` | Decreased by the item refund |
| 6 | Stock restore source | `recipe_items` (recipes finalized before opening) |
| 7 | Order status aggregation | Minimal now: `MENUNGGU` at create, `DIBATALKAN` when all items cancelled |
| 8 | Duplicate `menu_id` | Allowed as separate lines; notes stay per line |
| 9 | Seed | Public demo data only (`scripts/seed.sql`, `make seed`) |
| 10 | Recipe locking | `settings.is_open` added now |
| 11 | Cancel when `LUNAS` | Allowed; refund written automatically |
| 12 | Cancel when store closed | Allowed; only new orders are blocked |
| 13 | GET order contract | Item statuses + `payment_status` + stored totals; never the tracking token |
| 14 | GET menu contract | Hide categories with no available menus; include `is_open` |
| 15 | Rate limit | 5/min order per `qr_token`; 30/min status per IP; 60/min menu per `qr_token` |
| 16 | Migration tracking | `schema_migrations` table + psql runner in Makefile |
| 17 | `settings.is_open` backfill | `NOT NULL DEFAULT TRUE` |
| 18 | `refunds.actor_id` | Nullable; `NULL` = public customer via tracking token |
| 19 | `refunds.payment_method` | Stays `NOT NULL`; use the order's method, fall back to `CASH` |
| 20 | Rounding | PRD per-item formula; residual allowed |
| 21 | Store closed | 409 `STORE_CLOSED` |
| 22 | `refunds.reason` | Fixed string `customer cancelled item` |
| 23 | All items cancelled | Totals zeroed; status `DIBATALKAN` |
| 24 | Missing settings | Treated as open, `tax_percent = 0`, `cafe_name = ""` |
| 25 | Tracking token TTL | None in M1 |
| 26 | Tracking token format | 32 random bytes hex; store SHA-256 hex |
| 27 | Money | `int64` rupiah; `tax = round(subtotal * tax_percent / 100)` |
| 28 | Menu without recipe | Always available, no stock check, no deduction |
| 29 | Request bounds | `qty` 1–100; `items` max 50 lines |
| 30 | Seed keys | Fixed UUIDs for rows without natural unique keys (`settings`, categories) |
| 31 | Rate limit on cancel | Not limited in M1; documented risk |
| 32 | Repo-side stock check | Repository may raise `STOCK_NOT_ENOUGH`; deliberate exception to "repo has no business rules" |
| 33 | Migration atomicity | DDL and `schema_migrations` insert share one psql transaction per file |

## 3. Schema changes

One new migration: `migrations/000002_public_customer.up.sql` / `.down.sql`.

```sql
BEGIN;
ALTER TABLE settings ADD COLUMN is_open BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE refunds ALTER COLUMN actor_id DROP NOT NULL;
COMMIT;
```

Down migration drops `settings.is_open` and restores `refunds.actor_id NOT NULL` — it fails if refund rows with `NULL` actor exist. That is intentional: destructive rollback requires cleanup first.

Matching Go changes:

- `domain.Setting` gains `IsOpen bool` (`gorm:"not null;default:true"`).
- `domain.Refund.ActorID` becomes `*uuid.UUID` with gorm tag `gorm:"type:uuid;index"` (drop `not null`).

### Migration tracking (currently missing)

`make migrate` re-runs `000001` and fails (`type already exists`). Add a runner:

1. Create `schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())` if absent.
2. Loop `migrations/*.up.sql` in lexical order; skip versions already recorded.
3. Per file, run one `psql -v ON_ERROR_STOP=1` invocation:

```sql
BEGIN;
\i migrations/000002_public_customer.up.sql
INSERT INTO schema_migrations (version) VALUES ('000002_public_customer');
COMMIT;
```

`psql -f` with `\i` keeps DDL and the version insert atomic, so a crashed run leaves neither applied.

4. `make migrate-down` rolls back only the latest recorded version using its `.down.sql` and deletes the row in the same transaction.
5. Existing databases are baselined once: `INSERT INTO schema_migrations VALUES ('000001_initial')` before the runner trusts history.

No new dependency. `docker/postgres/init.sql` unchanged.

## 4. Domain contracts

```go
// internal/domain/menu.go
type MenuRepository interface {
	ListAvailableGroupedByCategory(ctx context.Context) ([]MenuCategory, error)
	ListAvailableByIDs(ctx context.Context, ids []uuid.UUID) ([]Menu, error)
}

// internal/domain/table.go
type TableRepository interface {
	GetByQRToken(ctx context.Context, qrToken string) (*Table, error)
}

// internal/domain/setting.go
type SettingRepository interface {
	GetFirst(ctx context.Context) (*Setting, error)
}

// internal/domain/order.go
type OrderRepository interface {
	GetByTrackingTokenHash(ctx context.Context, hash string) (*Order, error)
}
```

Writes do not live on `OrderRepository`. The transaction-scoped interface is declared by the usecase (see §6) and satisfied implicitly by `*repository.OrderRepository` created against a tx.

`internal/domain/error_codes.go` additions:

```go
CodeNotFound          = "NOT_FOUND"
CodeStockNotEnough    = "STOCK_NOT_ENOUGH"
CodeInvalidTransition = "INVALID_TRANSITION"
CodeStoreClosed       = "STORE_CLOSED"
```

`429` keeps the synthesized `Too Many Requests` code from `ErrorHandler`; no new constant.

## 5. Repository implementations

| File | Responsibility |
|---|---|
| `internal/repository/table_repository.go` | `GetByQRToken`; `nil, nil` when absent |
| `internal/repository/menu_repository.go` | `ListAvailableGroupedByCategory` (categories ordered by `sort_order`; `Menus` preloaded with `is_available = true` and ordered by `name`); `ListAvailableByIDs` |
| `internal/repository/setting_repository.go` | `GetFirst` (`ORDER BY created_at LIMIT 1`); `nil, nil` when absent |
| `internal/repository/order_repository.go` | `GetByTrackingTokenHash` (preload `Items.Menu`, `Table`); tx-scoped writes below |
| `internal/repository/stock_movement_repository.go` | `CreateMany` (used inside the order tx) |

Preload filtering needs the explicit form:

```go
Preload("Menus", func(db *gorm.DB) *gorm.DB {
	return db.Where("is_available = ?", true).Order("name")
}).
Order("sort_order")
```

Empty categories are dropped in the usecase (business decision), not the query.

### Tx-scoped write methods

```go
// *repository.OrderRepository, created with a *gorm.DB bound to a tx
CreateOrder(ctx context.Context, order *domain.Order) error
CreateItems(ctx context.Context, items []domain.OrderItem) error
ConsumeStock(ctx context.Context, items []domain.OrderItem) error
PersistCancel(ctx context.Context, order *domain.Order, itemID uuid.UUID, refund *domain.Refund) error
```

Rules:

- `ConsumeStock`: for each item, load `recipe_items` by `menu_id`; lock ingredients with `SELECT ... FOR UPDATE` ordered by `ingredients.id ASC` (deadlock avoidance); verify `stock_qty >= qty_used * qty`; decrement; insert `stock_movements` type `OUT` with negative qty (PRD §9 sign convention). Insufficient stock raises `STOCK_NOT_ENOUGH` (decision 32) so the tx rolls back.
- `PersistCancel`: lock the item row, persist the state the usecase computed — item `CANCELLED` + `cancelled_at`, restored stock, positive `RESTORE` movements, refund + `refund_items` when provided, and the order's new totals/status. It does not decide transitions or totals; the usecase does.
- All writes use the injected tx (`r.db`), never `r.db.Begin()` inside.

`internal/database` gains a small helper so `cmd` does not import GORM:

```go
func WithTx(ctx context.Context, db *gorm.DB, fn func(tx *gorm.DB) error) error
```

## 6. Usecase

`internal/usecase/public_usecase.go`

```go
// OrderTx is satisfied by *repository.OrderRepository bound to a tx.
type OrderTx interface {
	CreateOrder(ctx context.Context, order *domain.Order) error
	CreateItems(ctx context.Context, items []domain.OrderItem) error
	ConsumeStock(ctx context.Context, items []domain.OrderItem) error
	PersistCancel(ctx context.Context, order *domain.Order, itemID uuid.UUID, refund *domain.Refund) error
}

type TxRunner func(ctx context.Context, fn func(OrderTx) error) error

type PublicUsecase struct {
	tableRepo   domain.TableRepository
	menuRepo    domain.MenuRepository
	settingRepo domain.SettingRepository
	orderRepo   domain.OrderRepository
	withTx      TxRunner
}
```

Wiring in `cmd/api/main.go`:

```go
withTx := func(ctx context.Context, fn func(usecase.OrderTx) error) error {
	return database.WithTx(ctx, db, func(tx *gorm.DB) error {
		return fn(repository.NewOrderRepository(tx))
	})
}
```

No package imports `usecase` from `repository`; the concrete type satisfies `usecase.OrderTx` implicitly.

### Result types

```go
type MenuResult struct {
	CafeName   string
	TaxPercent float64
	IsOpen     bool
	Categories []MenuCategoryResult
}

type MenuCategoryResult struct {
	ID    uuid.UUID
	Name  string
	Menus []MenuItemResult
}

type MenuItemResult struct {
	ID       uuid.UUID
	Name     string
	Price    int64
	ImageURL *string
}

type CreateOrderItem struct {
	MenuID uuid.UUID
	Qty    int
	Note   *string
}

type OrderItemResult struct {
	ID       uuid.UUID
	MenuName string
	Qty      int
	Price    int64
	Status   domain.OrderItemStatus
	Note     *string
}

type CreateOrderResult struct {
	Order          *domain.Order
	TrackingToken  string
	Items          []OrderItemResult
}

type OrderStatusResult struct {
	Order *domain.Order
	Items []OrderItemResult
}
```

Methods:

```go
func (u *PublicUsecase) Menu(ctx context.Context, qrToken string) (*MenuResult, error)
func (u *PublicUsecase) CreateOrder(ctx context.Context, qrToken string, items []CreateOrderItem) (*CreateOrderResult, error)
func (u *PublicUsecase) OrderStatus(ctx context.Context, trackingToken string) (*OrderStatusResult, error)
func (u *PublicUsecase) CancelItem(ctx context.Context, trackingToken string, itemID uuid.UUID) (*OrderStatusResult, error)
```

Result types stay free of JSON tags (DTO owns JSON).

### Business rules

`Menu`:
1. Resolve table by `qr_token`; missing or inactive → `NOT_FOUND`.
2. Read settings; `nil` → open, tax `0`, empty cafe name.
3. Drop categories with no available menus.

`CreateOrder`:
1. Resolve active table → `NOT_FOUND`.
2. Settings `is_open = false` → `STORE_CLOSED` (409).
3. Empty items → `VALIDATION_ERROR`; bounds enforced by the DTO (decision 29).
4. Load menus by ID; any missing/unavailable → `NOT_FOUND`.
5. Price from DB only; duplicate `menu_id` allowed as separate lines.
6. `subtotal = Σ price×qty`; `tax = round(subtotal × tax_percent/100)`; `total = subtotal + tax`.
7. Build order: `QR`, `MENUNGGU`, `BELUM`, `table_id`, snapshot `tax_percent`.
8. Items: `PENDING`, price snapshot.
9. Generate tracking token (32 bytes hex) and SHA-256 hash; only the hash is persisted.
10. Persist inside `withTx`: order → items → `ConsumeStock`. Insufficient stock → `STOCK_NOT_ENOUGH` (409), whole tx rolls back.

`OrderStatus`:
1. Hash token → order lookup; missing → `NOT_FOUND`.
2. Map public fields only (no `tracking_token_hash`, no `created_by`).

`CancelItem`:
1. Hash token → order lookup; missing → `NOT_FOUND`.
2. Item must belong to the order → `NOT_FOUND`.
3. Item must be `PENDING` → `INVALID_TRANSITION` (409).
4. Compute the post-cancel state in memory on a copy of the order:
   - item → `CANCELLED`, `cancelled_at = now`
   - active items = items excluding `CANCELLED`
   - if no active items → totals `0`, status `DIBATALKAN`
   - else if `payment_status = LUNAS` → subtract `item_subtotal` and `item_tax = round(item_subtotal × order.tax_percent/100)` from the totals, never below `0`
   - else (`BELUM`) → totals unchanged, no refund
5. When `LUNAS`, build `domain.Refund`: `actor_id = nil`, fixed reason, `payment_method` = order's method or `CASH`, one `RefundItem`.
6. Persist inside `withTx` via `PersistCancel`.
7. Return the refreshed order.

Store-closed check applies only to `CreateOrder`; menu, status, and cancel keep working.

## 7. Delivery

`internal/delivery/http/dto/public.go`

```go
type MenuItemResponse struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Price    int64   `json:"price"`
	ImageURL *string `json:"image_url"`
}

type MenuCategoryResponse struct {
	ID    string             `json:"id"`
	Name  string             `json:"name"`
	Menus []MenuItemResponse `json:"menus"`
}

type MenuResponse struct {
	CafeName   string                 `json:"cafe_name"`
	TaxPercent float64                `json:"tax_percent"`
	IsOpen     bool                   `json:"is_open"`
	Categories []MenuCategoryResponse `json:"categories"`
}

type CreateOrderItemRequest struct {
	MenuID string  `json:"menu_id" validate:"required,uuid"`
	Qty    int     `json:"qty" validate:"required,min=1,max=100"`
	Note   *string `json:"note" validate:"omitempty,max=255"`
}

type CreateOrderRequest struct {
	Items []CreateOrderItemRequest `json:"items" validate:"required,min=1,max=50,dive"`
}

type OrderItemResponse struct {
	ID       string  `json:"id"`
	MenuName string  `json:"menu_name"`
	Qty      int     `json:"qty"`
	Price    int64   `json:"price"`
	Status   string  `json:"status"`
	Note     *string `json:"note"`
}

type CreateOrderResponse struct {
	OrderID        string              `json:"order_id"`
	TrackingToken  string              `json:"tracking_token"`
	SubtotalAmount int64               `json:"subtotal_amount"`
	TaxAmount      int64               `json:"tax_amount"`
	TotalAmount    int64               `json:"total_amount"`
	Status         string              `json:"status"`
	Items          []OrderItemResponse `json:"items"`
}

type OrderStatusResponse struct {
	OrderID        string              `json:"order_id"`
	Status         string              `json:"status"`
	PaymentStatus  string              `json:"payment_status"`
	SubtotalAmount int64               `json:"subtotal_amount"`
	TaxAmount      int64               `json:"tax_amount"`
	TotalAmount    int64               `json:"total_amount"`
	Items          []OrderItemResponse `json:"items"`
}

type CancelItemRequest struct {
	ItemID string `json:"item_id" validate:"required,uuid"`
}
```

`internal/delivery/http/public_handler.go` — thin handlers: bind → usecase → `Success()`. `tracking_token` is only ever emitted by `CreateOrderResponse`.

`internal/delivery/http/router.go`:

```go
publicGroup := e.Group("/public")
publicGroup.GET("/tables/:qr_token/menu", publicHandler.Menu, menuLimit)
publicGroup.POST("/tables/:qr_token/orders", publicHandler.CreateOrder, orderLimit)
publicGroup.GET("/orders/:tracking_token", publicHandler.OrderStatus, statusLimit)
publicGroup.POST("/orders/:tracking_token/cancel", publicHandler.CancelItem)
```

Rate limiters use `middleware.RateLimiterWithConfig` with in-memory stores and a custom `IdentifierExtractor`: `qr_token` path param for menu/order, client IP for status. Exceeding a limit returns `*echo.HTTPError` 429, which the existing `ErrorHandler` renders in the standard envelope.

## 8. Response contract

### GET menu
```json
{"success":true,"data":{"cafe_name":"Demo Cafe","tax_percent":10,"is_open":true,"categories":[{"id":"uuid","name":"Coffee","menus":[{"id":"uuid","name":"Latte","price":25000,"image_url":null}]}]}}
```

### POST order → 201
```json
{"success":true,"data":{"order_id":"uuid","tracking_token":"<64 hex>","subtotal_amount":50000,"tax_amount":5000,"total_amount":55000,"status":"MENUNGGU","items":[{"id":"uuid","menu_name":"Latte","qty":2,"price":25000,"status":"PENDING","note":"no sugar"}]}}
```

### GET order → 200

Two items, one cancelled, order still `BELUM`: totals stay at the created snapshot (decision 4).

```json
{"success":true,"data":{"order_id":"uuid","status":"MENUNGGU","payment_status":"BELUM","subtotal_amount":50000,"tax_amount":5000,"total_amount":55000,"items":[{"id":"uuid","menu_name":"Latte","qty":2,"price":25000,"status":"PENDING","note":"no sugar"},{"id":"uuid","menu_name":"Americano","qty":1,"price":20000,"status":"CANCELLED","note":null}]}}
```

### Cancel → 200

Same shape as GET order. After a `LUNAS` cancel, totals are the decreased values. When the cancelled item was the last active one, totals are `0` and status is `DIBATALKAN`.

## 9. Tests

`internal/usecase/public_usecase_test.go` with fakes for the four domain interfaces plus a fake `TxRunner`:

1. `Menu` rejects an inactive table.
2. `Menu` drops empty categories and reports `is_open`.
3. `Menu` with missing settings returns open, `tax_percent = 0`.
4. `CreateOrder` ignores client prices and uses DB prices; totals and tax are correct.
5. `CreateOrder` rejects an unavailable menu.
6. `CreateOrder` rejects when the store is closed (`STORE_CLOSED`).
7. `CreateOrder` propagates `STOCK_NOT_ENOUGH` and rolls back (fake tx reports no persisted rows).
8. `CreateOrder` returns the plaintext token and persists only the hash.
9. `CreateOrder` keeps duplicate `menu_id` lines separate.
10. `OrderStatus` returns `NOT_FOUND` for an unknown token and never exposes the hash.
11. `CancelItem` on a `BELUM` order keeps totals unchanged and still restores stock.
12. `CancelItem` on a `LUNAS` order writes a refund with `actor_id = nil`, method fallback `CASH`, and decreases totals.
13. `CancelItem` on the last active item zeroes totals and sets `DIBATALKAN`.
14. `CancelItem` rejects a non-`PENDING` item with `INVALID_TRANSITION`.
15. `CancelItem` works while the store is closed.

Integration test required by PRD §12: `internal/repository/order_repository_integration_test.go`, skipped unless `TEST_DATABASE_URL` is set. Covers create → stock decreased → cancel → stock restored, in a rolled-back transaction.

Handler-level tests are not required for this slice; Bruno covers the wiring.

## 10. Seed data

`scripts/seed.sql` + `make seed` (idempotent; dev only, not a migration):

- `settings`: id `00000000-0000-0000-0000-000000000001`, `Demo Cafe`, `tax_percent = 10`, `is_open = true`.
- `tables`: `T01`, `qr_token = demo-qr-token`.
- Categories: fixed UUIDs (`...0002` Coffee, `...0003` Food) since `menu_categories.name` has no unique constraint.
- Menus: Latte 25000, Americano 20000, Croissant 18000 — keyed by `(category_id, name)` via fixed UUIDs.
- Ingredients: Beans (1000 g), Milk (5000 ml), Flour (5000 g), each with `min_stock`.
- Recipes: Latte → beans 18 g + milk 200 ml; Americano → beans 18 g; Croissant → flour 100 g.

Rows without natural unique keys use fixed UUIDs so `ON CONFLICT (id) DO UPDATE` stays idempotent; menus/recipes use fixed UUIDs too.

Owner seeding from `SEED_OWNER_EMAIL`/`SEED_OWNER_PASSWORD` (PRD §3) stays out of this slice.

## 11. Bruno collection

```text
api-collection/public/
├── folder.bru
├── 01-get-menu.bru
├── 02-create-order.bru
├── 03-get-order.bru
├── 04-cancel-item.bru
└── 05-closed-store.bru     # documented path for 409 STORE_CLOSED
```

`environments/local.bru` additions: `qrToken = demo-qr-token`, empty `trackingToken`, empty `itemId`.

- `01` asserts `is_open === true`; category list contains no empty category.
- `02` post-response stores `trackingToken` and `itemId` (first item); asserts `201` and `tracking_token` length 64.
- `03` asserts `success`, item statuses present, and that the body has no `tracking_token` field.
- `04` body `{"item_id":"{{itemId}}"}`; asserts `status = CANCELLED`.
- `05` documents toggling `settings.is_open = false` and expecting `409` with code `STORE_CLOSED`.

## 12. Related docs (already updated)

| File | Change |
|---|---|
| `docs/PRD.md` | `settings.is_open`; `refunds.actor_id` nullable; refund `payment_method` fallback; totals frozen while `BELUM`; recipe edits only while closed |
| `docs/api.md` | `STORE_CLOSED` (409); `is_open` in menu response; cancel body `{item_id}`; rate limits |
| `docs/flow.md` | Tx ownership hybrid; `BELUM` cancel keeps totals; public refund `actor_id = NULL` |
| `docs/structure.md` | No change |

## 13. Commit sequence

```text
feat(db): add migration tracking and public customer schema changes
feat(domain): add public catalog and order contracts
feat(repository): implement public menu, table, setting, and order queries
feat(public): add customer menu and order usecase
feat(http): expose public customer endpoints with rate limits
chore(seed): add local demo seed data
test(api): add Bruno public collection
docs(api): document public customer contract
```

## 14. Verification

```bash
go test ./...
go build ./...
make migrate         # baselines 000001, applies 000002 once
make seed
make run             # API on :8081
# Bruno: 01 → 02 → 03 → 04
```

Acceptance:

- Menu shows only available items, hides empty categories, exposes `is_open`.
- Prices and tax come from the server; client prices are ignored.
- `tracking_token` returned once; DB stores only the hash; GET order never echoes it.
- Stock decreases on create; insufficient stock → 409 `STOCK_NOT_ENOUGH`.
- Store closed → 409 `STORE_CLOSED` on order creation only.
- Cancel on `BELUM` keeps totals; cancel on `LUNAS` writes a refund and decreases totals.
- Cancelling the last item zeroes totals and sets `DIBATALKAN`.

## 15. Accepted risks

- `refunds.payment_method = CASH` when the order has no recorded method → reports may misclassify non-cash refunds.
- Rounding residual of 1–2 rupiah can remain when a paid order still has active items.
- Rate limiting is in-memory per instance: resets on restart and is inaccurate with multiple replicas; the cancel endpoint is not limited at all.
- No idempotency key: a double submit creates two orders.
- `settings` still has no singleton constraint; `GetFirst` is a documented simplification (seed uses a fixed UUID).
- Recipe edits between order and cancel change restored quantities; mitigated operationally (recipes only edited while the store is closed).
- `PersistCancel` trusts the state computed by the usecase; a future internal cancel endpoint must reuse the same computation instead of duplicating it.