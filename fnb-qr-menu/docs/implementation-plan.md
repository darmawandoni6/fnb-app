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

| File | Phase | Tag | Depends on | Steps |
|---|---|---|---|---|
| `implementation/phase-0.md` | Scaffold and foundation | — | — | 13 |
| `implementation/phase-1.md` | Mock layer | `[MOCK]` | phase 0 | 8 |
| `implementation/phase-2.md` | Shell, session, menu home, menu detail | `[MOCK]` | phase 1 | 18 |
| `implementation/phase-2.5.md` | Cart and order submit | `[MOCK]` | phase 2 | 8 |
| `implementation/phase-2.6.md` | Status, closed, invalid | `[MOCK]` | phase 2.5 | 12 |
| `implementation/phase-3.md` | API integration | `[TODO-API]` | phase 2.6 + `fnb-server` on `:8081` | 9 |
| `implementation/phase-4.md` | Tests, polish, docs sync | — | phase 3 | 8 |

Run the phases in order. A phase is done only when its `Exit Criteria` pass.

## How to read this plan

Phase 2 steps are tagged:

- `[MOCK]` — buildable against `src/mocks/`. Do not call the real API.
- untagged — UI-only, identical under mock and HTTP.

`[TODO-API]` work lives only in Phase 3. It never leaks into Phase 2. Phase 3 changes `src/api/` and the switch only; components and hooks are not touched.

Rules that hold across every phase:

- `src/api/index.ts` is the single mock/HTTP switch. Components and hooks import from `@/api` only.
- Mock and HTTP implementations share signatures and return types.
- The client sends `menu_id`, `qty`, and `note` only. It never computes subtotal, tax, or total.
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

- [ ] `demo-invalid` and an unknown token both land on `/tidak-valid`.
- [ ] `/` with `demo-meja` renders categories, search, and menus; the URL drops `?meja`.
- [ ] `demo-tutup` routes to `/tutup`; browse-only returns to `/`.
- [ ] `/menu/:menuId` merges a second add into the same line.
- [ ] Editing a line with an existing note merges the two lines.
- [ ] Cart survives a reload; cart shows prices per line and no aggregate total.
- [ ] `demo-habis` toasts `STOCK_NOT_ENOUGH` and refreshes the menu.
- [ ] Submitting prepends an order card and navigates to `/status`.
- [ ] Only one card is open at a time; collapsed cards do not poll.
- [ ] Cancelling a `PENDING` item works; cancelling a paid item warns about the refund.
- [ ] A cancelled item stays visible, crossed out.
- [ ] Scanning a different `qr` resets cart and history with a toast.

### API

- [ ] Backend is running on `:8081`.
- [ ] Menu loads from `GET /public/tables/:qr_token/menu`.
- [ ] Order submit returns `order_id` and `tracking_token` and appears in the dashboard.
- [ ] The open card polls and reflects item changes within 5 seconds.
- [ ] Polling only the open card stays under the 30/minute status limit with several stored orders.
- [ ] Cancelling a `PENDING` item restores stock and updates totals per the server response.
- [ ] `STORE_CLOSED` blocks ordering end-to-end.
- [ ] API errors follow the backend envelope and error codes.

## Excluded

- Component and E2E testing (RTL, Playwright).
- WebSocket or SSE.
- Redux or Zustand.
- SSR, `@tanstack/react-router`, `@tanstack/react-start`, nitro.
- Authentication, accounts, and role guards.
- Payment inside QR Menu.
- Computing subtotals, tax, or totals on the client.
