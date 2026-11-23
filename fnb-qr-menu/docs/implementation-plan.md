# FNB QR Menu — Implementation Plan

## Scope

Plan for the public customer SPA `fnb-qr-menu`, based on:

- `../docs/PRD.md`
- `../docs/flow.md`
- `../docs/api.md`
- `../docs/api-response.md`
- `docs/tech-stack.md`
- `docs/qr-menu-structure.md`

`../docs/PRD.md` and `../docs/flow.md` are the source of truth. When this plan, the mock layer, or the code disagrees with them, the contract wins and the other side is fixed.

## Decisions captured

- Identity is the table session: `POST /public/tables/:qr_token/sessions` returns `session_token`, stored once in `localStorage` and sent as `X-Session-Token` on every public call except the session open.
- `401 UNAUTHORIZED` re-opens the session from the stored `qr` once; `404 NOT_FOUND` routes to `/tidak-valid`.
- `payment_url` is returned by the create-order response only. It is not persisted by the server (`fnb-server/internal/domain/order.go` uses `gorm:"-"`), so the list response always returns `null`. The customer app does not offer a "resume payment" link.
- The customer app ships the WebSocket `session:{token}` topic in phase 2.8, with the 5-second list poll kept as fallback (PRD §11.4, EC-19).
- `order_number` follows `api.md`: `DI-YYYYMMDD-SSS`, zero-padded daily sequence. The earlier `DI-001` decision in PRD §18 is superseded.
- Ordering is disabled while `is_open` is `false`; the menu query polls every 15 seconds and stops once the store reads closed.
- Cancellation is order-level, only while `MENUNGGU` with `payment_status` `BELUM`, and allowed while the store is closed.
- The client never computes prices, service, tax, totals, stock, or order status.

## Phase Map

| Phase | Name              | Goal                                                              | State   |
| ----- | ----------------- | ----------------------------------------------------------------- | ------- |
| 0     | Setup             | Scaffold, tooling, constants, types, API switch, session skeleton | Done    |
| 1     | Mock layer        | Every public endpoint mocked with the production signature        | Done    |
| 2     | Slicing with mock | Every customer screen works against `src/mocks/`                  | Done    |
| 2.8   | Realtime and sync | Session WebSocket, order discovery, payment-link cleanup          | Done    |
| 3     | API integration   | Swap the mock for the live `fnb-server`                           | Planned |
| 4     | Verification      | Tests, accessibility, docs sync, final gates                      | Partial |
| 5     | Menu polling      | Closed-store notice without a checkout attempt                    | Done    |
| 6     | Order QR          | Status card "Tunjukkan QR" deep link to the dashboard board       | Done    |

Work is organized per screen or feature so each slice can be built, integrated, and verified independently. Phase 2.8 ran before phase 3; phase 5 was executed ahead of phase 3 and needs no rework. Phase 4 keeps the two manual device passes open.

## Phase 0 — Setup

- [phase-0-setup.md](implementation/phase-0-setup.md) — done.

## Phase 1 — Mock Layer

- [phase-1-mock.md](implementation/phase-1-mock.md) — done.

## Phase 2 — Slicing with Mock

| Screen / feature        | File                                                                      | State |
| ----------------------- | ------------------------------------------------------------------------- | ----- |
| 2.1 Shell and session   | [phase-2-1-shell-session.md](implementation/phase-2-1-shell-session.md)   | Done  |
| 2.2 Menu home           | [phase-2-2-menu-home.md](implementation/phase-2-2-menu-home.md)           | Done  |
| 2.3 Menu detail         | [phase-2-3-menu-detail.md](implementation/phase-2-3-menu-detail.md)       | Done  |
| 2.4 Cart                | [phase-2-4-cart.md](implementation/phase-2-4-cart.md)                     | Done  |
| 2.5 Checkout and submit | [phase-2-5-checkout.md](implementation/phase-2-5-checkout.md)             | Done  |
| 2.6 Order status        | [phase-2-6-status.md](implementation/phase-2-6-status.md)                 | Done  |
| 2.7 Closed and invalid  | [phase-2-7-closed-invalid.md](implementation/phase-2-7-closed-invalid.md) | Done  |
| 2.8 Realtime and sync   | [phase-2-8-realtime-sync.md](implementation/phase-2-8-realtime-sync.md)   | Done  |

## Phase 3 — API Integration

- [phase-3-api.md](implementation/phase-3-api.md) — HTTP client, five public endpoints, WebSocket verification, error-code and rate-limit checks. Done.

## Phase 4 — Verification

- [phase-4-verification.md](implementation/phase-4-verification.md) — test coverage, accessibility, per-screen checks, documentation sync, final gates.

## Phase 5 — Menu Polling

- [phase-5-menu-polling.md](implementation/phase-5-menu-polling.md) — menu query polls every 15 seconds and stops when `is_open` is `false`. Done.

## Phase 6 — Order QR

- [phase-6-order-qr.md](implementation/phase-6-order-qr.md) — "Tunjukkan QR" on the status card encodes `${VITE_DASHBOARD_URL}/orders?q=<order_number>`. Done.

## Excluded

- Unit, component, or E2E frameworks beyond the existing Vitest unit tests; RTL and Playwright stay out.
- SSR, `@tanstack/react-router`, `@tanstack/react-start`, nitro.
- Redux or Zustand.
- Authentication, accounts, and role guards.
- Client-side recognition of prices, service, tax, totals, stock, or order status.
- Item-level cancellation, refunds, and refund warnings.
- WhatsApp and push notifications (product phase 2).
- Multi-outlet support.
