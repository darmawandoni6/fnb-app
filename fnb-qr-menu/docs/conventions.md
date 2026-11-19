# FNB QR Menu Naming Conventions

## Scope

Naming conventions for constants, variables, components, files, folders, environment variables, and API functions in `fnb-qr-menu`. Mirrors `../../fnb-dashboard/docs/conventions.md` unless a rule below differs.

## Constants

Use `SCREAMING_SNAKE_CASE` for constant names.

Place constants shared across features in `src/constants/`.

```ts
export const ORDER_STATUS = {
  MENUNGGU: 'MENUNGGU',
  DIPROSES: 'DIPROSES',
  SIAP: 'SIAP',
  DIANTAR: 'DIANTAR',
  SELESAI: 'SELESAI',
  DIBATALKAN: 'DIBATALKAN',
} as const

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

export const POLL_INTERVAL_MS = 5_000
export const SESSION_STORAGE_KEY = 'fnb-qr-menu:session'
export const TABLE_QUERY_PARAM = 'meja'
export const EDIT_QUERY_PARAM = 'edit'
export const MAX_QTY = 50
export const NOTE_MAX = 120

export const MOCK_TABLE_TOKEN = {
  OPEN: 'demo-meja',
  CLOSED: 'demo-tutup',
  OUT_OF_STOCK: 'demo-habis',
  INVALID: 'demo-invalid',
} as const
```

Rules:

- Use one file per domain, for example `orderStatus.ts`, `cart.ts`, `storage.ts`.
- Use `as const` for value maps.
- Do not place magic strings or numbers in components.
- A constant used by only one function may remain near that function, using `SCREAMING_SNAKE_CASE`.

## Variables

Use `camelCase` for variables, functions, parameters, and local properties.

```ts
const visibleCategories = categories.filter(hasMenus)
const activeLine = cart.find((line) => lineKey(line) === editKey)
```

Boolean names must use a prefix that describes the condition:

```ts
const isOpen = menu.isOpen
const hasOrder = session.orders.length > 0
const canCancel = item.status === ITEM_STATUS.PENDING
const isBrowseOnly = session.browseOnly
```

Avoid short or unclear names:

```ts
// Bad
const d = data
const l = lines

// Good
const menuResponse = data
const cartLines = lines
```

## Components, Hooks, and Types

- React components: `PascalCase`, for example `MenuItemCard.tsx`.
- Function components: `PascalCase`, for example `function MenuItemCard()`.
- Custom hooks: `camelCase` with a `use` prefix, for example `useCustomerSession.ts`, `useTrackedOrder.ts`.
- Types and interfaces: `PascalCase`, for example `PublicMenu`, `Order`, `CustomerSession`, `CartLine`.
- Props types: `[ComponentName]Props`, for example `MenuItemCardProps`.
- Type guards: `is` prefix, for example `isApiError`.
- Event handlers: `handle` prefix, for example `handleAddToCart`.
- Callback props: `on` prefix, for example `onQtyChange`.
- Cart helpers: verb-first, for example `addToCart`, `saveCartLine`, `cartLines`, `qtyOf`, `lineKey`.

```ts
type MenuItemCardProps = {
  menu: Menu
  qty: number
  onAdd: (menuId: string) => void
}

function MenuItemCard({ menu, qty, onAdd }: MenuItemCardProps) {
  function handleAdd() {
    onAdd(menu.id)
  }

  return null
}
```

## Session Types

Session names follow the stored record exactly so a reader can map code to `localStorage`.

```ts
type CartLine = { menuId: string; qty: number; note: string }

type TrackedOrder = {
  id: string
  trackingToken: string
  snapshot: OrderStatusResponse
}

type CustomerSession = {
  v: 1
  qr: string
  cart: CartLine[]
  orders: TrackedOrder[]
  browseOnly: boolean
  invalidTable: string | null
  updatedAt: string
}
```

- API field names stay `snake_case` in DTOs and are converted to `camelCase` domain types at the API boundary.
- Storage keys are lowercase kebab with a `fnb-qr-menu:` prefix.
- Order cards are named `OrderCard`, not `TrackedOrderCard`; `TrackedOrder` is the stored shape, `OrderCard` the component.

## Files and Folders

- Components: `PascalCase.tsx`.
- Hooks: `camelCase.ts`.
- Utilities: `camelCase.ts`.
- Constant files: `camelCase.ts`, exporting uppercase constants.
- Type files: `camelCase.ts`.
- Feature folders mirror the iul reference: `browse/`, `catalog/`, `checkout/`, `orders/`, `session/`.
- Screens live in `features/*/pages/`, matching `MenuHomePage.tsx`, `CartPage.tsx`, `StatusPage.tsx`.

## Environment Variables

Vite only exposes variables with the `VITE_` prefix.

```ts
const apiUrl = import.meta.env.VITE_API_URL
const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'
```

`.env.example`:

```env
VITE_API_URL=http://localhost:8081
VITE_USE_MOCKS=true
```

Never put secrets in `VITE_*` variables; their values are included in the browser bundle.

## API Naming

- API functions: verb + resource, for example `getPublicMenu`, `createPublicOrder`.
- Mutation functions: `cancelOrderItem`.
- Query option factories: `menuQuery`, `orderQuery`, following the iul `catalog/queries.ts` shape.
- Response DTOs: `Response` suffix when they differ from the domain type.
- Request DTOs: `Request` suffix.
- Error type: `ApiError`.

```ts
export type CreatePublicOrderRequest = {
  items: CreatePublicOrderItemRequest[]
}

export type CreatePublicOrderResponse = {
  order_id: string
  tracking_token: string
  subtotal_amount: number
  tax_amount: number
  total_amount: number
  status: OrderStatus
}

export async function createPublicOrder(
  qrToken: string,
  request: CreatePublicOrderRequest,
): Promise<CreatePublicOrderResponse> {
  // Send request through the API client.
}
```

## Status and Role Values

Use constant maps instead of repeating string literals.

```ts
if (item.status === ITEM_STATUS.PENDING) {
  // Allow cancel action.
}
```

QR Menu has no roles; do not introduce role constants.

## Formatting

- Use the project formatter and linter.
- Use single quotes, no semicolons, per `.prettierrc`.
- Avoid lines longer than the formatter configuration allows.
- Group imports as external packages, internal aliases, then relative imports.
- Remove unused imports and variables.

## Test Files

- Unit tests sit beside the source file: `cart.test.ts` next to `cart.ts`.
- Test names describe behaviour, not implementation: `merges two adds with the same note`.
- Vitest only; no RTL and no Playwright.
