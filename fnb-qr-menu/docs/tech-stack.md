# QR Menu Tech Stack

## Scope

`fnb-qr-menu` is the public customer SPA. It shows the menu for one table and lets a customer submit and track an order without login. It talks to the Go API in `fnb-server` over HTTP JSON using the envelope in `../docs/api-response.md`. Product scope is defined in `../docs/PRD.md` §2.3 and §6.1. The screen slicing is adapted from `/home/doni/me/iul-fnb/apps/qr-menu` (six customer screens), see `docs/qr-menu-structure.md`.

## Selected Stack

| Area          | Technology                                                                | Reason                                                            |
| ------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Build tool    | Vite                                                                      | Fast dev server, native ESM, SPA build                            |
| UI framework  | React                                                                     | Component model, large ecosystem                                  |
| Language      | TypeScript (strict)                                                       | Static typing across API and UI state                             |
| Routing       | React Router (`react-router-dom`)                                         | Map, cart, menu detail, tracking, and closed states               |
| Server state  | TanStack Query                                                            | Polling via `refetchInterval`, `queryOptions`, caching            |
| HTTP client   | Axios                                                                     | Interceptors for the base URL, envelope unwrapping, error mapping |
| Forms         | React Hook Form                                                           | Cart note and qty inputs on the menu detail screen                |
| Validation    | Zod + `@hookform/resolvers`                                               | Schema is the single source for validation and inferred types     |
| UI components | shadcn/ui                                                                 | Source-owned accessible components on Radix primitives            |
| Styling       | Tailwind CSS v4                                                           | Utility styling; iul design tokens ported into `@theme`           |
| Icons         | lucide-react                                                              | Default shadcn icon library                                       |
| Testing       | Vitest                                                                    | Unit tests for cart, session store, and polling predicate         |
| Linting       | Oxlint                                                                    | Fast static checks                                                |
| Formatting    | Prettier + `prettier-plugin-sort-imports` + `prettier-plugin-tailwindcss` | Consistent formatting, sorted imports, sorted Tailwind classes    |

Single Page Application only. No SSR, no `@tanstack/react-router`, no `@tanstack/react-start`, no nitro.

## Runtime

- Local API base URL: `http://localhost:8081` via `VITE_API_URL`.
- Mocks enabled with `VITE_USE_MOCKS=true`.
- All responses follow the `{success, data}` / `{success, error{code, message}}` envelope.
- The table is identified by the `meja` query parameter, which carries a `qr_token`.
- The order is identified by the `tracking_token` returned once by `POST /public/tables/:qr_token/orders`; `order_id` is stored alongside so a card can key on it.
- MVP updates: polling every 5 seconds with TanStack Query; no WebSocket or SSE.
- Polling runs while the tab is active; default TanStack behavior pauses when the tab is hidden.
- Mobile-first layout: the menu is designed for phones, not desktop dashboards.
- Money is integer rupiah; QR Menu never computes prices, tax, or totals — the server does, and the cart shows unit prices only.
- Order status is read from the API aggregate; the client never recalculates it.

## Screens

Adapted from the iul reference; routes and search params are defined in `docs/qr-menu-structure.md`.

| Screen       | Route           | Source of data                                                 |
| ------------ | --------------- | -------------------------------------------------------------- |
| Menu home    | `/`             | `GET /public/tables/:qr_token/menu`                            |
| Menu detail  | `/menu/:menuId` | same menu query (cache)                                        |
| Cart         | `/keranjang`    | session store + menu query                                     |
| Order status | `/status`       | `GET /public/orders/:tracking_token`, polled for the open card |
| Invalid QR   | `/tidak-valid`  | 404 from the menu endpoint                                     |
| Store closed | `/tutup`        | `is_open = false`                                              |

## Mock Switch

`src/api/index.ts` picks the mock or HTTP implementation at module load from `VITE_USE_MOCKS`. Components and hooks import only from `@/api`, so Phase 3 changes no component.

- Mock scenarios are selected by `qr_token`: `demo-meja` (open), `demo-tutup` (`is_open = false`), `demo-habis` (`STOCK_NOT_ENOUGH`), `demo-invalid` (404).
- A production build with `VITE_USE_MOCKS=true` fails in `vite.config.ts`.
- `src/mocks/` stays in the repo after integration, disabled by default.

## Customer Session

One versioned record in `localStorage` under `fnb-qr-menu:session`.

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

Read with `useSyncExternalStore`; write with `update(draft => ...)`. A different `qr` resets `cart` and `orders`. No credentials are stored.

`orders` has no size cap and no clear action. Each entry keeps the last full order response in `snapshot` so collapsed cards render without a request; the snapshot is overwritten on every successful refresh.

## Order History

- `/status` lists one card per order, newest first, as an accordion with exactly one card open.
- Only the open card polls; collapsed cards use `snapshot`.
- Scanning a different table QR clears `cart` and `orders` and raises a "new table session" toast.

## Cart Rules

- A line is one menu plus one note; the same menu with the same note (trimmed, case-insensitive) merges into one line.
- `MAX_QTY` is 50 per line; `NOTE_MAX` is 120 characters even though the API allows 255.
- Line key is `` `${menuId}|${note.trim().toLowerCase()}` ``.
- The cart shows unit prices only. No subtotal, tax, or total is computed — `api.md` forbids it. The footer reads "N item · total dihitung kasir".
- Lines whose menu is missing from the menu response are hidden and dropped from the submit payload.

## Public API

| Method | Endpoint                                | Purpose                                                            |
| ------ | --------------------------------------- | ------------------------------------------------------------------ |
| `GET`  | `/public/tables/:qr_token/menu`         | Available menus, categories, `is_open`, `cafe_name`, `tax_percent` |
| `POST` | `/public/tables/:qr_token/orders`       | Create one QR order; returns `order_id` and `tracking_token` once  |
| `GET`  | `/public/orders/:tracking_token`        | Order status and each item status                                  |
| `POST` | `/public/orders/:tracking_token/cancel` | Cancel one `PENDING` item                                          |

Rate limits: 60/minute menu per `qr_token`, 5/minute order per `qr_token`, 30/minute status per client IP. A `429` response must back off, not retry immediately.

## Reference Gaps

The iul reference targets a different backend. These mappings are deliberate; the server is unchanged.

| iul                                             | `fnb-server` today                                            | Adaptation                                                          |
| ----------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `GET /public/menu` + `GET /public/tables/:code` | Menu is bound to a table: `GET /public/tables/:qr_token/menu` | One request; 404 means the QR is invalid                            |
| `POST /public/orders`                           | `POST /public/tables/:qr_token/orders`                        | `qr_token` comes from the session                                   |
| `GET /public/orders/:id`                        | `GET /public/orders/:tracking_token`                          | Lookup by tracking token hash                                       |
| `order.timeline`                                | Not returned                                                  | Stepper is derived from the aggregate `status` only                 |
| `tableNumber` in responses                      | Not returned                                                  | Table label omitted; header shows `cafe_name` only                  |
| `cafe.hours`                                    | Only `settings.is_open`                                       | `/tutup` is driven by `is_open` alone                               |
| `popularMenuIds`, `tags`, `description`         | Not returned                                                  | Popular strip and tags dropped                                      |
| Client `orderTotals()`                          | Server returns totals                                         | Client displays server figures only                                 |
| `@starter/shared` workspace package             | No shared package                                             | Helpers live in `src/lib/`                                          |
| Order history in the session                    | API has no order list endpoint                                | Client keeps `orders[]` in `localStorage`; only the open card polls |

## Polling Rules

- `/status` polls only the currently open card, every 5 seconds.
- Collapsed cards render from `snapshot` and never poll.
- Stop polling when the open order is `SELESAI`, `DIBATALKAN`, or the component unmounts.
- Polling respects the 30/minute status rate limit per IP: one open card at 5 seconds is 12/minute.
- Mutations invalidate the tracked-order query so updates appear immediately.
- No background polling outside `/status`.

## Error Handling

- Map envelope error codes to UI behavior; never match message text:
  - `STORE_CLOSED`: show `/tutup` or a browse-only state and toast the server `message`.
  - `VALIDATION_ERROR`: show inline form errors.
  - `STOCK_NOT_ENOUGH`: toast the server `message` and refetch the menu.
  - `NOT_FOUND`: route to `/tidak-valid` for menu lookups and show the invalid-order state for tracking.
  - `INTERNAL_ERROR`: generic retry state.
- Display the server `message`; use `code` for logic branches.
- Never log tokens or full API responses.

## Styling

- iul tokens are ported to Tailwind v4 `@theme` in `src/index.css`: canvas `#fbf5f0`, surface `#ffffff`, accent `#fa5d00`, text `#1d1e1c`, muted `#6a696a`, border `rgb(29 30 28 / 10%)`.
- Fonts: `--font-ui` Inter, `--font-editorial` IBM Plex Serif.
- iul `pl-*` / `pc-*` classes are not copied; the same visual structure is rebuilt with Tailwind utilities and shadcn components.
- Touch targets are at least 44×44 CSS pixels.

## Deliberately Excluded

Do not add these for MVP:

- SSR, `@tanstack/react-router`, `@tanstack/react-start`, nitro.
- Redux or Zustand: the versioned session store covers customer state.
- WebSocket or SSE: PRD specifies polling for MVP.
- Authentication or role guards: customers never log in.
- Chart or date libraries: use `Intl` first.
- Storybook.
- Playwright E2E: add after the MVP flow is stable.

Add them only when a measured requirement or product decision requires them.
