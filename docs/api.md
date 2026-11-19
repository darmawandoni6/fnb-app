# M1 API Draft

This document is the source of truth before generating the Bruno request collection.

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

The refresh token uses an httpOnly cookie. The database stores only the token hash in `sessions`.

## Public — customer

No JWT required.

| Method | Path | Description |
|---|---|---|
| `GET` | `/public/tables/:qr_token/menu` | Available menus and categories |
| `POST` | `/public/tables/:qr_token/orders` | Create a QR order and return a tracking token |
| `GET` | `/public/orders/:tracking_token` | Order status and each item status |
| `POST` | `/public/orders/:tracking_token/cancel` | Cancel the customer's `PENDING` item |

The server reads prices from the database. The client must not determine prices, tax, totals, or stock.

Rate limits (per instance, in-memory):

| Endpoint | Limit | Key |
|---|---|---|
| `POST /public/tables/:qr_token/orders` | 5/minute | `qr_token` |
| `GET /public/orders/:tracking_token` | 30/minute | client IP |
| `GET /public/tables/:qr_token/menu` | 60/minute | `qr_token` |

### Menu response

```json
{
  "cafe_name": "Demo Cafe",
  "tax_percent": 10,
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

Categories with no available menu are omitted. When `is_open` is `false`, the client disables ordering; `POST .../orders` returns `409 STORE_CLOSED`.

### Cancel item

```json
{
  "item_id": "uuid"
}
```

Only items with status `PENDING` can be cancelled. Cancelling while the order is `BELUM` keeps the order totals unchanged; cancelling while `LUNAS` records a refund and decreases the totals.

### Create QR order

```json
{
  "items": [
    {
      "menu_id": "uuid",
      "qty": 2,
      "note": "no sugar"
    }
  ]
}
```

The response returns `tracking_token` once. QR Menu stores it in `localStorage`.

## Internal — orders

All endpoints below use JWT and role middleware.

| Method | Path | Role | Keterangan |
|---|---|---|---|
| `GET` | `/orders` | All roles | Filter by `status`, `table_id`, `date` |
| `GET` | `/orders/:id` | All roles | Order and item details |
| `POST` | `/orders/manual` | `CASHIER`, `OWNER` | Create a walk-in order |
| `PATCH` | `/orders/:id/payment` | `CASHIER`, `OWNER` | Mark payment as `LUNAS` |

The kitchen only sees `LUNAS` orders in the list. Reading an unpaid order by id returns `404 NOT_FOUND` to the kitchen. The kitchen board combines `MENUNGGU`, `DIPROSES`, and `DIANTAR` orders that still have active `PENDING` or `COOKING` items, because a paid order stays `MENUNGGU` until the first item becomes `COOKING`.

There is no order status endpoint. `status` is derived from item statuses and payment according to PRD §5.1. `GET /orders` returns at most 200 rows, newest first; `date` is a UTC day (`YYYY-MM-DD`).

Create manual order:

```json
{
  "items": [
    { "menu_id": "uuid", "qty": 1, "note": null }
  ]
}
```

Manual orders have `order_type = MANUAL`, `created_by` set from the JWT, and `table_id = NULL`. When `settings.is_open` is `false`, creation returns `409 STORE_CLOSED`, the same as QR orders.

Payment:

```json
{ "payment_status": "LUNAS", "payment_method": "CASH", "amount_received": 50000, "change_amount": 17000 }
```

`payment_method` is required and is `CASH` or `NON_CASH`. Only `BELUM → LUNAS` is allowed in M1; repeating it returns `409 INVALID_TRANSITION`. `amount_received` and `change_amount` are optional cash tendering fields, stored on the order when `payment_method` is `CASH` and returned as `null` otherwise, so a receipt can be reprinted with the same figures.

## Internal — kitchen items

| Method | Path | Role | Body |
|---|---|---|---|
| `PATCH` | `/orders/:id/items/:item_id/status` | `KITCHEN`, `OWNER` for `COOKING`/`READY`; `CASHIER`, `OWNER` for `DELIVERED` | `{status: COOKING\|READY\|DELIVERED}` |
| `POST` | `/orders/:id/items/:item_id/cancel` | `CASHIER`, `OWNER` | Batal if item `PENDING` |

Transitions are forward only: `PENDING → COOKING → READY → DELIVERED`. `COOKING` is rejected with `409 PAYMENT_REQUIRED` while the order is `BELUM`. `DELIVERED` moves the order to `DIANTAR`; the last active item plus `LUNAS` moves it to `SELESAI`.

The customer who owns the order, `CASHIER`, and `OWNER` may cancel `PENDING` items according to the PRD. After `COOKING`, items cannot be cancelled in M1. A staff cancellation on a `LUNAS` order writes a refund with `actor_id` set to the staff user and reason `staff cancelled item`; a `BELUM` cancellation writes no refund.

Item status and payment responses return the full order with its items, so the dashboard can read the new aggregate `status` without a second call.

## Internal — menus and tables

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
| `GET` | `/tables` | List tables, sorted by `table_number` |
| `POST` | `/tables` | Create table and `qr_token` |
| `PATCH` | `/tables/:id` | Update table; `table_number` stays unique |
| `DELETE` | `/tables/:id` | Deactivate table |

Exception: `PATCH /menus/:id` is also allowed for `CASHIER`, but only the `is_available` field. Sending `name`, `price`, `image_url`, or `category_id` as a cashier returns `403 FORBIDDEN`.

Table QR content:

```text
<QR_MENU_BASE_URL>/?meja=<qr_token>
```

`QR_MENU_BASE_URL` is configured through the dashboard env `VITE_QR_MENU_URL`; the dashboard has no default and disables the "open QR Menu" action while it is empty. The QR Menu app (`fnb-qr-menu`) reads `meja` from the query string and resolves it with `GET /public/tables/:code`, which accepts either a `qr_token` or a `table_number`. The dashboard sends the token so the label keeps working if a number is ever reused.

`qr_token` is generated by `POST /tables` and does not rotate in M1 — reprinting or re-rendering produces the same QR. Rotating a token would invalidate QR codes already attached to tables and requires a new endpoint plus reprinted labels, so it is out of scope. Deactivating a table (`DELETE /tables/:id`) is the way to reject its QR orders without changing the token.

## Internal — stock

`GET` can be used by `CASHIER` and `OWNER`. Only `OWNER` may change stock.

| Method | Path | Description |
|---|---|---|
| `GET` | `/ingredients` | List ingredients with `stock_qty` and `min_stock` |
| `POST` | `/ingredients` | Create ingredient (`name`, `unit`, `stock_qty`, `min_stock`); writes movement `ADJUSTMENT` when `stock_qty > 0` |
| `PATCH` | `/ingredients/:id` | Update ingredient, including `min_stock` |
| `POST` | `/ingredients/:id/restock` | Add stock and movement `IN` (body `{ qty, note? }`) |
| `POST` | `/ingredients/:id/adjust` | Stock opname: body `{ stock_qty, note? }`, replaces stock, writes `ADJUSTMENT` with the signed delta |
| `GET` | `/recipe-items` | List recipes (`menu_id`, `ingredient_id`, `qty_used`) |
| `POST` | `/recipe-items` | Add ingredient to recipe |
| `PATCH` | `/recipe-items/:id` | Update recipe quantity |
| `DELETE` | `/recipe-items/:id` | Delete recipe item |
| `GET` | `/stock-movements` | List stock movements; query `ingredient_id`, `type`, `from`, `to` (ISO date) |

`stock_movements.qty` is signed per PRD §9: positive for incoming (`IN`, `RESTORE`) and negative for outgoing (`OUT`). `ADJUSTMENT` stores the signed delta between the counted stock and the previous stock, so it can be positive or negative and is never zero. `order_id`/`order_item_id` are filled for `OUT` and `RESTORE`.

`POST /ingredients/:id/adjust` is an extension beyond PRD Phase 2 (opname). The flow is documented in `docs/flow.md` under "Stock Opname".

`POST`, `PATCH`, and `DELETE` on `/recipe-items` are rejected with `STORE_CLOSED` while `settings.is_open` is true (PRD §8: recipes are finalized before the store opens). Reading recipes stays allowed. Restock, opname, and ingredient CRUD are not gated by `is_open`.

## Internal — users and settings

Role: `OWNER`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/users` | List users |
| `POST` | `/users` | Create `CASHIER` or `KITCHEN` user |
| `PATCH` | `/users/:id` | Update or activate/deactivate user |
| `GET` | `/settings` | Get `cafe_name` and `tax_percent` |
| `PATCH` | `/settings` | Update settings |

## Error codes

| Code | HTTP | Kapan |
|---|---:|---|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Role is not authorized |
| `NOT_FOUND` | 404 | Resource not found |
| `STOCK_NOT_ENOUGH` | 409 | Insufficient stock |
| `STORE_CLOSED` | 409 | Store is closed for new orders |
| `INVALID_TRANSITION` | 409 | Status violates PRD matrix |
| `PAYMENT_REQUIRED` | 409 | Kitchen/order requires payment |
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
├── menus/
├── stock/
└── users/
```

Request bodies, headers, environment variables, and response assertions follow this document and `api-response.md`.
