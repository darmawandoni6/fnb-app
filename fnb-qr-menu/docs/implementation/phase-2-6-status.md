# Phase 2.6 — Order Status

Granular plan for executing section 2.6 from `../implementation-plan.md`.

## Scope

`/status` order history: one list poll per 5 seconds, accordion cards, status stepper derived from item statuses, server totals, order-level cancel, rate-limit backoff, and "add another order".

## Status

DONE — status screen shipped.

## Files

- `src/features/orders/api.ts`, `src/features/orders/status.ts`
- `src/features/orders/pages/StatusPage.tsx`
- `src/features/orders/components/OrderCard.tsx`, `OrderItemRow.tsx`, `StatusStepper.tsx`
- `src/constants/orderStatus.ts`, `itemStatus.ts`, `paymentStatus.ts`

## Tasks

- [x] `ordersQuery(sessionToken)` wired through `withSessionRetry`, keyed `['public-orders', token]`.
- [x] `useOrderList`: one query, `refetchInterval` 5 s while any order is unfinished, `false` when all are `SELESAI` or `DIBATALKAN`; interval doubles to 10 s after `429`.
- [x] Merge returned orders into `session.orders` by `id`, preferring the newest list entry; stored entries absent from the list keep their snapshot.
- [x] Phase 2.8 extends this merge to append list entries not yet stored.
- [x] `/status` redirects to `/` when no order is stored.
- [x] Accordion via shadcn `Collapsible`: newest first, exactly one card open.
- [x] Collapsed cards render from `snapshot`; no per-card query.
- [x] Stepper derives from item statuses: all `PENDING` → Menunggu; any `COOKING` → Diproses; any `READY` → Siap; any `DELIVERED` → Dalam pengantaran; all `COMPLETED`/`CANCELLED` → done.
- [x] `DIBATALKAN` renders a distinct cancelled row, not a step.
- [x] `PENDING`/`BELUM` never lights kitchen steps.
- [x] Item row shows `menu_name_snapshot`, qty, unit price, note, status badge; `CANCELLED` items stay visible and crossed out.
- [x] Card shows `payment_status` badge and server `order_number`, subtotal, service, tax, total; never recomputes.
- [x] Cancel button only for `MENUNGGU` + `BELUM`; `AlertDialog` with optional Indonesian reason; no refund warning.
- [x] Cancel success replaces the stored snapshot and invalidates the list.
- [x] `INVALID_TRANSITION` toasts and refreshes; `401` re-opens once and retries.
- [x] "Tambah pesanan" clears the cart and returns to `/` without resetting `qr`, `sessionToken`, or `orders`.
- [x] Header back link to `/`.

## Verification

- One request per 5 seconds refreshes every card; polling stops when all orders are terminal.
- Stepper matches each fixture; mixed item statuses show the furthest active step.
- Cancel flips the card to `DIBATALKAN` with crossed items; a `LUNAS` order has no cancel button.
- `429` backs off and keeps the last snapshots.
- `npm run lint && npm run format:check && npm run build` pass.

## Notes

- One list poll, not one per card; the session limit is 30/minute.
- No timeline or timestamps in the stepper; the API returns none.
- No refund warning; v1 cancels unpaid orders only.
- Payment URL link removed in phase 2.8.
