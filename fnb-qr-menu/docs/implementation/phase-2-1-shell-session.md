# Phase 2.1 — Shell and Session

Granular plan for executing section 2.1 from `../implementation-plan.md`.

## Scope

App bootstrap, route table, mobile shell, versioned session store semantics, and the table-session hook. No menu rendering yet.

## Status

DONE — shell and session shipped.

## Files

- `src/main.tsx`, `src/App.tsx`, `src/constants/routes.ts`
- `src/components/AppShell.tsx`
- `src/features/session/store.ts`, `src/features/session/token.ts`
- `src/features/browse/useTableSession.ts`

## Tasks

- [x] `QueryClientProvider`, `BrowserRouter`, and one `Toaster` in `main.tsx`.
- [x] Route table: `/`, `/menu/:menuId`, `/keranjang`, `/status`, `/tidak-valid`, `/tutup`, `*` → `/`.
- [x] `AppShell`: sticky header with `cafe_name` plus optional `leading` and `trailing` slots; `max-w-xl`; `bg-canvas text-text font-ui`.
- [x] Session store: `SESSION_STORAGE_KEY` `fnb-qr-menu:session`, `v: 1`, module cache, `storage` listener, memory fallback.
- [x] `getSession`, `updateSession`, `useCustomerSession`, `setFlash`, `takeFlash`.
- [x] A different `qr` clears `cart`, `orders`, and `sessionToken`, and raises a one-shot "new table session" notice.
- [x] `TrackedOrder` is `{ id, snapshot }`; no `trackingToken`.
- [x] `useTableSession` reads `?meja`, opens the session when needed, writes `qr` + `sessionToken`, then strips the param.
- [x] Empty `?meja` with a stored `qr` + token keeps the session; empty without either leaves both empty so the home guard redirects.
- [x] `404 NOT_FOUND` leaves the session empty; the home screen routes to `/tidak-valid`.
- [x] `withSessionRetry` re-opens the session from the stored `qr` once on `401 UNAUTHORIZED`.

## Verification

- `/?meja=demo-meja` lands on `/`, sets `session.qr` and `session.sessionToken`, and drops the query param.
- Two tabs stay in sync through the `storage` event.
- A new `qr` empties cart, orders, and token; `browseOnly` returns to its default.
- Reload keeps the session without a `?meja`.

## Notes

- Store `qr` and `sessionToken` once, in the session record; nowhere else.
- Never store credentials.
- `browseState` (category/search selection) stays in memory only.
