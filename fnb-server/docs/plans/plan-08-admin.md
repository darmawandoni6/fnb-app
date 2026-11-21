# Plan 08 — Admin surface alignment

Brings the remaining CRUD and the missing admin endpoints in line with PRD §7.4, §9 and `api.md`. Most endpoints already exist; this plan fixes the fields, the role exceptions, and adds what is missing.

Depends on: 01, 04.
Blocks: 09.

## 1. Scope

In:

| Group | Work |
|---|---|
| Menus, categories | Keep. Align DTO field names, add the `CASHIER` exception on `PATCH /menus/:id` (`is_available` only). |
| Tables | Keep. Add `GET /tables/:id/session`, `POST /tables/:id/session/close`. Align `qr_token` non-rotating rule. |
| Stock | Keep. Add `POST /ingredients/:id/adjust`; gate recipe edits on `settings.is_open`; align `stock_movements` filters. |
| Settings | Rename and add the fields from plan 01 (`service_rate`, `tax_rate`, four timers). |
| Users | Keep. Document that only `CASHIER`/`KITCHEN` are creatable; the owner comes from the seed. |
| Audit | New `GET /audit-log`. |

Out:

- Reports (phase 2).
- Recipe editing while the store is open is a gate, not a new flow.
- Anything already matching `api.md` is verified, not rewritten.

## 2. Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | Menu CRUD stays `OWNER`-only except `PATCH /menus/:id` for `CASHIER` with `is_available` only. Sending any other field as a cashier → `403 FORBIDDEN`. | `api.md` menus exception; dashboard already toggles availability. |
| 2 | Menu photo upload keeps the current multipart path and `UPLOAD_DIR`. | Existing behavior; no product change. |
| 3 | Deleting a menu with order history keeps row deletion allowed because `order_items` stores `menu_id` FK and `menu_name_snapshot`; a deleted menu leaves `menu_id` dangling? No — `order_items.menu_id` is `NOT NULL REFERENCES menus(id)`. Deletion must be a soft delete (`is_available = false`) or blocked while items reference it. | Referential integrity; PRD §7.4 says "delete/deactivate menu". |
| 4 | So `DELETE /menus/:id` deactivates (`is_available = false`) and never deletes a row. `DELETE /menu-categories/:id` is blocked with `409 INVALID_TRANSITION` when menus reference it. | Same reason. |
| 5 | `DELETE /tables/:id` deactivates (`is_active = false`), it does not delete. A deactivated table returns `404` on QR scan (plan 03). | `api.md` "Deactivating a table is the way to reject its QR scans". |
| 6 | `qr_token` does not rotate. Reprinting produces the same QR. | `api.md` tables note. |
| 7 | `GET /tables/:id/session` returns the `OPEN` session or `404`. `POST /tables/:id/session/close` closes it with `closed_by = <JWT user>`. | `api.md` tables and sessions. |
| 8 | Closing a session never touches orders. | PRD §4.6 step 5. |
| 9 | Closed sessions cannot be reopened. A close on an already-closed table → `404`. | PRD §4.6 step 4. |
| 10 | `POST /ingredients/:id/adjust` is stock opname: body `{stock_qty, note?}`, replaces `stock_qty`, writes `ADJUSTMENT` with the signed delta, rejected when the delta is zero. | `flow.md` Stock Opname; `api.md` stock table. |
| 11 | `POST`, `PATCH`, `DELETE` on `/recipe-items` are rejected with `409 STORE_CLOSED` while `settings.is_open`. Reads stay allowed. | BR-23. |
| 12 | `GET /stock-movements` filters `ingredient_id`, `type`, `from`, `to`; ordered `created_at DESC`, `LIMIT 200`. | `api.md` stock table. |
| 13 | Settings DTO carries every field from PRD §10.16 except `id`/timestamps. Rates validated `0..100`; timers `> 0`; `ready_auto_deliver_warning_minutes < ready_auto_deliver_minutes` (DB constraint from plan 01, mirrored in the usecase for a clean `400`). | `api.md` settings fields; avoid a `500` from the constraint. |
| 14 | Changing `service_rate`/`tax_rate` affects only new orders because orders snapshot them. | BR-12; nothing to implement, add an integration assertion. |
| 15 | `GET /audit-log` is `OWNER`-only, filters `entity`, `entity_id`, `actor_id`, `from`, `to` (ISO dates), `LIMIT 200`, `created_at DESC`. | `api.md` users/settings/audit table. |
| 16 | Audit writes are done by usecases (plans 04, 05, 07), never by handlers. | `docs/rules.md`. |
| 17 | User creation stays limited to `CASHIER`/`KITCHEN`; promoting someone to `OWNER` is not an endpoint. | PRD §3; owner comes from the seed. |
| 18 | `GET /settings` returns the single row; a missing row is `500` (the seed creates it), not an empty object. | Single-outlet invariant. |
| 19 | Every list endpoint keeps `LIMIT 200` unless `api.md` says otherwise. | Predictable memory. |

## 3. Schema

Plan 01 covers the settings columns. One change here:

```sql
ALTER TABLE menus ADD COLUMN deleted_at TIMESTAMPTZ;  -- not needed if decision 4 uses is_available
```

Decision 4 uses `is_available = false`, so no new column. Document that "delete" means deactivate in the handler comment and in `api.md`.

## 4. Domain

- `MenuRepository`: add `SetAvailability(ctx, id uuid.UUID, available bool) error`, `ListByCategoryID` for the delete guard.
- `MenuCategoryRepository`: `CountMenus(ctx, categoryID) (int64, error)`.
- `TableRepository`: `GetByID`, `GetActiveByID`, `Deactivate`; plus `TableSessionRepository` from plan 03.
- `IngredientRepository`: `AdjustStock(ctx, id uuid.UUID, counted float64) error` in the tx.
- `AuditRepository` from plan 01.

## 5. Repository

- `menu_repository.go` — availability update and category guard count.
- `table_repository.go` — deactivate, get by id.
- `table_session_repository.go` — reuse plan 03 `Close`.
- `stock_repository.go` — `AdjustStock` locks the ingredient row, computes the delta, updates, returns the delta for the movement insert.
- `audit_repository.go` — filtered list.

## 6. Usecase

| Usecase | Change |
|---|---|
| `MenuUsecase.Update` | Split into `UpdateAsOwner` and `UpdateAvailabilityAsCashier`; the handler picks by role. |
| `MenuUsecase.Delete` | Soft delete. |
| `MenuCategoryUsecase.Delete` | Guard on referencing menus. |
| `TableUsecase.Delete` | Soft delete. |
| `TableSessionUsecase` | `GetOpen(tableID)`, `CloseByTable(tableID, actorID)` reusing plan 03. Closing publishes `session.closed`. |
| `IngredientUsecase.Adjust` | Opname per decision 10, inside `StockTx`. |
| `RecipeItemUsecase` | Check `settings.is_open` before mutate → `409 STORE_CLOSED`. |
| `SettingsUsecase.Update` | Validate the whole new field set including cross-field timer rule. |
| `AuditUsecase.List` | Thin passthrough with filter normalization. |

## 7. Delivery

### 7.1 Routes

Add to `router.go`:

```go
admin.GET("/audit-log", h.Audit.List)

tables := e.Group("/tables", JWTMiddleware(authUsecase))
tables.GET("/:id/session", h.Admin.GetSession, RequireRoles(CASHIER, OWNER))
tables.POST("/:id/session/close", h.Admin.CloseSession, RequireRoles(CASHIER, OWNER))

menus := e.Group("/menus", JWTMiddleware(authUsecase))
menus.PATCH("/:id", h.Admin.UpdateMenu, RequireRoles(OWNER, CASHIER)) // role split inside the handler

stock.POST("/ingredients/:id/adjust", h.Stock.Adjust, RequireRoles(OWNER))
stock.GET("/stock-movements", h.Stock.Movements, RequireRoles(OWNER))
```

Keep the existing `/menus/:id` route but relax its middleware to `OWNER`,`CASHIER` and do the field check in the handler, because Echo cannot branch on the body in middleware cleanly.

### 7.2 DTOs

`dto/users_settings.go`:

```go
type UpdateSettingsRequest struct {
    CafeName                        *string  `json:"cafe_name" validate:"omitempty,min=1"`
    ServiceRate                     *float64 `json:"service_rate" validate:"omitempty,gte=0,lte=100"`
    TaxRate                         *float64 `json:"tax_rate" validate:"omitempty,gte=0,lte=100"`
    IsOpen                          *bool    `json:"is_open"`
    CashTimeoutMinutes              *int     `json:"cash_timeout_minutes" validate:"omitempty,min=1"`
    DeliveredAutoCompleteMinutes    *int     `json:"delivered_auto_complete_minutes" validate:"omitempty,min=1"`
    ReadyAutoDeliverMinutes         *int     `json:"ready_auto_deliver_minutes" validate:"omitempty,min=1"`
    ReadyAutoDeliverWarningMinutes  *int     `json:"ready_auto_deliver_warning_minutes" validate:"omitempty,min=0"`
}
```

`dto/stock.go`:

```go
type AdjustStockRequest struct {
    StockQty float64 `json:"stock_qty" validate:"required,gte=0"`
    Note     *string `json:"note" validate:"omitempty,max=255"`
}
```

`dto/admin.go`:

```go
type UpdateMenuRequest struct { /* owner fields */ }
type UpdateMenuAvailabilityRequest struct {
    IsAvailable bool `json:"is_available"`
}
type AuditLogResponse struct {
    ID        string
    Entity    string
    EntityID  string
    Action    string
    FromValue *string
    ToValue   *string
    ActorID   *string
    ActorRole *string
    CreatedAt string
}
```

## 8. Tests

- Cashier may toggle `is_available`; cashier sending `price` → `403`.
- `DELETE /menus/:id` sets `is_available = false` and the menu disappears from `GET /public/menu`.
- `DELETE /menu-categories/:id` with menus → `409`.
- Recipe mutation while `is_open = true` → `409 STORE_CLOSED`; read still `200`.
- Stock opname: counted equals current → `400`; counted lower → negative `ADJUSTMENT` and `stock_qty` replaced; counted higher → positive.
- `GET /stock-movements` filters and ordering.
- Settings: full update round-trip; warning >= deliver → `400`; rate > 100 → `400`.
- Rate change does not mutate an existing order's snapshots (asserted with a create before and after).
- `/audit-log` returns the entries written by plans 04/05/07 with the filters applied.
- Table session endpoints: open session returned; close sets `CLOSED` and `closed_by`; second close → `404`.

## 9. Verification

```bash
go test ./... && go build ./...
```

Manual: run the Bruno collection for `users`, `menus`, `tables`, `stock` (created in plan 09) and confirm every request matches `api.md`.

## 10. Docs to update

- `../../../docs/api.md` — add the `ADJUSTMENT` example response, confirm the soft-delete wording for menus/tables, add the audit-log response shape.
- `docs/plans/README.md` — check off the remaining gaps.
- `docs/rules.md` — no change.
