# Plan — Kitchen Board Conformance

Plan for aligning the dashboard kitchen board (`/kitchen`) with `../docs/PRD.md` §4.4, §5, §7.3, §9 and `../docs/flow.md`.

Status: **implemented**. The board now has the Masak and Pass/Counter tabs; this file records the rules it follows.

## Scope

Dashboard (`fnb-dashboard`) and its mock layer (`src/mocks/`). `../docs/PRD.md` and `../docs/flow.md` are the source of truth; the board is changed to match them, not the other way round.

## Reference rules (quoted)

Item transitions (PRD §5.2):

```text
PENDING → COOKING → READY → DELIVERED → COMPLETED
PENDING → CANCELLED            (order cancellation only)
```

Order status (PRD §5.1, §5.3):

```text
payment BELUM, not cancelled                 → MENUNGGU
payment LUNAS, any item not terminal         → DIPROSES
payment LUNAS, every item COMPLETED/CANCELLED → SELESAI
cancelled while unpaid                       → DIBATALKAN
```

Actor matrix (PRD §9):

| Transition                      | Actor                                                       |
| ------------------------------- | ----------------------------------------------------------- |
| `PENDING → COOKING`             | `KITCHEN`, `OWNER`                                          |
| `COOKING → READY`               | `KITCHEN`, `OWNER`                                          |
| `READY → DELIVERED` (dine-in)   | `KITCHEN`, `OWNER`                                          |
| `READY → DELIVERED` (take away) | `KITCHEN`, `CASHIER`, `OWNER`                               |
| `DELIVERED → COMPLETED`         | `KITCHEN`, `CASHIER` (take away), `OWNER`, or the scheduler |

Consequences that drive this plan:

- Kitchen sees paid orders only; `COOKING` while `BELUM` is rejected with `409 PAYMENT_REQUIRED`.
- `DELIVERED` means handed to the waiter or cashier, not served at the table (PRD §18 #6).
- The two tabs are product scope: "Masak" and "Pass/Counter" (PRD §18 #10).
- `READY → DELIVERED` falls back after `ready_auto_deliver_minutes`, with a warning `ready_auto_deliver_warning_minutes` earlier.
- `DELIVERED → COMPLETED` falls back after `delivered_auto_complete_minutes`; the kitchen may override earlier.

## Current drift

| #   | Drift                                                         | Fix                                                                                  |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Item set lacks `COMPLETED`                                    | add `COMPLETED` to `ITEM_STATUS` and the transition table                            |
| 2   | Board has one screen with `PENDING`/`COOKING`/`READY` columns | two tabs: "Masak" (`PENDING`, `COOKING`) and "Pass/Counter" (`READY`, `DELIVERED`)   |
| 3   | Order statuses include `SIAP` and `DIANTAR`                   | remove both; board selects orders by `payment_status = LUNAS` and active item states |
| 4   | No `READY → DELIVERED` or `DELIVERED → COMPLETED` action      | add both, role- and order-type-aware                                                 |
| 5   | No auto-deliver warning / auto-complete indicator             | derive from `settings` timers and show on the card                                   |
| 6   | `READY` items disappear once every item is `READY`            | keep them in Pass/Counter until `DELIVERED`                                          |

## Step 1 — Status constants

`src/constants/itemStatus.ts`: add `COMPLETED` between `DELIVERED` and `CANCELLED`.
`src/constants/orderStatus.ts`: keep `MENUNGGU`, `DIPROSES`, `SELESAI`, `DIBATALKAN` only.

## Step 2 — Mock transitions and derivation

`src/mocks/handlers/orders.ts`:

- `updateItemStatus` accepts `DELIVERED → COMPLETED`.
- Role guard per PRD §9: `COOKING`/`READY` → `KITCHEN`, `OWNER`; `DELIVERED` → `KITCHEN`, `OWNER` for `DINE_IN` and `CASHIER` too for `TAKE_AWAY`; `COMPLETED` → `KITCHEN`, `OWNER`, and `CASHIER` for `TAKE_AWAY`.
- `COOKING` while `payment_status = BELUM` → `PAYMENT_REQUIRED`.
- Invalid pair → `INVALID_TRANSITION`.

`src/mocks/handlers/deriveStatus.ts`:

- Drop `SIAP`/`DIANTAR` branches.
- `BELUM` and not cancelled → `MENUNGGU`.
- `LUNAS` and at least one item not `COMPLETED`/`CANCELLED` → `DIPROSES`.
- `LUNAS` and every item `COMPLETED`/`CANCELLED` → `SELESAI`.
- Cancelled while unpaid → `DIBATALKAN`.

## Step 3 — Kitchen page

`src/pages/KitchenPage.tsx`:

1. Queries `useOrders()`; keeps `payment_status === LUNAS` orders that still have an item outside `COMPLETED`/`CANCELLED`.
2. Tabs (`Tabs` component): "Masak" and "Pass/Counter".
3. Masak columns: `PENDING` (`Mulai masak`), `COOKING` (`Siap`).
4. Pass/Counter columns: `READY` (`Serahkan`), `DELIVERED` (`Selesaikan` override).
5. Card shows `order_number`, table, item name, `qty`, `note`, and a warning badge once a `READY` item has waited past `ready_auto_deliver_minutes − ready_auto_deliver_warning_minutes`.
6. Empty state per tab.

## Step 4 — Cashier hand-over

`src/pages/OrdersPage.tsx` and the order detail: for `TAKE_AWAY` orders the cashier gets `READY → DELIVERED` and `DELIVERED → COMPLETED`. No action for `DINE_IN` (the kitchen owns it).

## Step 5 — Self-check

`src/mocks/selfcheck.ts`:

- `COOKING` on a `BELUM` order throws `PAYMENT_REQUIRED`.
- `DELIVERED → COMPLETED` is accepted; `READY → COMPLETED` is rejected with `INVALID_TRANSITION`.
- Order becomes `SELESAI` only when every item is `COMPLETED` or `CANCELLED`.
- `CASHIER` cannot deliver a `DINE_IN` item but can deliver a `TAKE_AWAY` item.

## Step 6 — Verification

```bash
npm run lint && npm run format:check && npm run build
```

Manual: pay an order, cook it in "Masak", hand it over in "Pass/Counter", complete it, and confirm the order turns `SELESAI` on the cashier board.

## Commits

```
fix(mocks): align item transitions and order derivation with PRD §5
feat(kitchen): split Masak and Pass/Counter tabs with hand-over actions
```
