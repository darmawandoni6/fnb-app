# Phase 3 — API Integration

Granular plan for executing Phase 3 from `../implementation-plan.md`.

## Scope

Swap `src/mocks/` for the live `fnb-server` at `http://localhost:8081` one resource at a time, without changing components. Contract: `../../docs/api.md` and `../../docs/api-response.md`.

## Status

OPEN — 0 of 11 tasks complete. Blocked on Phase 2 open tasks per page.

## Rule

`src/api/index.ts` currently re-exports the mock module. Replace it resource by resource; a page keeps working against mocks until its own resource is swapped. Never change a component signature to accommodate the swap.

## Tasks

- [ ] 3.1 `src/api/client.ts` — axios instance, `baseURL` from `VITE_API_URL`, `withCredentials: true`, bearer interceptor reading `getAccessToken()`, envelope unwrapping to `data`, error mapping to `ApiError { code, message }`.
- [ ] 3.2 Auth — `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`; silent refresh at load before protected routes render; 401 flow of refresh, one retry, then `/login`. Files: `src/auth/context.tsx`, `src/auth/guards.tsx`, `src/pages/LoginPage.tsx`.
- [ ] 3.3 Orders and items — `GET /orders`, `GET /orders/:id`, `POST /orders/manual`, `PATCH /orders/:id/items/:item_id/status`, `POST /orders/:id/cancel`. Files: `src/features/orders/*`, `src/pages/OrdersPage.tsx`, `src/pages/KitchenPage.tsx`. Kitchen keeps client-side `LUNAS` filtering.
- [ ] 3.4 Payments — `PATCH /orders/:id/payment`, idempotent `BELUM → LUNAS`. Files: `src/pages/OrderPaymentPage.tsx`, `src/features/manual-order/*`.
- [ ] 3.5 Tables and sessions — `GET|POST|PATCH|DELETE /tables`, `GET /tables/:id/session`, `POST /tables/:id/session/close`. Files: `src/pages/TablesPage.tsx`, `src/features/tables/*`, `src/features/orders/OrderDetailDialog.tsx`.
- [ ] 3.6 Menus and recipes — `GET|POST|PATCH|DELETE /menu-categories`, `/menus`, `/recipe-items`. Files: `src/pages/MenusPage.tsx`, `src/features/menus/*`.
- [ ] 3.7 Stock — `GET|POST|PATCH /ingredients`, `POST /ingredients/:id/restock`, `POST /ingredients/:id/adjust`, `GET /stock-movements`. Files: `src/pages/StockPage.tsx`, `src/features/stock/*`.
- [ ] 3.8 Users, settings, audit log — `GET|POST|PATCH /users`, `GET|PATCH /settings`, `GET /audit-log`. Files: `src/pages/UsersPage.tsx`, `src/pages/SettingsPage.tsx`, `src/pages/AuditLogPage.tsx`.
- [ ] 3.9 WebSocket — `src/api/ws.ts`, `GET /ws` with the bearer token, subscribe `order:{id}`, handle `order.created`, `order.updated`, `item.updated`, `session.closed`. Invalidate affected queries; keep 3–5 s polling while the socket is down; reconnect and resubscribe; close on unmount and logout. PRD §11.4, EC-19. Not mocked.
- [ ] 3.10 Reports — deferred, keeps `src/mocks/handlers/reports.ts` until `../../docs/api.md` defines `/reports/*`.
- [ ] 3.11 Flag flip — `VITE_USE_MOCKS=false` in the integration environment.

## Verification

Per resource: the page behaves as it did on mocks with the server running. End-to-end checks live in `phase-4-verification.md` §4.3.
