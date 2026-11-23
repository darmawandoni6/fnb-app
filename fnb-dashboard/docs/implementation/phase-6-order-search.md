# Phase 6 — Order Search

Granular plan for the order board search that pairs with the QR Menu "Tunjukkan QR" button.

## Scope

`/orders` gains a search field that filters the board by `order_number`. The QR Menu encodes `${VITE_DASHBOARD_URL}/orders?q=<order_number>`, so a cashier who scans the customer's QR lands on the board already filtered to that order.

## Status

DONE — shipped.

## Files

- `src/pages/OrdersPage.tsx`

## Tasks

- [x] Search `Input` in the board header, left of `Refresh`, with a clear button.
- [x] Initial value read from `?q=` so a scanned QR link opens filtered; later typing stays local and does not rewrite the URL.
- [x] Filter runs client-side after the stat-card view filter: trimmed, case-insensitive `order_number` substring match.
- [x] Empty state switches to "Order tidak ditemukan" while a term is active.
- [x] Matching is order number only; customer name, table, and menu names are out of scope.

## Verification

- `/orders?q=DI-20261121-001` opens the board with only that order and the field prefilled.
- Typing a partial number narrows every column; clearing restores the full board.
- A term with no match shows the not-found empty state, not the empty board state.
- `npm run lint && npm run format:check && npm run build` pass.

## Notes

- No debounce: `GET /orders` returns at most 200 rows and the filter is local.
- No server query param: `api.md` has no `q` filter on `/orders`, and adding one is a contract change.
