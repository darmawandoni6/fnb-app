# Plan 10 — Reports

> **Status:** DONE (Completed on 2026-11-22)
> - `GET /reports/summary` returns `summary`, `trends`, `top_menus`, `categories` from four concurrent queries (`errgroup`); `GET /reports/transactions` reuses `OrderRepository.List` with the new `PaymentMethod`/`From`/`To` filters.
> - Trends zero-fill missing days in SQL with `generate_series`; aggregates scope `payment_status = 'LUNAS' AND status <> 'DIBATALKAN'`.
> - `from`/`to` required, `from <= to`, span ≤ 366 days → `400 VALIDATION_ERROR`; `CASHIER`/`KITCHEN` → `403`.
> - Tests passing: summary envelope, range validation (missing, inverted, too long, bad format), role guard, transaction filters, invalid filter value.
> - Bruno: `api-collection/reports/` (`01-summary`, `02-transactions`).
> - Dashboard: `src/api/http/reports.ts`; the four aggregate hooks share one `['reports', 'summary', filter]` query via `select`. Verified live against the seeded database.

Read-only analytics for `OWNER`. The contract is frozen in `../../../docs/api.md` § Internal — reports.

Depends on: 01, 04. Blocks: nothing; plan 09 already closed the 01–09 milestone.

## 1. Scope

In:

| Group | Work |
|---|---|
| Aggregates | New `GET /reports/summary` — KPI summary, daily trend, top menus, category share in one response |
| Transactions | New `GET /reports/transactions` — order history, reuses the `GET /orders` DTO |
| Orders filter | `OrderFilter` gains `PaymentMethod`, `From`, `To` so transactions reuse `OrderRepository.List` |

Out:

- CSV export — the dashboard generates it client-side from `Order[]`.
- Pagination on transactions — 200-row cap until history outgrows one screen.
- Materialized views or a `report_*` table — live aggregates until volume demands a rollup.
- WhatsApp, digital receipt, weekly charts (PRD Phase 2, not this plan).

## 2. Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | Two endpoints: `summary` returns four aggregates, `transactions` returns orders. | The dashboard issues one request for the four aggregate hooks (`src/features/reports/useReports.ts`); `api.md` contract. |
| 2 | Aggregates filter `payment_status = LUNAS AND status <> DIBATALKAN`; transactions do not filter payment. | Mock parity (`src/mocks/handlers/reports.ts`); the history tab must show unpaid and canceled orders. |
| 3 | `top_menus` capped at 10, `qty_sold DESC`; `category_name` joins live menus and falls back to `"Other"`. | Same as the mock; `order_items.menu_name_snapshot` keeps the name of a soft-deleted menu. |
| 4 | Trends zero-fill missing days in SQL (`generate_series`), not in Go. | One round trip, no calendar logic in the usecase; the `OUTLET_TIMEZONE` day boundary stays in the query. |
| 5 | `from`/`to` required, `from <= to`, span ≤ 366 days → `400 VALIDATION_ERROR`. | Bounded scans on `orders.created_at`; prevents a full-history aggregate. |
| 6 | The four aggregate queries run concurrently via `errgroup`. | Already an approved dependency (`stock_usecase.go`); independent reads in one handler call. |
| 7 | No new `usecase` package logic beyond validation and rounding. | Business logic is the SQL; the usecase only guards and shapes. |

## 3. Domain

`internal/domain/report.go`:

```go
type ReportFilter struct { From, To time.Time }

type SalesReportSummary struct {
	TotalRevenue      int64
	TotalOrders       int
	AverageOrderValue int64
	CashRevenue       int64
	NonCashRevenue    int64
	DineInOrdersCount int
	TakeAwayOrdersCount int
	TotalItemsSold    int
}

type DailySalesTrend struct {
	Date       string
	Revenue    int64
	OrderCount int
}

type TopSellingMenuItem struct {
	MenuID       string
	MenuName     string
	CategoryName string
	QtySold      int
	TotalRevenue int64
}

type CategorySalesShare struct {
	CategoryID     string
	CategoryName   string
	TotalRevenue   int64
	TotalItemsSold int
	Percentage     int
}

type ReportRepository interface {
	ListSummary(ctx context.Context, f ReportFilter) (*SalesReportSummary, error)
	ListTrends(ctx context.Context, f ReportFilter) ([]DailySalesTrend, error)
	ListTopMenus(ctx context.Context, f ReportFilter, limit int) ([]TopSellingMenuItem, error)
	ListCategorySales(ctx context.Context, f ReportFilter) ([]CategorySalesShare, error)
}
```

`OrderFilter` in `internal/domain/order_repositories.go` gains `PaymentMethod *PaymentMethod`, `From *time.Time`, `To *time.Time`.

## 4. Repository

`internal/repository/report_repository.go`:

- `ListSummary` — one `SELECT` with conditional aggregates over `payment_status = LUNAS` and `status <> DIBATALKAN`, `created_at >= from AND created_at < to + 1 day`.
- `ListTrends` — `generate_series(from, to, '1 day')` left join paid orders, grouped by day, zero-filled.
- `ListTopMenus` — join `order_items` → `orders` (paid only) and `menus` → `menu_categories`, `GROUP BY menu_id`, `ORDER BY qty_sold DESC LIMIT n`.
- `ListCategorySales` — same joins grouped by category; the grand item total is read in Go for `percentage`.

`order_repository.List` gains three `WHERE`s for `PaymentMethod`, `From`, `To`, applied alongside the existing filters.

## 5. Usecase

`internal/usecase/report_usecase.go`:

- `Summary(ctx, f)` — validate the range, run the four repository calls under `errgroup`, round `average_order_value` and each `percentage`.
- `Transactions(ctx, f)` — delegate to `OrderQueryRepository.List` with the extra filters.

No writes, no audit rows, no events.

## 6. Delivery

`internal/delivery/http/report_handler.go` + `internal/delivery/http/dto/report.go`, JSON field names identical to the frozen contract (snake_case, integer rupiah).

```go
reports := e.Group("/reports", JWTMiddleware(authUsecase), RequireRoles(domain.UserRoleOwner))
reports.GET("/summary", h.Report.Summary)
reports.GET("/transactions", h.Report.Transactions)
```

`cmd/api/wiring.go` gains `newReportHandler(db)` into `Handlers.Report`.

## 7. Tests

- Summary: paid-only and non-canceled filter; `DIBATALKAN` excluded; unpaid excluded; average rounded.
- Trends: every day present, a weekend gap zero-filled.
- Top menus: ordering, cap, `"Other"` fallback for a soft-deleted menu.
- Categories: percentages sum to ≤ 100 and zero-revenue categories are present.
- Transactions: no payment filter, `created_at DESC`, `order_type` and `payment_method` filters.
- Validation: missing `from`, missing `to`, `from > to`, span > 366 → `400 VALIDATION_ERROR`.
- Role: `CASHIER` and `KITCHEN` → `403 FORBIDDEN`.

## 8. Verification

```bash
go test ./... && go build ./...
```

Manual: `make run`, seed a month of orders, compare each dashboard tab against the mock figures for the same range.

## 9. Docs to update

- `../../../docs/api.md` — done: § Internal — reports and the Bruno tree entry.
- `../../../docs/PRD.md` — done: § 11.3 route lines, Phase 2 bullet.
- `api-collection/reports/` — new Bruno folder (`summary`, `transactions`).
- `AGENTS.md` — no change.
- Dashboard side is tracked separately in `fnb-dashboard/docs/implementation/phase-3-api.md` 3.11.
