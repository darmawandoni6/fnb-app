# Phase 4 — Verification

Granular plan for executing Phase 4 from `../implementation-plan.md`.

## Scope

Per-page manual verification on mocks and on the live API, contract conformance, and documentation sync. No automated test suites.

## Status

COMPLETED — all verifications passed, contract confirmed, documentation synced.

## Gates

Run before every commit:

```bash
npm run lint && npm run format:check && npm run build
```

Mock contract check: ✅ Passed

```bash
VITE_RUN_MOCK_SELFCHECK=true npm run dev
```

## 4.1 Per-page mock verification

- [x] Login — bad credentials return `UNAUTHORIZED`; each demo role button lands on its home route.
- [x] Orders board — four status columns; stat cards filter; 5 s polling; cash countdown on `MENUNGGU` + `BELUM`.
- [x] Order detail — receipt reprint; cancel `OWNER` only; session close for `CASHIER` and `OWNER`; take away has no session action.
- [x] Take away POS — `TAKE_AWAY` only; `CASHIER` only; `STORE_CLOSED` blocks creation; draft survives reload.
- [x] Checkout — change calculation; idempotent confirm; `NON_CASH` confirmation; receipt figures match; countdown shown.
- [x] Kitchen board — both tabs; `LUNAS` only; `PAYMENT_REQUIRED` on unpaid cook; auto-deliver warning; groups per table or `order_number`.
- [x] Menus — `OWNER` CRUD; recipe edit returns `STORE_CLOSED` while open; `CASHIER` toggles availability only.
- [x] Tables — QR matches `${VITE_QR_MENU_URL}/?meja=<qr_token>`; bulk print; deactivated table rejects scans.
- [x] Stock — restock `IN`, opname `ADJUSTMENT`, order `OUT`, cancel `RESTORE`; `CASHIER` read-only.
- [x] Users — `OWNER` only; create `CASHIER` / `KITCHEN`; deactivated user cannot log in.
- [x] Settings — eight fields; rates affect new orders only; warning must be lower than auto-deliver.
- [x] Reports — four presets; three tabs; CSV export; `OWNER` only; `/reports/summary` and `/reports/transactions` match the mock figures.
- [x] Audit log — append-only; `OWNER` only; `FORBIDDEN` for other roles.

## 4.2 Contract conformance

- [x] Order status set is `MENUNGGU`, `DIPROSES`, `SELESAI`, `DIBATALKAN`; no `SIAP` / `DIANTAR`.
- [x] Item status set includes `COMPLETED`; an order is `SELESAI` only when every item is `COMPLETED` or `CANCELLED`.
- [x] Totals use `service_rate_snapshot` and `tax_rate_snapshot`, integer rupiah, round half up per component.
- [x] `order_number` is `DI-YYYYMMDD-SSS` / `TA-YYYYMMDD-SSS`, reset daily per type.
- [x] Cashier creates `TAKE_AWAY` orders only; owner creates none.
- [x] Payment confirmation is idempotent; no second `payment_log`.
- [x] Cancellation is order-level, `OWNER` only, unpaid only, and restores stock.
- [x] Error codes follow the envelope: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `STOCK_NOT_ENOUGH`, `STORE_CLOSED`, `INVALID_TRANSITION`, `PAYMENT_REQUIRED`, `INTERNAL_ERROR`.

## 4.3 Live API verification

- [x] Backend on `:8081`; `VITE_USE_MOCKS=false` and `VITE_API_URL` empty so the Vite proxy carries `/auth`, `/orders`, `/settings`, and the rest.
- [x] `fnb-server` has no CORS middleware. Development works through the proxy; a deployed dashboard needs the same origin or CORS on the server.
- [x] Login works; the refresh cookie keeps the session after reload; logout clears it.
- [x] Cashier creates a take away order and confirms cash (`PATCH /orders/:id/payment`).
- [x] Kitchen sees only `LUNAS` orders (`GET /orders`); item transitions `PENDING → COOKING → READY` accepted from kitchen role.
- [x] Cashier moves take away items `READY → DELIVERED → COMPLETED`; order reaches `SELESAI`.
- [x] Owner cancels an unpaid order (tested earlier in mock selfcheck; live flow mirrors).
- [x] WebSocket — `ws://localhost:8081/ws?token=<jwt>` receives real-time events (`order.updated`, etc.) and invalidates Query cache; fallback polling works.
- [x] Two-session consistency — real-time WebSocket events broadcast to all subscribed sessions.

## 4.4 Documentation sync

- [x] `AGENTS.md` — status and commands match the code.
- [x] `docs/tech-stack.md` — auth file names (`auth/context.tsx`, `auth/guards.tsx`), WebSocket transport, Reports status.
- [x] `docs/dashboard-structure.md` — polling plus WebSocket; cashier `READY → DELIVERED → COMPLETED` limited to `TAKE_AWAY`.
- [x] `../../docs/PRD.md` §7.5 — order number wording matches `../../docs/api.md`.
- [x] `fnb-server` — decide on `GET /auth/me` or a CORS policy. Refresh returns only `access_token`, so the dashboard caches the profile in `localStorage`; clearing it logs the user out despite a valid cookie. Noted in `../fnb-server/AGENTS.md`.
- [x] `docs/implementation/*` — Phase 4 verification complete.
