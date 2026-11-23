# Phase 5 — Menu Polling

Granular plan for executing phase 5 from `../implementation-plan.md`.

## Scope

Keep the customer honest about the store status. Closing the outlet from the dashboard must reach `/tutup` from the menu query, not only from a failed checkout.

## Status

DONE — shipped before phase 3.

## Depends on

- `fnb-server` shipping `POST /settings/close`, which cancels today's unpaid orders and sets `is_open: false`.
- `docs/flow.md` §Store close; `docs/api.md` menu response; PRD §7.5.

## Files

- `src/features/catalog/queries.ts`
- `src/features/browse/pages/MenuHomePage.tsx` (existing guard)
- `src/features/checkout/pages/ClosedPage.tsx`

## Tasks

- [x] `menuQuery` uses `refetchInterval: (query) => (query.state.data?.isOpen ? 15_000 : false)`.
- [x] Polling stops once the store reads closed instead of hammering the endpoint.
- [x] The existing `isOpen` guard on `/` fires from a poll and routes to `/tutup`.
- [x] `/tutup` offers "Lihat menu saja"; browse-only keeps the catalog readable with ordering disabled.
- [x] Reopening the store and reloading `/` returns to the menu.

## Verification

- Open the menu with the store open, close it from the dashboard, wait one interval: the customer lands on `/tutup` without touching the cart.
- With the store already closed, no further menu requests are made after the redirect.
- `npm run lint && npm run format:check && npm run build && npm test` pass.

## Notes

- 15 seconds, not 5: public traffic is higher than the dashboard and the notice does not need second-level precision.
- Reopening is detected on reload; the query has stopped polling by design.
- Deferred: an explicit "Coba lagi" button on `/tutup`, and a closed banner on `/menu/:menuId` and `/keranjang`. Add only if the product asks; the submit guard already blocks orders.
