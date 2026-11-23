# PRD — FNB App

## 1. Overview

### 1.1 Background

FNB App is a self-service ordering system for a single cafe outlet. Customers order dine-in by scanning the table QR code, or order take away through the cashier. The system keeps customers, cashier, kitchen, and owner in sync, supports cash and non-cash payment, and calculates service charge and tax on every order.

Waiters do not use the application. They follow the manual procedure in `SOP-WAITER-01` (separate document).

Problems being solved:

- Orders taken on paper are lost or recorded incorrectly.
- The cashier has no single consistent order list.
- The kitchen has no clear production queue.
- The owner cannot monitor sales and stock.

First win:

> A customer scans the table QR code, submits an order, pays at the cashier, and the order appears on the kitchen board and is delivered without anyone writing it down.

### 1.2 Goals

- Reduce the time from scan to payment.
- Confirm cash payment through the cashier, not by assumption.
- Keep order and item status identical across customer, cashier, kitchen, and owner.
- Calculate service charge and tax automatically on every order.
- Keep operations simple: three applications, waiter stays manual.

### 1.3 Scope

- Single outlet.
- Dine-in through table QR and take away through the cashier.
- Cash payment confirmed by the cashier, and non-cash payment through Midtrans Snap.
- Order and item status management by kitchen, cashier, and owner.
- Service charge (PB1 service) and tax (PB1) calculation.
- Roles `OWNER`, `CASHIER`, `KITCHEN` with RBAC in the dashboard.
- Thermal receipt for take away, printed from the browser.
- Automatic cancel, automatic deliver fallback, and automatic complete.
- Ingredient stock, recipes, and stock movements.
- Order-level cancellation while the order is unpaid.

### 1.4 Out of Scope (v1)

- Multi-outlet.
- Loyalty, promo, voucher.
- Online delivery integration.
- Waiter application (manual SOP only).
- Separate manager role (phase 2).
- Item-level cancellation and partial cancellation (cancel is always order-level).
- Refund after payment (handled manually outside the system; phase 2).
- Cancelling a paid order (handled manually by the owner).
- Digital receipt through WhatsApp or email (phase 2).
- Push or WhatsApp notification to the customer (phase 2; `customer_phone` is prepared as optional).

## 2. Applications

```text
fnb-app/
├── fnb-server/     # Go backend
├── fnb-dashboard/  # Internal frontend: owner, cashier, kitchen
└── fnb-qr-menu/    # Public frontend: customers
```

### 2.1 Backend — `fnb-server`

- Go, Echo HTTP API, GORM, PostgreSQL.
- JWT access token for the dashboard; refresh token stored as a hash in `sessions` and sent through an httpOnly cookie.
- Table session token for the public QR Menu (no login).
- WebSocket hub for real-time order and item status; polling stays as the fallback.
- Midtrans Snap integration with an idempotent webhook.
- Scheduler job that runs every minute for auto-cancel, auto-deliver fallback, and auto-complete.
- Versioned SQL migrations in `migrations/`.
- Append-only `audit_log` for every status change.

PostgREST is not used. All data access goes through the Go API so authentication, authorization, transactions, and business rules stay centralized.

### 2.2 Dashboard — `fnb-dashboard`

Vite SPA + TypeScript, one build, routes and menus based on role.

- `OWNER`: order board, take away order creation, cancel unpaid order, cash confirmation (backup), outlet settings, users and roles, stock, menus, tables and QR, audit log, reports (phase 2).
- `CASHIER`: take away orders, cash confirmation, thermal receipt, `READY → DELIVERED → COMPLETED` for take away, cancel unpaid order, active order list, menu availability, stock read-only.
- `KITCHEN`: two tabs — "Masak" (`PENDING → COOKING → READY`) and "Pass/Counter" (`READY → DELIVERED`, override `DELIVERED → COMPLETED`), auto-deliver warning.

### 2.3 QR Menu — `fnb-qr-menu`

Vite SPA + TypeScript, mobile-first, lightweight.

- Scan the table QR code to open a table session.
- Browse menu, cart, quantity, per-item note.
- Required customer name, optional phone number.
- Choose cash or non-cash payment.
- Track order and item status in real time.
- Add another order in the same table session.
- No login; the table session token is stored in `localStorage`.

Application UI copy is written in Indonesian (product decision), while all documentation, identifiers, and database values stay in English or literal enum form.

## 3. Actors and Roles

| Actor | Description | Access |
|---|---|---|
| Customer | Dine-in guest who scans the table QR code | QR Menu, no login, table session token; name required, phone optional |
| Cashier | Creates take away orders, confirms cash, cancels unpaid orders, hands over take away orders, prints receipts | Dashboard (login) |
| Kitchen | Updates production and hand-over status | Dashboard (login) |
| Owner | Manages orders, creates take away orders, cancels unpaid orders, configures outlet, manages users, reads audit log | Dashboard (login) |
| Waiter | Picks up `READY` items from the counter and serves them | No system access; `SOP-WAITER-01` |

The first owner is created through an environment seed:

```text
SEED_OWNER_EMAIL
SEED_OWNER_PASSWORD
```

The seed creates an owner only when the `users` table is empty. Public registration is unavailable.

## 4. Main Flows

### 4.1 Dine-in Order (QR Menu)

1. The customer scans the table QR code.
2. QR Menu calls `POST /public/tables/:qr_token/sessions` and receives a `session_token`, stored in `localStorage`.
3. QR Menu requests the menu with the session token, showing price, availability, and whether the store is open.
4. The customer selects items and quantities, writes optional notes, and enters name (required) and phone (optional).
5. The customer chooses the payment method:
   - Non-cash: Midtrans Snap opens, and a successful payment moves the order to `DIPROSES`.
   - Cash: the order stays `MENUNGGU` with `order_number` and a 15-minute timer; the customer goes to the cashier.
6. The backend validates the table session, menu availability, prices, recipes, and stock in one transaction, then creates the order, its items with status `PENDING`, the order number, the price and rate snapshots, and decreases stock.
7. The success screen shows the order number. The order appears on the cashier and kitchen boards in real time.
8. The cashier confirms cash payment, or Midtrans confirms non-cash payment; the order becomes `DIPROSES`.
9. The kitchen moves each item `PENDING → COOKING → READY`.
10. The kitchen marks `READY → DELIVERED` in the Pass/Counter tab when the item is handed to the waiter; the customer sees "dalam pengantaran".
11. The waiter serves the item following `SOP-WAITER-01`. No system action.
12. `DELIVERED → COMPLETED` happens automatically after 5 minutes, or immediately when the kitchen overrides it.
13. When every item is `COMPLETED` or `CANCELLED`, the order becomes `SELESAI`.
14. The customer can add another order in the same table session; it becomes a new order row.

### 4.2 Take Away Order (Cashier)

1. The cashier logs in.
2. The cashier selects menu items and quantities.
3. The cashier reviews the cart: subtotal, service charge, tax, grand total.
4. The cashier enters the customer name (required) and phone (optional).
5. The cashier chooses the payment method:
   - Non-cash: Midtrans Snap, then the order moves to `DIPROSES`.
   - Cash: the order stays `MENUNGGU` with `order_number`; the cashier receives the money, enters the amount received, and confirms.
6. The success dialog shows the order number and offers the receipt print action.
7. The kitchen cooks the items (`PENDING → COOKING → READY`).
8. The cashier hands over the order and marks the items `READY → DELIVERED → COMPLETED`; no waiter is involved.
9. When every item is `COMPLETED` or `CANCELLED`, the order becomes `SELESAI`.

### 4.3 Cash Confirmation

1. The customer, cashier, or owner creates a cash order: status `MENUNGGU`, `payment_status` `BELUM`, with `order_number` and a 15-minute timer.
2. The cashier scans the order QR, opens the order from the board, or enters the order number. The order QR is a dashboard deep link (`/orders?q=<order_number>`), not an API lookup.
3. The cashier sees the order detail and the grand total.
4. The cashier enters the amount received; the client shows the change.
5. The cashier confirms the payment. The endpoint is idempotent: repeating the confirmation returns the same order without a second effect.
6. `payment_status` becomes `LUNAS`, `paid_at` is set, a `payment_log` row with method `CASH` is written, the order moves to `DIPROSES`, and the customer screen updates.
7. When the timer expires without payment, the order moves to `DIBATALKAN`.

### 4.4 Kitchen Flow (Dashboard, Two Tabs)

1. The kitchen logs in.
2. Tab "Masak": items with status `PENDING` are shown; the kitchen moves them to `COOKING` and then `READY`.
3. Tab "Pass/Counter": items with status `READY` are shown; the kitchen marks `DELIVERED` when handing them to the waiter (dine-in) or to the cashier (take away).
4. Items stuck at `READY` are automatically moved to `DELIVERED` after 10 minutes. The kitchen sees a warning 2 minutes before that happens.
5. Items at `DELIVERED` become `COMPLETED` automatically after 5 minutes; the kitchen may override it earlier.
6. Completed items leave the active list.

### 4.5 Waiter Flow (Manual SOP)

1. The waiter picks up `READY` items from the kitchen counter.
2. The kitchen marked the item `DELIVERED` when handing it over.
3. The waiter serves the item to the table.
4. The waiter performs no system action.
5. Detail lives in `SOP-WAITER-01` (separate document).

### 4.6 Table Session Lifecycle

1. Scanning the table QR code creates a table session when the table has none active, and returns its `session_token`.
2. Scanning again while the session is active returns the same `session_token`, so a closed browser can resume tracking.
3. The session closes automatically when it holds no active order (every order is `SELESAI` or `DIBATALKAN`), or when the cashier or owner closes the table manually.
4. A closed session cannot be reopened; the next scan creates a new session and new orders belong to it.
5. Orders always keep their `table_session_id`, so closing a session never hides history.

### 4.7 Order Cancellation (Unpaid Only)

Cancellation applies only while the order is `MENUNGGU` and `payment_status` is `BELUM`. There is no partial cancellation, no cancellation after payment, and no refund in v1.

Scenario A — automatic cash timeout:

1. The cash order is created: `MENUNGGU` and a 15-minute timer.
2. The customer does not pay in time; the scheduler cancels the order.
3. The order becomes `DIBATALKAN`, and every item becomes `CANCELLED`.
4. Stock for every item is restored atomically and recorded as `RESTORE` movements.
5. The customer screen updates.

Scenario B — Midtrans expiry:

1. The non-cash order is created and Midtrans Snap opens.
2. The customer does not pay; Midtrans sends the expiry callback.
3. The order becomes `DIBATALKAN`, and every item becomes `CANCELLED`; stock is restored.

Scenario C — owner or cashier cancels manually:

1. The owner or the cashier opens an order with status `MENUNGGU`.
2. They cancel it with a required reason.
3. The order becomes `DIBATALKAN`, written to `cancel_reason` and `canceled_at`; every item becomes `CANCELLED`; stock is restored.
4. The customer screen updates.

Rules:

- Cancellation is allowed only while the order is `MENUNGGU` and `payment_status` is `BELUM`.
- A paid order (`DIPROSES`) cannot be cancelled in v1; the owner handles it manually outside the system.
- Cancellation is always order-level; all items move to `CANCELLED` together.
- Cancellation never produces a refund, because no money has been collected.
- Cancelled orders keep their price snapshot and their stock movements.

## 5. State Machine

### 5.1 Order Status

```text
MENUNGGU ──→ DIPROSES ──→ SELESAI
    │
    └──────→ DIBATALKAN
```

- `MENUNGGU` — order created, payment not confirmed (`payment_status` `BELUM`).
- `DIPROSES` — payment confirmed, at least one item is still active.
- `SELESAI` — every item is `COMPLETED` or `CANCELLED`.
- `DIBATALKAN` — the order was cancelled while unpaid.

| From | To | Trigger | Actor |
|---|---|---|---|
| `MENUNGGU` | `DIPROSES` | Non-cash payment succeeded or cashier confirmed cash | System / `CASHIER` |
| `MENUNGGU` | `DIBATALKAN` | Cash timeout, Midtrans expiry, or manual cancel with a required reason | System / `OWNER` / `CASHIER` |
| `DIPROSES` | `SELESAI` | Every item is `COMPLETED` or `CANCELLED` | System |

`DIPROSES → DIBATALKAN` does not exist in v1.

### 5.2 Item Status

| Backend value | Customer label (UI) | Transition actor |
|---|---|---|
| `PENDING` | menunggu | System (order reaches `DIPROSES`) |
| `COOKING` | diproses | `KITCHEN`, `OWNER` |
| `READY` | siap | `KITCHEN`, `OWNER` |
| `DELIVERED` | dalam pengantaran | `KITCHEN`, `OWNER` for dine-in; `CASHIER`, `OWNER` for take away |
| `COMPLETED` | selesai | Auto after 5 minutes; `KITCHEN`, `CASHIER`, `OWNER` override |
| `CANCELLED` | batal | `OWNER`, `CASHIER`, or system, only while the whole order is cancelled |

| From | To | Actor |
|---|---|---|
| `PENDING` | `COOKING` | `KITCHEN`, `OWNER` |
| `COOKING` | `READY` | `KITCHEN`, `OWNER` |
| `READY` | `DELIVERED` | `KITCHEN`, `OWNER`, and `CASHIER` for take away |
| `DELIVERED` | `COMPLETED` | Scheduler after 5 minutes, or `KITCHEN`, `CASHIER`, `OWNER` |
| `PENDING` | `CANCELLED` | System, `OWNER`, or `CASHIER`, only as part of order cancellation |

- `COOKING` is rejected with `409 PAYMENT_REQUIRED` while the order is `BELUM`.
- There is no `COOKING`/`READY`/`DELIVERED` → `CANCELLED` transition in v1.
- `DELIVERED` means the kitchen handed the item to the waiter (dine-in) or to the cashier (take away), not that the item has reached the table.
- Customer-facing status is derived from item status, never stored per customer.

### 5.3 Order Status Derivation

`orders.status` is a stored aggregate, recomputed on every item and payment change.

| Condition | Order status |
|---|---|---|
| `payment_status` is `BELUM` and the order is not cancelled | `MENUNGGU` |
| `payment_status` is `LUNAS` and at least one item is not `COMPLETED` or `CANCELLED` | `DIPROSES` |
| `payment_status` is `LUNAS` and every item is `COMPLETED` or `CANCELLED` | `SELESAI` |
| The order was cancelled while unpaid | `DIBATALKAN` |

There is no endpoint that sets the order status directly.

## 6. Service Charge and Tax

```text
subtotal      = Σ (order_item.price × order_item.qty)
service_amount = round(subtotal × service_rate / 100)
tax_amount     = round((subtotal + service_amount) × tax_rate / 100)
total_amount   = subtotal + service_amount + tax_amount
```

- `service_rate` defaults to `5`, `tax_rate` defaults to `10`, both configurable by the owner in settings.
- Rounding is round half up to the nearest rupiah, applied per component.
- The rates and amounts are snapshotted into the order (`service_rate_snapshot`, `tax_rate_snapshot`, `service_amount`, `tax_amount`, `total_amount`) so history never changes when a rate changes.
- The rates apply to every order, cash or non-cash, dine-in or take away.
- All monetary values are stored as integer rupiah (`bigint`), never floating point. Rates are stored as `numeric`.

## 7. Functional Requirements

### 7.1 Customer (QR Menu)

- Scan the table QR code to open a table session.
- View the menu by category with price and availability.
- Add items to the cart with quantity and note.
- Enter name (required) and phone (optional).
- Choose cash or non-cash payment.
- See order and item status in real time.
- Show an order QR that opens the dashboard order board filtered to that `order_number`, so the cashier needs no manual entry.
- Add another order in the same table session.
- See the screen notification for every status change (WhatsApp and push are phase 2).

### 7.2 Cashier (Dashboard)

- Log in.
- Create take away orders with multiple items.
- Review the cart with service charge, tax, and grand total.
- Process non-cash payment through Midtrans Snap.
- Confirm cash payment by scanning the order QR, opening the order, or entering the order number; enter the amount received and see the change; the endpoint is idempotent.
- Move take away items `READY → DELIVERED → COMPLETED`.
- Print the thermal receipt through the browser print dialog.
- View the active order list and the order detail.
- Search the order board by `order_number`; the QR Menu order QR resolves to the same board with the search applied, so no manual entry is needed.
- Cancel an unpaid order with a required reason.
- Read stock, and mark menu availability.

### 7.3 Kitchen (Dashboard, Two Tabs)

- Log in.
- Tab "Masak": list `PENDING` items, move `PENDING → COOKING → READY`, filter by status and time.
- Tab "Pass/Counter": list `READY` items, mark `READY → DELIVERED` when handing to waiter or cashier, override `DELIVERED → COMPLETED`.
- See the auto-deliver warning 2 minutes before the fallback fires.
- See items grouped by table or by order number.

### 7.4 Owner (Dashboard)

- View all orders in every status.
- Create take away orders from the dashboard (BR-24).
- Cancel an order only while it is `MENUNGGU` and unpaid; the cancel reason is required.
- Configure outlet settings: `service_rate`, `tax_rate`, `cash_timeout_minutes`, `ready_auto_deliver_minutes`, `ready_auto_deliver_warning_minutes`, `delivered_auto_complete_minutes`, `is_open`.
- Close the store: only when no order created today is still `DIPROSES`. Unpaid `MENUNGGU` orders for today are cancelled automatically in the same transaction.
- Manage users and roles (`OWNER`, `CASHIER`, `KITCHEN`), activate or deactivate users.
- Read the audit log.
- Confirm cash as a backup for the cashier.
- Manage menus, categories, tables, QR codes, ingredients, recipes, and stock.
- Close a table session manually.

### 7.5 System (Automatic)

- Create the order number atomically: `TA-YYYYMMDD-SSS` for take away, `DI-YYYYMMDD-SSS` for dine-in (`SSS` is the daily sequence, zero-padded), reset daily per type.
- Snapshot menu name, price, and rates into the order.
- Decrease ingredient stock when an order is created and write `OUT` movements.
- Restore ingredient stock when an order is cancelled and write `RESTORE` movements.
- Write `audit_log` for every status change.
- Push order and item changes to WebSocket subscribers.
- Auto-cancel a cash order unpaid after `cash_timeout_minutes`.
- Auto-cancel a non-cash order when Midtrans reports expiry.
- Auto-deliver items stuck at `READY` for `ready_auto_deliver_minutes`.
- Auto-complete items at `DELIVERED` for `delivered_auto_complete_minutes`.
- Recompute the order status whenever an item or the payment changes.
- Reject new orders with `409 STORE_CLOSED` while `settings.is_open` is false; existing orders stay readable and processable.
- Cancel every unpaid `MENUNGGU` order of the current outlet day (`status = DIBATALKAN`, items `CANCELLED`, stock restored, `RESTORE` movements, `audit_log`) when the store is closed.

### 7.6 Non-Functional

- Real time: order and item updates reach customer, kitchen, and dashboard in under 2 seconds through WebSocket, with polling every 3–5 seconds as the fallback.
- Idempotency: cash confirmation and the Midtrans callback are idempotent.
- Security: the table QR code carries a unique `qr_token`; the dashboard uses JWT with a refresh cookie; the customer session token is bound to one table session; credentials and tokens never appear in production responses or logs.
- Audit: every status change is written to `audit_log`.
- Availability: 99% during operating hours.
- Responsive: QR Menu is mobile-first; the dashboard and kitchen boards target tablet and desktop.
- Consistency: order creation, stock change, and cancellation run in one database transaction each.
- Money: integer rupiah (`bigint`); no floating point.
- Receipt: thermal 58 or 80 mm for take away, printed from the browser.

## 8. Business Rules

- BR-01: The cashier and the owner create take away orders only; neither can create a dine-in order.
- BR-02: The kitchen starts cooking only after payment is confirmed.
- BR-03: A cash order unpaid after `cash_timeout_minutes` (default 15) is cancelled automatically.
- BR-04: An order can be cancelled only while it is `MENUNGGU` and unpaid, by the owner, the cashier, or the system (cash timeout, Midtrans expiry). A manual cancel from the dashboard records a required reason.
- BR-05: Cancellation is order-level; every item becomes `CANCELLED` at the same time.
- BR-06: A paid order (`DIPROSES`) cannot be cancelled in v1; the owner handles it manually outside the system.
- BR-07: An order is `SELESAI` only when every item is `COMPLETED` or `CANCELLED`.
- BR-08: Adding an order in the same table session creates a new order row with a new order number.
- BR-09: The cashier moves take away items `READY → DELIVERED → COMPLETED` when handing over the order.
- BR-10: Service charge and tax are calculated server-side and snapshotted into the order.
- BR-11: Cash confirmation is idempotent; repeating it never double-pays or double-writes.
- BR-12: A rate change applies only to new orders.
- BR-13: A customer without login can access only orders inside their own table session, proven by the session token.
- BR-14: `DELIVERED → COMPLETED` happens automatically after `delivered_auto_complete_minutes`, or earlier by kitchen, cashier for take away, or owner.
- BR-15: Order numbers reset daily per `order_type` and are generated atomically; no number is reused within a day.
- BR-16: The Midtrans callback must verify the signature key and be idempotent per order.
- BR-17: `READY → DELIVERED` falls back automatically after `ready_auto_deliver_minutes`, with a warning `ready_auto_deliver_warning_minutes` earlier.
- BR-18: The waiter has no system access; the `READY → DELIVERED` transition belongs to the kitchen (`SOP-WAITER-01`).
- BR-19: `DELIVERED` means handed to the waiter or cashier, not served at the table.
- BR-20: There is no refund in v1; a refund after payment is phase 2 and handled manually outside the system.
- BR-21: Cancelling an order restores the stock of every item in the same transaction.
- BR-22: `customer_name` is required on every order; `customer_phone` is optional.
- BR-23: Recipes can be edited only while `settings.is_open` is false; store closure only blocks new orders.
- BR-24: The owner may create take away orders from the dashboard; the owner cannot create a dine-in order.
- BR-25: The store can be closed only while no order created on the current outlet day is `DIPROSES`. Unpaid `MENUNGGU` orders of that day are cancelled automatically as part of the close operation.
- BR-26: `PATCH /settings` rejects `is_open: false`; closing must go through the dedicated close operation so the active-order check always runs. Opening the store stays a plain settings update.

## 9. Access Matrix

| Action | Customer | `CASHIER` | `KITCHEN` | `OWNER` |
|---|---|---|---|---|
| Open table session | Yes | — | — | — |
| Create order (QR, dine-in) | Yes | No | No | No |
| Create order (take away) | No | Yes | No | Yes |
| Confirm cash payment | No | Yes | No | Yes |
| `PENDING → COOKING` | No | No | Yes | Yes |
| `COOKING → READY` | No | No | Yes | Yes |
| `READY → DELIVERED` (dine-in) | No | No | Yes | Yes |
| `READY → DELIVERED` (take away) | No | Yes | Yes | Yes |
| `DELIVERED → COMPLETED` | No | Yes (take away) | Yes (override) | Yes |
| Cancel order (only `MENUNGGU`) | No | Yes | No | Yes |
| Close table session | No | Yes | No | Yes |
| Configure service charge and tax | No | No | No | Yes |
| Print thermal receipt | No | Yes | No | Yes |
| Manage users and roles | No | No | No | Yes |
| Read audit log | No | No | No | Yes |

## 10. Data Model

### 10.1 PostgreSQL Enum Types

All constrained values use native PostgreSQL enums. Migrations create the types before the tables.

```sql
order_status: MENUNGGU, DIPROSES, SELESAI, DIBATALKAN
order_item_status: PENDING, COOKING, READY, DELIVERED, COMPLETED, CANCELLED
payment_status: BELUM, LUNAS
payment_method: CASH, NON_CASH
order_type: DINE_IN, TAKE_AWAY
user_role: OWNER, CASHIER, KITCHEN
stock_movement_type: IN, OUT, RESTORE, ADJUSTMENT
payment_gateway: MIDTRANS
payment_log_status: PENDING, SETTLED, EXPIRED, FAILED
table_session_status: OPEN, CLOSED
```

Go maps each enum to typed constants in `internal/domain`, never to unrestricted `string`.

### 10.2 `users`

- `id` UUID primary key
- `name` text
- `email` text unique
- `password_hash` text
- `role` user_role enum
- `is_active` boolean default `true`
- `created_at`, `updated_at` timestamptz

The login identity is `email`. There is no `username` column.

### 10.3 `sessions`

- `id` UUID primary key
- `user_id` FK → `users`
- `token_hash` text unique
- `expires_at` timestamptz
- `revoked_at` nullable timestamptz
- `created_at` timestamptz

### 10.4 `tables`

- `id` UUID primary key
- `table_number` text unique
- `qr_token` text unique
- `is_active` boolean default `true`
- `created_at`, `updated_at` timestamptz

The QR code contains only a public URL with `qr_token`. It contains no credentials.

### 10.5 `table_sessions`

- `id` UUID primary key
- `table_id` FK → `tables`
- `session_token` text unique
- `status` table_session_status enum
- `started_at` timestamptz
- `ended_at` nullable timestamptz
- `closed_by` nullable FK → `users`; null when closed automatically

Partial unique index: only one `OPEN` session per table.

Deliberate simplification: `session_token` is stored as plain text because it is a table-scoped capability equivalent to the printed `qr_token`, and hashing it would make a re-scan unable to reissue the same token (EC-14). Upgrade to a hashed token plus rotation when per-customer accounts arrive in phase 2.

### 10.6 `menu_categories`

- `id` UUID primary key
- `name` text
- `sort_order` integer default `0`
- `created_at`, `updated_at` timestamptz

### 10.7 `menus`

- `id` UUID primary key
- `category_id` FK → `menu_categories`
- `name` text
- `price` bigint `>= 0`
- `image_url` nullable text
- `is_available` boolean default `true`
- `created_at`, `updated_at` timestamptz

### 10.8 `ingredients`

- `id` UUID primary key
- `name` text
- `unit` text
- `stock_qty` numeric `>= 0`
- `min_stock` numeric `>= 0`
- `created_at`, `updated_at` timestamptz

### 10.9 `recipe_items`

- `id` UUID primary key
- `menu_id` FK → `menus`
- `ingredient_id` FK → `ingredients`
- `qty_used` numeric `> 0`
- unique: `menu_id`, `ingredient_id`

### 10.10 `stock_movements`

- `id` UUID primary key
- `ingredient_id` FK → `ingredients`
- `order_id` nullable FK → `orders`
- `order_item_id` nullable FK → `order_items`
- `qty` numeric; signed — positive for `IN` and `RESTORE`, negative for `OUT`
- `type` stock_movement_type enum
- `note` text
- `created_at` timestamptz

Append-only. A correction is a new `ADJUSTMENT` row, never an edit or delete.

### 10.11 `orders`

- `id` UUID primary key
- `order_number` text; `TA-###` or `DI-###`, unique per day and type (see `order_sequence`)
- `table_id` nullable FK → `tables`; null for take away
- `table_session_id` nullable FK → `table_sessions`; null for take away
- `created_by` nullable FK → `users`; null for QR customers
- `order_type` order_type enum: `DINE_IN`, `TAKE_AWAY`
- `customer_name` text not null
- `customer_phone` nullable text
- `status` order_status enum
- `subtotal_amount` bigint `>= 0`
- `service_rate_snapshot` numeric `>= 0`
- `service_amount` bigint `>= 0`
- `tax_rate_snapshot` numeric `>= 0`
- `tax_amount` bigint `>= 0`
- `total_amount` bigint `>= 0` — the grand total
- `payment_status` payment_status enum default `BELUM`
- `payment_method` nullable payment_method enum
- `payment_ref` nullable text; the Midtrans transaction reference
- `paid_at` nullable timestamptz
- `amount_received` nullable bigint; cash tendering
- `change_amount` nullable bigint; cash tendering
- `cancel_reason` nullable text
- `canceled_at` nullable timestamptz
- `created_at`, `updated_at` timestamptz

Order totals are snapshots. There is no `tracking_token_hash`; the customer is identified by the table session.

### 10.12 `order_items`

- `id` UUID primary key
- `order_id` FK → `orders`
- `menu_id` FK → `menus`
- `menu_name_snapshot` text; the menu name when the order was created
- `price` bigint `>= 0`; the price snapshot when the order was created
- `qty` integer `> 0`
- `note` nullable text
- `status` order_item_status enum
- `delivered_at` nullable timestamptz
- `completed_at` nullable timestamptz
- `cancelled_at` nullable timestamptz
- `updated_by` nullable FK → `users`; null when the scheduler moved the item

### 10.13 `order_sequence`

- `id` UUID primary key
- `order_type` order_type enum
- `date` date; the local business day
- `last_seq` integer `> 0`
- unique: `order_type`, `date`

No `outlet_id`: v1 is single outlet. The row is taken with an atomic update so two concurrent orders never share a number.

### 10.14 `payment_log`

- `id` UUID primary key
- `order_id` FK → `orders`
- `method` payment_method enum
- `gateway` nullable payment_gateway enum; null for cash
- `amount` bigint `>= 0`
- `status` payment_log_status enum
- `gateway_ref` nullable text unique; the Midtrans transaction id
- `gateway_status` nullable text; the raw gateway status
- `created_at` timestamptz

The webhook is idempotent on `gateway_ref`. Repeated callbacks update the existing row instead of writing a new one.

### 10.15 `audit_log`

- `id` UUID primary key
- `entity` text; for example `order` or `order_item`
- `entity_id` UUID
- `action` text; for example `status_changed`, `payment_confirmed`, `order_cancelled`
- `from_value` nullable text
- `to_value` nullable text
- `actor_id` nullable FK → `users`; null for the scheduler
- `actor_role` nullable user_role enum
- `created_at` timestamptz

Append-only.

### 10.16 `settings`

One row for the single outlet.

- `id` UUID primary key
- `cafe_name` text
- `service_rate` numeric default `5`, `>= 0`
- `tax_rate` numeric default `10`, `>= 0`
- `is_open` boolean default `true`
- `cash_timeout_minutes` integer default `15`
- `delivered_auto_complete_minutes` integer default `5`
- `ready_auto_deliver_minutes` integer default `10`
- `ready_auto_deliver_warning_minutes` integer default `2`
- `created_at`, `updated_at` timestamptz

## 11. API and Integration

All responses follow the envelope in `api-response.md`. Final endpoint details live in `api.md`. Every endpoint that writes an order, item, or payment runs in one transaction.

### 11.1 Auth

```text
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

The dashboard sends `Authorization: Bearer <access_token>`. The refresh token travels in an httpOnly cookie; the database stores only its hash.

### 11.2 Public — Customer

No login. `qr_token` appears only when opening a session.

```text
POST /public/tables/:qr_token/sessions     -> session_token (idempotent while the session is open)
GET  /public/menu                          -> cafe name, rates, is_open, categories and menus
POST /public/orders                        -> create an order in the session
GET  /public/orders                        -> every order in the session
GET  /public/orders/:id                    -> one order with its items
POST /public/orders/:id/cancel             -> cancel the whole order while MENUNGGU
```

Requests carrying a session send it in this header:

```text
X-Session-Token: <session_token>
```

A missing, unknown, or closed session token returns `401 UNAUTHORIZED`. The server always reads prices, service charge, tax, totals, and stock from the database; the client never decides them.

Rate limits, per instance and in memory:

| Endpoint | Limit | Key |
|---|---|---|
| `POST /public/tables/:qr_token/sessions` | 20/minute | `qr_token` |
| `GET /public/menu` | 60/minute | session token |
| `POST /public/orders` | 5/minute | session token |
| `GET /public/orders*` | 30/minute | session token |

### 11.3 Internal

Every endpoint below requires JWT and role middleware.

```text
GET   /orders                                  list orders; filter status, table_id, order_type, date
GET   /orders/:id                              order with items
POST  /orders/manual                           create a take away order (`CASHIER`, `OWNER`)
PATCH /orders/:id/payment                      confirm payment, idempotent (`CASHIER`, `OWNER`)
POST  /orders/:id/cancel                       cancel an unpaid order, `reason` required (`CASHIER`, `OWNER`)
PATCH /orders/:id/items/:item_id/status        move an item along the matrix (role depends on the target)
GET   /tables/:id/session                      read the open session of a table (`CASHIER`, `OWNER`)
POST  /tables/:id/session/close                close a table session manually (`CASHIER`, `OWNER`)
GET   /audit-log                               read the audit trail (`OWNER`)
GET   /reports/summary                         KPI summary, daily trend, top menus, category share (`OWNER`)
GET   /reports/transactions                    transaction history, filter order_type/payment_method (`OWNER`)
```

`PATCH /orders/:id/payment` accepts a cash or manual non-cash confirmation:

```json
{ "payment_method": "CASH", "amount_received": 50000, "change_amount": 17000 }
```

Only `BELUM → LUNAS` is a state change; repeating the call with the same body returns `200` and the same order without writing a second `payment_log`. `amount_received` and `change_amount` are stored only for `CASH` and returned as `null` otherwise, so a receipt can be reprinted with the same figures.

Menu, table, stock, user, and settings endpoints are documented in `api.md`.

### 11.4 WebSocket

One hub, one connection per client, authenticated per topic:

```text
GET /ws                          dashboard: Authorization: Bearer <access_token>
GET /ws?session=<session_token>   QR Menu: table session
```

Topics:

- `order:{id}` — dashboard subscribers receive every change to that order.
- `session:{session_token}` — the customer receives every change to orders inside the session.

Messages:

```json
{ "topic": "order:uuid", "event": "order.updated", "data": { "id": "uuid", "status": "DIPROSES" } }
```

Events: `order.created`, `order.updated`, `item.updated`, `session.closed`. The server is the only publisher; clients never write through the socket. If the socket drops, clients fall back to polling and resubscribe on reconnect.

### 11.5 Midtrans

```text
POST /public/payments/midtrans/callback
```

1. A non-cash order is created with `payment_method = NON_CASH` and `payment_status = BELUM`; the backend writes `payment_log` `PENDING` and returns the Snap token and redirect URL.
2. The customer pays in Snap.
3. Midtrans calls the callback. The backend verifies `signature_key`, then is idempotent on `gateway_ref` and `order_id`.
4. `settlement` sets `payment_status = LUNAS`, `paid_at`, `payment_ref`, `payment_log` `SETTLED`, and moves the order to `DIPROSES`.
5. `expire`, `deny`, and `cancel` cancel the order through the same path as the cash timeout: order `DIBATALKAN`, items `CANCELLED`, stock restored.
6. A callback that does not change state returns `200`.

Until Midtrans credentials are available, the cashier may confirm a non-cash payment manually through `PATCH /orders/:id/payment` with `payment_method = NON_CASH` and no `payment_ref`, and the report treats it as manual.

### 11.6 Error Codes

| Code | HTTP | When |
|---|---:|---|
| `VALIDATION_ERROR` | 400 | Invalid input or missing required field |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Role is not authorized |
| `NOT_FOUND` | 404 | Resource not found |
| `STOCK_NOT_ENOUGH` | 409 | Insufficient stock |
| `STORE_CLOSED` | 409 | Store is closed for new orders |
| `INVALID_TRANSITION` | 409 | Transition violates the state machine |
| `PAYMENT_REQUIRED` | 409 | Cooking requested before payment |
| `INTERNAL_ERROR` | 500 | Unexpected failure |

## 12. Scheduled Jobs

One scheduler loop runs every minute and is safe to run repeatedly.

- Cancel cash orders past `cash_timeout_minutes` with `payment_status = BELUM`.
- Move `READY` items to `DELIVERED` past `ready_auto_deliver_minutes`, after the warning window.
- Move `DELIVERED` items to `COMPLETED` past `delivered_auto_complete_minutes`.
- Recompute `orders.status` for the touched orders.
- Close table sessions that hold no active order.

## 13. Edge Cases

- EC-01: A cash order is not paid → cancelled automatically after 15 minutes.
- EC-02: The cashier confirms payment twice → idempotent, one `payment_log`.
- EC-03: The owner changes a rate → only new orders use it.
- EC-04: A table is reused → the old session is closed, the new QR scan opens a new session.
- EC-05: The payment gateway times out → the order stays `MENUNGGU`; the customer retries or the timer cancels it.
- EC-06: The customer adds an order → a new order in the same session.
- EC-07: A Midtrans expiry callback → the order is cancelled like a cash timeout.
- EC-08: An item hangs at `DELIVERED` → completed automatically after 5 minutes.
- EC-09: The kitchen forgets to mark completed → auto-complete handles it.
- EC-10: Two clients mark the same transition at once → the first write wins, the second is a no-op.
- EC-11: The receipt printer is offline → the order number is shown on screen and printing can be retried.
- EC-12: The kitchen forgets `READY → DELIVERED` → fallback after 10 minutes, warning 2 minutes earlier.
- EC-13: The kitchen completes an item early → the auto-complete job skips it.
- EC-14: The customer closes the browser after scanning → the session token stays valid, and scanning the table QR again returns the same token while the session is open.
- EC-15: The owner or the cashier cancels an unpaid order → every item is cancelled, the reason is recorded, and stock is restored.
- EC-16: The customer asks for a refund after payment → handled manually by the owner; not a v1 feature.
- EC-17: The customer asks to change a paid order → handled manually by the owner; the alternative is to finish it and order again.
- EC-18: Two orders are created at the same instant → the order number sequence is atomic, no duplicate number.
- EC-19: The WebSocket connection drops → clients poll until they reconnect; nothing is lost, the server never depends on the socket.
- EC-20: A customer scans while the order is already paid → the session still returns its orders; cancellation is rejected with `INVALID_TRANSITION`.

## 14. Infrastructure and Development

- One `docker-compose.yml` at the monorepo root; local runtime uses Podman and `podman-compose`.
- Services: PostgreSQL, backend, dashboard dev server, QR Menu dev server.
- Versioned SQL migrations live in `fnb-server/migrations/`; `make migrate` runs them through `psql` in the PostgreSQL container.
- The schema change from the per-item refund model is a breaking migration: `000001`/`000002` are rewritten instead of stacked, and the development database is reset. There is no production data to preserve.
- The owner seed reads `SEED_OWNER_EMAIL` and `SEED_OWNER_PASSWORD`; demo data comes from `make seed`.
- `.env` is never committed.

## 15. Testing

v1 minimum:

- Unit tests for the order status derivation from item statuses and payment.
- Unit tests for role authorization against the access matrix.
- Unit tests for service charge, tax, and grand total, including round half up.
- Unit tests for order number generation and daily reset.
- Unit tests for table session open, idempotent re-scan, and close rules.
- Unit tests for cancellation rules: only `MENUNGGU`, order-level, atomic stock restore.
- One integration test for order creation → stock decrease → cancellation → stock restore.
- One integration test for the idempotent payment confirmation and the Midtrans callback replay.

Non-trivial changes must add or update the relevant tests.

## 16. Success Metrics

- Order time from scan to payment: under 3 minutes.
- Cash auto-cancel rate: under 10%.
- Tax and service charge accuracy: 100%.
- Order status consistency across clients: zero mismatches.
- Self-service QR adoption: over 50% of dine-in orders.
- `READY → DELIVERED` time for dine-in: under 2 minutes.
- Auto-deliver fallback rate: under 5%, as a kitchen discipline indicator.

## 17. Roadmap

### MVP (v1)

- Backend: JWT auth, REST, WebSocket hub, Midtrans Snap and idempotent webhook, scheduler, audit log, payment log.
- Dashboard: RBAC login.
  - Cashier: take away order, cash confirmation, thermal receipt, take away hand-over.
  - Kitchen: "Masak" and "Pass/Counter" tabs, auto-deliver warning, complete override.
  - Owner: settings, users and roles, audit log, cancel unpaid order, manual table session close.
- QR Menu: session scan, order, cash and non-cash payment, real-time status, add order.
- Order and item state machine, including `DELIVERED` and `COMPLETED` with automatic fallbacks.
- Service charge and tax.
- Automatic cancel for cash timeout and Midtrans expiry.
- Automatic deliver fallback and automatic complete.
- Order numbers `TA-###` and `DI-###`, reset daily.
- Thermal receipt for take away, printed from the browser.
- Table session token without login.
- Stock, recipes, and stock movements, including restock and opname.
- `SOP-WAITER-01` reference (separate document).

### Phase 2

- Reports: sales summary, daily and weekly charts, transaction history, CSV export. Contract: `api.md` § Internal — reports.
- WhatsApp and push notification to the customer (`customer_phone`).
- Digital receipt.
- Separate manager role.
- Refund after payment through the Midtrans refund API.
- Item-level cancellation, if operations require it.
- Hashed customer session token with rotation.

### Phase 3

- Multiple payment gateways.
- Loyalty and promo.
- Multi-outlet.

## 18. Resolved Questions

| No | Question | Decision |
|---|---|---|
| 1 | Separate waiter? | No. The waiter has no application and follows `SOP-WAITER-01`. The kitchen owns `READY → DELIVERED`. |
| 2 | Payment gateway? | Midtrans Snap, with an idempotent webhook. The integration is specified in v1 and implemented when credentials exist; manual non-cash confirmation bridges the gap. |
| 3 | Order number format? | `TA-YYYYMMDD-SSS` for take away, `DI-YYYYMMDD-SSS` for dine-in (`SSS` is the zero-padded daily sequence per type). |
| 4 | Digital receipt in v1? | No, phase 2. The physical thermal receipt for take away is v1, printed from the browser. |
| 5 | Customer login? | No. Scan the table QR, then name (required) and phone (optional). |
| 6 | Meaning of `DELIVERED`? | Handed to the waiter or cashier, not served at the table. |
| 7 | Auto-complete? | After 5 minutes, with kitchen, cashier (take away), and owner override. |
| 8 | Auto-deliver fallback? | After 10 minutes, with a warning 2 minutes earlier. |
| 9 | Owner and manager roles? | v1 has `OWNER` only; manager is phase 2. |
| 10 | Kitchen tabs? | Two tabs, "Masak" and "Pass/Counter". |
| 11 | Waiter SOP? | Separate document, `SOP-WAITER-01`. |
| 12 | Refund in v1? | No. Refund after payment is phase 2 and handled manually outside the system. |
| 13 | When can an order be cancelled? | Only while `MENUNGGU` and unpaid. Order-level only. |
| 14 | Item-level cancellation? | No in v1. |
| 15 | Cancel a paid order? | No in v1; the owner handles it manually. |
| 16 | Real-time transport? | WebSocket in v1, with polling as the fallback. |
| 17 | Customer identity? | The table session token only; there is no per-order tracking token. |
| 18 | Outlet model? | Single outlet; `settings` keeps one row and holds every rate and timer. No `outlet` table in v1. |
| 19 | Order type values? | `DINE_IN` and `TAKE_AWAY`, replacing `QR` and `MANUAL`. |
| 20 | Login identity? | `email`; no `username` column. |
| 21 | Table session end? | Automatic when it holds no active order, plus a manual close by cashier or owner. |
| 22 | Stock module? | Stays in v1, including decrease on order and restore on cancellation. |
| 23 | Audit log? | In v1, append-only. |
| 24 | `payment_status`? | Kept as `BELUM`/`LUNAS` alongside the derived order status. |
| 25 | Service charge formula? | Service from the subtotal, tax from subtotal plus service, round half up, snapshotted. |
| 26 | Thermal receipt implementation? | Browser print with a print CSS area; no backend printer service. |
| 27 | Analytics? | Phase 2; a dashboard mock already exists. |
| 28 | Event store for status history? | `audit_log` in v1, plus `delivered_at`/`completed_at`/`cancelled_at` on the item. |

## 19. References

- Application flow diagrams: `flow.md`.
- API contract: `api.md`.
- API response envelope: `api-response.md`.
- Documentation language: `doc-language.md`.
- Documentation naming: `doc-naming.md`.
- Archived previous draft: `prd-v1.1.md`.
- Waiter procedure: `SOP-WAITER-01` (separate document).
