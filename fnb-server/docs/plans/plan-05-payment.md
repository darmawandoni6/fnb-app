# Plan 05 — Payment

> **Status:** DONE (Completed on 2026-11-21)
> - `PATCH /orders/:id/payment` replaced the old `UpdatePayment` with `OrderUsecase.ConfirmPayment`: idempotent on `LUNAS`, cash math validated and recomputed server-side, one `payment_log` (gateway `NULL` for cash).
> - `POST /public/payments/midtrans/callback` verifies `sha512(order_id + status_code + gross_amount + server_key)`, then settles/expires the order's `PENDING` `payment_log` row in one transaction.
> - Snap creation after the create transaction commits for `NON_CASH`; gateway failure logs a warning and leaves `payment_url`/`snap_token` null.
> - `internal/repository/midtrans_client.go` hand-rolled over `net/http` (10 s timeout, one retry); no SDK.
> - Config `MIDTRANS_SERVER_KEY`/`MIDTRANS_CLIENT_KEY`/`MIDTRANS_IS_PRODUCTION`; production requires the server key, development warns and skips Snap.
> - Unit tests passing: `payment_usecase_test.go`, `payment_handler_test.go`.

Cash confirmation and Midtrans Snap with an idempotent callback (PRD §4.3, §11.5; `api.md` Payment and Midtrans sections).

Depends on: 04.
Blocks: 08 (receipt fields), 09.

## 1. Scope

In:

| Method | Path | Role |
|---|---|---|
| `PATCH` | `/orders/:id/payment` | `CASHIER`, `OWNER` |
| `POST` | `/public/payments/midtrans/callback` | public, signature verified |

Plus: Snap transaction creation when a `NON_CASH` order is created (inside plan 04's create path), `payment_log` writes, `paid_at`/`payment_ref`/`amount_received`/`change_amount`, and config for Midtrans credentials.

Out:

- Refund (PRD §1.4).
- Reports.
- Receipt printing (dashboard-side, reads the order response from plan 04).

## 2. Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | Cash confirmation is idempotent: `payment_status = LUNAS` already → `200` with the same order and no new `payment_log`. | BR-11, EC-02. |
| 2 | Payment body: `{payment_method, amount_received?, change_amount?}`. | `api.md` Payment. |
| 3 | `amount_received` and `change_amount` are accepted and stored only for `CASH`; ignored and returned `null` for `NON_CASH`. | Receipt reprint must show the same figures. |
| 4 | `change_amount` is validated: `amount_received >= total_amount` and `change_amount == amount_received - total_amount` when provided. Server recomputes and stores its own value; a mismatch is `400 VALIDATION_ERROR`. | Cash drawer correctness is a trust boundary; never trust client totals. |
| 5 | Confirmation moves the order to `DIPROSES` and writes one `payment_log` (`method`, `amount = total`, `status = SETTLED` for gateway, `SETTLED` for cash too — the column is about money, not the rail). | `api.md` Payment; PRD §10.14. |
| 6 | `payment_log` for cash has `gateway = NULL`, `gateway_ref = NULL`. | PRD §10.14. |
| 7 | Manual `NON_CASH` confirmation (Midtrans not yet live) is allowed: `gateway = NULL`, no `gateway_ref`. | PRD §11.5 last paragraph. |
| 8 | Snap is created at order creation for `payment_method = NON_CASH`, inside no transaction with the DB write; failure to reach Midtrans → order creation still succeeds, response has `payment_url = null` and a logged warning. | Gateway outage must not block the kitchen (EC-05). |
| 9 | Snap line items are generated from `order_items` snapshots plus a `Service` and `Tax` line so the gateway total equals `total_amount`. | Midtrans reconciles the sum of items against `gross_amount`. |
| 10 | Snap `order_id` is our `order_number`; `custom_field1` is our `orders.id`. | `order_number` is what the cashier sees; the UUID is the stable key. |
| 11 | Callback verifies the SHA-512 signature `sha512(order_id + status_code + gross_amount + server_key)` over the raw fields; mismatch → `401 UNAUTHORIZED`, nothing written. | BR-16. |
| 12 | Callback is idempotent on the order's `PENDING`/`SETTLED` `payment_log` row: a replay finds it already `SETTLED` and returns `200` with no writes. | BR-16, EC-02 spirit. |
| 13 | Callback status mapping: `settlement` → paid; `expire`/`deny`/`cancel` → order-level cancel with stock restore reusing plan 04's `CancelOrder`; anything else → `200` no state change. | PRD §11.5 table; `api.md` Midtrans callback. |
| 14 | Callback always returns `200` (except signature failure) so Midtrans stops retrying. | Gateway contract; a `5xx` triggers retries that cannot succeed when the payload is unknown. |
| 15 | Callback runs in one transaction: payment_log settle/expire, order status, item cancel, stock restore, audit. | `flow.md` Midtrans callback. |
| 16 | Cash timeout is scheduler work (plan 07); this plan only exposes the cancel helper it calls. | Split of concerns. |
| 17 | `payment_confirmed` audit entry for both rails, with `actor_id` null for the callback. | PRD §10.15. |
| 18 | `amount_received < total_amount` → `400 VALIDATION_ERROR` (underpayment is not a rounding case). | Cash integrity. |
| 19 | Config: `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION` (bool). Missing server key in production → callback endpoint returns `503 INTERNAL_ERROR`? No: startup fails. Missing in development → Snap creation is skipped with a warning so local work continues. | Same reasoning as the owner seed. |

## 3. Schema

From plan 01: `payment_log` with `gateway_ref TEXT UNIQUE` (nullable), and `orders.payment_ref|paid_at|amount_received|change_amount`.

No new index. `gateway_ref` idempotency is resolved through the plan 04 `PENDING` row per order (decision 12/§6.2), so the partial index is unnecessary.

## 4. Domain

`internal/domain/payment_log.go` (from plan 01) plus:

```go
type PaymentLogRepository interface {
    Create(ctx context.Context, p *PaymentLog) error
    GetByGatewayRef(ctx context.Context, ref string) (*PaymentLog, error)
    Mark(ctx context.Context, id uuid.UUID, status PaymentLogStatus, gatewayStatus *string) error
}
```

`internal/domain/payment_gateway.go`:

```go
type SnapRequest struct {
    OrderNumber string
    OrderID     uuid.UUID
    GrossAmount int64
    Customer    struct{ Name, Phone string }
    Items       []SnapItem
}
type SnapItem struct {
    ID, Name string
    Price    int64
    Quantity int
}
type SnapResponse struct {
    Token       string
    RedirectURL string
}
type PaymentGateway interface {
    CreateSnap(ctx context.Context, req SnapRequest) (*SnapResponse, error)
}
```

`ErrGatewayUnavailable` sentinel so the create usecase can swallow it.

## 5. Repository

`internal/repository/payment_log_repository.go` — plain GORM.

`internal/repository/midtrans_client.go` — HTTP client over `net/http`:

- `POST https://app.midtrans.com/snap/v1/transactions` (sandbox `https://app.sandbox.midtrans.com`) with Basic auth `server_key:`.
- 10 s timeout, one retry on connection error.
- Parse `token` and `redirect_url`.

No SDK; PRD deliberately excludes gateway SDKs (`docs/tech-stack.md` "Deliberately Excluded").

`internal/repository/order_repository.go` gains the tx methods used by the callback:

```go
SetPaid(ctx, orderID, method, ref *string, paidAt time.Time, amountReceived, changeAmount *int64) error
CreatePaymentLog(ctx, *domain.PaymentLog) error
GetPaymentLogByGatewayRef(ctx, ref string) (*domain.PaymentLog, error)
UpdatePaymentLogStatus(ctx, id uuid.UUID, status domain.PaymentLogStatus, gatewayStatus *string) error
```

## 6. Usecase

### 6.1 `OrderUsecase.ConfirmPayment`

```go
type ConfirmPaymentInput struct {
    Method         domain.PaymentMethod
    AmountReceived *int64
    ChangeAmount   *int64
}

func (u *OrderUsecase) ConfirmPayment(ctx context.Context, orderID uuid.UUID,
        in ConfirmPaymentInput, actorID uuid.UUID, actorRole domain.UserRole) (*domain.Order, error)
```

1. Read order; `404` if missing.
2. Already `LUNAS` → return the order (`200`, no writes). Log at debug.
3. `canceled_at != nil` → `409 INVALID_TRANSITION`.
4. Method validation: required, `CASH`/`NON_CASH`; `CASH` requires `amount_received`.
5. Cash math per decision 4 → `400` on mismatch.
6. Transaction: `SetPaid`, `CreatePaymentLog`, recompute aggregate (`DIPROSES` unless every item already terminal), `UpdateAggregate`, `Audit` `payment_confirmed`.
7. Publish `order.updated` after commit.

### 6.2 Snap at creation

In plan 04's create path, after the DB transaction commits:

```go
if order.PaymentMethod == domain.PaymentMethodNonCash && u.gateway != nil {
    snap, err := u.gateway.CreateSnap(ctx, buildSnapRequest(order))
    if err != nil { log warn; return order without URL }
    // store snap token / redirect url in the response only, not in the DB
}
```

`payment_log` `PENDING` is written inside the create transaction with `amount = total`, so the callback can match `gateway_ref` later. The `PENDING` row has no `gateway_ref` yet; the callback sets it. That means `gateway_ref` idempotency needs the order: the callback looks up the `PENDING` log by `order_id` and `status = PENDING`, then writes `gateway_ref`. Decision 12 becomes: idempotent on `(order_id, gateway_ref)` with the `PENDING` row updated in place, so a replay finds an already-`SETTLED` row and returns `200`.

### 6.3 `PaymentUsecase.HandleMidtransCallback`

```go
type CallbackInput struct {
    OrderID           string // our order_number
    StatusCode        string
    GrossAmount       string
    SignatureKey      string
    TransactionStatus string
    TransactionID     string
    FraudStatus       string
}

func (u *PaymentUsecase) HandleMidtransCallback(ctx context.Context, in CallbackInput) error
```

1. Signature check → `401` on mismatch (no DB read).
2. Resolve order by `order_number`; missing → `404` (logged, still `404` because it is not a replay).
3. Transaction:
   - `settlement` (and `capture` with `fraud_status = accept`): find `PENDING` log for the order, set `gateway_ref`, `gateway_status`, `SETTLED`; `SetPaid`; aggregate `DIPROSES`; audit. Already `SETTLED` → commit nothing, return nil.
   - `expire`/`deny`/`cancel`: mark the log `EXPIRED`; call the shared cancel helper (items `CANCELLED`, stock `RESTORE`, order `DIBATALKAN`, `cancel_reason = "midtrans "+status`); audit.
   - anything else: no writes.
4. Publish `order.updated` after commit.

## 7. Delivery

### 7.1 Routes

```go
orders.PATCH("/:id/payment", h.Order.ConfirmPayment, RequireRoles(OWNER, CASHIER))
publicGroup.POST("/payments/midtrans/callback", h.Payment.MidtransCallback)
```

The callback route is outside the session middleware group and has no rate limit beyond the global logger; Midtrans retries are expected.

### 7.2 DTOs

`dto/order.go`:

```go
type ConfirmPaymentRequest struct {
    PaymentMethod  string `json:"payment_method" validate:"required,oneof=CASH NON_CASH"`
    AmountReceived *int64 `json:"amount_received" validate:"omitempty,min=0"`
    ChangeAmount   *int64 `json:"change_amount" validate:"omitempty,min=0"`
}
```

Order response adds `payment_ref`, `paid_at`, `amount_received`, `change_amount`, `payment_url`, `snap_token` (the last two are populate-only at creation, `null` elsewhere).

`dto/payment.go`:

```go
type MidtransCallbackRequest struct {
    OrderID           string `json:"order_id" form:"order_id"`
    StatusCode        string `json:"status_code" form:"status_code"`
    GrossAmount       string `json:"gross_amount" form:"gross_amount"`
    SignatureKey      string `json:"signature_key" form:"signature_key"`
    TransactionStatus string `json:"transaction_status" form:"transaction_status"`
    TransactionID     string `json:"transaction_id" form:"transaction_id"`
    FraudStatus       string `json:"fraud_status" form:"fraud_status"`
}
```

Midtrans posts `application/x-www-form-urlencoded` or JSON; bind both (Echo binds form into `form` tags only when the content type says so — add an explicit `c.Request().ParseForm()` path when the content type is form-encoded).

Response for the callback is `200` with the standard success envelope; Midtrans ignores the body.

### 7.3 Config

```go
MidtransServerKey    string
MidtransClientKey    string
MidtransIsProduction bool
```

Validation: production requires a server key. Development without a key disables Snap creation with one warning log at startup.

### 7.4 Wiring

`cmd/api/wiring_payment.go`:

```go
func newPaymentHandler(db *gorm.DB, cfg *config.Config, log *slog.Logger) *httpDelivery.PaymentHandler
func newPaymentUsecase(db *gorm.DB, cfg *config.Config) *usecase.PaymentUsecase
func newSnapClient(cfg *config.Config) domain.PaymentGateway // nil when unconfigured
```

`newOrderHandler` receives the same gateway and publisher.

## 8. Tests

- `ConfirmPayment`: cash paid once → `LUNAS`, one `payment_log`, `paid_at` set, aggregate `DIPROSES`; repeat → `200` unchanged, still one log row (BR-11).
- Cash math: `amount_received` below total → `400`; `change_amount` inconsistent → `400`; correct → stored exactly.
- `NON_CASH` manual confirm: `payment_ref` null; `amount_received` ignored and stored null.
- Paid then cancel → `409 INVALID_TRANSITION`.
- Callback signature: wrong signature → `401`, zero writes.
- Callback settlement → paid + aggregate; replay with the same `transaction_id` → `200`, single `payment_log`, `paid_at` unchanged (compare timestamps).
- Callback `expire` → order `DIBATALKAN`, items `CANCELLED`, stock restored exactly once (count `RESTORE` rows); a second expire callback adds no rows.
- Callback unknown status → `200`, no writes.
- Snap request builder: sum of item prices + service + tax equals `total_amount` (table-driven over a few totals, including rounded ones).
- Use a fake `PaymentGateway` in usecase tests; no network.

## 9. Verification

```bash
go test ./internal/usecase/... ./internal/repository/...
```

Manual without Midtrans credentials:

```bash
curl -sX PATCH localhost:8081/orders/<id>/payment -H "Authorization: Bearer $A" \
  -d '{"payment_method":"CASH","amount_received":100000,"change_amount":42250}'
# repeat → 200, same body, psql: SELECT count(*) FROM payment_log WHERE order_id = '<id>';  -- 1
```

Callback replay:

```bash
# compute signature: sha512(order_number + status_code + gross_amount + server_key)
curl -sX POST localhost:8081/public/payments/midtrans/callback -d '...'
```

## 10. Docs to update

- `../../../docs/api.md` — cash confirmation body already documented; add the `capture`/`fraud_status` nuance and the `payment_url`-null-on-gateway-failure note.
- `docs/tech-stack.md` — note the Midtrans client is hand-rolled `net/http`, no SDK (records the decision).
- `AGENTS.md` — add `MIDTRANS_*` env vars.
- `../../../docs/PRD.md` — no change.
