# Phase 4 — Verification

Granular plan for executing Phase 4 from `../implementation-plan.md`.

## Scope

Per-page manual verification on mocks and on the live API, contract conformance, and documentation sync. No automated test suites.

## Status

OPEN — not started.

## Gates

Run before every commit:

```bash
npm run lint && npm run format:check && npm run build
```

Mock contract check:

```bash
VITE_RUN_MOCK_SELFCHECK=true npm run dev
```

## 4.1 Per-page mock verification

- [ ] Login — bad credentials return `UNAUTHORIZED`; each demo role button lands on its home route.
- [ ] Orders board — four status columns; stat cards filter; 5 s polling; cash countdown on `MENUNGGU` + `BELUM`.
- [ ] Order detail — receipt reprint; cancel `OWNER` only; session close for `CASHIER` and `OWNER`; take away has no session action.
- [ ] Take away POS — `TAKE_AWAY` only; `CASHIER` only; `STORE_CLOSED` blocks creation; draft survives reload.
- [ ] Checkout — change calculation; idempotent confirm; `NON_CASH` confirmation; receipt figures match; countdown shown.
- [ ] Kitchen board — both tabs; `LUNAS` only; `PAYMENT_REQUIRED` on unpaid cook; auto-deliver warning; groups per table or `order_number`.
- [ ] Menus — `OWNER` CRUD; recipe edit returns `STORE_CLOSED` while open; `CASHIER` toggles availability only.
- [ ] Tables — QR matches `${VITE_QR_MENU_URL}/?meja=<qr_token>`; bulk print; deactivated table rejects scans.
- [ ] Stock — restock `IN`, opname `ADJUSTMENT`, order `OUT`, cancel `RESTORE`; `CASHIER` read-only.
- [ ] Users — `OWNER` only; create `CASHIER` / `KITCHEN`; deactivated user cannot log in.
- [ ] Settings — eight fields; rates affect new orders only; warning must be lower than auto-deliver.
- [ ] Reports — four presets; three tabs; CSV export; `OWNER` only.
- [ ] Audit log — append-only; `OWNER` only; `FORBIDDEN` for other roles.

## 4.2 Contract conformance

- [ ] Order status set is `MENUNGGU`, `DIPROSES`, `SELESAI`, `DIBATALKAN`; no `SIAP` / `DIANTAR`.
- [ ] Item status set includes `COMPLETED`; an order is `SELESAI` only when every item is `COMPLETED` or `CANCELLED`.
- [ ] Totals use `service_rate_snapshot` and `tax_rate_snapshot`, integer rupiah, round half up per component.
- [ ] `order_number` is `DI-YYYYMMDD-SSS` / `TA-YYYYMMDD-SSS`, reset daily per type.
- [ ] Cashier creates `TAKE_AWAY` orders only; owner creates none.
- [ ] Payment confirmation is idempotent; no second `payment_log`.
- [ ] Cancellation is order-level, `OWNER` only, unpaid only, and restores stock.
- [ ] Error codes follow the envelope: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `STOCK_NOT_ENOUGH`, `STORE_CLOSED`, `INVALID_TRANSITION`, `PAYMENT_REQUIRED`, `INTERNAL_ERROR`.

## 4.3 Live API verification

- [ ] Backend on `:8081`; `VITE_USE_MOCKS=false`.
- [ ] Login works; the refresh cookie keeps the session after reload; logout clears it.
- [ ] Cashier creates a take away order and confirms cash.
- [ ] Kitchen processes only `LUNAS` orders through `PENDING → COOKING → READY → DELIVERED`, then overrides `COMPLETED`.
- [ ] Cashier moves take away items `READY → DELIVERED → COMPLETED`.
- [ ] Owner cancels an unpaid order and stock is restored.
- [ ] WebSocket updates arrive under 2 s; polling takes over within 5 s when the socket drops.
- [ ] Two dashboard sessions stay consistent with no status mismatch.

## 4.4 Documentation sync

- [ ] `AGENTS.md` — status and commands match the code.
- [ ] `docs/tech-stack.md` — auth file names (`auth/context.tsx`, `auth/guards.tsx`), WebSocket transport, Reports status.
- [ ] `docs/dashboard-structure.md` — polling plus WebSocket; cashier `READY → DELIVERED → COMPLETED` limited to `TAKE_AWAY`.
- [ ] `../../docs/PRD.md` §7.5 — order number wording matches `../../docs/api.md`.
- [ ] `docs/implementation/*` — completed tasks stay marked, open tasks removed once done.
