# FNB QR Menu — Implementation Plan

## Scope

Plan for the public QR Menu SPA based on:

- `../docs/PRD.md`
- `../docs/flow.md`
- `../docs/api.md`
- `../docs/api-response.md`
- `docs/tech-stack.md`
- `docs/qr-menu-structure.md`

Slicing follows `/home/doni/me/iul-fnb/apps/qr-menu` (six customer screens, versioned session store, cart helpers), adapted to `fnb-server`. Gaps are listed in `docs/tech-stack.md` under Reference Gaps.

This file is the index. Each phase has its own file in `docs/implementation/` with steps, verification, and a checklist.

## Phase Index

| File                          | Phase                                  | Tag          | Depends on                          | Steps |
| ----------------------------- | -------------------------------------- | ------------ | ----------------------------------- | ----- |
| `implementation/phase-0.md`   | Scaffold and foundation                | `[REWORK]`   | —                                   | 13    |
| `implementation/phase-1.md`   | Mock layer                             | `[MOCK]`     | phase 0                             | 9     |
| `implementation/phase-2.md`   | Shell, session, menu home, menu detail | `[MOCK]`     | phase 1                             | 18    |
| `implementation/phase-2.5.md` | Cart, checkout form, order submit      | `[MOCK]`     | phase 2                             | 10    |
| `implementation/phase-2.6.md` | Status, closed, invalid                | `[MOCK]`     | phase 2.5                           | 12    |
| `implementation/phase-3.md`   | API integration                        | `[TODO-API]` | phase 2.6 + `fnb-server` on `:8081` | 10    |
| `implementation/phase-4.md`   | Tests, polish, docs sync               | —            | phase 3                             | 8     |

Run the phases in order. A phase is done only when its `Exit Criteria` pass.

## How to read this plan

Phase 2 steps are tagged:

- `[MOCK]` — buildable against `src/mocks/`. Do not call the real API.
- untagged — UI-only, identical under mock and HTTP.
- `[REWORK]` — the shipped code was built against the old contract (`tracking_token`, per-item cancel, menu per `qr_token`) and must be reworked to the current `../docs/api.md`.

`[TODO-API]` work lives only in Phase 3. It never leaks into Phase 2. Phase 3 changes `src/api/` and the switch only; components and hooks are not touched.

Rules that hold across every phase:

- `src/api/index.ts` is the single mock/HTTP switch. Components and hooks import from `@/api` only.
- Mock and HTTP implementations share signatures and return types.
- Identity is the table session: `POST /public/tables/:qr_token/sessions` returns `session_token`, stored in `localStorage`, sent as `X-Session-Token` on every public call except the session open itself.
- On `401 UNAUTHORIZED` the client re-opens the session from the stored `qr` and retries once; `404 NOT_FOUND` routes to `/tidak-valid`.
- The order payload sends `order_type`, `customer_name` (required), `customer_phone` (optional), `payment_method`, and `items: [{ menu_id, qty, note }]`. It never computes subtotal, service, tax, or total; displayed money always comes from the server response.
- `NON_CASH` submit returns `payment_url`; the client stores the order, then navigates to Snap.
- Status polling is one `GET /public/orders` list request every 5 seconds while any stored order is unfinished; it stops when all are `SELESAI` or `DIBATALKAN`.
- Cancellation is order-level: `POST /public/orders/:id/cancel` with `{ reason }`, allowed only while the order is `MENUNGGU` and `payment_status` is `BELUM`. There is no item-level cancel and no refund warning.
- A production build with `VITE_USE_MOCKS=true` fails in `vite.config.ts`.
- Each phase file restarts step numbering at 1.

## End-to-end Verification

Run after Phase 4, or whenever the whole flow feels stable.

### Foundation

- [ ] `npm run dev` works.
- [ ] `npm run build` works.
- [ ] `npm run lint` works.
- [ ] `npm run format:check` works.
- [ ] A production build with `VITE_USE_MOCKS=true` fails.

### Mock

- [ ] `demo-invalid` and an unknown token both land on `/tidak-valid` after the session open returns `404`.
- [ ] `/` with `demo-meja` opens a session, renders categories, search, and menus; the URL drops `?meja`.
- [ ] A stored `session_token` that the mock rejects with `401` is re-opened transparently; the screen keeps working.
- [ ] `demo-tutup` routes to `/tutup`; browse-only returns to `/`.
- [ ] `/menu/:menuId` merges a second add into the same line.
- [ ] Editing a line with an existing note merges the two lines.
- [ ] Cart survives a reload; cart shows prices per line and no aggregate total.
- [ ] The checkout form requires `customer_name`, accepts an optional phone, and offers `CASH` / `NON_CASH`.
- [ ] `demo-habis` toasts `STOCK_NOT_ENOUGH` and refreshes the menu.
- [ ] Submitting stores the order card and navigates to `/status`; `NON_CASH` navigates to the returned `payment_url`.
- [ ] The status list polls once per 5 seconds and every stored card updates from the response.
- [ ] Polling stops when every stored order is `SELESAI` or `DIBATALKAN`.
- [ ] Cancelling an unpaid `MENUNGGU` order works from the order card; a `LUNAS` or `DIPROSES` order shows no cancel button.
- [ ] A cancelled order stays visible with `DIBATALKAN` and its items crossed out.
- [ ] Scanning a different `qr` resets cart and history with a toast.

### API

- [ ] Backend is running on `:8081`.
- [ ] `POST /public/tables/:qr_token/sessions` returns `session_token`; `GET /public/menu` loads with `X-Session-Token`.
- [ ] Order submit returns `order_number`, totals, and `order_id`, and appears on the dashboard.
- [ ] The status list reflects dashboard item changes within 5 seconds.
- [ ] List polling stays under the 30/minute limit with several stored orders; submit stays under 5/minute.
- [ ] Cancelling a `MENUNGGU` unpaid order restores stock and returns `DIBATALKAN` with updated totals.
- [ ] A paid or in-progress order rejects cancel with `409 INVALID_TRANSITION`.
- [ ] `STORE_CLOSED` blocks ordering end-to-end.
- [ ] A closed session token returns `401 UNAUTHORIZED` and the client re-opens it once.
- [ ] API errors follow the backend envelope and error codes.

## Excluded

- Component and E2E testing (RTL, Playwright).
- WebSocket or SSE — PRD v1 ships WebSocket with polling fallback; this plan ships polling first and records WS as a follow-up.
- Redux or Zustand.
- SSR, `@tanstack/react-router`, `@tanstack/react-start`, nitro.
- Authentication, accounts, and role guards.
- Computing subtotals, service, tax, or totals on the client.
