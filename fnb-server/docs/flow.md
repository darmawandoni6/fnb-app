# Application Flow

This document describes application execution flows. Role and status matrices are defined in `docs/PRD.md` §5.

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

    QR -->|HTTP public endpoints| API
    DASH -->|HTTP JWT bearer| API
    API --> DB
```

- QR Menu without login; uses table token and tracking token.
- Dashboard uses JWT and role `OWNER`, `CASHIER`, `KITCHEN`.
- MVP uses polling: dashboard 3–5 detik, QR Menu 5 detik.

## Order QR end-to-end

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer (QR Menu)
    participant K as Cashier (Dashboard)
    participant D as Kitchen (Dashboard)
    participant API as fnb-server
    participant DB as PostgreSQL

    C->>API: GET /public/tables/:qr_token/menu
    API->>DB: query table + available menu + settings
    DB-->>API: menu data + is_open
    API-->>C: menu

    C->>API: POST /public/tables/:qr_token/orders
    Note over API,DB: TRANSAKSI
    API->>DB: validate settings.is_open, menu, recipes, and stock
    API->>DB: insert order MENUNGGU, payment BELUM
    API->>DB: insert order_items PENDING
    API->>DB: decrease stock + stock_movements OUT
    API->>DB: commit
    API-->>C: tracking_token once only
    C->>C: save tracking_token in localStorage

    Note over K: unpaid order appears for collection
    K->>API: PATCH /orders/:id/payment
    API->>DB: update payment_status = LUNAS

    Note over D: kitchen only sees paid orders<br/>COOKING is rejected with PAYMENT_REQUIRED while BELUM
    D->>API: PATCH /orders/:id/items/:item_id/status COOKING
    API->>DB: item COOKING, order aggregate DIPROSES
    D->>API: PATCH /orders/:id/items/:item_id/status READY
    API->>DB: item READY, order aggregate SIAP when all are ready

    K->>API: PATCH /orders/:id/items/:item_id/status DELIVERED
    API->>DB: item DELIVERED, order aggregate DIANTAR
    K->>API: PATCH /orders/:id/items/:item_id/status DELIVERED (last active item)
    API->>DB: order aggregate SELESAI (payment LUNAS)

    Note over API: order status is never set directly<br/>it is derived from item statuses and payment (PRD §5.1)

    loop polling every 5 seconds
        C->>API: GET /public/orders/:tracking_token
        API-->>C: order status + each item status
    end
```

## Manual order

```mermaid
sequenceDiagram
    autonumber
    participant K as Cashier (Dashboard)
    participant API as fnb-server
    participant DB as PostgreSQL

    K->>API: POST /orders/manual (JWT)
    Note over API,DB: TRANSAKSI
    API->>DB: validate settings.is_open, menu, recipes, and stock
    API->>DB: insert order MANUAL, created_by = cashier, table_id NULL
    API->>DB: insert order_items PENDING
    API->>DB: decrease stock + stock_movements OUT
    API->>DB: commit
    API-->>K: order with items

    Note over K: store closed returns 409 STORE_CLOSED

    K->>API: PATCH /orders/:id/payment LUNAS
    API->>DB: payment LUNAS + order status recomputed
    K->>API: PATCH /orders/:id/items/:item_id/status COOKING → READY → DELIVERED
    API->>DB: item status + order aggregate recomputed
```

Manual orders have no table and no tracking token. Payment, item transitions, stock, and cancellation behave exactly like QR orders.

## Atomic Item Cancellation and Refund

```mermaid
sequenceDiagram
    autonumber
    participant A as Customer/Cashier/Owner
    participant API as fnb-server
    participant DB as PostgreSQL

    A->>API: POST /orders/:id/items/:item_id/cancel
    Note over API,DB: TRANSACTION — all or nothing
    API->>DB: lock item, validate status = PENDING
    API->>DB: item = CANCELLED
    API->>DB: restore stock from recipe_items
    API->>DB: stock_movements RESTORE + order_item_id

    alt payment_status = LUNAS
        API->>DB: calculate item refund + proportional tax
        API->>DB: decrease subtotal_amount, tax_amount, total_amount
        alt public cancel via tracking token
            API->>DB: save refund actor_id NULL, reason "customer cancelled item"
        else staff cancel via JWT
            API->>DB: save refund actor_id = user id, reason "staff cancelled item"
        end
    else payment_status = BELUM
        Note right of API: no refund because payment has not been made<br/>order totals stay unchanged
    end

    alt all items CANCELLED
        API->>DB: order = DIBATALKAN, totals = 0
    end
    API->>DB: commit
    API-->>A: success response
```

## Polling

```mermaid
graph TD
    subgraph Dashboard
        P1[poll GET /orders<br/>3–5 detik, JWT]
        P2[poll GET /orders?status=DIPROSES<br/>papan dapur]
    end
    subgraph QR Menu
        P3[poll GET /public/orders/:tracking_token<br/>5 detik]
    end
    API[fnb-server]

    P1 --> API
    P2 --> API
    P3 --> API
```

## Request Layers

```mermaid
graph LR
    H[delivery/http<br/>bind + response] --> U[usecase<br/>business rules + transaction]
    U --> R[repository<br/>GORM queries]
    R --> DB[(PostgreSQL)]
```

- Handler: bind, validate, call usecase, send response envelope.
- Usecase: role checks, status transitions, calculations, and the steps executed inside a transaction.
- Repository: opens/commits transactions and runs database queries, without business decisions.

Transaction ownership is hybrid: the repository exposes `database.WithTx` (GORM mechanics), the usecase declares the transaction-scoped interface and decides the sequence of writes.
