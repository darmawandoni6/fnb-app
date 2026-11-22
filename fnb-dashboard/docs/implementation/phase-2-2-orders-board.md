# Phase 2.2 — Orders Board

Granular plan for executing section 2.2 from `../implementation-plan.md`.

## Scope

`/orders` board for `OWNER` and `CASHIER`. Kanban over the four order statuses, stat cards, and 5 s polling. PRD §5.1, §7.2, §7.4.

## Status

DONE — all tasks complete.

## Files

- `src/pages/OrdersPage.tsx`
- `src/features/orders/OrderCard.tsx`
- `src/features/orders/useOrders.ts`
- `src/features/orders/useOrderStats.ts`
- `src/features/orders/CashCountdown.tsx`

## Tasks

- [x] Kanban columns for `MENUNGGU`, `DIPROSES`, `SELESAI`, `DIBATALKAN`.
- [x] Stat cards: active orders, unpaid orders, completed today; unpaid and done cards toggle the view filter.
- [x] Polling through `useOrders` with `refetchInterval: 5_000`.
- [x] Cash countdown on `MENUNGGU` + `BELUM` cards.
  - Derive the deadline from `created_at` + `settings.cash_timeout_minutes`; read settings through `api.getSettings`.
  - Render the remaining time as `mm:ss`; switch to an expired state at zero and invalidate `['orders']` once.
  - The dashboard only displays the derived state. The scheduler on the server performs the cancellation (BR-03).
- [x] Extract the countdown as `CashCountdown` so `phase-2-5-checkout.md` reuses it instead of duplicating the derivation.

## Verification

- Order created just now shows close to the full timeout.
- Order past the timeout shows the expired state and refreshes the board once.
- Countdown is absent for `LUNAS` orders and for the `DIPROSES`, `SELESAI`, `DIBATALKAN` columns.
