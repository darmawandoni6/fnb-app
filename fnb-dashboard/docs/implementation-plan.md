# FNB Dashboard — Implementation Plan

## Scope

Plan for the internal dashboard `fnb-dashboard`, based on `../docs/PRD.md`, `../docs/flow.md`, `../docs/api.md`, `../docs/api-response.md`, `docs/tech-stack.md`, and `docs/dashboard-structure.md`.

`../docs/PRD.md` and `../docs/flow.md` are the source of truth. When this plan, the mock layer, or the code disagrees with them, the PRD wins and the other side is fixed.

Decided exception: `order_number` follows `api.md` (`DI-YYYYMMDD-SSS` / `TA-YYYYMMDD-SSS`, zero-padded daily sequence per `order_type`). PRD §7.5 (`TA-001` / `DI-001`) is superseded and needs a correction in the PRD itself.

Reports are complete on the mock layer. `api.md` has no `/reports/*` contract, so Reports stays on mocks and is excluded from API integration until the contract exists.

Unit, component, and E2E testing are excluded.

This document is the index. Every phase and every page has its own file in `docs/implementation/`, with its own task checklist and verification steps.

## Phase Map

| Phase | Name              | Goal                                              | State                    |
| ----- | ----------------- | ------------------------------------------------- | ------------------------ |
| 1     | Setup             | Scaffold, tooling, constants, types, mock harness | Done                     |
| 2     | Slicing with mock | Every page works against `src/mocks/`             | Mostly done; 7 gaps open |
| 3     | API integration   | Swap mock for the live `fnb-server`               | Not started              |
| 4     | Verification      | Per-page manual verification and docs sync        | Not started              |

Work is organized per feature or per page so each page can be sliced, integrated, and verified independently.

## Phase 1 — Setup

- [phase-1-setup.md](implementation/phase-1-setup.md) — done.

## Phase 2 — Slicing with Mock

| Page                     | File                                                                            | State                       |
| ------------------------ | ------------------------------------------------------------------------------- | --------------------------- |
| 2.1 Auth                 | [phase-2-1-auth.md](implementation/phase-2-1-auth.md)                           | Done                        |
| 2.2 Orders board         | [phase-2-2-orders-board.md](implementation/phase-2-2-orders-board.md)           | Open — cash countdown       |
| 2.3 Order detail dialog  | [phase-2-3-order-detail.md](implementation/phase-2-3-order-detail.md)           | Open — session close        |
| 2.4 Take away POS        | [phase-2-4-pos.md](implementation/phase-2-4-pos.md)                             | Done                        |
| 2.5 Checkout and payment | [phase-2-5-checkout.md](implementation/phase-2-5-checkout.md)                   | Open — countdown reuse      |
| 2.6 Kitchen board        | [phase-2-6-kitchen.md](implementation/phase-2-6-kitchen.md)                     | Open — grouping             |
| 2.7 Menus and recipes    | [phase-2-7-menus.md](implementation/phase-2-7-menus.md)                         | Open — cashier availability |
| 2.8 Tables and QR        | [phase-2-8-tables.md](implementation/phase-2-8-tables.md)                       | Done                        |
| 2.9 Stock                | [phase-2-9-stock.md](implementation/phase-2-9-stock.md)                         | Done                        |
| 2.10 Users               | [phase-2-10-users.md](implementation/phase-2-10-users.md)                       | Done                        |
| 2.11 Settings            | [phase-2-11-settings.md](implementation/phase-2-11-settings.md)                 | Open — warning validation   |
| 2.12 Reports             | [phase-2-12-reports.md](implementation/phase-2-12-reports.md)                   | Done, frozen on mocks       |
| 2.13 Audit log           | [phase-2-13-audit-log.md](implementation/phase-2-13-audit-log.md)               | Done                        |
| 2.14 Mock conformance    | [phase-2-14-mock-conformance.md](implementation/phase-2-14-mock-conformance.md) | Open — order number         |

Open work, in dependency order:

1. `2.14` order number format — touches the mock generator, fixtures, and self check.
2. `2.2` cash countdown — the shared `CashCountdown` component is a prerequisite for `2.5`.
3. `2.5` countdown reuse.
4. `2.3` table session close in the order detail.
5. `2.7` cashier menu availability.
6. `2.11` settings warning validation.
7. `2.6` kitchen grouping.

## Phase 3 — API Integration

- [phase-3-api.md](implementation/phase-3-api.md) — 11 tasks, resource by resource, WebSocket last.

## Phase 4 — Verification

- [phase-4-verification.md](implementation/phase-4-verification.md) — gates, per-page checks, contract conformance, live API checks, documentation sync.

## Excluded

- Unit, component, and E2E testing; Redux or Zustand; Storybook; Playwright before the MVP flow is stable.
- Reports API integration until `api.md` defines `/reports/*`.
- Refund, item-level cancellation, multi-outlet, manager role, notifications, and Midtrans UI inside the dashboard (customer payment stays in the QR Menu).
