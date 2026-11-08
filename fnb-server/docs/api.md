# M1 API Draft

This document is the source of truth before generating the Bruno request collection.

Local base URL:

```text
http://localhost:8081
```

All responses follow the envelope in `docs/api-response.md`.

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

| Method | Path | Keterangan |
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
| `GET` | `/orders` | All roles | Filter by status, table, and date |
| `GET` | `/orders/:id` | All roles | Order and item details |
| `POST` | `/orders/manual` | `CASHIER`, `OWNER` | Create a walk-in order |
| `PATCH` | `/orders/:id/payment` | `CASHIER`, `OWNER` | Mark payment as `LUNAS` |
| `PATCH` | `/orders/:id/status` | `CASHIER`, `OWNER` | `SIAP` → `DIANTAR` → `SELESAI` |

The kitchen can only see `LUNAS` orders.

## Internal — kitchen items

| Method | Path | Role | Body |
|---|---|---|---|
| `PATCH` | `/orders/:id/items/:item_id/status` | `KITCHEN`, `OWNER` | `{status: COOKING\|READY}` |
| `POST` | `/orders/:id/items/:item_id/cancel` | `CASHIER`, `OWNER` | Batal if item `PENDING` |
| `POST` | `/orders/:id/items/:item_id/refund` | `CASHIER`, `OWNER` | Refund item that already paid |

All actors may cancel `PENDING` items according to the PRD. After `COOKING`, items cannot be cancelled in M1.

## Internal — menus and tables

Role: `OWNER`.

| Method | Path | Keterangan |
|---|---|---|
| `GET` | `/menu-categories` | List categories |
| `POST` | `/menu-categories` | Create category |
| `PATCH` | `/menu-categories/:id` | Update category |
| `DELETE` | `/menu-categories/:id` | Delete category |
| `GET` | `/menus` | List menus |
| `POST` | `/menus` | Create menu; use multipart photo upload when needed |
| `PATCH` | `/menus/:id` | Update menu |
| `DELETE` | `/menus/:id` | Delete/deactivate menu |
| `GET` | `/tables` | List tables |
| `POST` | `/tables` | Create table and `qr_token` |
| `PATCH` | `/tables/:id` | Update table |
| `DELETE` | `/tables/:id` | Deactivate table |

## Internal — stock

`GET` dapat used `CASHIER` and `OWNER`. Only `OWNER` may change stock.

| Method | Path | Keterangan |
|---|---|---|
| `GET` | `/ingredients` | List ingredients and stock |
| `POST` | `/ingredients` | Create ingredient |
| `PATCH` | `/ingredients/:id` | Update ingredient |
| `POST` | `/ingredients/:id/restock` | Add stock and movement `IN` |
| `GET` | `/recipe-items` | List recipes |
| `POST` | `/recipe-items` | Add ingredient to recipe |
| `PATCH` | `/recipe-items/:id` | Update recipe quantity |
| `DELETE` | `/recipe-items/:id` | Delete recipe item |

## Internal — users and settings

Role: `OWNER`.

| Method | Path | Keterangan |
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
| `REFUND_NOT_ALLOWED` | 409 | Item does not meet refund requirements |
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

Request bodies, headers, environment variables, and response assertions follow this document and `docs/api-response.md`.
