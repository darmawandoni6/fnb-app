# M1 API Draft

This document is the source of truth before generating the Bruno request collection. Business rules live in `PRD.md`.

Local base URL:

```text
http://localhost:8081
```

All responses follow the envelope in `api-response.md`.

## Auth

| Method | Path | Role | Body |
|---|---|---|---|
| `POST` | `/auth/login` | Public | `{email, password}` |
| `POST` | `/auth/refresh` | Public + refresh cookie | - |
| `POST` | `/auth/logout` | Authenticated | - |

The access token uses this header:

```text
Authorization: Bearer <access_token>
```

The refresh token uses an httpOnly cookie. The database stores only the token hash in `sessions`. The login identity is `email`; there is no `username`.

## Public — customer

No login. The customer is identified by a table session token.

| Method | Path | Description |
|---|---|---|
| `POST` | `/public/tables/:qr_token/sessions` | Open a table session and return `session_token` |
| `GET` | `/public/menu` | Cafe name, rates, `is_open`, categories and menus |
| `POST` | `/public/orders` | Create an order in the session |
| `GET` | `/public/orders` | Every order in the session |
| `GET` | `/public/orders/:id` | One order with its items |
| `POST` | `/public/orders/:id/cancel` | Cancel the whole order while `MENUNGGU` |

Every endpoint except `POST .../sessions` requires:

```text
X-Session-Token: <session_token>
```

A missing, unknown, or closed session token returns `401 UNAUTHORIZED`. The client never decides prices, service charge, tax, totals, or stock.

Rate limits (per instance, in-memory):

| Endpoint | Limit | Key |
|---|---|---|
| `POST /public/tables/:qr_token/sessions` | 20/minute | `qr_token` |
| `GET /public/menu` | 60/minute | session token |
| `POST /public/orders` | 5/minute | session token |
| `GET /public/orders` | 30/minute | session token |

### Open table session

```json
{
  "session_token": "uuid",
  "table_number": "A1",
  "status": "OPEN"
}
```

Idempotent while the session is open: scanning the same table QR again returns the same token (EC-14). An inactive table returns `404 NOT_FOUND`. A table with no open session creates one.

### Menu response

```json
{
  "cafe_name": "Demo Cafe",
  "service_rate": 5,
  "tax_rate": 10,
  "is_open": true,
  "categories": [
    {
      "id": "uuid",
      "name": "Coffee",
      "menus": [{ "id": "uuid", "name": "Latte", "price": 25000, "image_url": null }]
    }
  ]
}
```

Categories with no available menu are omitted. When `is_open` is `false`, the client disables ordering and `POST /public/orders` returns `409 STORE_CLOSED`.

### Create order

```json
{
  "order_type": "DINE_IN",
  "customer_name": "Budi",
  "customer_phone": null,
  "payment_method": "CASH",
  "items": [
    { "menu_id": "uuid", "qty": 2, "note": "no sugar" }
  ]
}
```

- `customer_name` is required for every order; an empty value returns `400 VALIDATION_ERROR`.
- `customer_phone` is optional.
- `order_type` is `DINE_IN` for this endpoint; `table_id` and `table_session_id` come from the session.
- `payment_method` is `CASH` or `NON_CASH`. For `NON_CASH` the response also carries `payment_url` and `snap_token`.
- The server validates menu availability, recipes, and stock, then writes order, items, order number, snapshots, and `OUT` stock movements in one transaction.

Response:

```json
{
  "id": "uuid",
  "order_number": "DI-001",
  "status": "MENUNGGU",
  "payment_status": "BELUM",
  "subtotal_amount": 50000,
  "service_amount": 2500,
  "tax_amount": 5250,
  "total_amount": 57750,
  "payment_url": null,
  "items": [{ "id": "uuid", "menu_id": "uuid", "status": "PENDING" }]
}
```

### Order status

```json
{
  "id": "uuid",
  "order_number": "DI-001",
  "status": "DIPROSES",
  "payment_status": "LUNAS",
  "order_type": "DINE_IN",
  "customer_name": "Budi",
  "subtotal_amount": 50000,
  "service_amount": 2500,
  "tax_amount": 5250,
  "total_amount": 57750,
  "created_at": "2026-11-20T10:00:00Z",
  "items": [
    { "id": "uuid", "menu_id": "uuid", "menu_name_snapshot": "Latte", "qty": 2, "price": 25000, "status": "COOKING", "note": null }
  ]
}
```

`GET /public/orders` returns only orders belonging to the caller's session, newest first.

### Cancel order

`POST /public/orders/:id/cancel` cancels the whole order.

```json
{ "reason": "changed my mind" }
```

Rules:

- Allowed only while `status = MENUNGGU` and `payment_status = BELUM`. Otherwise `409 INVALID_TRANSITION`.
- Every item moves to `CANCELLED`; stock for every item is restored; `RESTORE` movements are written.
- No refund is created; no money has been collected.
- Order becomes `DIBATALKAN` and `cancel_reason`/`canceled_at` are filled.
- Cancellation is allowed while the store is closed.

## Internal — orders

All endpoints below use JWT and role middleware.

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/orders` | All roles | Filter by `status`, `table_id`, `order_type`, `date` |
| `GET` | `/orders/:id` | All roles | Order and item details |
| `POST` | `/orders/manual` | `CASHIER` | Create a take away order |
| `PATCH` | `/orders/:id/payment` | `CASHIER`, `OWNER` | Confirm payment, idempotent |
| `POST` | `/orders/:id/cancel` | `OWNER` | Cancel an unpaid order |

`orders.status` is a stored aggregate recomputed on every item and payment change (PRD §5.3). There is no endpoint that sets it directly. `GET /orders` returns at most 200 rows, newest first; `date` is a UTC day (`YYYY-MM-DD`).

The kitchen sees only `LUNAS` orders; reading an unpaid order by id returns `404 NOT_FOUND` to the kitchen.

Create manual order:

```json
{
  "customer_name": "Budi",
  "customer_phone": null,
  "payment_method": "CASH",
  "items": [
    { "menu_id": "uuid", "qty": 1, "note": null }
  ]
}
```

Manual orders have `order_type = TAKE_AWAY`, `created_by` from the JWT, and `table_id = NULL`. `customer_name` is required. When `settings.is_open` is `false`, creation returns `409 STORE_CLOSED`, the same as QR orders.

Payment:

```json
{ "payment_method": "CASH", "amount_received": 100000, "change_amount": 42250 }
```

- `payment_method` is required and is `CASH` or `NON_CASH`.
- Only `BELUM → LUNAS` is a state change. Repeating the call returns `200` and the same order; no second `payment_log` is written (BR-11).
- `amount_received` and `change_amount` are stored only for `CASH` and returned as `null` otherwise, so a receipt prints the same figures.
- A manual `NON_CASH` confirmation has no `payment_ref`; reports treat it as manual until Midtrans is live.
- The response returns the full order with its items so the dashboard reads the new `status` without a second call.

Cancel order:

```json
{ "reason": "customer left" }
```

`OWNER` only. Same rules as the public cancel endpoint.

## Internal — kitchen items

| Method | Path | Role | Body |
|---|---|---|---|
| `PATCH` | `/orders/:id/items/:item_id/status` | `KITCHEN`, `OWNER` for `COOKING`/`READY`; `KITCHEN`, `CASHIER`, `OWNER` for `DELIVERED`; `KITCHEN`, `CASHIER`, `OWNER` for `COMPLETED` | `{ "status": "COOKING" }` |

Transitions are forward only:

```text
PENDING → COOKING → READY → DELIVERED → COMPLETED
```

- `COOKING` is rejected with `409 PAYMENT_REQUIRED` while the order is `BELUM`.
- `CASHIER` may only move items whose order is `TAKE_AWAY` to `DELIVERED` and `COMPLETED`.
- `COMPLETED` is also reached automatically after `delivered_auto_complete_minutes`; a manual call earlier is an override (EC-13).
- `READY → DELIVERED` is also reached automatically after `ready_auto_deliver_minutes`, after the warning window.
- Two clients racing the same transition: the first write wins, the second is a no-op (EC-10).

Item status and payment responses return the full order with its items.

## Internal — tables and table sessions

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/tables` | `OWNER` | List tables, sorted by `table_number` |
| `POST` | `/tables` | `OWNER` | Create table and `qr_token` |
| `PATCH` | `/tables/:id` | `OWNER` | Update table; `table_number` stays unique |
| `DELETE` | `/tables/:id` | `OWNER` | Deactivate table |
| `GET` | `/tables/:id/session` | `CASHIER`, `OWNER` | Read the open session of a table |
| `POST` | `/tables/:id/session/close` | `CASHIER`, `OWNER` | Close the open session manually |

Closing a session does not touch its orders; they keep `table_session_id`. A closed session cannot be reopened.

Table QR content:

```text
<QR_MENU_BASE_URL>/?meja=<qr_token>
```

`QR_MENU_BASE_URL` is configured through the dashboard env `VITE_QR_MENU_URL`; the dashboard has no default and disables the "open QR Menu" action while it is empty.

`qr_token` is generated by `POST /tables` and does not rotate in M1 — reprinting or re-rendering produces the same QR. Deactivating a table (`DELETE /tables/:id`) is the way to reject its QR scans without changing the token.

## Internal — menus

Role: `OWNER`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/menu-categories` | List categories |
| `POST` | `/menu-categories` | Create category |
| `PATCH` | `/menu-categories/:id` | Update category |
| `DELETE` | `/menu-categories/:id` | Delete category |
| `GET` | `/menus` | List menus |
| `POST` | `/menus` | Create menu; use multipart photo upload when needed |
| `PATCH` | `/menus/:id` | Update menu |
| `DELETE` | `/menus/:id` | Delete/deactivate menu |

Exception: `PATCH /menus/:id` is also allowed for `CASHIER`, but only the `is_available` field. Sending `name`, `price`, `image_url`, or `category_id` as a cashier returns `403 FORBIDDEN`.

## Internal — stock

`GET` can be used by `CASHIER` and `OWNER`. Only `OWNER` may change stock.

| Method | Path | Description |
|---|---|---|
| `GET` | `/ingredients` | List ingredients with `stock_qty` and `min_stock` |
| `POST` | `/ingredients` | Create ingredient; writes movement `ADJUSTMENT` when `stock_qty > 0` |
| `PATCH` | `/ingredients/:id` | Update ingredient, including `min_stock` |
| `POST` | `/ingredients/:id/restock` | Add stock and movement `IN` (body `{ qty, note? }`) |
| `POST` | `/ingredients/:id/adjust` | Stock opname: body `{ stock_qty, note? }`, replaces stock, writes `ADJUSTMENT` with the signed delta |
| `GET` | `/recipe-items` | List recipes (`menu_id`, `ingredient_id`, `qty_used`) |
| `POST` | `/recipe-items` | Add ingredient to recipe |
| `PATCH` | `/recipe-items/:id` | Update recipe quantity |
| `DELETE` | `/recipe-items/:id` | Delete recipe item |
| `GET` | `/stock-movements` | List stock movements; query `ingredient_id`, `type`, `from`, `to` (ISO date) |

`stock_movements.qty` is signed: positive for `IN` and `RESTORE`, negative for `OUT`. `ADJUSTMENT` stores the signed delta and is never zero. `order_id`/`order_item_id` are filled for `OUT` and `RESTORE`.

`POST`, `PATCH`, and `DELETE` on `/recipe-items` are rejected with `STORE_CLOSED` while `settings.is_open` is true (BR-23). Reading recipes stays allowed. Restock, opname, and ingredient CRUD are not gated by `is_open`.

## Internal — users, settings, audit

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/users` | `OWNER` | List users |
| `POST` | `/users` | `OWNER` | Create `CASHIER` or `KITCHEN` user |
| `PATCH` | `/users/:id` | `OWNER` | Update or activate/deactivate user |
| `GET` | `/settings` | `OWNER` | Read every outlet setting |
| `PATCH` | `/settings` | `OWNER` | Update outlet settings |
| `GET` | `/audit-log` | `OWNER` | Read the audit trail; query `entity`, `entity_id`, `actor_id`, `from`, `to` |

Settings fields:

```json
{
  "cafe_name": "Demo Cafe",
  "service_rate": 5,
  "tax_rate": 10,
  "is_open": true,
  "cash_timeout_minutes": 15,
  "delivered_auto_complete_minutes": 5,
  "ready_auto_deliver_minutes": 10,
  "ready_auto_deliver_warning_minutes": 2
}
```

Every rate and timer is configurable. Changing a rate affects only new orders (BR-12).

## WebSocket

```text
GET /ws                          Authorization: Bearer <access_token>
GET /ws?session=<session_token>  QR Menu table session
```

Topics:

- `order:{id}` — dashboard subscribers.
- `session:{session_token}` — customer subscribers.

Message:

```json
{ "topic": "order:uuid", "event": "order.updated", "data": { "id": "uuid", "status": "DIPROSES" } }
```

Events: `order.created`, `order.updated`, `item.updated`, `session.closed`. The server is the only publisher. If the socket drops, clients poll and resubscribe on reconnect (EC-19).

## Midtrans callback

```text
POST /public/payments/midtrans/callback
```

Verifies `signature_key`, then is idempotent on `gateway_ref` and `order_id`:

| Midtrans status | Effect |
|---|---|
| `settlement` | `payment_status` `LUNAS`, `paid_at`, `payment_ref`, `payment_log` `SETTLED`, order `DIPROSES` |
| `expire`, `deny`, `cancel` | Order `DIBATALKAN`, every item `CANCELLED`, stock restored |
| anything else | `200`, no state change |

A repeated callback with the same `gateway_ref` returns `200` and writes nothing.

## Error Codes

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

## Bruno collection

This draft is the source for the Bruno collection:

```text
bruno/
├── collection.bru
├── environments/local.bru
├── auth/
├── public/
├── orders/
├── tables/
├── menus/
├── stock/
└── users/
```

Request bodies, headers, environment variables, and response assertions follow this document and `api-response.md`.
