# FNB QR Menu Structure

## Scope

Folder and runtime structure for the public `fnb-qr-menu` application. Based on `../docs/PRD.md` §2.3, `docs/tech-stack.md`, and the screen slicing of `/home/doni/me/iul-fnb/apps/qr-menu` adapted to `fnb-server`.

## Technology

- React
- Vite
- TypeScript with `strict: true`
- Single Page Application (SPA)
- `react-router-dom` for routing; no SSR and no `@tanstack/react-router`
- No authentication and no role guards
- Mobile-first, designed for phone browsers

## Routes

| Route           | Search params      | Purpose                                                           |
| --------------- | ------------------ | ----------------------------------------------------------------- |
| `/`             | `?meja=<qr_token>` | Menu home: open session, cafe name, search, categories, quick add |
| `/menu/:menuId` | `?edit=<lineKey>`  | Menu detail: qty, note, add or save the cart line                 |
| `/keranjang`    | —                  | Cart lines, qty, notes, checkout form, submit                     |
| `/status`       | —                  | Order status and item statuses, list polling                      |
| `/tidak-valid`  | —                  | Table QR is missing, unknown, or inactive                         |
| `/tutup`        | —                  | Store is closed (`is_open = false`)                               |
| `*`             | —                  | Not found; redirect to `/`                                        |

Route guards:

- `/` with no `meja` and no session `qr` redirects to `/tidak-valid`.
- `/` with a stored `qr` but no `sessionToken` re-opens the session from `qr` before loading the menu.
- `/` calls `POST /public/tables/:qr_token/sessions`; a `404 NOT_FOUND` (unknown or deactivated table) redirects to `/tidak-valid`.
- A stored `session_token` that returns `401 UNAUTHORIZED` is re-opened once from the stored `qr_token`; a `404` on the re-open redirects to `/tidak-valid`.
- `/` redirects to `/tutup` when `is_open` is `false` and the customer has not chosen browse-only.
- `/status` with no stored order redirects to `/`.
- `/menu/:menuId` with an unknown menu id redirects to `/`.
- `/keranjang` and `/status` show a header back link to `/`; `/tutup` and `/tidak-valid` are dead ends by design.

`?meja` is applied to the session on the first load (session open), then removed from the URL so a reload keeps the session.

## Folder Structure

```text
fnb-qr-menu/
├── AGENTS.md
├── docs/
│   ├── ai-rules.md
│   ├── conventions.md
│   ├── implementation-plan.md
│   ├── implementation/
│   │   ├── phase-0.md
│   │   ├── phase-1.md
│   │   ├── phase-2.md
│   │   ├── phase-2.5.md
│   │   ├── phase-2.6.md
│   │   ├── phase-3.md
│   │   └── phase-4.md
│   ├── qr-menu-structure.md
│   └── tech-stack.md
├── public/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   ├── index.ts
│   │   ├── client.ts
│   │   ├── session.ts
│   │   ├── publicMenu.ts
│   │   ├── publicOrders.ts
│   │   └── types.ts
│   ├── components/
│   │   └── ui/
│   ├── constants/
│   │   ├── cart.ts
│   │   ├── errors.ts
│   │   ├── itemStatus.ts
│   │   ├── mockTokens.ts
│   │   ├── orderStatus.ts
│   │   ├── paymentMethod.ts
│   │   ├── paymentStatus.ts
│   │   ├── queryKeys.ts
│   │   ├── routes.ts
│   │   └── storage.ts
│   ├── features/
│   │   ├── browse/
│   │   │   ├── pages/MenuHomePage.tsx
│   │   │   ├── pages/MenuDetailPage.tsx
│   │   │   ├── components/MenuItemCard.tsx
│   │   │   ├── components/CategoryTabs.tsx
│   │   │   ├── components/SearchField.tsx
│   │   │   ├── components/CartBar.tsx
│   │   │   ├── cart.ts
│   │   │   └── useTableSession.ts
│   │   ├── catalog/
│   │   │   ├── api.ts
│   │   │   ├── queries.ts
│   │   │   └── hooks.ts
│   │   ├── checkout/
│   │   │   ├── pages/CartPage.tsx
│   │   │   ├── pages/ClosedPage.tsx
│   │   │   ├── pages/InvalidTablePage.tsx
│   │   │   ├── components/CartLineRow.tsx
│   │   │   ├── components/CheckoutForm.tsx
│   │   │   ├── components/PageToast.tsx
│   │   │   └── hooks.ts
│   │   ├── orders/
│   │   │   ├── api.ts
│   │   │   ├── status.ts
│   │   │   ├── pages/StatusPage.tsx
│   │   │   ├── components/OrderCard.tsx
│   │   │   ├── components/StatusStepper.tsx
│   │   │   └── components/OrderItemRow.tsx
│   │   └── session/
│   │       └── store.ts
│   ├── lib/
│   │   ├── apiError.ts
│   │   ├── formatRupiah.ts
│   │   ├── mode.ts
│   │   └── useNow.ts
│   ├── mocks/
│   │   ├── data/
│   │   ├── handlers/
│   │   └── index.ts
│   ├── schemas/
│   │   └── checkout.ts
│   ├── types/
│   │   ├── api.ts
│   │   ├── menu.ts
│   │   └── order.ts
│   └── index.css
├── .env.example
├── components.json
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Folder Rules

- `api/`: HTTP requests and response DTOs. Components must not call `fetch` directly.
- `api/index.ts`: the single mock/HTTP switch; everything else imports from here.
- `constants/`: fixed values shared across features, including cart limits, the storage key, and mock table tokens.
- `features/`: code organized by business domain, mirroring the iul reference (`browse`, `catalog`, `checkout`, `orders`, `session`).
- `features/session/store.ts`: the single customer session store backed by `localStorage`.
- `components/ui/`: shadcn source-owned components.
- `lib/`: pure utility functions.
- `mocks/`: mock handlers and fixtures with the same signatures as `api/`.
- `schemas/`: Zod schemas for the checkout and menu detail forms.
- `types/`: domain types shared across features.

## Session Store

```ts
import { useCallback, useSyncExternalStore } from 'react'

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

const [session, update] = useCustomerSession()
update((draft) => {
  draft.cart.push({ menuId, qty: 1, note: '' })
})
```

Rules:

- One key, `SESSION_STORAGE_KEY` in `src/constants/storage.ts` (`fnb-qr-menu:session`).
- Validate the stored version with `v === 1`; anything else starts from an empty session.
- Storage failures (private mode, quota) fall back to memory without throwing.
- A different `qr` than the stored one resets the cart, orders, and `sessionToken`.
- `sessionToken` comes from `POST /public/tables/:qr_token/sessions` and is sent as `X-Session-Token`; on `401` the client re-opens it once from `qr`.
- `orders` grows without a cap; no clear action exists in the UI.

## Cart Rules

- A line is one menu plus one note; equal `menuId|note.trim().toLowerCase()` merges.
- `MAX_QTY` 50 per line, `NOTE_MAX` 120.
- Editing a line with a note that already exists on the same menu merges the two.
- Lines whose menu disappeared from the menu response are hidden and dropped from the submit payload.
- The cart shows unit prices only. No subtotal, service, tax, or total is computed in the client; the footer reads "N item · total dihitung kasir".
- The checkout form collects `customer_name` (required), `customer_phone` (optional), and `payment_method` (`CASH` / `NON_CASH`).
- On success the order is written to `session.orders` first; `NON_CASH` then navigates to the returned `payment_url` (Midtrans Snap), `CASH` navigates to `/status`.

## Order History

- `session.orders` is an append-only array with no size cap and no clear action.
- Each entry is `{ id, snapshot }`; `snapshot` holds the last full order response and is overwritten on every successful list refresh.
- `/status` renders one accordion card per order, newest first; exactly one card is open.
- One `GET /public/orders` poll every 5 seconds refreshes every stored card; collapsed cards render their snapshot between polls.
- Scanning a different table QR clears `cart`, `orders`, and `sessionToken`.

## Runtime Rules

- The status screen polls the session's order list every 5 seconds while any stored order is unfinished.
- Polling stops on unmount and when every stored order is `SELESAI` or `DIBATALKAN`.
- The backend calculates order status from item statuses and payment status; the stepper derives its labels from item statuses.
- The UI does not change order status directly.
- The customer may cancel a whole order only while it is `MENUNGGU` with `payment_status` `BELUM`, with an optional reason; there is no refund warning in v1.
- `CANCELLED` items stay visible, crossed out.
- `/` shows a `Receipt` icon in the header when `session.orders` is non-empty; the badge counts orders still `MENUNGGU`/`DIPROSES` and hides at `0`. The badge reads stored snapshots; `/` does not poll.
- Header slots are optional: `leading` for the back link on `/keranjang` and `/status`, `trailing` for the order-history entry on `/`.
- Ordering is disabled while `is_open` is `false`.
- Prices, service, tax, and totals always come from the server.
