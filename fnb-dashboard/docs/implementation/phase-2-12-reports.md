# Phase 2.12 — Reports

Granular plan for executing section 2.12 from `../implementation-plan.md`.

## Scope

`/reports` for `OWNER`: KPI cards, sales trend, menu performance, and transaction history with CSV export. Runs on mocks because `../../docs/api.md` defines no `/reports/*` contract. PRD §17 places reports in phase 2; the dashboard slice is complete and frozen.

## Status

DONE (frozen) — no work until the API contract exists.

## Files

- `src/pages/ReportsPage.tsx`
- `src/features/reports/ReportKpiCards.tsx`
- `src/features/reports/SalesTrendChart.tsx`
- `src/features/reports/MenuPerformanceCharts.tsx`
- `src/features/reports/TransactionHistoryTab.tsx`
- `src/features/reports/useReports.ts`
- `src/features/reports/exportReportCsv.ts`
- `src/mocks/data/reports.ts`
- `src/mocks/handlers/reports.ts`

## Tasks

- [x] Preset filter in the header: `today`, `last_7_days`, `last_30_days`, `this_month`.
- [x] Tab 1 — four KPI cards (revenue, orders, average order value, payment and order type split) plus a trend chart toggling revenue area and order volume bar through the shadcn chart wrapper on Recharts.
- [x] Tab 2 — top ten menus and category sales share charts.
- [x] Tab 3 — transaction table with local filters, pagination, empty state, and client-side CSV export.
- [x] Mock 30-day historical generator with weekend spikes and menu and payment variation.
- [x] `OWNER` only; other roles get `FORBIDDEN` from the handlers.

## Tasks — deferred

- [ ] API integration. Blocked: `../../docs/api.md` has no `/reports/*` endpoints.

## Verification

- Each preset changes every tab consistently.
- CSV export matches the filtered table rows.
- `CASHIER` and `KITCHEN` cannot open the page.
