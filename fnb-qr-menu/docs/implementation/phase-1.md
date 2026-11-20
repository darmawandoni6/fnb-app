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
│   ├── publicMenu.ts
│   ├── publicOrders.ts
│   └── index.ts
└── index.ts
```

`src/mocks/index.ts` seeds the in-memory store once and re-exports the handlers.

Verify: importing `@/mocks` seeds without side effects on import order.

### Step 2 — Create menu fixtures

Files: `src/mocks/data/menus.ts`

- One open store: `cafe_name` "Kopi Senja", `tax_percent` 10, `is_open` true.
- Two or three categories with 8–12 menus total; each item `{id, name, price, image_url}` with integer rupiah prices.
- One closed variant with `is_open: false` for `demo-tutup`.
- At least two items with `image_url: null` to exercise the initials placeholder.

Verify: fixture shape matches `MenuResponse` field for field.

### Step 3 — Create order fixtures

Files: `src/mocks/data/orders.ts`

- Orders in `MENUNGGU`, `DIPROSES`, `SIAP`, `DIANTAR`, `SELESAI`, and `DIBATALKAN`.
- Items in `PENDING`, `COOKING`, `READY`, `DELIVERED`, and `CANCELLED`.
- `payment_status` both `BELUM` and `LUNAS`, so the refund warning path can be seen.
- Deterministic `order_id` and `tracking_token` values so fixtures are easy to type into a URL.

Verify: every fixture maps onto `OrderStatusResponse`.

### Step 4 — Implement the menu handler

Files: `src/mocks/handlers/publicMenu.ts`

```ts
export async function getPublicMenu(qrToken: string): Promise<PublicMenu>
```

Scenario table:

| `qr_token`     | Response                                           |
| -------------- | -------------------------------------------------- |
| `demo-meja`    | Normal open store                                  |
| `demo-tutup`   | `is_open = false`                                  |
| `demo-habis`   | Normal open store; order creation fails separately |
| `demo-invalid` | `404 NOT_FOUND`                                    |
| anything else  | `404 NOT_FOUND`                                    |

Categories with no menus are omitted, mirroring the server.

Verify: each token returns the expected shape; unknown tokens throw `ApiError` with `code: 'NOT_FOUND'`.

### Step 5 — Implement the order handlers

Files: `src/mocks/handlers/publicOrders.ts`

```ts
export async function createPublicOrder(
  qrToken: string,
  request: CreatePublicOrderRequest,
): Promise<CreatePublicOrderResponse>
export async function getPublicOrder(trackingToken: string): Promise<OrderStatusResponse>
export async function cancelOrderItem(
  trackingToken: string,
  itemId: string,
): Promise<OrderStatusResponse>
```

Rules:

- `createPublicOrder` returns `order_id`, `tracking_token`, `subtotal_amount`, `tax_amount`, `total_amount`, `status`, and `items`.
- `demo-habis` returns `409 STOCK_NOT_ENOUGH`; `demo-tutup` returns `409 STORE_CLOSED`.
- `createPublicOrder` pushes the new order into the in-memory store so `getPublicOrder` finds it immediately.
- `cancelOrderItem` accepts `PENDING` items only; anything else returns `409 INVALID_TRANSITION`. It mutates the stored order so the next poll shows the change.

Verify: create → lookup → cancel round-trip works against the store.

### Step 6 — Add latency and error helpers

Files: `src/mocks/handlers/index.ts`, `src/lib/apiError.ts`

- A `sleep(200..500ms)` helper applied to every handler so loading states are visible.
- A shared `mockError(code, status, message)` builder producing the same `ApiError` shape the HTTP client throws.
- Codes limited to backend values: `NOT_FOUND`, `STORE_CLOSED`, `INVALID_TRANSITION`, `VALIDATION_ERROR`, `STOCK_NOT_ENOUGH`.

Verify: network panel-free manual test shows a skeleton for at least 200 ms.

### Step 7 — Wire the handlers into the switch

Files: `src/api/index.ts`

- Replace the Phase 0 stubs on both sides so `mocks` is complete and `http` still throws `NOT_IMPLEMENTED`.
- Confirm `useMocks` reads `VITE_USE_MOCKS` only, not a hardcoded value.

Verify: with `VITE_USE_MOCKS=true`, `getPublicMenu('demo-meja')` resolves; with the flag off it throws `NOT_IMPLEMENTED`.

### Step 8 — Add the production build guard

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
- [ ] Order create → lookup → cancel works in memory.
- [ ] Cancel of a non-`PENDING` item returns `INVALID_TRANSITION`.
- [ ] Every handler has 200–500 ms latency.
- [ ] `VITE_USE_MOCKS=true npm run build` fails.
- [ ] `npm run lint && npm run format:check && npm run build` pass with the flag off.

## Exit Criteria

- [ ] All four API functions resolve from `@/api` without a backend.
- [ ] Mock signatures match `docs/tech-stack.md` Public API exactly.
- [ ] Phase 2 can start with no UI-facing API changes expected.

## Gotchas

- Store state is module-level and resets on reload; that is fine for slicing.
- Do not add a mock endpoint that `fnb-server` does not expose.
- Keep mock money in integer rupiah and compute fixtures by hand; do not import a formatter into data files.
