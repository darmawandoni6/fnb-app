# QR Menu Tech Stack

## Scope

`fnb-qr-menu` is the public customer SPA. It shows the menu for one table and lets a customer submit and track an order without login. It talks to the Go API in `fnb-server` over HTTP JSON using the envelope in `../docs/api-response.md`. Product scope is defined in `../docs/PRD.md` §2.3 and §7.1. The screen slicing is adapted from `/home/doni/me/iul-fnb/apps/qr-menu` (six customer screens), see `docs/qr-menu-structure.md`.

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
- The table is identified by the `meja` query parameter, which carries a `qr_token`; `POST /public/tables/:qr_token/sessions` exchanges it for a `session_token`.
- The session token is stored in `localStorage` and sent as `X-Session-Token` on every public call except the session open. A `401 UNAUTHORIZED` re-opens the session from the stored `qr_token` once; a `404 NOT_FOUND` routes to `/tidak-valid`.
- Orders are identified by `id` inside the session; there is no `tracking_token`.
- MVP updates: polling the order list every 5 seconds with TanStack Query; no WebSocket or SSE (PRD v1 ships WebSocket with polling fallback — polling ships first, WS is a follow-up).
- Polling runs while the tab is active; default TanStack behavior pauses when the tab is hidden.
- Mobile-first layout: the menu is designed for phones, not desktop dashboards.
- Money is integer rupiah; QR Menu never computes prices, tax, or totals — the server does, and the cart shows unit prices only.
- Order status is read from the API aggregate; the client never recalculates it.

## Screens

Adapted from the iul reference; routes and search params are defined in `docs/qr-menu-structure.md`.

| Screen       | Route           | Source of data                                                   |
| ------------ | --------------- | ---------------------------------------------------------------- |
| Menu home    | `/`             | `POST /public/tables/:qr_token/sessions` then `GET /public/menu` |
| Menu detail  | `/menu/:menuId` | same menu query (cache)                                          |
| Cart         | `/keranjang`    | session store + menu query + checkout form                       |
| Order status | `/status`       | `GET /public/orders`, the session list polled for the open flow  |
| Invalid QR   | `/tidak-valid`  | `404` from the session open                                      |
| Store closed | `/tutup`        | `is_open = false`                                                |

## Mock Switch

`src/api/index.ts` picks the mock or HTTP implementation at module load from `VITE_USE_MOCKS`. Components and hooks import only from `@/api`, so Phase 3 changes no component.

- Mock scenarios are selected at session open by `qr_token` (`demo-meja` open, `demo-tutup` `is_open = false`, `demo-habis` `STOCK_NOT_ENOUGH`, `demo-invalid` 404) and bound to the issued `session_token`.
- A production build with `VITE_USE_MOCKS=true` fails in `vite.config.ts`.
- `src/mocks/` stays in the repo after integration, disabled by default.

## Customer Session

One versioned record in `localStorage` under `fnb-qr-menu:session`.

```ts
type CartLine = { menuId: string; qty: number; note: string }

type TrackedOrder = {
  id: string
  snapshot: OrderStatusResponse
}

type CustomerSession = {
  v: 1
  qr: string
  sessionToken: string
  cart: CartLine[]
  orders: TrackedOrder[]
  browseOnly: boolean
  invalidTable: string | null
  updatedAt: string
}
```

Read with `useSyncExternalStore`; write with `update(draft => ...)`. A different `qr` resets `cart`, `orders`, and `sessionToken`. No credentials are stored.

`orders` has no size cap and no clear action. Each entry keeps the last full order response in `snapshot` so collapsed cards render without a request; the snapshot is overwritten on every successful refresh.

## Order History

- `/status` lists one card per order, newest first, as an accordion with exactly one card open.
- One `GET /public/orders` poll refreshes every stored card; collapsed cards render their snapshot between polls.
- Scanning a different table QR clears `cart`, `orders`, and `sessionToken` and raises a "new table session" toast.
- Cancellation is order-level and only while the order is `MENUNGGU` with `payment_status` `BELUM`; there is no refund warning in v1.

## Cart Rules

- A line is one menu plus one note; the same menu with the same note (trimmed, case-insensitive) merges into one line.
- `MAX_QTY` is 50 per line; `NOTE_MAX` is 120 characters even though the API allows 255.
- Line key is `` `${menuId}|${note.trim().toLowerCase()}` ``.
- The cart shows unit prices only. No subtotal, service, tax, or total is computed — `api.md` forbids it. The footer reads "N item · total dihitung kasir".
- Lines whose menu is missing from the menu response are hidden and dropped from the submit payload.
- The checkout form collects `customer_name` (required), `customer_phone` (optional), and `payment_method` (`CASH` / `NON_CASH`). Only the server computes money; the form never shows a preview total.
- `NON_CASH` submit stores the order, then navigates to the returned `payment_url` (Midtrans Snap).

## Public API

| Method | Endpoint                            | Purpose                                                                                             |
| ------ | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `POST` | `/public/tables/:qr_token/sessions` | Open (or resume) a table session; returns `session_token`, `table_number`                           |
| `GET`  | `/public/menu`                      | `cafe_name`, `service_rate`, `tax_rate`, `is_open`, categories and menus                            |
| `POST` | `/public/orders`                    | Create a DINE_IN order in the session; returns `order_number`, totals, `payment_url` for `NON_CASH` |
| `GET`  | `/public/orders`                    | Every order in the session with items, newest first                                                 |
| `POST` | `/public/orders/:id/cancel`         | Cancel the whole order while `MENUNGGU` and `BELUM`, body `{ reason }`                              |

Every endpoint except the session open carries `X-Session-Token`.

Rate limits (per instance, in-memory, keyed by session token unless noted): session open 20/minute per `qr_token`, menu 60/minute, create order 5/minute, orders list 30/minute. A `429` response must back off, not retry immediately.

## Reference Gaps

The iul reference targets a different backend. These mappings are deliberate; the server is unchanged.

| iul                                             | `fnb-server` today                                                                                  | Adaptation                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `GET /public/menu` + `GET /public/tables/:code` | Two steps: `POST /public/tables/:qr_token/sessions`, then `GET /public/menu` with `X-Session-Token` | One session open on entry; `404` from either step means the QR is invalid |
| `order.timeline`                                | Not returned                                                                                        | Stepper is derived from item statuses; no timestamps                      |
| `tableNumber` in the menu response              | Returned only by the session open, not by the menu                                                  | Header shows `cafe_name` only                                             |
| `cafe.hours`                                    | Only `settings.is_open`                                                                             | `/tutup` is driven by `is_open` alone                                     |
| `popularMenuIds`, `tags`, `description`         | Not returned                                                                                        | Popular strip and tags dropped                                            |
| Client `orderTotals()`                          | Server returns totals in every order response                                                       | Client displays server figures only                                       |
| `@starter/shared` workspace package             | No shared package                                                                                   | Helpers live in `src/lib/`                                                |
| Per-order tracking view                         | `GET /public/orders` returns the whole session                                                      | One list query refreshes every stored card                                |
| WebSocket `session:{token}` topic               | Exists on the server, deferred in this plan                                                         | Polling ships first; WS is a follow-up                                    |

## Polling Rules

- `/status` polls `GET /public/orders` once every 5 seconds while any stored order is unfinished.
- The single list response refreshes every stored snapshot; collapsed cards render their snapshot between polls.
- Polling stops when every stored order is `SELESAI` or `DIBATALKAN`, or the component unmounts.
- Polling respects the 30/minute orders limit per session: one 5-second poll is 12/minute.
- Mutations (cancel) update the stored snapshot and the list query so changes appear immediately.
- The menu query (`GET /public/menu`) polls every 15 seconds and stops once `is_open` is `false`, so a store closed mid-browse lands on `/tutup` without waiting for a checkout attempt.
- No background polling on other paths.
- A `429` skips the next interval instead of retrying immediately.

## Error Handling

- Map envelope error codes to UI behavior; never match message text:
  - `UNAUTHORIZED`: the session token is missing, unknown, or closed — re-open the session from the stored `qr_token` once and retry; if the re-open returns `404`, route to `/tidak-valid`.
  - `STORE_CLOSED`: show `/tutup` or a browse-only state and toast the server `message`.
  - `VALIDATION_ERROR`: show inline form errors (checkout form) or toast the server `message`.
  - `STOCK_NOT_ENOUGH`: toast the server `message` and refetch the menu.
  - `NOT_FOUND`: route to `/tidak-valid` for the session open; other lookups toast the server `message`.
  - `INVALID_TRANSITION`: the cancel was rejected (order no longer `MENUNGGU` + `BELUM`) — toast the server `message` and refresh.
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
- WebSocket or SSE: PRD v1 ships WebSocket with polling fallback; this plan ships the polling fallback first and records WS as a follow-up.
- Authentication or role guards: customers never log in.
- Chart or date libraries: use `Intl` first.
- Storybook.
- Playwright E2E: add after the MVP flow is stable.

Add them only when a measured requirement or product decision requires them.
