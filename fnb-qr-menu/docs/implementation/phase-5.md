# Phase 5 — Menu Polling for the Closed Notice

Granular plan for executing Phase 5 from `../implementation-plan.md`.

## Scope

Keep the QR Menu honest about the store status. The customer should land on `/tutup` shortly after the outlet closes, not only when a checkout attempt returns `STORE_CLOSED`. Contract: `../../docs/api.md` (`GET /public/menu` carries `is_open`), `../../docs/PRD.md` §7.5.

## Status

OPEN — not started.

## Depends on

`fnb-server` shipping `POST /settings/close`, so the store can actually close while a customer is browsing.

## Tasks

- [ ] 5.1 `src/features/catalog/queries.ts` — `menuQuery` gets `refetchInterval: (query) => (query.state.data?.isOpen ? 15_000 : false)`, so polling stops once the store reads closed instead of hammering a dead endpoint.
- [ ] 5.2 Confirm the existing guard in `src/features/browse/pages/MenuHomePage.tsx` (already redirects to `/tutup` when `isOpen` is false) fires from a poll rather than only from the first load; no code change expected.
- [ ] 5.3 `src/pages/ClosedPage.tsx` (or its equivalent) — verify it offers a way back once the store reopens, or state explicitly that a reload is required.

## Verification

- Open the menu with the store open, close the store from the dashboard, then wait one poll interval: the customer lands on `/tutup` without touching the cart.
- With the store already closed, no further menu requests are made after the redirect.
- Reopening the store and reloading `/` returns the customer to the menu.
- `npm run lint && npm run format:check && npm run build && npm run test`

## Notes

15 seconds, not 5: public traffic is much higher than the dashboard, and the closed notice does not need second-level precision.
