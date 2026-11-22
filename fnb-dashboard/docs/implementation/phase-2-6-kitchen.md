# Phase 2.6 — Kitchen Board

Granular plan for executing section 2.6 from `../implementation-plan.md`.

## Scope

`/kitchen` board for `KITCHEN` and `OWNER`. Two tabs, paid orders only, auto-deliver warning. PRD §4.4, §7.3, BR-02, BR-17.

## Status

DONE — all tasks complete.

## Files

- `src/pages/KitchenPage.tsx`
- `src/features/orders/useOrders.ts`

## Tasks

- [x] Tabs "Masak" (`PENDING`, `COOKING`) and "Pass/Counter" (`READY`, `DELIVERED`).
- [x] Fetch `GET /orders` and keep `LUNAS` orders only; terminal items are filtered out of the board.
- [x] Actions `PENDING → COOKING`, `COOKING → READY`, `READY → DELIVERED`, and the `DELIVERED → COMPLETED` override.
- [x] Auto-deliver warning derived from `ready_auto_deliver_minutes` and `ready_auto_deliver_warning_minutes` in settings.
- [x] Group items per table for dine-in and per `order_number` for take away, keeping the status columns inside each group (PRD §7.3).
  - Sort groups so the longest-waiting item appears first; keep a group visible while any of its items is non-terminal.
  - Show the table badge for dine-in and the order number for take away on every item card.

## Verification

- `BELUM` orders never appear; cooking an unpaid order is unreachable from the UI.
- An item at `READY` past the warning threshold shows the warning.
- Groups collapse to nothing when all their items are terminal.
