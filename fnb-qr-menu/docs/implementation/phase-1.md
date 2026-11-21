# Phase 1 — Mock Layer

Granular plan for Phase 1 of `../implementation-plan.md`.

Goal: an in-memory mock backend with the same function signatures and return types as the HTTP module, so Phase 2 builds screens without a running server and Phase 3 only swaps the switch in `src/api/index.ts`.

## Prerequisites

- Phase 0 complete: constants, types, `src/api/index.ts`, session store skeleton.
- Docs read: `docs/tech-stack.md` (Mock Switch, Reference Gaps), `../docs/api.md` (Public — customer).

## Steps

### Step 1 — Create the mock folder

Files: `src/mocks/data/`, `src/mocks/handlers/`, `src/mocks/index.ts`

```text
src/mocks/
├── data/
│   ├── menus.ts
│   └── orders.ts
├── handlers/
│   ├── session.ts
│   ├── publicMenu.ts
│   ├── publicOrders.ts
│   └── index.ts
└── index.ts
```

`src/mocks/index.ts` seeds the in-memory store once and re-exports the handlers.

Verify: importing `@/mocks` seeds without side effects on import order.

### Step 2 — Create menu fixtures `[REWORK]`

Files: `src/mocks/data/menus.ts`

- One open store: `cafe_name` "Kopi Senja", `service_rate` 5, `tax_rate` 10, `is_open` true.
- Two or three categories with 8–12 menus total; each item `{id, name, price, image_url}` with integer rupiah prices.
- One closed variant with `is_open: false` for `demo-tutup`.
- At least two items with `image_url: null` to exercise the initials placeholder.

Verify: fixture shape matches `PublicMenu` field for field.

### Step 3 — Create order fixtures `[REWORK]`

Files: `src/mocks/data/orders.ts`

- Orders in the four aggregate statuses only: `MENUNGGU`, `DIPROSES`, `SELESAI`, `DIBATALKAN`.
- Items in `PENDING`, `COOKING`, `READY`, `DELIVERED`, `COMPLETED`, and `CANCELLED`.
- `payment_status` both `BELUM` and `LUNAS`, so the cancel eligibility path can be seen.
- Deterministic `id` and `order_number` (`DI-001`, `DI-002`, …) values so fixtures are easy to type into a URL.
- Every fixture carries the full server totals (`subtotal_amount`, `service_amount`, `tax_amount`, `total_amount`) so no screen computes them.

Verify: every fixture maps onto `OrderStatusResponse`.

### Step 4 — Implement the session handler `[REWORK]`

Files: `src/mocks/handlers/session.ts`

```ts
export async function openTableSession(qrToken: string): Promise<OpenSessionResponse>
```

Scenario table:

| `qr_token`     | Response                                                |
| -------------- | ------------------------------------------------------- |
| `demo-meja`    | `{ session_token, table_number, status: 'OPEN' }`       |
| `demo-tutup`   | same, with the closed-store scenario bound to the token |
| `demo-habis`   | same, with the out-of-stock scenario bound to the token |
| `demo-invalid` | `404 NOT_FOUND`                                         |
| anything else  | `404 NOT_FOUND`                                         |

The handler records which scenario each issued `session_token` belongs to, so later calls resolve their store state from the token, not from `qr_token`.

Verify: each token returns the expected shape; unknown tokens throw `ApiError` with `code: 'NOT_FOUND'`.

### Step 5 — Implement the menu handler `[REWORK]`

Files: `src/mocks/handlers/publicMenu.ts`

```ts
export async function getPublicMenu(sessionToken: string): Promise<PublicMenu>
```

- A `sessionToken` the mock never issued throws `401 UNAUTHORIZED`.
- The response comes from the scenario bound at session open: `cafe_name`, `service_rate`, `tax_rate`, `is_open`, `categories[].menus[]`.
- Categories with no menus are omitted, mirroring the server.

Verify: a fresh session token resolves; an unknown token throws `ApiError` with `code: 'UNAUTHORIZED'`.

### Step 6 — Implement the order handlers `[REWORK]`

Files: `src/mocks/handlers/publicOrders.ts`

```ts
export async function createPublicOrder(
  sessionToken: string,
  request: CreatePublicOrderRequest,
): Promise<OrderStatusResponse>
export async function getPublicOrders(sessionToken: string): Promise<PublicOrderList>
export async function cancelPublicOrder(
  sessionToken: string,
  orderId: string,
  request: CancelPublicOrderRequest,
): Promise<OrderStatusResponse>
```

Rules:

- Unknown `sessionToken` throws `401 UNAUTHORIZED` on all three.
- `createPublicOrder`: empty `customer_name` or `qty < 1` throws `400 VALIDATION_ERROR`; the `demo-habis` scenario throws `409 STOCK_NOT_ENOUGH`; the `demo-tutup` scenario throws `409 STORE_CLOSED`. On success it prepends the order (newest first) with `order_number`, full totals, `payment_status: 'BELUM'`, items `PENDING`, and `payment_url` when `payment_method` is `NON_CASH`.
- `getPublicOrders` returns only the session's orders, newest first.
- `cancelPublicOrder`: `404 NOT_FOUND` when the id is not in the session; `409 INVALID_TRANSITION` unless the order is `MENUNGGU` with `payment_status` `BELUM`. On success it sets `DIBATALKAN`, `cancel_reason`, `canceled_at`, moves every item to `CANCELLED`, and returns the full order. Allowed while the store is closed.

Verify: open session → menu → create → list → cancel round-trip works against the store.

### Step 7 — Add latency and error helpers

Files: `src/mocks/handlers/index.ts`, `src/lib/apiError.ts`

- A `sleep(200..500ms)` helper applied to every handler so loading states are visible.
- A shared `mockError(code, status, message)` builder producing the same `ApiError` shape the HTTP client throws.
- Codes limited to backend values: `NOT_FOUND`, `UNAUTHORIZED`, `STORE_CLOSED`, `INVALID_TRANSITION`, `VALIDATION_ERROR`, `STOCK_NOT_ENOUGH`.

Verify: network panel-free manual test shows a skeleton for at least 200 ms.

### Step 8 — Wire the handlers into the switch

Files: `src/api/index.ts`

- Replace the Phase 0 stubs on both sides so `mocks` is complete and `http` still throws `NOT_IMPLEMENTED`.
- Confirm `useMocks` reads `VITE_USE_MOCKS` only, not a hardcoded value.

Verify: with `VITE_USE_MOCKS=true`, `openTableSession('demo-meja')` then `getPublicMenu(token)` resolves; with the flag off it throws `NOT_IMPLEMENTED`.

### Step 9 — Add the production build guard

Files: `vite.config.ts`

```ts
export default defineConfig(({ mode }) => {
  if (mode === 'production' && process.env.VITE_USE_MOCKS === 'true')
    throw new Error('VITE_USE_MOCKS must be false for production builds')
  // ...
})
```

Verify: `VITE_USE_MOCKS=true npm run build` fails with that message; unset it and the build passes.

## Phase Checklist

- [ ] `demo-meja`, `demo-tutup`, `demo-habis`, `demo-invalid`, and an unknown token all behave per the table.
- [ ] An unknown session token returns `UNAUTHORIZED` on menu and orders.
- [ ] Session open → menu → create → list → cancel works in memory.
- [ ] Cancelling anything but a `MENUNGGU` unpaid order returns `INVALID_TRANSITION`.
- [ ] Every handler has 200–500 ms latency.
- [ ] `VITE_USE_MOCKS=true npm run build` fails.
- [ ] `npm run lint && npm run format:check && npm run build` pass with the flag off.

## Exit Criteria

- [ ] All five API functions resolve from `@/api` without a backend.
- [ ] Mock signatures match `docs/tech-stack.md` Public API exactly.
- [ ] Phase 2 can start with no UI-facing API changes expected.

## Gotchas

- Store state is module-level and resets on reload; that is fine for slicing.
- Do not add a mock endpoint that `fnb-server` does not expose.
- Keep mock money in integer rupiah and compute fixtures by hand; do not import a formatter into data files.
- Scenario state hangs off the issued `session_token`; never read `qr_token` inside the orders handlers.
