# FNB Dashboard — Implementation Plan

## Scope

Plan for the internal dashboard `fnb-dashboard`, based on `../docs/PRD.md`, `../docs/flow.md`, `../docs/api.md`, `../docs/api-response.md`, `docs/tech-stack.md`, and `docs/dashboard-structure.md`.

`../docs/PRD.md` and `../docs/flow.md` are the source of truth. When this plan, the mock layer, or the code disagrees with them, the PRD wins and the other side is fixed.

Decided exception: `order_number` follows `api.md` (`DI-YYYYMMDD-SSS` / `TA-YYYYMMDD-SSS`, zero-padded daily sequence per `order_type`). PRD §7.5 (`TA-001` / `DI-001`) is superseded and needs a correction in the PRD itself.

Reports are complete on the mock layer. `api.md` now defines `/reports/*` (phase 3.11), so Reports joins the API integration.

Unit, component, and E2E testing are excluded.

This document is the index. Every phase and every page has its own file in `docs/implementation/`, with its own task checklist and verification steps.

## Phase Map

| Phase | Name              | Goal                                              | State       |
| ----- | ----------------- | ------------------------------------------------- | ----------- |
| 1     | Setup             | Scaffold, tooling, constants, types, mock harness | Done        |
| 2     | Slicing with mock | Every page works against `src/mocks/`             | Done        |
| 3     | API integration   | Swap mock for the live `fnb-server`               | Not started |
| 4     | Verification      | Per-page manual verification and docs sync        | Not started |

Work is organized per feature or per page so each page can be sliced, integrated, and verified independently.

## Phase 1 — Setup

- [phase-1-setup.md](implementation/phase-1-setup.md) — done.

## Phase 2 — Slicing with Mock

| Page                     | File                                                                            | State                 |
| ------------------------ | ------------------------------------------------------------------------------- | --------------------- |
| 2.1 Auth                 | [phase-2-1-auth.md](implementation/phase-2-1-auth.md)                           | Done                  |
| 2.2 Orders board         | [phase-2-2-orders-board.md](implementation/phase-2-2-orders-board.md)           | Done                  |
| 2.3 Order detail dialog  | [phase-2-3-order-detail.md](implementation/phase-2-3-order-detail.md)           | Done                  |
| 2.4 Take away POS        | [phase-2-4-pos.md](implementation/phase-2-4-pos.md)                             | Done                  |
| 2.5 Checkout and payment | [phase-2-5-checkout.md](implementation/phase-2-5-checkout.md)                   | Done                  |
| 2.6 Kitchen board        | [phase-2-6-kitchen.md](implementation/phase-2-6-kitchen.md)                     | Done                  |
| 2.7 Menus and recipes    | [phase-2-7-menus.md](implementation/phase-2-7-menus.md)                         | Done                  |
| 2.8 Tables and QR        | [phase-2-8-tables.md](implementation/phase-2-8-tables.md)                       | Done                  |
| 2.9 Stock                | [phase-2-9-stock.md](implementation/phase-2-9-stock.md)                         | Done                  |
| 2.10 Users               | [phase-2-10-users.md](implementation/phase-2-10-users.md)                       | Done                  |
| 2.11 Settings            | [phase-2-11-settings.md](implementation/phase-2-11-settings.md)                 | Done                  |
| 2.12 Reports             | [phase-2-12-reports.md](implementation/phase-2-12-reports.md)                   | Done                  |
| 2.13 Audit log           | [phase-2-13-audit-log.md](implementation/phase-2-13-audit-log.md)               | Done                  |
| 2.14 Mock conformance    | [phase-2-14-mock-conformance.md](implementation/phase-2-14-mock-conformance.md) | Done                  |

Phase 2 is complete on the mock layer. The integration work that used to be listed here is now the first task of Phase 3.

## Phase 3 — API Integration

- [phase-3-api.md](implementation/phase-3-api.md) — 15 tasks, resource by resource, settings before orders, WebSocket last.

## Phase 4 — Verification

- [phase-4-verification.md](implementation/phase-4-verification.md) — gates, per-page checks, contract conformance, live API checks, documentation sync.

## Excluded

- Unit, component, and E2E testing; Redux or Zustand; Storybook; Playwright before the MVP flow is stable.
- Refund, item-level cancellation, multi-outlet, manager role, notifications, and Midtrans UI inside the dashboard (customer payment stays in the QR Menu).
