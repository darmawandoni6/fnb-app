# Phase 2.5 — Checkout and Payment

Granular plan for executing section 2.5 from `../implementation-plan.md`.

## Scope

`/orders/:id/payment` for `CASHIER` and `OWNER`. Cash settlement, manual non-cash confirmation, printable receipt, and the unpaid-exit guard. PRD §4.3, §7.2, BR-11.

## Status

DONE — all tasks complete.

## Files

- `src/pages/OrderPaymentPage.tsx`
- `src/features/manual-order/PaymentReceiptDialog.tsx`
- `src/features/orders/CashCountdown.tsx` (from `phase-2-2-orders-board.md`)

## Tasks

- [x] Cash tab: `amount_received` input, quick nominal buttons, computed change, submit with `payment_method: CASH`.
- [x] Non-cash tab: `payment_method: NON_CASH` with no gateway reference until Midtrans is live.
- [x] Send only `BELUM → LUNAS` through `PATCH /orders/:id/payment`; a repeat returns `200` with the same order and writes no second `payment_log` (BR-11).
- [x] Printable receipt at 58/80 mm through `window.print()`, showing `order_number`, service amount, tax amount, and the persisted `amount_received` / `change_amount`.
- [x] Leaving with an unpaid order asks for confirmation; the order board routes payment actions here.
- [x] Order-level cancel from this page is visible to `OWNER` and `CASHIER`, with a required reason.
- [x] Cash countdown on the unpaid order, reusing `CashCountdown` from `phase-2-2-orders-board.md` instead of recomputing the deadline.

## Verification

- Change equals `amount_received - total_amount` and is never negative.
- Submitting the same cash confirmation twice leaves one `payment_log` and the same `paid_at`.
- Receipt reprint shows identical figures to the first print.
- Countdown reaches zero and the page refreshes the order instead of allowing a stale confirmation.
