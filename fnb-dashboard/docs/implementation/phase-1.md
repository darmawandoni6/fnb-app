# Phase 1 — Mock Layer

Granular plan for executing Phase 1 from `../implementation-plan.md`.

Goal: an in-memory mock backend with the same function signatures and return types as the future API module (`src/api/`), so Phase 2/3 UI code never changes when swapping mocks for real HTTP. All money stays integer rupiah; all status logic mirrors PRD §5.

## Structure

```text
src/mocks/
├── data/
│   ├── orders.ts
│   ├── menus.ts
│   ├── tables.ts
│   ├── users.ts
│   ├── ingredients.ts
│   └── settings.ts
├── handlers/
│   ├── auth.ts
│   ├── orders.ts
│   ├── menus.ts
│   ├── payments.ts
│   └── index.ts
├── db.ts
└── index.ts
```

## Step 1 — Mock DB (`src/mocks/db.ts`)

Single mutable in-memory store. Not a class, no reactivity — one exported object.

```ts
import type { Category, Ingredient, Menu, Order, RecipeItem, Settings, Table, User } from '@/types'

export const db = {
  orders: [] as Order[],
  menus: [] as Menu[],
  categories: [] as Category[],
  tables: [] as Table[],
  users: [] as User[],
  ingredients: [] as Ingredient[],
  recipeItems: [] as RecipeItem[],
  settings: {
    cafe_name: 'Demo Cafe',
    service_rate: 5,
    tax_rate: 10,
    is_open: true,
    cash_timeout_minutes: 15,
    delivered_auto_complete_minutes: 5,
    ready_auto_deliver_minutes: 10,
    ready_auto_deliver_warning_minutes: 2,
  } as Settings,
  currentUserId: '' as string, // mock session: set on login, no token mechanics
}
```

Notes:

- Mutating helpers live next to the data they mutate, in handlers, not in `db.ts`.
- `db` is module-level state; full page reload resets it. Acceptable for mock mode; note it in a `ponytail:` comment.

## Step 2 — Fixtures (`src/mocks/data/*.ts`)

Each file exports a `seed*()` function or plain array that populates `db`. IDs use stable strings (`'order-1'`, `'menu-1'`), not `crypto.randomUUID()`, so verification stays reproducible.

`menus.ts`:

- 3 categories: Coffee, Non-Coffee, Food.
- 2–3 menus per category.
- One menu uses `is_available: false`.

`tables.ts` — 4 tables, one `is_active: false`.

`users.ts` — one user per role:

```ts
{ id: 'user-1', name: 'Owner', email: 'owner@demo.cafe', role: 'OWNER', is_active: true }
{ id: 'user-2', name: 'Kasir', email: 'kasir@demo.cafe', role: 'CASHIER', is_active: true }
{ id: 'user-3', name: 'Dapur', email: 'dapur@demo.cafe', role: 'KITCHEN', is_active: true }
```

`ingredients.ts` — 5 ingredients with `stock` numbers, plus `recipeItems` mapping 2 menus to ingredients so `STOCK_NOT_ENOUGH` can trigger.

`settings.ts` — `service_rate: 5`, `tax_rate: 10`, `is_open: true`, `cash_timeout_minutes: 15`, `delivered_auto_complete_minutes: 5`, `ready_auto_deliver_minutes: 10`, `ready_auto_deliver_warning_minutes: 2`.

`orders.ts` — seed orders covering every matrix cell:

| Order | type      | order_number | status     | payment     | items (status)   | purpose                                         |
| ----- | --------- | ------------ | ---------- | ----------- | ---------------- | ----------------------------------------------- |
| 1     | DINE_IN   | DI-001       | MENUNGGU   | BELUM       | 2× PENDING       | kitchen blocked by PAYMENT_REQUIRED             |
| 2     | TAKE_AWAY | TA-001       | DIPROSES   | LUNAS       | PENDING, COOKING | kitchen PENDING→COOKING                         |
| 3     | DINE_IN   | DI-002       | DIPROSES   | LUNAS       | COOKING, READY   | kitchen COOKING→READY                           |
| 4     | DINE_IN   | DI-003       | DIPROSES   | LUNAS       | READY            | kitchen READY→DELIVERED                         |
| 5     | TAKE_AWAY | TA-002       | DIPROSES   | LUNAS       | DELIVERED        | cashier DELIVERED→COMPLETED                     |
| 6     | TAKE_AWAY | TA-003       | SELESAI    | LUNAS, CASH | COMPLETED        | history + receipt reprint                       |
| 7     | DINE_IN   | DI-004       | DIBATALKAN | BELUM       | CANCELLED        | cancelled order                                 |
| 8     | TAKE_AWAY | TA-004       | MENUNGGU   | BELUM       | PENDING          | order-level cancel → all CANCELLED → DIBATALKAN |

Item fields follow `src/types/order.ts`. Amounts use menu prices. Totals are precomputed server-side style; mock must behave like server, so client never computes totals.

Verification:

- `npm run build` passes; fixtures type-check against `src/types/`.

## Step 3 — Mock API Surface (`src/mocks/index.ts` + `src/mocks/handlers/index.ts`)

Contract for Phase 2/3. Signatures mirror `src/api/`, returning resolved data and throwing `ApiError` on failure — same shape real client produces after envelope handling.

`auth.ts`:

```ts
login(email: string, password: string): Promise<{ user: User; access_token: string }>
refresh(): Promise<{ user: User; access_token: string }>
logout(): Promise<void>
```

- Mock mode: any seeded email + password `'demo'` logs in.
- `refresh` returns current mock user.
- Unknown email throws `UNAUTHORIZED`.
- `access_token` is fake string `'mock-token-<userId>'`; stored in memory only.

`orders.ts`:

```ts
getOrders(filters?: { status?: OrderStatus; table_id?: string; order_type?: OrderType; date?: string }): Promise<Order[]>
getOrder(id: string): Promise<Order>
createManualOrder(body: { items: { menu_id: string; qty: number; note: string | null }[]; customer_name: string; customer_phone?: string | null; payment_method: PaymentMethod }): Promise<Order>
updateItemStatus(orderId: string, itemId: string, status: ItemStatus): Promise<Order>
cancelOrder(orderId: string, reason: string): Promise<Order>
```

`payments.ts`:

```ts
updatePayment(orderId: string, body: { payment_method: PaymentMethod; amount_received?: number; change_amount?: number }): Promise<Order>
```

`menus.ts`:

```ts
getMenuCategories(): Promise<Category[]>
```

Read-only for Phase 1; CRUD comes with its feature phase.

All handlers are async and await `delay(200 + Math.random() * 300)` first. This supplies 200–500 ms latency for loading-state verification.

## Step 4 — Status Derivation (`orders.ts` helper)

No order-status setter. Compute aggregate from items + payment per PRD §5.3:

1. If every item is `CANCELLED` and the order was unpaid → `DIBATALKAN`.
2. Active items exclude `CANCELLED` items.
3. If `payment_status` is `BELUM` → `MENUNGGU`.
4. If `payment_status` is `LUNAS` and at least one active item is not `COMPLETED` → `DIPROSES`.
5. If `payment_status` is `LUNAS` and every item is `COMPLETED` or `CANCELLED` → `SELESAI`.

There is no `SIAP` or `DIANTAR` order status (PRD §5.1).

`ponytail:` this matrix must match `fnb-server`; if server disagrees at integration, fix here and server side, not UI.

## Step 5 — Transition Rules and Error Codes

Implement PRD §5.2 and `api.md` exactly:

| Action                         | Guard                                                                             | Throw                                                           |
| ------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| item `PENDING` → `COOKING`     | order `LUNAS`; actor KITCHEN/OWNER                                                | `PAYMENT_REQUIRED` if `BELUM`, `FORBIDDEN` if CASHIER           |
| item `COOKING` → `READY`       | actor KITCHEN/OWNER                                                               | `FORBIDDEN` if CASHIER, `INVALID_TRANSITION` if not `COOKING`   |
| item `READY` → `DELIVERED`     | actor KITCHEN/OWNER; CASHIER only for `TAKE_AWAY`                                 | `FORBIDDEN` if not allowed, `INVALID_TRANSITION` if not `READY` |
| item `DELIVERED` → `COMPLETED` | actor KITCHEN/OWNER; CASHIER only for `TAKE_AWAY`                                 | `FORBIDDEN` if not allowed, `INVALID_TRANSITION`                |
| cancel order                   | order `MENUNGGU` + `BELUM`; actor OWNER                                           | `FORBIDDEN` if not OWNER, `INVALID_TRANSITION` otherwise        |
| payment                        | order `BELUM`; method `CASH`/`NON_CASH`; idempotent repeat returns the same order | `VALIDATION_ERROR` for an unknown method                        |
| create manual order            | `settings.is_open`; at least one item; `qty >= 1`; CASHIER only; `TAKE_AWAY` only | `STORE_CLOSED` if closed, `FORBIDDEN` for OWNER/KITCHEN         |
| stock check on create          | recipe qty ≤ ingredient stock                                                     | `STOCK_NOT_ENOUGH`                                              |
| menu availability on create    | menu `is_available`                                                               | `VALIDATION_ERROR`                                              |

On successful mutation:

- Recompute order status.
- Decrement ingredient stock on order creation.
- Order cancellation restores stock for every item, writes `RESTORE` movements with `order_id`/`order_item_id`, and sets `cancel_reason`/`canceled_at`.

Throw `ApiError` (`{ code, message }`), never raw envelope. Role checking reads `db.currentUserId` → user role.

## Step 6 — Mock Switch (`src/api/index.ts` Boundary)

Do not build real axios yet. Create swap point only:

```ts
// src/api/index.ts
import * as mock from '@/mocks'

// import * as real from './http' // Phase 3
export const api = mock
```

`src/lib/mode.ts`:

```ts
export const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false'
```

Phase 3 replaces mock export with real HTTP implementation without changing UI imports.

Verification:

- `import { api } from '@/api'` from a scratch call site returns mock handlers; typecheck passes.

## Step 7 — Runnable Self-Check

Non-trivial logic gets one check file: `src/mocks/selfcheck.ts`, using tiny assert helper, no framework.

Check:

1. `PENDING`→`COOKING` on `BELUM` order throws `PAYMENT_REQUIRED`.
2. Same transition on `LUNAS` order succeeds and order becomes `DIPROSES`.
3. `COOKING`→`READY`→`DELIVERED`→`COMPLETED`; every item terminal + `LUNAS` → `SELESAI`.
4. Order-level cancel on `MENUNGGU`+`BELUM` → every item `CANCELLED`, order `DIBATALKAN`, stock restored.
5. Paying a `LUNAS` order again returns the same order (idempotent, no second `payment_log`).
6. CASHIER calling `COOKING` throws `FORBIDDEN`; CASHIER cancelling an order throws `FORBIDDEN`.
7. Closed store order creation throws `STORE_CLOSED`.
8. Order exceeding stock throws `STOCK_NOT_ENOUGH`.
9. OWNER creating an order throws `FORBIDDEN`.

Run from `main.tsx` behind `if (useMocks)` during Phase 1 only. Remove call when Phase 2 starts; keep file. Self-check uses scratch cloned state or reseeds fixtures before execution.

## Step 8 — Final Verification

```bash
npm run lint
npm run format:check
npm run build
```

Confirm:

- `VITE_USE_MOCKS=true` in `.env` and `.env.example`.
- No `any`.
- No `fetch` or axios in mock handlers.
- All access goes through `src/api/`.
- `AGENTS.md` status says `Phase 1 complete; next: Phase 2`.

## Definition of Done

- [ ] `src/mocks/` matches planned structure.
- [ ] Fixtures cover every status/payment/role combination.
- [ ] All PRD §5.2 transitions enforced.
- [ ] `INVALID_TRANSITION`, `PAYMENT_REQUIRED`, `STORE_CLOSED`, `STOCK_NOT_ENOUGH`, `FORBIDDEN` reproducible.
- [ ] 200–500 ms latency on every handler.
- [ ] `src/api/` swap point exists; mock selected via `VITE_USE_MOCKS`.
- [ ] Self-check passes.
- [ ] Lint, format, build pass.
- [ ] `AGENTS.md` updated.
