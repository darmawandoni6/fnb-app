# Plan 04 — Order core

> **Status:** DONE (Completed on 2026-11-21)
> - Unified order builder with service and tax calculation snapshot (`domain.CalcTotals`).
> - Daily order sequence generation (`FormatOrderNumber`, `OrderSequenceRepository.NextSeq`).
> - Item transitions enforced with PRD role matrix and first-write-wins idempotence (no-op on same status).
> - Order-level cancellation with stock restoration and audit logging.
> - Registered public order endpoints (`POST /public/orders`, `GET /public/orders`, `GET /public/orders/:id`, `POST /public/orders/:id/cancel`) with session isolation.
> - Registered internal order endpoints (`GET /orders`, `GET /orders/:id`, `POST /orders/manual`, `PATCH /orders/:id/items/:item_id/status`, `POST /orders/:id/cancel`).
> - Unit tests passing: `order_usecase_test.go`, `order_handler_test.go`, `public_handler_test.go`.
> - Updated Bruno API collection in `api-collection/orders/` and `api-collection/public/`.

The heaviest slice: create order (QR and manual), totals, order number, item transitions, order-level cancel, list/detail. Implements PRD §4.1, §4.2, §4.7, §5, §6, §8.

Depends on: 01, 03.
Blocks: 05, 06, 07, 08.

## 1. Scope

In:

| Method | Path | Role |
|---|---|---|
| `POST` | `/public/orders` | session |
| `GET` | `/public/orders` | session |
| `GET` | `/public/orders/:id` | session |
| `POST` | `/public/orders/:id/cancel` | session |
| `GET` | `/orders` | `OWNER`, `CASHIER`, `KITCHEN` |
| `GET` | `/orders/:id` | `OWNER`, `CASHIER`, `KITCHEN` |
| `POST` | `/orders/manual` | `CASHIER`, `OWNER` |
| `PATCH` | `/orders/:id/items/:item_id/status` | per target status, see §2.10 |
| `POST` | `/orders/:id/cancel` | `OWNER` |

Packages: `internal/usecase/order_*.go`, `internal/repository/order_repository.go`, `internal/domain/order*.go`, `internal/delivery/http/order_handler.go`, `dto/order.go`, `public_handler.go`, `dto/public.go`.

Out:

- Payment confirmation and Midtrans (plan 05).
- WebSocket publishing (plan 06); this plan calls a `Publisher` interface whose nil implementation is a no-op.
- Scheduler (plan 07).

Removed in this plan:

- `POST /orders/:id/items/:item_id/cancel`, `PublicUsecase.CancelItem`, `cancelOrderItem`, `domain.Refund`, `refund` writes, per-item order totals adjustment.
- `OrderRepository.GetByTrackingTokenHash`, `TrackingTokenHash` usage, `tracking_token` in responses.

## 2. Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | One order builder for QR and manual orders; only `order_type`, `table_id`, `table_session_id`, `created_by`, and the number prefix differ. | Avoids two pricing paths drifting apart (`flow.md` "Shared order construction"). |
| 2 | Totals come from `domain.CalcTotals` only. The client never sends amounts. | PRD §6; `api.md` "the client never decides". |
| 3 | Rates and amounts are snapshotted into the order. Changing settings affects only new orders. | BR-10, BR-12, EC-03. |
| 4 | `menu_name_snapshot` and `price` are copied at creation; `GET` responses read the snapshot, not `menus`. | PRD §10.12; menu rename must not rewrite history. |
| 5 | Order number is taken inside the create transaction via `OrderSequenceRepository.NextSeq`. Prefix `DI-` for `DINE_IN`, `TA-` for `TAKE_AWAY`. | PRD §10.13, BR-15, EC-18. |
| 6 | Format: `<PREFIX>-<YYYYMMDD>-<seq:03d>` for new orders, and `order_number` stays unique globally. | The backfill in plan 01 uses the same shape; `api.md` examples show `DI-001` — document the extended format in `docs/plans/README.md` note below. |
| 7 | Business day for the sequence is computed in the outlet timezone from `Asia/Jakarta`, configurable via `OUTLET_TIMEZONE` (default `Asia/Jakarta`). | PRD §10.13 "local business day"; single-outlet but the server clock is UTC. |
| 8 | Order creation writes, in one transaction and this order: `order`, `order_items`, stock `OUT` per recipe, `order_sequence` bump, `audit_log`. Stock shortage aborts everything with `409 STOCK_NOT_ENOUGH`. | `flow.md` Dine-in end-to-end; BR-02 ordering of writes matters for the movement log. |
| 9 | `COOKING` requires `payment_status = LUNAS`, else `409 PAYMENT_REQUIRED`. | BR-02, PRD §5.2. |
| 10 | Item transition roles: `COOKING`/`READY` → `KITCHEN`, `OWNER`; `DELIVERED` → `KITCHEN`, `OWNER`, and `CASHIER` only for `TAKE_AWAY`; `COMPLETED` → `KITCHEN`, `CASHIER` (take away only), `OWNER`. | PRD §9 matrix rows for item transitions. |
| 11 | Role checks live in the usecase, not only in the route middleware, because the allowed role depends on the target status and the order type. The route middleware still restricts to the three roles. | `docs/rules.md`: business rules in usecases. |
| 12 | Race on the same transition: `UPDATE ... WHERE id = ? AND status = ?` and `RowsAffected == 0` → re-read; if the item already has the target status, return `200` with the current order (no-op), else `409 INVALID_TRANSITION`. | EC-10 first write wins. The current code returns `409` on re-read; make it a no-op. |
| 13 | Order status is never accepted from a client. It is recomputed after every item, payment, and cancel write. | PRD §5.3. |
| 14 | Cancel is order-level and allowed only while `status = MENUNGGU` **in aggregate terms**, meaning `payment_status = BELUM` and `canceled_at IS NULL`. Every item moves to `CANCELLED`, stock is restored with `RESTORE` movements, `cancel_reason` and `canceled_at` are set. | BR-04, BR-05, PRD §4.7. |
| 15 | Cancel is allowed while the store is closed. Only new orders check `is_open`. | `flow.md` order cancellation note. |
| 16 | Cancel is idempotent-ish: cancelling an already-cancelled order → `409 INVALID_TRANSITION`. Cancelling a paid order → `409 INVALID_TRANSITION`. | BR-06; no silent success that hides a mistake. |
| 17 | `GET /orders` caps at 200 rows, newest first; kitchen forcibly filters `payment_status = LUNAS`; `GET /orders/:id` on an unpaid order returns `404` to the kitchen. | `api.md` Internal — orders; no existence leak. |
| 18 | `GET /public/orders` returns only orders whose `table_session_id` matches the caller's session, newest first, and includes `DIBATALKAN` and `SELESAI`. | BR-13. |
| 19 | `POST /public/orders` forces `order_type = DINE_IN`; `POST /orders/manual` forces `TAKE_AWAY` and `created_by` from JWT. | BR-01, `api.md`. |
| 20 | `customer_name` is required and trimmed non-empty; `customer_phone` optional, normalized to digits with optional leading `+`, max 20 chars. | `api.md` Create order; validation at the boundary plus a usecase check. |
| 21 | Duplicate `menu_id` lines are allowed and stay separate rows. | Simple, matches existing behavior. |
| 22 | Unavailable or missing menu → `404 NOT_FOUND` listing the first offending id in the message. | `api.md` error table. |
| 23 | Stock consumption uses `SELECT ... FOR UPDATE` per ingredient inside the transaction, then update and insert movement. Always in one goroutine. | `docs/concurrency.md`. |
| 24 | `GET /public/orders` and `GET /orders` share one DTO but public responses omit `created_by`, `table_id`, `payment_ref`. | Customer should not see staff identifiers. |
| 25 | Response codes: `201` for both create endpoints, `200` for transitions and reads. | `api.md` examples. |
| 26 | Publishing is done after the transaction commits, by calling a `Publisher` handed to the usecase. Plan 06 wires the real hub. | Avoids emitting events for rolled-back writes (`flow.md` real time). |

Format note for decision 6: `api.md` shows `DI-001`. Keep `api.md` as-is for the response example but implement `DI-20261121-001`. Update `api.md` once and mention it in §10 — a number that resets daily needs the date to stay unique.

## 3. Domain contracts

`internal/domain/order_status.go` (from plan 01) plus:

```go
// OrderNumber builds the public identifier: PREFIX-YYYYMMDD-SSS.
func FormatOrderNumber(t OrderType, day time.Time, seq int) string
```

`internal/domain/order_events.go`:

```go
type OrderEvent struct {
    Event string      // order.created order.updated item.updated
    Order *Order
}
type Publisher interface {
    PublishOrder(ctx context.Context, ev OrderEvent)
    PublishSession(ctx context.Context, sessionToken string, ev OrderEvent)
}
```

Nil-safe: usecases check `if p != nil`.

## 4. Repository

### 4.1 `OrderTx` interface — rewritten

```go
type OrderTx interface {
    NextOrderNumber(ctx context.Context, t domain.OrderType, day time.Time) (string, error)
    CreateOrder(ctx context.Context, o *domain.Order) error
    CreateItems(ctx context.Context, items []domain.OrderItem) error
    ConsumeStock(ctx context.Context, order *domain.Order, items []domain.OrderItem) error
    RestoreStock(ctx context.Context, order *domain.Order, items []domain.OrderItem) error
    SetItemStatus(ctx, orderID, itemID uuid.UUID, from, to domain.OrderItemStatus, actor *uuid.UUID) error
    CancelOrder(ctx, orderID uuid.UUID, reason string, actor *uuid.UUID) error
    UpdateAggregate(ctx, orderID uuid.UUID, status domain.OrderStatus) error
    Audit(ctx, entry *domain.AuditLog) error
}
```

Note: `SetPayment` moves to plan 05.

### 4.2 `internal/repository/order_repository.go`

- `NextOrderNumber` — calls `OrderSequenceRepository.NextSeq` then `domain.FormatOrderNumber`, both inside the tx.
- `ConsumeStock` — keep the current shape, add `note` on the movement (`"order "+order_number`).
- `RestoreStock` — restore for every item regardless of current item status, then the usecase flips items to `CANCELLED`. One pass over `recipe_items`.
- `CancelOrder` — set all items `CANCELLED` with `cancelled_at`, set the order `DIBATALKAN`, `cancel_reason`, `canceled_at`.
- `SetItemStatus` — sets the timestamp column matching the target: `delivered_at` for `DELIVERED`, `completed_at` for `COMPLETED`, and `updated_by`.
- Delete `PersistCancel` and every `refund` reference.
- `List` — add `order_type` and `session_id` filters; keep `Limit(200)`.
- `GetByID` must preload `Items`, `Table`, and `TableSession`.

### 4.3 `internal/repository/order_sequence_repository.go`

From plan 01.

## 5. Usecase

### 5.1 Shared order construction — `internal/usecase/order_create.go`

```go
type OrderInput struct {
    CustomerName  string
    CustomerPhone *string
    PaymentMethod domain.PaymentMethod
    Items         []CreateOrderItem
}

func buildOrder(ctx, menuRepo, settingRepo, in OrderInput, t domain.OrderType,
                tableID, sessionID, createdBy *uuid.UUID) (*domain.Order, []domain.OrderItem, error)
```

Steps:

1. `settingRepo.GetFirst`; `!IsOpen` → `409 STORE_CLOSED` (only when `checkOpen` is true — plan 05 creates no orders, so it is always true here).
2. Validate `len(Items) > 0`, `qty > 0` per line, `customer_name` non-blank.
3. `menuRepo.ListAvailableByIDs`; missing/unavailable → `404`.
4. `subtotal = Σ price × qty`; `totals = domain.CalcTotals(subtotal, s.ServiceRate, s.TaxRate)`.
5. Build `Order{Status: MENUNGGU, PaymentStatus: BELUM, CustomerName, CustomerPhone, ServiceRateSnapshot, TaxRateSnapshot, ServiceAmount, TaxAmount, TotalAmount, OrderType, TableID, TableSessionID, CreatedBy}`.
6. Build items with `MenuNameSnapshot`, `Price`, `Status: PENDING`.

### 5.2 `OrderUsecase.CreateManual` and `PublicUsecase.CreateOrder`

```go
func (u *OrderUsecase) CreateManual(ctx, actorID uuid.UUID, in OrderInput) (*domain.Order, error)
func (u *PublicUsecase) CreateOrder(ctx, session *domain.TableSession, in OrderInput) (*domain.Order, error)
```

Both call `buildOrder`, then:

```go
u.withTx(ctx, func(tx OrderTx) error {
    o.OrderNumber = tx.NextOrderNumber(ctx, o.OrderType, now)
    tx.CreateOrder(ctx, o)
    tx.CreateItems(ctx, items)
    tx.ConsumeStock(ctx, o, items)
    tx.UpdateAggregate(ctx, o.ID, domain.OrderStatusWaiting)
    tx.Audit(ctx, &domain.AuditLog{Entity: "order", EntityID: o.ID,
        Action: "order_created", ToValue: string(o.Status), ActorID: actor})
})
```

Then publish `order.created` to `order:{id}` and `session:{token}` (session only for QR).

Public create also rejects when the session belongs to a closed session (middleware already does) and when the table id on the session does not match — no, session is the source of truth.

### 5.3 `UpdateItemStatus`

```go
func (u *OrderUsecase) UpdateItemStatus(ctx, orderID, itemID uuid.UUID,
        target domain.OrderItemStatus, actorID uuid.UUID, role domain.UserRole) (*domain.Order, error)
```

1. Read the order; `404` if missing; `404` if role `KITCHEN` and unpaid.
2. Role check per target and order type (decision 10) → `403 FORBIDDEN`.
3. Find the item; `404` if missing.
4. Same status already → return the order unchanged (`200`).
5. `domain.ValidateItemTransition(current, target)` → `409`.
6. `target == COOKING && payment != LUNAS` → `409 PAYMENT_REQUIRED`.
7. Transaction: `SetItemStatus`, recompute `domain.AggregateOrderStatus(items, payment, canceledAt != nil)`, `UpdateAggregate` when changed, `Audit` (`status_changed`, from, to, actor, role).
8. Publish `item.updated` and `order.updated` when the aggregate changed.

### 5.4 `CancelOrder`

```go
func (u *OrderUsecase) CancelOrder(ctx, orderID uuid.UUID, reason string,
        actorID *uuid.UUID, actorRole *domain.UserRole) (*domain.Order, error)
```

1. Read; `404` if missing.
2. `payment_status != BELUM` or `canceled_at != nil` → `409 INVALID_TRANSITION`.
3. Transaction: `RestoreStock`, `CancelOrder`, `UpdateAggregate(DIBATALKAN)`, `Audit` (`order_cancelled`, reason).
4. Publish `order.updated`.

`PublicUsecase.CancelOrder(ctx, session, orderID, reason)` loads the order, asserts `order.TableSessionID == session.ID`, then delegates to the same helper.

### 5.5 Reads

```go
func (u *OrderUsecase) List(ctx, filter domain.OrderFilter, role domain.UserRole) ([]domain.Order, error)
func (u *OrderUsecase) Get(ctx, id uuid.UUID, role domain.UserRole) (*domain.Order, error)
func (u *PublicUsecase) ListOrders(ctx, session *domain.TableSession) ([]domain.Order, error)
func (u *PublicUsecase) GetOrder(ctx, session *domain.TableSession, id uuid.UUID) (*domain.Order, error)
```

Kitchen filters applied in `List`/`Get` as decision 17. Public reads assert session ownership → `404` otherwise (BR-13; do not leak existence).

### 5.6 Deletions

- `internal/usecase/order_cancel.go` — replace with `cancel_order.go` implementing decision 14.
- Any `refund` reference in `order_usecase.go`, `order_repository.go`, `order_tx.go`.

## 6. Delivery

### 6.1 Routes

```go
// public, session middleware group (plan 03)
sessionGroup.POST("/orders", h.Public.CreateOrder, sessionRateLimit(5, 5))
sessionGroup.GET("/orders", h.Public.ListOrders, sessionRateLimit(30, 30))
sessionGroup.GET("/orders/:id", h.Public.GetOrder, sessionRateLimit(30, 30))
sessionGroup.POST("/orders/:id/cancel", h.Public.CancelOrder, sessionRateLimit(30, 30))

// internal
orders := e.Group("/orders", JWTMiddleware(authUsecase))
orders.GET("", h.Order.List, RequireRoles(OWNER, CASHIER, KITCHEN))
orders.GET("/:id", h.Order.Get, RequireRoles(OWNER, CASHIER, KITCHEN))
orders.POST("/manual", h.Order.CreateManual, RequireRoles(OWNER, CASHIER))
orders.PATCH("/:id/items/:item_id/status", h.Order.UpdateItemStatus, RequireRoles(OWNER, CASHIER, KITCHEN))
orders.POST("/:id/cancel", h.Order.CancelOrder, RequireRoles(OWNER))
```

Remove the old `POST /:id/items/:item_id/cancel` line.

### 6.2 DTOs

`dto/order.go` — order response aligned with `api.md`:

```go
type OrderResponse struct {
    ID            string  `json:"id"`
    OrderNumber   string  `json:"order_number"`
    OrderType     string  `json:"order_type"`
    TableID       *string `json:"table_id"`
    TableNumber   *string `json:"table_number"`
    CreatedBy     *string `json:"created_by"`
    CustomerName  string  `json:"customer_name"`
    CustomerPhone *string `json:"customer_phone"`
    Status        string  `json:"status"`
    PaymentStatus string  `json:"payment_status"`
    PaymentMethod *string `json:"payment_method"`
    SubtotalAmount int64  `json:"subtotal_amount"`
    ServiceAmount  int64  `json:"service_amount"`
    TaxAmount      int64  `json:"tax_amount"`
    TotalAmount    int64  `json:"total_amount"`
    CancelReason   *string `json:"cancel_reason"`
    CanceledAt     *string `json:"canceled_at"`
    CreatedAt      string  `json:"created_at"`
    Items          []OrderItemResponse
}
```

`OrderItemResponse` adds `completed_at`, `delivered_at`, keeps `menu_name_snapshot` as JSON `menu_name`.

Requests:

```go
type CreateOrderRequest struct {
    CustomerName  string  `json:"customer_name" validate:"required,max=100"`
    CustomerPhone *string `json:"customer_phone" validate:"omitempty,max=20"`
    PaymentMethod string  `json:"payment_method" validate:"required,oneof=CASH NON_CASH"`
    Items         []CreateOrderItemRequest `json:"items" validate:"required,min=1,max=50,dive"`
}

type ManualOrderRequest = CreateOrderRequest (same shape)
type CancelOrderRequest struct {
    Reason string `json:"reason" validate:"required,max=255"`
}
type UpdateItemStatusRequest struct {
    Status string `json:"status" validate:"required,oneof=COOKING READY DELIVERED COMPLETED"`
}
```

`dto/public.go` — public order responses drop `created_by`, `table_id`.

## 7. Tests

Keep the existing `order_usecase_test.go` shape, expand:

- Totals snapshot: create with settings `service_rate=5`, `tax_rate=10`, subtotal 50000 → `{2500, 5250, 57750}`; then change settings and confirm the old order is unchanged (BR-12).
- Order number: two creates in the same transaction scope produce `DI-YYYYMMDD-001` and `-002`; a `TAKE_AWAY` create uses `TA-`; a day rollover resets to `001`.
- Create rejects: closed store (`STORE_CLOSED`), unavailable menu (`NOT_FOUND`), insufficient stock (`STOCK_NOT_ENOUGH`, and no order row survives), blank `customer_name` (`VALIDATION_ERROR`).
- Transition matrix: every allowed pair passes; `COOKING` on unpaid → `PAYMENT_REQUIRED`; `CASHIER` cannot `COOKING` on `DINE_IN` → `FORBIDDEN`; repeated `DELIVERED` → `200` no-op (EC-10).
- Aggregate: item set `COMPLETED` → order `SELESAI`; a mix → `DIPROSES`; unpaid → `MENUNGGU`.
- Cancel: unpaid order → items `CANCELLED`, stock restored (assert `stock_movements` rows with `RESTORE` and matching quantities), order `DIBATALKAN`, `cancel_reason` set; paid order → `409`; twice → `409`.
- Public isolation: session A cannot read or cancel session B's order (`404`).
- Kitchen visibility: unpaid order → `404` on `GET /orders/:id`, absent from `GET /orders`.

`go test -race ./internal/usecase/...` for the transition race test.

## 8. Verification

```bash
go test ./... && go build ./...
```

Manual end-to-end with seeded data (`demo-qr-token`):

```bash
T=$(curl -sX POST localhost:8081/public/tables/demo-qr-token/sessions | jq -r .data.session_token)
curl -sX POST localhost:8081/public/orders -H "X-Session-Token: $T" -d '{
  "customer_name":"Budi","payment_method":"CASH",
  "items":[{"menu_id":"<latte uuid>","qty":2}]}'
curl -s localhost:8081/public/orders -H "X-Session-Token: $T"
```

Check in `psql` that `orders.order_number`, `service_amount`, `tax_amount`, `order_items.menu_name_snapshot` are filled and `stock_movements` has matching `OUT` rows.

## 9. Docs to update

- `../../../docs/api.md` — update the `order_number` example format to `DI-20261121-001`, and confirm the cancel example. Everything else already matches this plan.
- `docs/plans/README.md` — check off the gaps closed by 04.
- `docs/rules.md` — no change.
