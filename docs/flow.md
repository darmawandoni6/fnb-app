# Application Flow

This document describes application execution flows. Business rules, the state machine, and the access matrix are defined in `PRD.md` §5, §8, §9.

## Architecture

```mermaid
graph LR
    subgraph Public
        QR[fnb-qr-menu<br/>Vite SPA]
    end
    subgraph Internal
        DASH[fnb-dashboard<br/>Vite SPA]
    end
    API[fnb-server<br/>Go Echo + GORM]
    DB[(PostgreSQL)]
    MT[Midtrans Snap]

    QR -->|HTTP + X-Session-Token<br/>WS session topic| API
    DASH -->|HTTP JWT bearer<br/>WS order topic| API
    API --> DB
    API -->|Snap + callback| MT
```

- QR Menu without login; identified by a table session token.
- Dashboard uses JWT and role `OWNER`, `CASHIER`, `KITCHEN`.
- Real time over one WebSocket hub; polling every 3–5 seconds (dashboard) and 5 seconds (QR Menu) is the fallback when the socket drops.

## Dine-in order end-to-end

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer (QR Menu)
    participant K as Cashier (Dashboard)
    participant D as Kitchen (Dashboard)
    participant API as fnb-server
    participant DB as PostgreSQL

    C->>API: POST /public/tables/:qr_token/sessions
    API->>DB: find or create OPEN table_session
    API-->>C: session_token
    C->>C: save session_token in localStorage

    C->>API: GET /public/menu (X-Session-Token)
    API->>DB: query session, available menu, settings
    API-->>C: menu + service_rate + tax_rate + is_open

    C->>API: POST /public/orders (name, phone?, method, items)
    Note over API,DB: TRANSACTION
    API->>DB: validate session, is_open, menu, recipes, stock
    API->>DB: next order_number (DI-###) from order_sequence
    API->>DB: insert order MENUNGGU / payment BELUM, snapshot rates and totals
    API->>DB: insert order_items PENDING with menu_name and price snapshot
    API->>DB: decrease stock + stock_movements OUT
    API->>DB: write audit_log
    API->>DB: commit
    API-->>C: order_number + totals (+ payment_url when NON_CASH)
    API-->>K: WS order.created
    API-->>D: WS order.created

    alt CASH
        Note over C,K: order stays MENUNGGU with a 15 minute timer
        C->>K: customer walks to the counter
        K->>API: PATCH /orders/:id/payment (CASH, amount_received)
        API->>DB: payment_status LUNAS, paid_at, payment_log CASH
        API->>DB: order DIPROSES + audit_log
        API-->>C: WS order.updated
    else NON_CASH
        C->>API: pay in Midtrans Snap
        API->>DB: payment_log PENDING at creation
        API-->>API: POST /public/payments/midtrans/callback settlement
        API->>DB: verify signature, idempotent on gateway_ref
        API->>DB: payment_status LUNAS, payment_ref, payment_log SETTLED, order DIPROSES
        API-->>C: WS order.updated
    end

    D->>API: PATCH /orders/:id/items/:item_id/status COOKING
    API->>DB: reject with PAYMENT_REQUIRED while BELUM
    API->>DB: item COOKING + order aggregate recomputed
    API-->>C: WS item.updated
    D->>API: PATCH /orders/:id/items/:item_id/status READY
    API->>DB: item READY + order aggregate recomputed
    API-->>C: WS item.updated

    Note over D: tab Pass/Counter — hand the item to the waiter
    D->>API: PATCH /orders/:id/items/:item_id/status DELIVERED
    API->>DB: item DELIVERED, delivered_at, audit_log
    API-->>C: WS item.updated (customer sees "dalam pengantaran")

    Note over D,C: waiter serves following SOP-WAITER-01 — no system action

    opt 5 minutes at DELIVERED, or kitchen override
        API->>DB: scheduler sets item COMPLETED, completed_at
        API-->>C: WS item.updated
    end

    API->>DB: every item COMPLETED or CANCELLED -> order SELESAI
    API-->>C: WS order.updated
    API-->>K: WS order.updated
```

## Take away order (cashier)

```mermaid
sequenceDiagram
    autonumber
    participant K as Cashier (Dashboard)
    participant D as Kitchen (Dashboard)
    participant API as fnb-server
    participant DB as PostgreSQL

    K->>API: POST /orders/manual (JWT)
    Note over API,DB: TRANSACTION
    API->>DB: validate is_open, menu, recipes, stock, required customer_name
    API->>DB: next order_number (TA-###) from order_sequence
    API->>DB: insert order TAKE_AWAY, table_id NULL, table_session_id NULL, payment BELUM
    API->>DB: insert order_items PENDING, decrease stock, audit_log
    API->>DB: commit
    API-->>K: order_number + totals (+ payment_url when NON_CASH)

    K->>API: PATCH /orders/:id/payment (CASH, amount_received, change_amount)
    API->>DB: payment LUNAS, payment_log CASH, order DIPROSES
    K->>K: browser print of the receipt (58/80 mm)

    D->>API: PATCH items COOKING → READY
    K->>API: PATCH /orders/:id/items/:item_id/status DELIVERED
    K->>API: PATCH /orders/:id/items/:item_id/status COMPLETED
    API->>DB: order SELESAI when every item is terminal
```

Manual orders have no table and no table session. Payment, item transitions, stock, and cancellation behave exactly like dine-in orders, except that the cashier owns `READY → DELIVERED → COMPLETED`.

## Table session lifecycle

```mermaid
stateDiagram-v2
    [*] --> OPEN: scan table QR
    OPEN --> OPEN: scan again (same token)
    OPEN --> CLOSED: no active order left
    OPEN --> CLOSED: cashier/owner closes the table
    CLOSED --> [*]
```

- A session closes automatically when it holds no order other than `SELESAI` or `DIBATALKAN`.
- Closing never deletes orders; `orders.table_session_id` keeps the history.
- A closed session cannot be reopened; the next scan creates a new one (EC-04).

## Order cancellation (unpaid only)

```mermaid
sequenceDiagram
    autonumber
    participant A as Customer / Owner
    participant S as Scheduler / Midtrans
    participant API as fnb-server
    participant DB as PostgreSQL

    alt public customer
        A->>API: POST /public/orders/:id/cancel (X-Session-Token, reason)
    else owner
        A->>API: POST /orders/:id/cancel (JWT, reason)
    else automatic
        S->>API: cash timeout or Midtrans expire
    end

    Note over API,DB: TRANSACTION — all or nothing
    API->>DB: validate status = MENUNGGU and payment_status = BELUM
    API->>DB: reject otherwise with INVALID_TRANSITION
    API->>DB: all items -> CANCELLED, cancelled_at
    API->>DB: restore stock from recipe_items, stock_movements RESTORE per item
    API->>DB: order DIBATALKAN, cancel_reason, canceled_at
    API->>DB: audit_log
    API->>DB: commit

    Note over API: no refund is created — no money was collected
    API-->>A: order cancelled
    API-->>A: WS order.updated, session topic
```

Allowed while the store is closed. A paid order (`DIPROSES`) cannot be cancelled in v1; the owner handles it manually (BR-06).

## Stock

Stock decreases when an order is created and is restored when the order is cancelled.

```mermaid
sequenceDiagram
    autonumber
    participant API as fnb-server
    participant DB as PostgreSQL

    Note over API,DB: order creation — inside the same transaction
    API->>DB: for each item, for each recipe_item -> OUT movement, stock_qty - qty_used
    API->>DB: reject with STOCK_NOT_ENOUGH when stock_qty < qty_used

    Note over API,DB: order cancellation — inside the same transaction
    API->>DB: for each item, for each recipe_item -> RESTORE movement, stock_qty + qty_used
```

The movement log is append-only.

## Stock Opname

Physical stock correction. A correction is recorded as a new `ADJUSTMENT`, never an edit or delete.

```mermaid
sequenceDiagram
    autonumber
    participant O as Owner (Dashboard)
    participant API as fnb-server
    participant DB as PostgreSQL

    O->>API: POST /ingredients/:id/adjust (JWT)
    Note over API,DB: TRANSACTION
    API->>DB: lock ingredient row
    API->>DB: reject when counted stock equals current (VALIDATION_ERROR)
    API->>DB: update stock_qty = counted stock
    API->>DB: insert stock_movements ADJUSTMENT, qty = counted - previous
    API->>DB: commit
    API-->>O: ingredient
```

## Recipe Management

PRD BR-23: recipes are finalized before the store opens, so editing is rejected while `settings.is_open` is true. Reading recipes stays allowed.

```mermaid
sequenceDiagram
    autonumber
    participant O as Owner (Dashboard)
    participant API as fnb-server
    participant DB as PostgreSQL

    O->>API: POST/PATCH/DELETE /recipe-items (JWT)
    API->>DB: read settings.is_open
    alt is_open = true
        API-->>O: STORE_CLOSED
    else is_open = false
        Note over API,DB: TRANSACTION
        API->>DB: validate menu, ingredient, qty_used, unique (menu_id, ingredient_id)
        API->>DB: write recipe_items
        API->>DB: commit
        API-->>O: recipe item
    end
```

## Midtrans callback

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant MT as Midtrans
    participant API as fnb-server
    participant DB as PostgreSQL

    C->>API: POST /public/orders (NON_CASH)
    API->>DB: order BELUM, payment_log PENDING
    API-->>C: payment_url + snap_token
    C->>MT: pay in Snap
    MT-->>API: POST /public/payments/midtrans/callback

    Note over API,DB: TRANSACTION
    API->>API: verify signature_key
    API->>DB: read payment_log by gateway_ref — already SETTLED is a no-op
    alt settlement
        API->>DB: payment_status LUNAS, paid_at, payment_ref, payment_log SETTLED
        API->>DB: order DIPROSES, audit_log
    else expire / deny / cancel
        API->>DB: order DIBATALKAN, items CANCELLED, stock RESTORE
    else other status
        Note right of API: 200 with no state change
    end
    API->>DB: commit
    API-->>MT: 200
    API-->>C: WS order.updated
```

A replayed callback returns `200` and writes nothing (BR-16).

## Scheduled jobs

One loop runs every minute and is safe to repeat.

```mermaid
flowchart TD
    J[scheduler tick] --> A[orders MENUNGGU past cash_timeout_minutes<br/>payment BELUM -> cancel order]
    J --> B[items READY past ready_auto_deliver_minutes<br/>-> DELIVERED]
    J --> C[items DELIVERED past delivered_auto_complete_minutes<br/>-> COMPLETED]
    J --> D[table_sessions with no active order<br/>-> CLOSED]
    A --> E[recompute order.status]
    B --> E
    C --> E
    E --> F[audit_log + WS publish]
```

The kitchen sees a warning `ready_auto_deliver_warning_minutes` before the auto-deliver fires.

## Real time and polling

```mermaid
graph TD
    subgraph Dashboard
        W1[WS topic order:id<br/>all roles that may read it]
        P1[poll GET /orders<br/>3–5 s, JWT, fallback]
    end
    subgraph QR Menu
        W2[WS topic session:token]
        P2[poll GET /public/orders<br/>5 s, X-Session-Token, fallback]
    end
    API[fnb-server]

    W1 --> API
    W2 --> API
    P1 --> API
    P2 --> API
```

The server is the only publisher. If the socket drops, the client polls until it reconnects (EC-19).

## Request layers

```mermaid
graph LR
    H[delivery/http<br/>bind + response] --> U[usecase<br/>business rules + transaction]
    U --> R[repository<br/>GORM queries]
    R --> DB[(PostgreSQL)]
```

- Handler: bind, validate, call usecase, send response envelope.
- Usecase: role checks, status transitions, calculations, audit writes, and the steps executed inside a transaction.
- Repository: opens/commits transactions and runs database queries, without business decisions.

Transaction ownership is hybrid: the repository exposes `database.WithTx` (GORM mechanics), the usecase declares the transaction-scoped interface and decides the sequence of writes.
