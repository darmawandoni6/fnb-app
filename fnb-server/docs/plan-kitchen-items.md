# Plan: Internal — Kitchen Items Endpoints

Source: `../../docs/api.md`, `../../docs/PRD.md`, `../../docs/flow.md`

> **Status: IMPLEMENTED.** This plan is retained as a design record. Sections below note where the
> implementation lives. Remaining work is listed in "Remaining Gaps" at the bottom.

## Scope
Two endpoints from `../../docs/api.md`:
1. `PATCH /orders/:id/items/:item_id/status` — transition item status (`COOKING`/`READY`/`DELIVERED`)
2. `POST /orders/:id/items/:item_id/cancel` — cancel `PENDING` item (with refund logic if `LUNAS`)

---

## 1. Domain (`internal/domain`) — DONE

- `OrderItemStatus`, `OrderStatus`, `PaymentStatus` typed constants in `internal/domain` (enums)
- `AggregateOrderStatus(items, payment)` pure function in `internal/domain/order_status.go`
  - Precedence: DIBATALKAN (no active items) → SELESAI (all active DELIVERED + LUNAS) →
    DIANTAR (any DELIVERED) → SIAP (all active READY) → DIPROSES (any COOKING) → MENUNGGU
  - **Decision:** all active items DELIVERED but payment BELUM → order stays `DIANTAR` until
    payment endpoint recomputes on LUNAS. Matches PRD §5.1 gate.
- Transition validation (forward-only matrix) with per-transition role checks
- Tests: `internal/domain/order_status_test.go`

---

## 2. Repository (`internal/repository`) — DONE

Implemented in `internal/repository/order_repository.go`:
- Order + item loading with `FOR UPDATE` row locking (`clauseLocking()`) inside the transaction —
  required by flow.md "lock item, validate status = PENDING"
- `PersistCancel` single write for item cancel + refund + totals + aggregate
- Stock restore movements `RESTORE` with `order_id` + `order_item_id`
- All writes via `database.WithTx` (`internal/database/database.go`)

**Decision:** totals decrement is in-memory mutation + full `PersistCancel` save, not SQL-side
`SET x = x - ?`. Item row lock serializes concurrent cancels of the same item; a cross-item race
on the same order is accepted for M1.

---

## 3. Usecase (`internal/usecase`) — DONE

### `UpdateItemStatus` — `internal/usecase/order_usecase.go`
1. Load item + order
2. Validate transition matrix:
   - `PENDING → COOKING`: role `KITCHEN`/`OWNER`; reject if `payment_status == BELUM` → `PAYMENT_REQUIRED`
   - `COOKING → READY`: role `KITCHEN`/`OWNER`
   - `READY → DELIVERED`: role `CASHIER`/`OWNER`
   - Any other: `INVALID_TRANSITION`
3. Update item status
4. Recompute aggregate via `AggregateOrderStatus`
5. Return full order with items

### `CancelItem` — `internal/usecase/order_cancel.go` (`cancelOrderItem`)
1. Load item (item not in order → `NOT_FOUND`; status != `PENDING` → `INVALID_TRANSITION`)
2. Set `CANCELLED` + `cancelled_at`
3. Restore stock from `recipe_items`, write `RESTORE` movements
4. If `LUNAS`: proportional refund
   `item_tax = round(item_subtotal * tax_percent / 100)`, refund row carries
   `subtotal_amount`/`tax_amount`/`total_amount` of the refund, order totals decremented;
   refund `payment_method` copies order method, falls back to `CASH` (PRD §9)
5. If `BELUM`: no refund, totals unchanged (PRD §10)
6. All items cancelled → `DIBATALKAN`, totals = 0
7. Return full order

**Public/staff separation:** internal endpoint passes `actorID` from JWT, reason
`"staff cancelled item"`; public cancel (`internal/usecase/public_usecase.go:171`) reuses the same
`cancelOrderItem` with `actorID = nil` and fixed reason `"customer cancelled item"`. No `isPublic`
flag — token ownership verified at delivery layer.

---

## 4. Delivery (`internal/delivery/http`) — DONE

- Routes in `router.go:45-46`:
  - `orders.PATCH("/:id/items/:item_id/status", h.Order.UpdateItemStatus, RequireRoles(OWNER, CASHIER, KITCHEN))`
  - `orders.POST("/:id/items/:item_id/cancel", h.Order.CancelItem, RequireRoles(OWNER, CASHIER))`
- Handlers in `order_handler.go`: bind, UUID path validation (`VALIDATION_ERROR` on bad UUID),
  role from JWT context
- Per-transition role enforcement lives in the usecase (middleware only gates endpoint entry)
- Response: full order via `dto.OrderResponseFrom` + `Success` envelope

---

## 5. Tests — DONE (partially, see gaps)

- `internal/domain/order_status_test.go`: aggregate matrix + transition validation
- `internal/usecase/order_usecase_test.go`: payment gate, transitions, cancellation paths

---

## 6. Wiring — DONE

- Routes registered in `internal/delivery/http/router.go` order group with `RequireRoles`
- `OrderUsecase` constructed with `TxRunner` in `cmd/api/main.go`

---

## Open Questions — RESOLVED

- [x] Role middleware? → `RequireRoles(...)` in `internal/delivery/http/auth_middleware.go`
- [x] Existing repository? → `OrderRepository` in `internal/repository/order_repository.go`
- [x] `database.WithTx`? → exists in `internal/database/database.go`
- [x] `reason` field on cancel? → No. Fixed reasons per PRD §9:
      `"staff cancelled item"` / `"customer cancelled item"`
- [x] Test fixtures? → plain Go structs, no helpers needed

---

## Remaining Gaps

None. Both resolved:

1. ~~**Float tax math.**~~ Fixed: shared `domain.CalcTax(amount, percent)` integer helper
   (`internal/domain/order_status.go`) used by `order_cancel.go` and `order_create.go`.
   Half-up rounding without float on the amount; residual test in `order_status_test.go`
   (`TestCalcTax`). `TaxPercent` stays `float64` (numeric column).
2. ~~Plan doc updated~~ (this document).
