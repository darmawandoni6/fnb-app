# FNB Dashboard Structure

## Scope

Folder and runtime structure for the internal `fnb-dashboard` application.

## Technology

- React
- Vite
- TypeScript with `strict: true`
- Single Page Application (SPA)
- One build for the `OWNER`, `CASHIER`, and `KITCHEN` roles
- Dashboard uses a JWT bearer token for internal requests
- Dashboard polls for current order and status data

## Folder Structure

```text
fnb-dashboard/
├── docs/
│   ├── ai-rules.md
│   ├── conventions.md
│   └── dashboard-structure.md
├── public/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── orders.ts
│   │   ├── menus.ts
│   │   └── types.ts
│   ├── auth/
│   │   ├── AuthContext.tsx
│   │   └── RoleGuard.tsx
│   ├── constants/
│   │   ├── roles.ts
│   │   ├── orderStatus.ts
│   │   ├── itemStatus.ts
│   │   ├── paymentStatus.ts
│   │   ├── orderType.ts
│   │   └── routes.ts
│   ├── features/
│   │   ├── auth/
│   │   │   └── pages/LoginPage.tsx
│   │   ├── orders/
│   │   │   ├── pages/OrdersPage.tsx
│   │   │   ├── pages/KitchenPage.tsx
│   │   │   ├── components/OrderCard.tsx
│   │   │   └── hooks/useOrdersPolling.ts
│   │   ├── payments/
│   │   ├── menus/
│   │   ├── tables/
│   │   ├── stock/
│   │   ├── reports/
│   │   └── settings/
│   ├── components/
│   │   └── ui/
│   ├── lib/
│   │   └── formatRupiah.ts
│   ├── types/
│   │   ├── auth.ts
│   │   ├── order.ts
│   │   └── user.ts
│   └── styles/
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Folder Rules

- `api/`: HTTP requests and response DTOs. Components must not call `fetch` directly.
- `auth/`: session, login, logout, and role restrictions.
- `constants/`: fixed values shared across features.
- `features/`: code organized by business domain.
- `components/ui/`: small, reusable UI components.
- `lib/`: pure utility functions.
- `types/`: domain types shared across features.

## Role Feature Access

| Feature | OWNER | CASHIER | KITCHEN |
|---|---|---|---|
| Orders | Full | Full according to permissions | Production queue |
| Payments | Full | Full | None |
| Menus | Full | View according to permissions | None |
| Tables and QR | Full | View according to permissions | None |
| Stock | Full | View according to permissions | None |
| Reports | Full | None | None |
| Staff and settings | Full | None | None |

## Runtime Rules

- Dashboard polling runs every 3–5 seconds.
- Backend calculates order status from item statuses and payment status.
- The UI does not change order status directly.
- Kitchen changes `PENDING` → `COOKING` → `READY`.
- Cashier changes `READY` → `DELIVERED`.
- `OWNER` can perform every transition allowed by the backend.
