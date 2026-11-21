# Plan 03 — Public customer session

> **Status:** DONE (Completed on 2026-11-21)
> - Implemented `TableSessionUsecase` with idempotent open and concurrency race recovery.
> - Implemented `SessionMiddleware` validating `X-Session-Token` header and storing session in context.
> - Masked `X-Session-Token` in request logger.
> - Rewrote `PublicUsecase.Menu` and updated DTOs (`service_rate`, `tax_rate`, omit empty categories).
> - Registered `POST /public/tables/:qr_token/sessions` and `GET /public/menu`.
> - Unit tests passing: `table_session_usecase_test.go`, `session_middleware_test.go`, `public_handler_test.go`, `request_logger_test.go`.
> - Updated Bruno API collection in `api-collection/public/` and `environments/local.bru`.

Replaces the `qr_token`-per-request + `tracking_token` model with table sessions and the `X-Session-Token` header (PRD §4.6, §11.2; `api.md` Public).

Depends on: 01.
Blocks: 04 (order creation needs a session), 05, 06.

## 1. Scope

In:

| Method | Path | Role |
|---|---|---|
| `POST` | `/public/tables/:qr_token/sessions` | public, no token |
| `GET` | `/public/menu` | `X-Session-Token` |

Plus the `X-Session-Token` middleware and the in-memory rate limits from `api.md`.

Out:

- `POST /public/orders`, `GET /public/orders*`, `POST /public/orders/:id/cancel` (plan 04).
- Removal of the old `GET /public/tables/:qr_token/menu`, `POST /public/tables/:qr_token/orders`, `GET /public/orders/:tracking_token`, `POST /public/orders/:tracking_token/cancel` route entries happens here; their usecase bodies are deleted in plan 04.

## 2. Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | Session open is idempotent while a session is `OPEN`: same table → same `session_token`. | EC-14: scanning again after closing the browser must resume tracking. |
| 2 | A closed session is never reopened; scan creates a new row. | PRD §4.6 step 4. |
| 3 | Inactive table or unknown `qr_token` → `404 NOT_FOUND`. | `api.md` Open table session. |
| 4 | Creating an order requires an `OPEN` session; a closed session token → `401 UNAUTHORIZED`. | `api.md` Public — customer header rule. |
| 5 | Token: 32 random bytes from `crypto/rand`, hex encoded (64 chars). Stored plain. | PRD §10.5; `qr_token` has the same threat model. |
| 6 | The partial unique index `(table_id) WHERE status = 'OPEN'` is the concurrency guard: `INSERT` losing the race retries a read. | Plan 01 §3.4; avoids `SELECT`-then-`INSERT` race (EC-04). |
| 7 | `GET /public/menu` reads `settings` for `cafe_name`, `service_rate`, `tax_rate`, `is_open` and returns categories with at least one available menu. | `api.md` Menu response; empty categories are omitted. |
| 8 | Rate limits: session open 20/min keyed by `qr_token`; menu 60/min keyed by session token. | `api.md` rate limit table. |
| 9 | Rate limiter stays in-memory per instance. | `docs/tech-stack.md` excludes Redis. |
| 10 | The session token is never logged; the request logger masks `X-Session-Token`. | PRD §11 security; `docs/logging.md` secret rules. |
| 11 | `closed_by` is null for automatic closes. | PRD §10.5. |

## 3. Schema

`table_sessions` from plan 01. No further change.

## 4. Domain

`internal/domain/table_session.go`:

```go
type TableSession struct {
    ID           uuid.UUID          `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
    TableID      uuid.UUID          `gorm:"type:uuid;not null;index"`
    Table        Table              `gorm:"foreignKey:TableID"`
    SessionToken string             `gorm:"not null;uniqueIndex"`
    Status       TableSessionStatus `gorm:"type:table_session_status;not null;default:OPEN"`
    StartedAt    time.Time
    EndedAt      *time.Time
    ClosedBy     *uuid.UUID         `gorm:"type:uuid"`
    CreatedAt    time.Time
    UpdatedAt    time.Time
}

type TableSessionRepository interface {
    GetOpenByTableID(ctx context.Context, tableID uuid.UUID) (*TableSession, error)
    GetBySessionToken(ctx context.Context, token string) (*TableSession, error)
    Create(ctx context.Context, s *TableSession) error
    Close(ctx context.Context, id uuid.UUID, closedBy *uuid.UUID) error
}
```

## 5. Repository

`internal/repository/table_session_repository.go`:

- `GetOpenByTableID` — `Where("table_id = ? AND status = ?", id, OPEN)`.
- `GetBySessionToken` — preload `Table`.
- `Create` — plain insert; on unique violation of the open-session index, return the existing row to the caller (translate `pgconn.PgError` code `23505` into a sentinel error the usecase handles).
- `Close` — set `status = CLOSED`, `ended_at = now()`, `closed_by`.

## 6. Usecase

`internal/usecase/table_session_usecase.go`

```go
func (u *TableSessionUsecase) Open(ctx context.Context, qrToken string) (*domain.TableSession, error)
func (u *TableSessionUsecase) RequireOpen(ctx context.Context, sessionToken string) (*domain.TableSession, error)
```

`Open`:

1. `tableRepo.GetByQRToken`; nil or `!IsActive` → `404`.
2. `GetOpenByTableID`; hit → return it (idempotent).
3. Generate token, `INSERT`; on open-session unique violation → re-read and return.
4. `audit_log` action `session_opened` (plan 01 repository).

`RequireOpen` — used by the middleware and by every later public usecase:

1. `GetBySessionToken`; nil → `401`.
2. `status != OPEN` → `401`.
3. Table inactive → `401`.

`PublicUsecase.Menu` is rewritten to take the session instead of `qr_token`:

```go
func (u *PublicUsecase) Menu(ctx context.Context, s *domain.TableSession) (*MenuResult, error)
```

`MenuResult` gains `ServiceRate` and `TaxRate`; drop `TaxPercent`.

## 7. Delivery

### 7.1 Middleware `internal/delivery/http/session_middleware.go`

```go
const ContextSessionKey = "table_session"

func SessionMiddleware(u *usecase.TableSessionUsecase) echo.MiddlewareFunc
func GetTableSession(c echo.Context) (*domain.TableSession, bool)
```

Reads `X-Session-Token`; missing → `401 UNAUTHORIZED`; invalid/closed → `401`; on success stores the `*domain.TableSession` in context.

### 7.2 Router

```go
publicGroup := e.Group("/public")
publicGroup.POST("/tables/:qr_token/sessions", h.Public.OpenSession, qrRateLimit(20, 20))

sessionGroup := e.Group("/public", SessionMiddleware(tableSessionUsecase))
sessionGroup.GET("/menu", h.Public.Menu, sessionRateLimit(60, 60))
```

Remove the four old public routes.

### 7.3 DTOs `internal/delivery/http/dto/public.go`

```go
type OpenSessionResponse struct {
    SessionToken string `json:"session_token"`
    TableNumber  string `json:"table_number"`
    Status       string `json:"status"`
}

type MenuResponse struct {
    CafeName    string
    ServiceRate float64
    TaxRate     float64
    IsOpen      bool
    Categories  []MenuCategoryResponse
}
```

Delete `CreateOrderResponse`, `OrderStatusResponse`, `CancelItemRequest`, `TrackingToken` field usage. These are re-added in plan 04 with the session model.

### 7.4 Rate limit keys

`qrRateLimit` keyed by `qr_token` stays. `sessionRateLimit(perMinute, burst)` keyed by session token — add to `public_rate_limit.go`, replacing `statusRateLimit`.

## 8. Tests

- `table_session_usecase_test.go`: new table → created; second open → same token; closed session → `401`; inactive table → `404`; two concurrent opens produce one row (unique index; use `go test -race`).
- `session_middleware_test.go`: missing header, garbage token, closed session, valid token stores the session.
- `public_handler_test.go`: menu response shape matches `api.md`; empty category omitted.
- Request logger test: `X-Session-Token` masked in output.

## 9. Verification

```bash
go test ./internal/usecase/... ./internal/delivery/http/... -race
```

Manual with the seeded `demo-qr-token` table:

```bash
curl -sX POST localhost:8081/public/tables/demo-qr-token/sessions
curl -s localhost:8081/public/menu -H "X-Session-Token: <token>"
curl -s localhost:8081/public/menu -H "X-Session-Token: nope"   # 401
```

## 10. Docs to update

- `../../../docs/api.md` — already documents these endpoints; no change.
- `docs/rules.md` — add the `X-Session-Token` masking requirement to the checklist.
- `scripts/seed.sql` — no change; `demo-qr-token` still works.
