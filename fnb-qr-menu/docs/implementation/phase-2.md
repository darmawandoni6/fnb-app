# Phase 2 — Shell, Session, Menu Home, Menu Detail

Granular plan for Phase 2 of `../implementation-plan.md`.

Goal: the app shell, the versioned customer session store, and the two browsing screens working against the mock. Cart, status, and closed/invalid screens are Phases 2.5 and 2.6.

## Prerequisites

- Phase 1 complete: mock handlers resolve from `@/api`.
- Docs read: `docs/qr-menu-structure.md` (Routes, Session Store, Cart Rules).

## Steps

### Step 1 — Set up `main.tsx`

Files: `src/main.tsx`, `src/App.tsx`

- `QueryClientProvider` with a single `QueryClient`.
- `BrowserRouter` from `react-router-dom`.
- shadcn `Toaster` mounted once.

Verify: the app renders with no console error.

### Step 2 — Define the route table

Files: `src/App.tsx`, `src/constants/routes.ts`

| Route           | Component                      |
| --------------- | ------------------------------ |
| `/`             | `MenuHomePage`                 |
| `/menu/:menuId` | `MenuDetailPage`               |
| `/keranjang`    | `CartPage` (Phase 2.5)         |
| `/status`       | `StatusPage` (Phase 2.6)       |
| `/tidak-valid`  | `InvalidTablePage` (Phase 2.6) |
| `/tutup`        | `ClosedPage` (Phase 2.6)       |
| `*`             | `Navigate to="/"`              |

Create placeholder components for the Phase 2.5/2.6 screens so the router compiles.

Verify: every path renders something and `*` redirects.

### Step 3 — Build the mobile shell

Files: `src/components/AppShell.tsx`

- Sticky header showing `cafe_name` only; the API returns no `table_number`.
- `max-w-xl` container for phones, widening cleanly on tablets.
- Background `bg-canvas`, text `text-text`, font `font-ui`.

Verify: header stays put while content scrolls on a 375px viewport.

### Step 4 — Complete the session store

Files: `src/features/session/store.ts`, `src/constants/storage.ts`

- `SESSION_STORAGE_KEY` `fnb-qr-menu:session`, version `v: 1`.
- `read`, `write`, `subscribe` with a `storage` listener and a module-level cache keyed on the raw string.
- `useCustomerSession()` → `[session, update]` via `useSyncExternalStore`.
- Storage failures fall back to memory; corrupt JSON or an unknown `v` starts empty.
- `orders` is `{ id, trackingToken, snapshot }[]`, no cap, no clear action.

Verify: two tabs stay in sync through the `storage` event.

### Step 5 — Implement session reset semantics

Files: `src/features/session/store.ts`

- A different `qr` than the stored one clears `cart` and `orders`.
- The reset raises a one-shot "new table session" notice for the next screen to consume, mirroring iul's `setFlash`/`takeFlash`.

Verify: writing a new `qr` empties cart and orders and leaves `browseOnly` at its default.

### Step 6 — Implement `useUrlTable`

Files: `src/features/browse/useUrlTable.ts`, `src/constants/storage.ts`

- Read `?meja` with `useSearchParams`.
- Non-empty and different from the session → write it to the session.
- Empty and the session already has a `qr` → keep the session.
- Empty and no session → leave `qr` empty so the home screen can redirect to `/tidak-valid`.
- Strip `meja` from the URL after applying it, so a reload keeps the session.

Verify: visiting `/?meja=demo-meja` leaves the URL at `/` and sets `session.qr`.

### Step 7 — Create the catalog query layer

Files: `src/features/catalog/queries.ts`, `src/features/catalog/api.ts`, `src/features/catalog/hooks.ts`

```ts
export const catalogKeys = { menu: (qr: string) => ['public-menu', qr] as const }

export const menuQuery = (qr: string) =>
  queryOptions({ queryKey: catalogKeys.menu(qr), queryFn: () => getPublicMenu(qr) })

export const usePublicMenu = (qr: string) => useQuery(menuQuery(qr))
```

Import `getPublicMenu` from `@/api`, never from a concrete module.

Verify: the query runs once per `qr` and caches across navigation.

### Step 8 — Create the menu home page

Files: `src/features/browse/pages/MenuHomePage.tsx`

- Apply `useUrlTable()` first.
- Redirect to `/tidak-valid` when `qr` is empty.
- Read the menu; on `404 NOT_FOUND` redirect to `/tidak-valid`.
- When `is_open` is `false` and `browseOnly` is false, redirect to `/tutup`.
- Render categories, search, and the grid.

Verify: `demo-invalid` lands on `/tidak-valid`; `demo-meja` renders the grid.

### Step 9 — Build category tabs and search

Files: `src/features/browse/components/CategoryTabs.tsx`, `src/features/browse/components/SearchField.tsx`

- Tabs: "Semua" plus one per category; keep the selection across navigation with the iul `browseState` pattern.
- Search filters by menu name, case-insensitive; empty result shows an empty state with a clear action.
- Hide categories with no menus in the response.

Verify: searching a nonsense string shows the empty state, not a blank page.

### Step 10 — Build the menu card

Files: `src/features/browse/components/MenuItemCard.tsx`

- Name, price via `formatRupiah`, optional `image_url`, and a quick-add button.
- Two-character initials placeholder when `image_url` is null.
- Quick add writes one line to the cart and shows a confirmation toast.
- Disabled with a closed note when ordering is blocked.

Verify: quick add twice produces one merged line with qty 2.

### Step 11 — Build the cart bar

Files: `src/features/browse/components/CartBar.tsx`

- Sticky bottom bar: item count and a link to `/keranjang`.
- Hidden when the cart is empty.
- Shows no money total.

Verify: adding one item reveals the bar; removing it hides the bar.

### Step 12 — Add the closed banner

Files: `src/features/browse/pages/MenuHomePage.tsx`

- When `browseOnly` is true, show a persistent banner: the store is closed and ordering is disabled.
- Every add button renders disabled in that mode.

Verify: choosing browse-only from `/tutup` returns to `/` with the banner and disabled add buttons.

### Step 13 — Add loading, empty, and error states

Files: `src/features/browse/pages/MenuHomePage.tsx`

- Skeleton grid while the menu loads.
- Empty state when the response has no categories.
- Error state with a retry button for `INTERNAL_ERROR` and network failures.

Verify: throttling the mock latency to 3 s still shows skeletons, not a blank screen.

### Step 14 — Create the cart helpers

Files: `src/features/browse/cart.ts`, `src/constants/cart.ts`

```ts
export const lineKey = (menuId: string, note: string) => `${menuId}|${note.trim().toLowerCase()}`
```

- `addToCart(cart, menuId, qty, note)` merges equal keys, clamps to `MAX_QTY`.
- `saveCartLine(cart, editKey, menuId, qty, note)` returns `'merged' | 'saved' | 'added'`.
- `cartLines(cart, menus)` drops lines whose menu is gone.
- `qtyOf(cart, menuId)` sums portions across lines.

Verify: unit-level manual check in the browser console for merge and clamp.

### Step 15 — Create the menu detail page

Files: `src/features/browse/pages/MenuDetailPage.tsx`

- Route param `menuId`; unknown id redirects to `/`.
- Hero image or initials, name, price, and note field capped at `NOTE_MAX`.
- Qty stepper clamped to `MAX_QTY`.

Verify: an unknown id redirects; a valid one renders.

### Step 16 — Wire add and edit modes

Files: `src/features/browse/pages/MenuDetailPage.tsx`

- No `edit` param → `addToCart`, then navigate to `/`.
- `?edit=<lineKey>` → prefill qty and note from the matching line, then `saveCartLine`.
- Saving a note that already exists on the same menu merges the two lines.
- Toast states: `added`, `saved`, `merged`.

Verify: editing a line to an existing note collapses two lines into one.

### Step 17 — Wire the cart link with the edit key

Files: `src/features/browse/components/CartBar.tsx` (link only), `src/features/checkout/components/CartLineRow.tsx` (Phase 2.5)

- The bar links to `/keranjang`; the edit links inside the cart are Phase 2.5.

Verify: navigation works both ways without losing the cart.

### Step 18 — Guard the empty-table edge cases

Files: `src/features/browse/pages/MenuHomePage.tsx`, `src/features/browse/useUrlTable.ts`

- `/` with no `meja` and no session `qr` → `/tidak-valid`.
- `/` with `meja` that resolves to 404 → `/tidak-valid`.
- A stale `qr` in the session still attempts the query and redirects on 404.

Verify: clearing `localStorage` and opening `/` lands on `/tidak-valid`.

## Phase Checklist

- [x] Routes all resolve; `*` redirects to `/`.
- [x] `?meja` applies to the session then disappears from the URL.
- [x] Two tabs share the session through the `storage` event.
- [x] A new `qr` clears cart and orders.
- [x] Category tabs and search filter the grid.
- [x] Quick add merges into one line with clamped qty.
- [x] Menu detail add and `?edit` save both work, including the merge case.
- [x] Loading, empty, and error states render.
- [x] `npm run lint && npm run format:check && npm run build` pass.

## Exit Criteria

- [x] Browsing and cart editing work end-to-end on mock data.
- [x] No money aggregate is computed anywhere.
- [x] Phase 2.5 can build the cart page on top of `cartLines` and `session.cart`.

## Gotchas

- Do not store the table token in a second place; `session.qr` is the only copy.
- Do not add a money total to the cart bar.
- Keep `browseState` selection in memory only; it must not go into `localStorage`.
