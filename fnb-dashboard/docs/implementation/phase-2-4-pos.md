# Phase 2.4 — Take Away POS

Granular plan for executing section 2.4 from `../implementation-plan.md`.

## Scope

`/orders/new` point-of-sale for `CASHIER` and `OWNER`. Creates `TAKE_AWAY` orders only. PRD §4.2, §7.2, BR-01, BR-24.

## Status

DONE — all tasks complete.

## Files

- `src/pages/NewOrderPage.tsx`
- `src/features/manual-order/MenuCatalogGrid.tsx`
- `src/features/manual-order/OrderCartPanel.tsx`
- `src/features/manual-order/usePosDrafts.ts`
- `src/features/manual-order/manualOrderSchema.ts`

## Tasks

- [x] Dedicated page at `/orders/new`; the button on the board is visible to `CASHIER` and `OWNER`.
- [x] No `DINE_IN` toggle and no table select; `order_type = TAKE_AWAY` and `table_id = null` (BR-01).
- [x] Category tabs, search input, and menu catalog grid with 2-character initials when `image_url` is absent.
- [x] Cart panel: `customer_name` required, `customer_phone` optional, per-item note, quantity controls.
- [x] Cart totals are a preview only; the server response is authoritative (PRD §6).
- [x] Hold draft in `localStorage` through `usePosDrafts`; restore on reload; clear after a successful submit.
- [x] `manualOrderSchema` validates the same rules as the API before sending.
- [x] `STORE_CLOSED` disables creation and shows the server message; existing orders stay readable.
- [x] Unavailable menus are not addable to the cart.

## Verification

- Creating an order while `is_open` is false is blocked before the request.
- Empty `customer_name` is rejected client-side and by the mock API.
- Draft survives a page reload and disappears after a successful order.
