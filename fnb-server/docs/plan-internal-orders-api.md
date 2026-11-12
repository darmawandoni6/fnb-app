# Draft Plan — Internal Orders API (M1)

Source: `../../docs/api.md` → "Internal — orders", "Internal — kitchen items"; `../../docs/PRD.md` §5, §6.2, §10; `../../docs/flow.md`.
Decisions settled on 2026-11-09. Builds on `docs/plan-public-customer-api.md` (shared cancel path, transaction ownership, refund rules).

## 1. Scope

| # | Method | Path | Roles |
|---|---|---|---|
| 1 | GET | `/orders` | `OWNER`, `CASHIER`, `KITCHEN` |
| 2 | GET | `/orders/:id` | `OWNER`, `CASHIER`, `KITCHEN` |
| 3 | POST | `/orders/manual` | `OWNER`, `CASHIER` |
| 4 | PATCH | `/orders/:id/payment` | `OWNER`, `CASHIER` |
| 5 | PATCH | `/orders/:id/items/:item_id/status` | `KITCHEN`, `OWNER` for `COOKING`/`READY`; `CASHIER`, `OWNER` for `DELIVERED` |
| 6 | POST | `/orders/:id/items/:item_id/cancel` | `OWNER`, `CASHIER` |

All routes require a JWT (`Authorization: Bearer <access_token>`) and pass through `JWTMiddleware` + `RequireRoles`.

Out of scope for this slice (separate plans): menu/category CRUD, table CRUD, stock, users, settings.

## 2. Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | `PATCH /orders/:id/status` from `api.md` | Dropped. PRD §5.1 derives order status from item statuses + payment; a manual endpoint would bypass the matrix. `../../docs/api.md` updated. |
| 2 | `POST .../items/:item_id/refund` from `api.md` | Dropped. Cancel already writes a refund when `payment_status = LUNAS`, which is the only legal refund point (items can only be cancelled while `PENDING`). |
| 3 | Manual order when store closed | Rejected with `409 STORE_CLOSED`, same gate as QR orders. |
| 4 | Order status ownership | Computed by `domain.AggregateOrderStatus` after every item-status, cancel, and payment write. Never accepted from the client. |
| 5 | Item transitions | Forward only: `PENDING → COOKING → READY → DELIVERED`; `PENDING → CANCELLED`. Anything else → `409 INVALID_TRANSITION`. |
| 6 | Kitchen payment gate | `→ COOKING` requires `payment_status = LUNAS`; otherwise `409 PAYMENT_REQUIRED`. `READY`/`DELIVERED` have no payment gate (already paid). |
| 7 | Kitchen visibility | `GET /orders` forces `payment_status = LUNAS` for `KITCHEN`. `GET /orders/:id` on an unpaid order returns `404 NOT_FOUND` to the kitchen (no existence leak). |
| 8 | Cancel ownership | Internal cancel reuses the public cancel computation through one shared helper; only `refunds.actor_id` and `reason` differ. |
| 9 | Internal refund actor | `refunds.actor_id = <JWT user id>`, reason `staff cancelled item`. |
| 10 | Cancel while closed | Allowed. Only new orders are blocked by `is_open`. |
| 11 | Payment body | `{"payment_status":"LUNAS","payment_method":"CASH"\|"NON_CASH"}`. Only `BELUM → LUNAS` allowed in M1; repeating it → `409 INVALID_TRANSITION`. |
| 12 | Payment method | Required when marking `LUNAS`; `VALIDATION_ERROR` when missing or unknown. |
| 13 | Manual order shape | `order_type = MANUAL`, `created_by = <JWT user id>`, `table_id = NULL` (PRD §6.2), `tracking_token_hash = NULL`, same tax/stock path as QR. |
| 14 | Pricing | Server-side only: prices from `menus`, `tax_percent` snapshot from `settings`, `tax = round(subtotal × tax_percent / 100)`, `int64` rupiah. |
| 15 | Duplicate `menu_id` | Allowed as separate lines, consistent with the public endpoint. |
| 16 | List filters | `status`, `table_id`, `date` (`YYYY-MM-DD`, UTC day on `created_at`). No pagination in M1. |
| 17 | List ordering and cap | `ORDER BY created_at DESC LIMIT 200`. |
| 18 | List payload | Orders with `Items.Menu` and `Table` preloaded; same shape as detail. |
| 19 | Detail payload | Full order, but never `tracking_token_hash`. |
| 20 | Aggregation edge case | Active items `DELIVERED` with `payment_status = BELUM` → `DIANTAR`. |
| 21 | Unknown aggregate state | Active mix without `COOKING`/`DELIVERED` where not all are `READY` or `PENDING` (e.g. `PENDING` + `READY`) → `DIPROSES`. |
| 22 | Concurrency | Item updates use `SELECT ... FOR UPDATE` plus compare-and-set on `(order_id, item_id, status)`. Zero rows updated → `409 INVALID_TRANSITION`. |
| 23 | Response status codes | `200` for reads and transitions, `201` for manual order creation. |
| 24 | Schema | No migration. All columns already exist (`created_by`, `payment_method`, `refunds.actor_id`). |
| 25 | Idempotency | None in M1; a repeated payment or transition returns `409`. |

## 3. Domain contracts

`internal/domain/order_status.go` (new):

```go
func AggregateOrderStatus(items []OrderItem, payment PaymentStatus) OrderStatus
func ValidateItemTransition(from, to OrderItemStatus) error
```

`AggregateOrderStatus`, evaluated in order:

```text
active = items with status != CANCELLED
len(active) == 0                                  → DIBATALKAN
all active PENDING                                → MENUNGGU
any active COOKING                                → DIPROSES
all active DELIVERED && payment == LUNAS          → SELESAI
all active DELIVERED && payment != LUNAS          → DIANTAR
any active DELIVERED                              → DIANTAR
all active READY                                  → SIAP
otherwise                                         → DIPROSES
```

`ValidateItemTransition` allows exactly:

```text
PENDING → COOKING
COOKING → READY
READY   → DELIVERED
```

`internal/domain/order_repositories.go` (new):

```go
type OrderFilter struct {
	Status   *OrderStatus
	TableID  *uuid.UUID
	Date     *time.Time
	PaidOnly bool
}

type OrderQueryRepository interface {
	List(ctx context.Context, filter OrderFilter) ([]Order, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Order, error)
}
```

Error codes: one addition, `PAYMENT_REQUIRED`.

```go
CodePaymentRequired = "PAYMENT_REQUIRED"
```

## 4. Repository

`internal/repository/order_repository.go` additions:

```go
List(ctx context.Context, filter domain.OrderFilter) ([]domain.Order, error)
GetByID(ctx context.Context, id uuid.UUID) (*domain.Order, error)
SetPayment(ctx context.Context, id uuid.UUID, status domain.PaymentStatus, method *domain.PaymentMethod) error
SetItemStatus(ctx context.Context, orderID, itemID uuid.UUID, from, to domain.OrderItemStatus) error
UpdateAggregate(ctx context.Context, orderID uuid.UUID, status domain.OrderStatus) error
```

Rules:

- `List` / `GetByID` preload `Items.Menu` and `Table`; `GetByID` returns `nil, nil` when absent.
- `List` applies `PaidOnly` as `payment_status = 'LUNAS'`, `Date` as `created_at >= d AND created_at < d + 1 day`, and caps at `LIMIT 200`.
- `SetItemStatus` runs `UPDATE order_items SET status = ? WHERE id = ? AND order_id = ? AND status = ?`; `RowsAffected == 0` → `INVALID_TRANSITION`.
- `UpdateAggregate` writes only `orders.status`.
- `SetPayment` writes `payment_status` and `payment_method` together.
- Existing `PersistCancel` unchanged: it persists the state the usecase computed and is reused by internal cancel.

## 5. Usecase

`internal/usecase/order_usecase.go` (new):

```go
type OrderUsecase struct {
	orderRepo   domain.OrderQueryRepository
	menuRepo    domain.MenuRepository
	settingRepo domain.SettingRepository
	withTx      TxRunner
}

func (u *OrderUsecase) List(ctx context.Context, filter domain.OrderFilter, role domain.UserRole) ([]domain.Order, error)
func (u *OrderUsecase) Get(ctx context.Context, id uuid.UUID, role domain.UserRole) (*domain.Order, error)
func (u *OrderUsecase) CreateManual(ctx context.Context, actorID uuid.UUID, items []CreateOrderItem) (*domain.Order, error)
func (u *OrderUsecase) UpdatePayment(ctx context.Context, id uuid.UUID, status domain.PaymentStatus, method *domain.PaymentMethod) (*domain.Order, error)
func (u *OrderUsecase) UpdateItemStatus(ctx context.Context, orderID, itemID uuid.UUID, target domain.OrderItemStatus, role domain.UserRole) (*domain.Order, error)
func (u *OrderUsecase) CancelItem(ctx context.Context, orderID, itemID, actorID uuid.UUID) (*domain.Order, error)
```

`OrderTx` gains three methods:

```go
SetPayment(ctx context.Context, id uuid.UUID, status domain.PaymentStatus, method *domain.PaymentMethod) error
SetItemStatus(ctx context.Context, orderID, itemID uuid.UUID, from, to domain.OrderItemStatus) error
UpdateAggregate(ctx context.Context, orderID uuid.UUID, status domain.OrderStatus) error
```

### Shared order construction

Extract from `public_usecase.go` into `internal/usecase/order_create.go` (same package):

```go
func buildOrder(ctx context.Context, menuRepo domain.MenuRepository, settingRepo domain.SettingRepository,
	lines []CreateOrderItem, orderType domain.OrderType, tableID, createdBy *uuid.UUID) (*domain.Order, []domain.OrderItem, error)
```

Shared steps: read settings → `is_open` gate (`STORE_CLOSED`) → load available menus by ID (`NOT_FOUND`) → compute subtotal/tax/total → build order (`MENUNGGU`, `BELUM`) and items (`PENDING`, price snapshot). `PublicUsecase.CreateOrder` keeps only token generation; `OrderUsecase.CreateManual` only sets `created_by` and passes `tableID = nil`.

### Shared cancellation

Extract from `public_usecase.go` into `internal/usecase/order_cancel.go` (same package):

```go
func cancelOrderItem(ctx context.Context, order *domain.Order, itemID uuid.UUID,
	refundActor *uuid.UUID, reason string, withTx TxRunner) (*domain.Order, error)
```

Behavior (moved, not changed):

1. Item must belong to the order → `NOT_FOUND`.
2. Item must be `PENDING` → `INVALID_TRANSITION`.
3. Item → `CANCELLED`, `cancelled_at = now`.
4. No active items → totals `0`, status `DIBATALKAN`.
5. Else `LUNAS` → refund row (actor, reason, order's method or `CASH`), totals decreased, never below `0`.
6. Else `BELUM` → totals unchanged.
7. Persist via `withTx` + `PersistCancel`.
8. Return the refreshed order.

Public call: `refundActor = nil`, reason `customer cancelled item`.
Internal call: `refundActor = &actorID`, reason `staff cancelled item`.

### Business rules

`List`: `KITCHEN` → force `PaidOnly = true`.
`Get`: `KITCHEN` + order `BELUM` → `NOT_FOUND`.
`CreateManual`: shared `buildOrder` with `MANUAL`, `created_by`, `tableID = nil`; inside `withTx`: order → items → `ConsumeStock`; insufficient stock → `STOCK_NOT_ENOUGH`, whole tx rolls back.
`UpdatePayment`: only `BELUM → LUNAS`; method required and valid; then recompute aggregate (all delivered + `LUNAS` → `SELESAI`) in the same tx.
`UpdateItemStatus`: `ValidateItemTransition`; role gate for target (`COOKING`/`READY` = `KITCHEN`/`OWNER`, `DELIVERED` = `CASHIER`/`OWNER`); `→ COOKING` requires `LUNAS`; write item, recompute aggregate.
`CancelItem`: shared helper with `staff cancelled item` reason and the JWT actor.

## 6. Delivery

`internal/delivery/http/dto/order.go` (new):

```go
type OrderItemResponse struct {
	ID          string  `json:"id"`
	MenuID      string  `json:"menu_id"`
	MenuName    string  `json:"menu_name"`
	Qty         int     `json:"qty"`
	Price       int64   `json:"price"`
	Note        *string `json:"note"`
	Status      string  `json:"status"`
	CancelledAt *string `json:"cancelled_at,omitempty"`
}

type OrderResponse struct {
	ID             string              `json:"id"`
	OrderType      string              `json:"order_type"`
	TableID        *string             `json:"table_id,omitempty"`
	TableNumber    *string             `json:"table_number,omitempty"`
	CreatedBy      *string             `json:"created_by,omitempty"`
	Status         string              `json:"status"`
	PaymentStatus  string              `json:"payment_status"`
	PaymentMethod  *string             `json:"payment_method,omitempty"`
	SubtotalAmount int64               `json:"subtotal_amount"`
	TaxPercent     float64             `json:"tax_percent"`
	TaxAmount      int64               `json:"tax_amount"`
	TotalAmount    int64               `json:"total_amount"`
	CreatedAt      string              `json:"created_at"`
	UpdatedAt      string              `json:"updated_at"`
	Items          []OrderItemResponse `json:"items"`
}

type ManualOrderRequest struct {
	Items []CreateOrderItemRequest `json:"items" validate:"required,min=1,max=50,dive"`
}

type UpdatePaymentRequest struct {
	PaymentStatus string  `json:"payment_status" validate:"required,oneof=LUNAS"`
	PaymentMethod *string `json:"payment_method" validate:"omitempty,oneof=CASH NON_CASH"`
}

type UpdateItemStatusRequest struct {
	Status string `json:"status" validate:"required,oneof=COOKING READY DELIVERED"`
}
```

Reuses `CreateOrderItemRequest` from `dto/public.go`; move that type into `dto/order_shared.go` only if the duplication becomes awkward (it does not — one import).

`internal/delivery/http/order_handler.go` (new): six thin handlers, each bind → parse UUID → usecase → `Success()`.

`internal/delivery/http/router.go`:

```go
type Handlers struct {
	Auth   *AuthHandler
	Public *PublicHandler
	Order  *OrderHandler
}

func NewRouter(h Handlers, authUsecase *usecase.AuthUsecase, isDevelopment bool, log *slog.Logger) *echo.Echo
```

```go
orders := e.Group("/orders", JWTMiddleware(authUsecase))
orders.GET("", h.Order.List, RequireRoles(domain.UserRoleOwner, domain.UserRoleCashier, domain.UserRoleKitchen))
orders.GET("/:id", h.Order.Get, RequireRoles(domain.UserRoleOwner, domain.UserRoleCashier, domain.UserRoleKitchen))
orders.POST("/manual", h.Order.CreateManual, RequireRoles(domain.UserRoleOwner, domain.UserRoleCashier))
orders.PATCH("/:id/payment", h.Order.UpdatePayment, RequireRoles(domain.UserRoleOwner, domain.UserRoleCashier))
orders.PATCH("/:id/items/:item_id/status", h.Order.UpdateItemStatus, RequireRoles(domain.UserRoleOwner, domain.UserRoleCashier, domain.UserRoleKitchen))
orders.POST("/:id/items/:item_id/cancel", h.Order.CancelItem, RequireRoles(domain.UserRoleOwner, domain.UserRoleCashier))
```

The route-level role list for item status is the union; the usecase enforces target-specific roles because the route cannot see the body.

`cmd/api/wiring.go`: `newOrderHandler(db)` mirrors `newPublicHandler`.

## 7. Response contract

### GET /orders → 200

```json
{"success":true,"data":[{"id":"uuid","order_type":"QR","table_id":"uuid","table_number":"T01","status":"DIPROSES","payment_status":"LUNAS","payment_method":"CASH","subtotal_amount":50000,"tax_percent":10,"tax_amount":5000,"total_amount":55000,"created_at":"2026-11-09T10:00:00Z","updated_at":"2026-11-09T10:04:00Z","items":[{"id":"uuid","menu_id":"uuid","menu_name":"Latte","qty":2,"price":25000,"note":"no sugar","status":"COOKING"}]}]}
```

### POST /orders/manual → 201

Request:

```json
{"items":[{"menu_id":"uuid","qty":1,"note":null}]}
```

Response: single `OrderResponse` with `order_type = "MANUAL"`, `table_id` absent, `status = "MENUNGGU"`, `payment_status = "BELUM"`, `created_by` set.

### PATCH /orders/:id/payment → 200

```json
{"payment_status":"LUNAS","payment_method":"CASH"}
```

Response: `OrderResponse`; `status` recomputed (`SELESAI` if every active item is already `DELIVERED`).

### PATCH /orders/:id/items/:item_id/status → 200

```json
{"status":"COOKING"}
```

Response: `OrderResponse`; order `status` reflects aggregation.

### POST /orders/:id/items/:item_id/cancel → 200

Response: `OrderResponse`; when all items are cancelled, totals `0` and status `DIBATALKAN`.

### Errors

```text
401 UNAUTHORIZED        missing/invalid JWT
403 FORBIDDEN           role not allowed
404 NOT_FOUND           order/item absent, or unpaid order read by KITCHEN
409 INVALID_TRANSITION  illegal item transition, repeated payment
409 PAYMENT_REQUIRED    COOKING before LUNAS
409 STORE_CLOSED        manual order while is_open = false
409 STOCK_NOT_ENOUGH    recipe demand exceeds stock
400 VALIDATION_ERROR    bad body
```

## 8. Tests

`internal/domain/order_status_test.go`:

1. All `PENDING` → `MENUNGGU`.
2. One `COOKING` → `DIPROSES`.
3. All `READY` → `SIAP`.
4. One `DELIVERED`, others active → `DIANTAR`.
5. All `DELIVERED` + `LUNAS` → `SELESAI`.
6. All `DELIVERED` + `BELUM` → `DIANTAR`.
7. All `CANCELLED` → `DIBATALKAN`.
8. `PENDING` + `READY` mix → `DIPROSES`.
9. Cancelled items excluded from the active count.

`internal/usecase/order_usecase_test.go` (fakes for `OrderQueryRepository`, `MenuRepository`, `SettingRepository`, `TxRunner`):

10. `List` forces `PaidOnly` for `KITCHEN`.
11. `Get` returns `NOT_FOUND` for an unpaid order read by `KITCHEN`.
12. `CreateManual` rejects when `is_open = false` (`STORE_CLOSED`).
13. `CreateManual` sets `MANUAL`, `created_by`, `table_id = NULL`, no tracking hash, correct totals.
14. `UpdatePayment` rejects a non-`LUNAS` target and a missing method.
15. `UpdatePayment` recomputes `SELESAI` when all items are `DELIVERED`.
16. `UpdateItemStatus` rejects a `KITCHEN` user setting `DELIVERED` (`FORBIDDEN`).
17. `UpdateItemStatus` rejects `→ COOKING` while `BELUM` (`PAYMENT_REQUIRED`).
18. `UpdateItemStatus` rejects a backward transition (`INVALID_TRANSITION`).
19. `CancelItem` writes a refund with `actor_id = user` and reason `staff cancelled item` when `LUNAS`.
20. `CancelItem` on `BELUM` keeps totals and writes no refund.
21. `CancelItem` on the last active item zeroes totals, sets `DIBATALKAN`.

No repository integration test in this slice; the PRD integration test stays tracked in the public plan.

## 9. Bruno collection

```text
api-collection/orders/
├── folder.bru
├── 01-list.bru
├── 02-get.bru
├── 03-create-manual.bru
├── 04-payment.bru
├── 05-item-cooking.bru
├── 06-item-ready.bru
├── 07-item-delivered.bru
└── 08-item-cancel.bru
```

Environment additions in `environments/local.bru`: `orderId` (stored by `03`), `orderItemId` (stored by `03`).

All requests send `Authorization: Bearer {{accessToken}}`, so `auth/01-login.bru` must run first.

## 10. Docs to update

| File | Change |
|---|---|
| `../../docs/api.md` | Remove `PATCH /orders/:id/status` and `POST .../refund`; document manual-order `STORE_CLOSED`, payment body, item status body, list filters, kitchen visibility, response shapes |
| `../../docs/flow.md` | Manual order sequence; `DELIVERED`-driven `DIANTAR`/`SELESAI`; `PAYMENT_REQUIRED` gate; staff-vs-public refund actors |
| `../../docs/PRD.md` | §10 refund recorded through the cancel endpoint; endpoint list without `/refund` |
| `docs/structure.md` | No change |

## 11. Commit sequence

```text
feat(domain): add order status aggregation and item transition rules
feat(repository): add internal order queries and transition writers
feat(usecase): add internal order lifecycle and share cancel path
feat(http): expose internal order endpoints with role guards
test(orders): cover aggregation and order lifecycle rules
test(api): add Bruno internal orders collection
docs(api): document internal order contract
```

## 12. Verification

```bash
go test ./...
go build ./...
make run
```

Manual flow:

1. `POST /auth/login` (owner) → `accessToken`.
2. `POST /orders/manual` → `orderId`, item ids.
3. `PATCH /orders/:id/payment` `LUNAS` → `payment_status` updated.
4. Item `COOKING` → order `DIPROSES`.
5. Item `READY` → order `SIAP`.
6. Item `DELIVERED` → order `SELESAI`.
7. Second order left `BELUM`, cancel item → stock restored, totals unchanged.
8. Third order `LUNAS`, cancel one of two items → refund row written with the actor, totals decreased.
9. Cancel the last item → totals `0`, status `DIBATALKAN`.
10. `settings.is_open = false` → `POST /orders/manual` returns `409 STORE_CLOSED`; cancel still works.

Acceptance:

- Order status is always derived; no endpoint sets it directly.
- Kitchen sees only `LUNAS` orders and cannot read unpaid details.
- `COOKING` blocked until payment; roles enforced per target status.
- Stock consumed on create, restored on cancel, movements recorded.
- `LUNAS` cancel writes a refund with the staff actor and decreases totals; `BELUM` cancel writes none.
- Manual orders respect the closed-store gate.

## 13. Accepted risks

- `GET /orders` has no pagination; the 200-row cap can hide older orders.
- `date` uses UTC day boundaries; a Jakarta-local day boundary is not configurable yet.
- Aggregation for mixed `PENDING`/`READY` states is a documented choice (decision 21), not a PRD line.
- No idempotency key on manual order creation or payment; retries surface as `409` or duplicate orders.
- Kitchen detail visibility is enforced in the usecase, not the repository; a new read path must repeat the rule.
- Shared cancel helper trusts the in-memory state it computes; any new cancel caller must go through it rather than reimplementing totals.