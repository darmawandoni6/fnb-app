# FNB Dashboard Naming Conventions

## Scope

Naming conventions for constants, variables, components, files, folders, environment variables, and API functions in `fnb-dashboard`.

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

export const POLL_INTERVAL_MS = 4_000
```

Rules:

- Use one file per domain, for example `orderStatus.ts`.
- Use `as const` for value maps.
- Do not place magic strings or numbers in components.
- A constant used by only one function may remain near that function, using `SCREAMING_SNAKE_CASE`.
- Use `Object.freeze` only when needed; `as const` is sufficient for compile-time safety.

## Variables

Use `camelCase` for variables, functions, parameters, and local properties.

```ts
const activeOrders = orders.filter(isActive)
const selectedOrderId = order.id
```

Boolean names must use a prefix that describes the condition:

```ts
const isPaid = paymentStatus === PAYMENT_STATUS.LUNAS
const hasPermission = permissions.includes(permission)
const canCancel = item.status === ITEM_STATUS.PENDING
const shouldPoll = isAuthenticated && isOrdersPage
```

Avoid short or unclear names:

```ts
// Bad
const d = data
const x = orders

// Good
const orderResponse = data
const pendingOrders = orders
```

## Components, Hooks, and Types

- React components: `PascalCase`, for example `OrderCard.tsx`.
- Function components: `PascalCase`, for example `function OrderCard()`.
- Custom hooks: `camelCase` with a `use` prefix, for example `useOrdersPolling.ts`.
- Types and interfaces: `PascalCase`, for example `Order`, `OrderItem`.
- Props types: `[ComponentName]Props`, for example `OrderCardProps`.
- Type guards: `is` prefix, for example `isApiError`.
- Event handlers: `handle` prefix, for example `handlePaymentSubmit`.
- Callback props: `on` prefix, for example `onStatusChange`.

```ts
type OrderCardProps = {
  order: Order
  onStatusChange: (itemId: string, status: ItemStatus) => void
}

function OrderCard({ order, onStatusChange }: OrderCardProps) {
  function handleStatusChange(status: ItemStatus) {
    onStatusChange(order.id, status)
  }

  return null
}
```

## Files and Folders

- Components: `PascalCase.tsx`.
- Hooks: `camelCase.ts`.
- Utilities: `camelCase.ts`.
- Constant files: `camelCase.ts`, exporting uppercase constants.
- Type files: `camelCase.ts`.
- Feature folders: lowercase plural or domain name, for example `orders/`, `payments/`.

## Environment Variables

Vite only exposes variables with the `VITE_` prefix.

```ts
const apiUrl = import.meta.env.VITE_API_URL
```

`.env.example`:

```env
VITE_API_URL=http://localhost:8080/api/v1
```

Never put secrets in `VITE_*` variables; their values are included in the browser bundle.

## API Naming

- API functions: verb + resource, for example `getOrders`, `createManualOrder`.
- Mutation functions: `markOrderAsPaid`, `updateOrderItemStatus`.
- Response DTOs: `Response` suffix when they differ from the domain type.
- Request DTOs: `Request` suffix.
- Error type: `ApiError`.

```ts
export type CreateManualOrderRequest = {
  items: CreateManualOrderItemRequest[]
}

export async function createManualOrder(request: CreateManualOrderRequest): Promise<Order> {
  // Send request through the API client.
}
```

## Status and Role Values

Use constant maps instead of repeating string literals.

```ts
if (user.role === USER_ROLE.CASHIER) {
  // Cashier-only UI.
}

if (item.status === ITEM_STATUS.READY) {
  // Allow delivery action.
}
```

## Formatting

- Use the project formatter and linter.
- Use single quotes when required by the project configuration.
- Avoid lines longer than the formatter configuration allows.
- Group imports as external packages, internal aliases, then relative imports.
- Remove unused imports and variables.
