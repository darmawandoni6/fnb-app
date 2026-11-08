# PRD — FNB App

## 1. Overview

FNB App is a digital ordering system for cafes and restaurants. It connects customers, cashiers, kitchen staff, and owners through one backend and one PostgreSQL database.

Main problems:

- Manual orders are easy to lose or record incorrectly.
- Cashiers lack one consistent order list.
- The kitchen lacks a clear production queue.
- Owners have difficulty monitoring sales and stock.

First win:

> A customer scans a table QR code, submits an order, and the order appears on the cashier and kitchen dashboards.

## 2. Applications

The monorepo contains three separate applications:

```text
fnb-app/
├── fnb-server/     # Go backend
├── fnb-dashboard/  # Internal frontend: owner, cashier, kitchen
└── fnb-qr-menu/    # Public frontend: customers
```

### 2.1 Backend — `fnb-server`

- Go
- Echo HTTP API
- GORM PostgreSQL
- JWT access token
- Refresh tokens are stored as hashes in the database and sent through an httpOnly cookie
- Polling for order updates in the MVP
- Versioned SQL migrations

PostgREST is not used. All data access goes through the Go API so authentication, authorization, transactions, and business rules remain centralized.

### 2.2 Dashboard — `fnb-dashboard`

Vite SPA + TypeScript for internal users:

- Owner: all features.
- Cashier: order, payments, delivery status, stock according to permissions.
- Kitchen: production queue and production status.

One frontend build with routes and menus based on role.

### 2.3 QR Menu — `fnb-qr-menu`

Vite SPA + TypeScript, lightweight for mobile browsers:

- Open the menu through a table QR token.
- Select menu items and quantities.
- Add item notes.
- Submit orders without login.
- Track orders using an order token stored in `localStorage`.

## 3. Roles and Access

| Role      | Main access                                                                                |
| --------- | ------------------------------------------------------------------------------------------ |
| `OWNER`   | All features, staff accounts, menus, tables/QR, stock, reports, settings, and all order transitions       |
| `CASHIER` | QR/manual orders, payments, status `SIAP` → `DIANTAR` → `SELESAI`, cancellations, and stock viewing |
| `KITCHEN` | Melihat production queue, `MENUNGGU` → `DIPROSES` → `SIAP`                                 |

The first owner is created through an environment seed:

```text
SEED_OWNER_EMAIL
SEED_OWNER_PASSWORD
```

The seed creates an owner only if the `users` table has no users. Public registration is unavailable.

## 4. Requirements

### 4.1 Functional

- Customers open the menu by scanning a table QR code without installing an app.
- Customers select menu items, quantities, and notes, then submit an order.
- The dashboard polls for orders and status changes.
- Cashiers create manual orders for walk-in customers.
- The kitchen processes the order queue.
- Cashiers record cash or non-cash payments.
- Owners manage menus, categories, tables, QR codes, recipes, stock, accounts, and settings.
- Ingredient stock decreases automatically when an order is created.
- Stock is restored automatically when an order is cancelled.
- The system stores stock movement history.
- Order totals are calculated server-side.
- Tax is read from settings and copied to the order so history does not change.

### 4.2 Non-functional

- One modular backend and one PostgreSQL database.
- Two frontends with separate builds and deployments.
- QR Menu is lightweight and mobile-first.
- Order and stock changes are consistent within database transactions.
- Internal endpoints are protected by JWT and role authorization.
- Credentials and tokens are never exposed in production responses or logs.
- Money is stored as integer rupiah, not floating point.

## 5. Order and Item Status

Production and delivery status are stored in `order_items`, because each item can finish at a different time.

```text
PENDING → COOKING → READY → DELIVERED
    └────────────────────→ CANCELLED
```

Item status can only move forward. The kitchen changes `COOKING` and `READY`; the cashier changes `DELIVERED`. All actors can cancel an item only while it is `PENDING`.

Order status is the aggregate production and delivery status:

```text
MENUNGGU → DIPROSES → SIAP → DIANTAR → SELESAI
     └──────────────→ DIBATALKAN
```

### 5.1 Order Status Aggregation

| Item condition | Order status |
|---|---|
| All items `PENDING` | `MENUNGGU` |
| At least one item `COOKING` and not all `READY` | `DIPROSES` |
| All active items `READY` | `SIAP` |
| At least one item `DELIVERED` and not all active items are delivered | `DIANTAR` |
| All items are complete and payment is `LUNAS` | `SELESAI` |
| All items are cancelled | `DIBATALKAN` |

Statuses `MENUNGGU`, `DIPROSES`, `SIAP`, `DIANTAR`, and `SELESAI` are calculated automatically from item statuses and payment.

### 5.2 Item Status Transitions

| Dari | Ke | Actor |
|---|---|---|
| `PENDING` | `COOKING` | `KITCHEN`, `OWNER` |
| `COOKING` | `READY` | `KITCHEN`, `OWNER` |
| `READY` | `DELIVERED` | `CASHIER`, `OWNER` |
| `PENDING` | cancel | The customer who owns the order, `CASHIER`, `OWNER` |

Cancelled items are excluded from active item calculations. If all items are cancelled, the order automatically becomes `DIBATALKAN`.

### 5.3 Delivery and Payment Transitions

| Dari | Ke | Actor |
|---|---|---|
| first item `DELIVERED` | `DIANTAR` | `CASHIER`, `OWNER` |
| all active items `DELIVERED` | `SELESAI` | `CASHIER`, `OWNER`, with payment `LUNAS` |
| before `SELESAI` | cancel item | any actor, only while item is `PENDING` |
| all valid transitions | as needed | `OWNER` |

Payment remains at order level. New orders start as `BELUM`. Cashier/owner marks an order `LUNAS` before the kitchen may start `COOKING`. `payment_status` and `order.status` are separate fields, but the order must be `LUNAS` before `SELESAI`. Cancelling an item restores that item's stock atomically. Completed orders or items cannot be cancelled.

## 6. Main Flows

### 6.1 QR Customer

1. The owner creates a table and QR token.
2. The customer scans the QR code.
3. QR Menu requests the menu using the table token.
4. The customer selects menu items and submits the order.
5. The backend validates the table, menu, prices, recipes, and stock in a transaction.
6. The backend creates order `MENUNGGU`, creates all items with status `PENDING`, stores `tracking_token`, calculates tax, and decreases stock.
7. QR Menu stores the order token in `localStorage`.
8. The dashboard retrieves orders through polling.
9. The cashier marks the order `LUNAS`.
10. The kitchen changes each item status from `PENDING` → `COOKING` → `READY`.
11. The backend calculates the order production status from item statuses.
12. The cashier delivers ready items and marks them `DELIVERED`.
13. The order becomes `SELESAI` after all active items are `DELIVERED` and payment is `LUNAS`.
14. QR Menu polls order and item statuses using `tracking_token`.

### 6.2 Manual Orders

1. The cashier selects menus and quantities from the dashboard.
2. The backend creates an order with `order_type=MANUAL` without `table_id`.
3. Stock, payment, and status processing are the same as for QR orders.

### 6.3 Cancellation

- Customers, cashiers, and owners may cancel an item only while it is still `PENDING`.
- Cancelled items are excluded from aggregate production status.
- If all items are cancelled, the order automatically becomes `DIBATALKAN`.
- The backend restores ingredients based on the cancelled item and its `recipe_items`.
- Stock restoration and item status changes occur in one transaction.

## 7. Product Phases

### Phase 1 — End-to-End Ordering

- Owner/cashier/kitchen authentication.
- Table QR and public menu.
- Cart and order submission.
- Manual cashier orders.
- Cashier and kitchen order boards.
- Status transitions according to the matrix.
- Cash/non-cash payments.
- Polling order and item statuses.
- Kitchen and delivery item status: `PENDING` → `COOKING` → `READY` → `DELIVERED`.
- Per-item delivery and aggregate order status.
- Ingredients, recipes, stock decrease, per-item stock restoration, and stock movements.
- Settings `cafe_name` and `tax_percent`.

### Phase 2 — Operations Administration

- Menu and category CRUD.
- Upload menu photos locally through the backend and static files.
- Table CRUD and QR generation.
- Restock ingredients.
- Mark menus unavailable.
- Low-stock warnings.
- Manage staff accounts and deactivate users.

### Phase 3 — Insights

- Sales overview.
- Daily/weekly charts.
- Transaction history.
- Download reports.

### Phase 4 — Additional Settings

- Cafe logo and address.
- Operating hours.
- Service fees.
- Receipt format.

## 8. Settings and Calculations

M1 has one settings record:

- `cafe_name`
- `tax_percent`, default `0`
- `is_open`, default `true`; when `false`, new orders are rejected with `STORE_CLOSED`. Existing orders can still be read and cancelled.

Recipes are finalized before the store opens. Recipe edits are only allowed while `is_open = false`; this rule is enforced when recipe management lands in Phase 2.

Server-side calculation:

```text
subtotal = Σ(order_item.price × order_item.qty)
tax_amount = subtotal × settings.tax_percent / 100
total_amount = subtotal + tax_amount
```

The effective `tax_percent` and `tax_amount` are copied to the order when it is created.

All monetary values are stored as integer rupiah (`bigint`). Rounding follows the integer rules defined by the backend.

## 9. M1 Database Schema

### PostgreSQL enum types

All following constrained values use native PostgreSQL enums. Migrations must create the types before the tables:

```sql
order_status: MENUNGGU, DIPROSES, SIAP, DIANTAR, SELESAI, DIBATALKAN
order_item_status: PENDING, COOKING, READY, DELIVERED, CANCELLED
payment_status: BELUM, LUNAS
payment_method: CASH, NON_CASH
order_type: QR, MANUAL
user_role: OWNER, CASHIER, KITCHEN
stock_movement_type: IN, OUT, RESTORE, ADJUSTMENT
```

Go maps each enum to typed string constants in `internal/domain`, rather than unrestricted `string` values.

### `users`

- `id` UUID primary key
- `name` text
- `email` text unique
- `password_hash` text
- `role` user_role enum: `OWNER`, `CASHIER`, `KITCHEN`
- `is_active` boolean
- `created_at`, `updated_at` timestamps

### `sessions`

- `id` UUID primary key
- `user_id` FK → `users`
- `token_hash` text unique
- `expires_at` timestamp
- `revoked_at` nullable timestamp
- `created_at` timestamp

### `tables`

- `id` UUID primary key
- `table_number` text unique
- `qr_token` text unique
- `is_active` boolean
- `created_at`, `updated_at` timestamps

The QR code contains only a public URL with `qr_token`. It does not contain credentials.

### `menu_categories`

- `id` UUID primary key
- `name` text
- `sort_order` integer
- `created_at`, `updated_at` timestamps

### `menus`

- `id` UUID primary key
- `category_id` FK → `menu_categories`
- `name` text
- `price` bigint
- `image_url` nullable text
- `is_available` boolean
- `created_at`, `updated_at` timestamps

### `ingredients`

- `id` UUID primary key
- `name` text
- `unit` text
- `stock_qty` numeric
- `min_stock` numeric
- `created_at`, `updated_at` timestamps

### `recipe_items`

- `id` UUID primary key
- `menu_id` FK → `menus`
- `ingredient_id` FK → `ingredients`
- `qty_used` numeric
- unique: `menu_id`, `ingredient_id`

### `stock_movements`

- `id` UUID primary key
- `ingredient_id` FK → `ingredients`
- `order_id` nullable FK → `orders`
- `order_item_id` nullable FK → `order_items`
- `qty` numeric; positive for incoming, negative for outgoing
- `type` stock_movement_type enum: `IN`, `OUT`, `RESTORE`, `ADJUSTMENT`
- `note` text
- `created_at` timestamp

### `orders`

- `id` UUID primary key
- `table_id` nullable FK → `tables`
- `created_by` nullable FK → `users`; null for QR customers
- `order_type` order_type enum: `QR`, `MANUAL`
- `tracking_token_hash` nullable text unique
- `status` order_status enum: `MENUNGGU`, `DIPROSES`, `SIAP`, `DIANTAR`, `SELESAI`, `DIBATALKAN`
- `subtotal_amount` bigint
- `tax_percent` numeric
- `tax_amount` bigint
- `total_amount` bigint
- `payment_status` payment_status enum: `BELUM`, `LUNAS`
- `payment_method` nullable payment_method enum: `CASH`, `NON_CASH`
- `created_at`, `updated_at` timestamps

Tracking token asli only sent sekali to QR Menu. Database stores hash token.

### `order_items`

- `id` UUID primary key
- `order_id` FK → `orders`
- `menu_id` FK → `menus`
- `qty` integer
- `note` nullable text
- `price` bigint; price snapshot when the order was created
- `status` order_item_status enum: `PENDING`, `COOKING`, `READY`, `DELIVERED`, `CANCELLED`
- `cancelled_at` nullable timestamp

### `refunds`

- `id` UUID primary key
- `order_id` FK → `orders`
- `actor_id` nullable FK → `users`; `NULL` when the refund was initiated by a public customer through the tracking token
- `reason` text; fixed `customer cancelled item` for public cancellations
- `subtotal_amount` bigint
- `tax_amount` bigint
- `total_amount` bigint
- `payment_method` payment_method enum: `CASH`, `NON_CASH`; copies the order's method, falling back to `CASH` when the order has none recorded
- `created_at` timestamp

### `refund_items`

- `id` UUID primary key
- `refund_id` FK → `refunds`
- `order_item_id` FK → `order_items`
- `qty` integer
- `subtotal_amount` bigint
- `tax_amount` bigint
- `total_amount` bigint

### `settings`

- `id` UUID primary key
- `cafe_name` text
- `tax_percent` numeric default `0`
- `is_open` boolean default `true`
- `created_at`, `updated_at` timestamps

## 10. API and Integration

Item refunds after payment are recorded through an internal endpoint. Cancelling an item before `LUNAS` does not produce a refund. For an item after `LUNAS`, the backend calculates a proportional refund:

```text
item_subtotal = item.price × item.qty
item_tax = round(item_subtotal × order.tax_percent / 100)
refund_amount = item_subtotal + item_tax
```

The refund amount decreases `subtotal_amount`, `tax_amount`, and `total_amount` atomically. The order remains `LUNAS`; additional orders are created as new orders.

Order totals are snapshots. Cancelling an item while the order is still `BELUM` does not change `subtotal_amount`, `tax_amount`, or `total_amount`, because no money has been collected; only `LUNAS` cancellations decrease the totals and create a refund. When every item is cancelled, the totals are set to `0` and the status becomes `DIBATALKAN`.

Public cancellation uses the tracking token as proof of ownership: the refund row stores `actor_id = NULL` and a fixed reason. Per-item rounding can leave a residual of 1–2 rupiah on `tax_amount`; that residual is accepted in M1.

Minimum public customer API:

```text
GET  /public/tables/:qr_token/menu
POST /public/tables/:qr_token/orders
GET  /public/orders/:tracking_token
POST /public/orders/:tracking_token/cancel
```

Auth API:

```text
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

Internal API protected by JWT and role middleware:

```text
GET/PATCH /orders
POST       /orders/manual
PATCH      /orders/:id/items/:item_id/status
POST       /orders/:id/items/:item_id/cancel
POST       /orders/:id/items/:item_id/refund
PATCH      /orders/:id/payment
GET/POST   /menus
GET/POST   /tables
GET/POST   /ingredients
GET/POST   /recipe-items
GET/PATCH  /settings
```

The API uses the standard response envelope in `docs/api-response.md`. Final endpoint details are documented in `docs/api.md` before handler implementation.

## 11. Infrastructure and Development

- The monorepo root has one `docker-compose.yml`.
- Main services: PostgreSQL, backend, dashboard dev server, QR Menu dev server.
- PostgREST is not used.
- Local runtime uses Podman and `podman-compose`.
- Versioned SQL migrations are located in `migrations/`.
- `make migrate` runs migrations through `psql` in the PostgreSQL container.
- The owner seed reads `SEED_OWNER_EMAIL` and `SEED_OWNER_PASSWORD` from the environment.
- `.env` must not be committed.

## 12. Testing

M1 minimum:

- Unit tests for status transitions and role authorization.
- Unit tests for subtotal, tax, and total calculations.
- Unit tests for tracking tokens and cancellation rules.
- One integration test for order + stock decrease + restore on cancellation.

Non-trivial changes must add or update relevant tests.
