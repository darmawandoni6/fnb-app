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

| Route           | Search params      | Purpose                                             |
| --------------- | ------------------ | --------------------------------------------------- |
| `/`             | `?meja=<qr_token>` | Menu home: cafe name, search, categories, quick add |
| `/menu/:menuId` | `?edit=<lineKey>`  | Menu detail: qty, note, add or save the cart line   |
| `/keranjang`    | —                  | Cart lines, qty, notes, submit                      |
| `/status`       | —                  | Order status and item statuses, polling             |
| `/tidak-valid`  | —                  | Table QR is missing, unknown, or inactive           |
| `/tutup`        | —                  | Store is closed (`is_open = false`)                 |
| `*`             | —                  | Not found; redirect to `/`                          |

Route guards:

- `/` with no `meja` and no session `qr` redirects to `/tidak-valid`.
- `/` resolving `GET /public/tables/:qr_token/menu` with `404 NOT_FOUND` redirects to `/tidak-valid`.
- `/` redirects to `/tutup` when `is_open` is `false` and the customer has not chosen browse-only.
- `/status` with no stored order redirects to `/`.
- `/menu/:menuId` with an unknown menu id redirects to `/`.

`?meja` is applied to the session on the first load, then removed from the URL so a reload keeps the session.

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
│   │   │   └── useUrlTable.ts
│   │   ├── catalog/
│   │   │   ├── api.ts
│   │   │   ├── queries.ts
│   │   │   └── hooks.ts
│   │   ├── checkout/
│   │   │   ├── pages/CartPage.tsx
│   │   │   ├── pages/ClosedPage.tsx
│   │   │   ├── pages/InvalidTablePage.tsx
│   │   │   ├── components/CartLineRow.tsx
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
│   │   └── cart.ts
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
- `schemas/`: Zod schemas for the cart and menu detail forms.
- `types/`: domain types shared across features.

## Session Store

```ts
import { useCallback, useSyncExternalStore } from 'react'

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

const [session, update] = useCustomerSession()
update((draft) => {
  draft.cart.push({ menuId, qty: 1, note: '' })
})
```

Rules:

- One key, `SESSION_STORAGE_KEY` in `src/constants/storage.ts` (`fnb-qr-menu:session`).
- Validate the stored version with `v === 1`; anything else starts from an empty session.
- Storage failures (private mode, quota) fall back to memory without throwing.
- A different `qr` than the stored one resets the cart and orders.
- `orders` grows without a cap; no clear action exists in the UI.

## Cart Rules

- A line is one menu plus one note; equal `menuId|note.trim().toLowerCase()` merges.
- `MAX_QTY` 50 per line, `NOTE_MAX` 120.
- Editing a line with a note that already exists on the same menu merges the two.
- Lines whose menu disappeared from the menu response are hidden and dropped from the submit payload.
- The cart shows unit prices only. No subtotal, tax, or total is computed in the client; the footer reads "N item · total dihitung kasir".

## Order History

- `session.orders` is an append-only array with no size cap and no clear action.
- Each entry is `{ id, trackingToken, snapshot }`; `snapshot` holds the last full order response and is overwritten on every successful refresh.
- `/status` renders one accordion card per order, newest first; exactly one card is open.
- Only the open card polls; collapsed cards read `snapshot`.
- Scanning a different table QR clears `cart` and `orders`.

## Runtime Rules

- The status screen polls only the open order card, every 5 seconds.
- Polling stops on unmount and when the open order is `SELESAI` or `DIBATALKAN`.
- The backend calculates order status from item statuses and payment status.
- The UI does not change order status directly.
- The customer may cancel only `PENDING` items; a `LUNAS` order adds a refund warning to the confirmation.
- `CANCELLED` items stay visible, crossed out.
- Ordering is disabled while `is_open` is `false`.
- Prices, tax, and totals always come from the server.
