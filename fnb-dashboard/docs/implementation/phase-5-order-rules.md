# Phase 5 — Order Business Rules

Granular plan for executing Phase 5 from `../implementation-plan.md`.

## Scope

Four business rules on top of the shipped order flow: orders blocked while the store is closed, a manual refresh on the order board, the order list scoped to the current outlet day, and a store close that refuses to run while orders are still in progress. Contract: `../../docs/api.md`, `../../docs/PRD.md` §7.4/§7.5, `../../docs/flow.md`.

## Status

OPEN — not started.

## Gates

Run before every commit:

```bash
npm run lint && npm run format:check && npm run build
```

Backend: `cd ../fnb-server && go test ./... && go build ./...`

Mock contract check:

```bash
VITE_RUN_MOCK_SELFCHECK=true npm run dev
```

## Decisions

- Closing is its own endpoint, `POST /settings/close`, not a `PATCH /settings` field. A partial settings update must not cancel orders as a side effect.
- `PATCH /settings` rejects `is_open: false` with `409 INVALID_TRANSITION`, so the active-order check cannot be bypassed.
- Error code stays `INVALID_TRANSITION`; the message carries the blocking count. No new code, because the client only renders `message`.
- "All orders" means the current outlet day. Older days neither block a close nor get cancelled by it.
- A `DIPROSES` order is already paid, so it is never auto-cancelled; it blocks the close instead.
- `GET /orders` defaults to the current outlet day server-side. The dashboard stops computing dates.
- No new WebSocket topic. Polling covers the close notice within one interval.

## Tasks

### Backend — `../fnb-server`

- [ ] 5.1 `internal/usecase/order_usecase.go` — `List` fills `filter.Date` with the current outlet day when the caller omits it. `date` sent explicitly is still honoured.
- [ ] 5.2 `internal/usecase/users_settings_usecase.go` — `SettingsUsecase` takes `domain.OrderQueryRepository` and a transaction runner. `Update` rejects `IsOpen == false` with `INVALID_TRANSITION`.
- [ ] 5.3 Close operation — new usecase method and `POST /settings/close` handler:
  - reject with `409 INVALID_TRANSITION` when any order created on the current outlet day is `DIPROSES`; the message reports the count
  - otherwise cancel every unpaid `MENUNGGU` order of that day in one transaction: `DIBATALKAN`, items `CANCELLED`, stock restored, `RESTORE` movements, `audit_log`
  - set `is_open = false`, return the settings
- [ ] 5.4 `internal/delivery/http/router.go` — register `POST /settings/close` for `OWNER`.
- [ ] 5.5 Wiring in `cmd/api/wiring.go` — pass the order repository into `SettingsUsecase`.
- [ ] 5.6 Tests — `settings` close blocked by `DIPROSES`; close cancels unpaid orders and restores stock; close is a no-op when already closed; `PATCH /settings` rejects `is_open:false`; `GET /orders` without `date` returns the outlet day.

### Dashboard — `fnb-dashboard`

- [ ] 5.7 `src/api/http/settings.ts` — add `closeStore()` calling `POST /settings/close`.
- [ ] 5.8 `src/pages/SettingsPage.tsx` — the close toggle calls `closeStore()`; the confirm dialog states how many unpaid orders will be cancelled; a blocked close surfaces the server message.
- [ ] 5.9 `src/pages/OrdersPage.tsx` — manual refresh button invalidating the `['orders']` prefix, so the board and the stat cards refetch together.
- [ ] 5.10 `src/features/orders/useOrderStats.ts` — drop `date: todayUTC()`; rely on the server default.
- [ ] 5.11 Store-closed awareness — `['settings']` query polls so the POS guard and the closed banner react without a reload; `NewOrderPage` offers a refresh action while the store reads closed.
- [ ] 5.12 `src/mocks/handlers/orders.ts` — `getOrders` defaults to the current day when `date` is omitted.
- [ ] 5.13 `src/mocks/handlers/settings.ts` — mirror the server: reject `is_open:false` on patch, add a close handler that validates `DIPROSES` and cancels unpaid orders.
- [ ] 5.14 `src/mocks/selfcheck.ts` — close blocked by `DIPROSES` returns `INVALID_TRANSITION`; close cancels unpaid orders and restores stock; `PATCH is_open:false` returns `INVALID_TRANSITION`; `getOrders()` without a filter excludes a previous-day order.

### QR Menu — `../fnb-qr-menu`

- [ ] 5.15 `src/features/catalog/queries.ts` — `menuQuery` polls every 15 seconds and stops once `isOpen` is `false`, so a store closed mid-browse reaches `/tutup` without a checkout attempt.

### Docs

- [ ] 5.16 `../../docs/PRD.md` — §7.4 close rules, §7.5 auto-cancel on close, BR-25/BR-26.
- [ ] 5.17 `../../docs/api.md` — `POST /settings/close`, `PATCH /settings` rejection, `GET /orders` default day.
- [ ] 5.18 `../../docs/flow.md` — store close sequence.
- [ ] 5.19 `docs/tech-stack.md` — refresh action, server-owned day, settings polling.
- [ ] 5.20 `../fnb-qr-menu/docs/tech-stack.md` — menu polling for the closed notice.

## Verification

Mock layer:

- Closing while a `DIPROSES` order exists is refused and nothing changes.
- Closing with unpaid orders cancels them, restores stock, and flips `is_open`.
- The board shows only today's orders; a previous-day order is reachable through its own detail route.
- The refresh button refetches the board and the stat cards together.
- The POS page unlocks on its own when the store is opened from another tab.

Live API on `:8081`:

1. Owner closes the store with an unpaid order → order `DIBATALKAN`, stock restored, `settings.is_open` false.
2. Cashier tries to create an order → `409 STORE_CLOSED`.
3. Owner closes while an order is `DIPROSES` → `409 INVALID_TRANSITION`, store stays open.
4. `PATCH /settings {"is_open": false}` → `409 INVALID_TRANSITION`.
5. `GET /orders` without `date` returns only the current outlet day, including orders created just after local midnight.
6. QR Menu sitting on the menu page when the store closes → `/tutup` within 15 seconds.
