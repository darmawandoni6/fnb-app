# Phase 2.3 — Order Detail Dialog

Granular plan for executing section 2.3 from `../implementation-plan.md`.

## Scope

`OrderDetailDialog` opened from the order board: item detail, receipt reprint, order-level cancellation, and manual table session close. PRD §4.6, §4.7, §9.

## Status

DONE — all tasks complete.

## Files

- `src/features/orders/OrderDetailDialog.tsx`
- `src/features/orders/CancelOrderButton.tsx`
- `src/features/orders/CloseTableSessionButton.tsx`
- `src/features/manual-order/PaymentReceiptDialog.tsx`

## Tasks

- [x] Show order header, item table, and totals; readable by `OWNER` and `CASHIER`.
- [x] Receipt reprint for paid orders through `PaymentReceiptDialog`.
- [x] Order-level cancel rendered for `OWNER` only, calling `POST /orders/:id/cancel`; hidden unless the order is `MENUNGGU` and `BELUM`.
- [x] Close table session action for `CASHIER` and `OWNER` (PRD §9).
  - Read the open session with `getTableSession(order.table_id)`; close it with `closeTableSession(order.table_id)`.
  - Only for `DINE_IN` orders that still have `table_id`; take away orders have none.
  - Hide the action when the read returns `NOT_FOUND` (no open session); do not pre-empt the error with local state.
  - Invalidate `['orders']` and `['tables']` after a successful close.
- [x] `/tables` stays `OWNER`-only; the cashier reaches this action only through the order detail.

## Verification

- `CASHIER` sees the close action on a dine-in order with an open session; `KITCHEN` never reaches the dialog.
- Closing removes the action and leaves the order history untouched (PRD §4.6 point 5).
- Second close attempt after the action is hidden is unreachable; a direct API call returns `NOT_FOUND`.
- Cancel stays invisible to `CASHIER` and visible to `OWNER` only while unpaid.
