# Phase 3 — API Integration

Granular plan for executing Phase 3 from `../implementation-plan.md`.

## Scope

Swap `src/mocks/` for the live `fnb-server` at `http://localhost:8081` one resource at a time, without changing components. Contract: `../../docs/api.md` and `../../docs/api-response.md`.

## Status

OPEN — 4 of 15 tasks complete.

## Rule

`src/api/index.ts` currently re-exports the mock module. Replace it resource by resource; a page keeps working against mocks until its own resource is swapped. Never change a component signature to accommodate the swap.

Tasks are grouped per resource, not per page, because one `api` function is shared across pages — `api.getSettings` feeds eight files, `api.updateItemStatus` both the kitchen and the cashier path. Splitting by page would duplicate a task per caller without changing the work.

## Tasks

- [x] 3.0 `src/api/index.ts` — `api` merges the integrated HTTP resources over the mock module, so a page whose resource is not swapped yet keeps working. `VITE_USE_MOCKS=true` keeps the whole app on mocks; the mock spread is only removed at 3.12.
- [x] 3.1 `src/api/client.ts` — axios instance, `baseURL` from `VITE_API_URL`, `withCredentials: true`, bearer interceptor reading `getAccessToken()`, envelope unwrapping to `data`, error mapping to `ApiRequestError { code, message, status }`. The Vite dev proxy in `vite.config.ts` keeps API paths unchanged because `fnb-server` has no CORS middleware and the refresh cookie is scoped to `Path=/auth`.
- [x] 3.2 Auth — `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`; silent refresh at load before protected routes render; 401 flow of refresh, one retry, then `/login`. Files: `src/auth/context.tsx`, `src/auth/guards.tsx`, `src/pages/LoginPage.tsx`.
- [ ] 3.3a Order reads — `GET /orders`, `GET /orders/:id`. Files: `src/features/orders/useOrders.ts`, `src/features/orders/useOrderStats.ts`, `src/pages/OrdersPage.tsx`, `src/pages/KitchenPage.tsx`. Kitchen keeps client-side `LUNAS` filtering.
- [ ] 3.3b Item transitions — `PATCH /orders/:id/items/:item_id/status`, used by the kitchen board and by the cashier `READY → DELIVERED` path. File: `src/features/orders/OrderCard.tsx`.
- [ ] 3.3c Manual order and cancel — `POST /orders/manual`, `POST /orders/:id/cancel`. Files: `src/pages/NewOrderPage.tsx`, `src/features/manual-order/*`, `src/features/orders/CancelOrderButton.tsx`.
- [ ] 3.4 Payments — `PATCH /orders/:id/payment`, idempotent `BELUM → LUNAS`. Files: `src/pages/OrderPaymentPage.tsx`, `src/features/manual-order/PaymentReceiptDialog.tsx`.
- [x] 3.5 Settings — `GET|PATCH /settings`. Pulled ahead of the other resources because `api.getSettings` feeds eight files (cash countdown, kitchen timers, receipt, recipe, tables, POS, settings page). Files: `src/pages/SettingsPage.tsx` plus the `useQuery({ queryKey: ['settings'] })` callers.
- [ ] 3.6 Tables and sessions — `GET|POST|PATCH|DELETE /tables`, `GET /tables/:id/session`, `POST /tables/:id/session/close`. Files: `src/pages/TablesPage.tsx`, `src/features/tables/*`, `src/features/orders/CloseTableSessionButton.tsx`.
- [ ] 3.7 Menus and recipes — `GET|POST|PATCH|DELETE /menu-categories`, `/menus`, `/recipe-items`. Files: `src/pages/MenusPage.tsx`, `src/features/menus/*`.
- [ ] 3.8 Stock — `GET|POST|PATCH /ingredients`, `POST /ingredients/:id/restock`, `POST /ingredients/:id/adjust`, `GET /stock-movements`. Files: `src/pages/StockPage.tsx`, `src/features/stock/*`.
- [ ] 3.9 Users and audit log — `GET|POST|PATCH /users`, `GET /audit-log`. Files: `src/pages/UsersPage.tsx`, `src/pages/AuditLogPage.tsx`.
- [ ] 3.10 WebSocket — `src/api/ws.ts`, `GET /ws` with the bearer token, subscribe `order:{id}`, handle `order.created`, `order.updated`, `item.updated`, `session.closed`. Invalidate affected queries; keep 3–5 s polling while the socket is down; reconnect and resubscribe; close on unmount and logout. PRD §11.4, EC-19. Not mocked.
- [ ] 3.11 Reports — deferred, keeps `src/mocks/handlers/reports.ts` until `../../docs/api.md` defines `/reports/*`.
- [ ] 3.12 Flag flip — `VITE_USE_MOCKS=false` in the integration environment; confirm no page still resolves a mock resource through the 3.0 merge.

## Known gap

`POST /auth/refresh` returns only `access_token` and there is no `/auth/me`, so the user profile is cached in `localStorage` (`fnb.profile`) at login and reused after a reload. A cleared profile logs the session out even with a valid refresh cookie. Tracked in `phase-4-verification.md` §4.4.

## Order

3.0 → 3.1 → 3.2 → 3.5 → 3.3a → 3.3b → 3.3c → 3.4 → 3.6 → 3.7 → 3.8 → 3.9 → 3.10 → 3.12.

Settings comes before orders because the cash countdown on the board and the kitchen timers read `cash_timeout_minutes` and `ready_auto_deliver_*`. Reports stays deferred.

## Verification

Per resource: the page behaves as it did on mocks with the server running. End-to-end checks live in `phase-4-verification.md` §4.3.
