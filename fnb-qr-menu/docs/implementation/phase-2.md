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

- Sticky header showing `cafe_name` plus optional `leading` and `trailing` slots; the API returns no `table_number`.
- `max-w-xl` container for phones, widening cleanly on tablets.
- Background `bg-canvas`, text `text-text`, font `font-ui`.

Verify: header stays put while content scrolls on a 375px viewport.

### Step 4 — Complete the session store `[REWORK]`

Files: `src/features/session/store.ts`, `src/constants/storage.ts`

- `SESSION_STORAGE_KEY` `fnb-qr-menu:session`, version `v: 1`.
- `CustomerSession` gains `sessionToken`; `TrackedOrder` is `{ id, snapshot }` with no `trackingToken`.
- `read`, `write`, `subscribe` with a `storage` listener and a module-level cache keyed on the raw string.
- `useCustomerSession()` → `[session, update]` via `useSyncExternalStore`.
- Storage failures fall back to memory; corrupt JSON or an unknown `v` starts empty.
- `orders` is `{ id, snapshot }[]`, no cap, no clear action.

Verify: two tabs stay in sync through the `storage` event.

### Step 5 — Implement session reset semantics `[REWORK]`

Files: `src/features/session/store.ts`

- A different `qr` than the stored one clears `cart`, `orders`, and `sessionToken`.
- The reset raises a one-shot "new table session" notice for the next screen to consume, mirroring iul's `setFlash`/`takeFlash`.

Verify: writing a new `qr` empties cart, orders, and the token and leaves `browseOnly` at its default.

### Step 6 — Implement `useTableSession` `[REWORK]`

Files: `src/features/browse/useTableSession.ts`, `src/constants/storage.ts`

- Read `?meja` with `useSearchParams`.
- Non-empty and different from the session → call `openTableSession(qr)`; on success write `qr` and `sessionToken`.
- Empty and the session already has a `qr` plus `sessionToken` → keep the session.
- Empty and either is missing → call `openTableSession(session.qr)` when `qr` exists, else leave both empty so the home screen redirects to `/tidak-valid`.
- `404 NOT_FOUND` from the open → leave the session empty; the home screen redirects to `/tidak-valid`.
- Strip `meja` from the URL after applying it, so a reload keeps the session.

Verify: visiting `/?meja=demo-meja` leaves the URL at `/` and sets `session.qr` and `session.sessionToken`.

### Step 7 — Create the catalog query layer `[REWORK]`

Files: `src/features/catalog/queries.ts`, `src/features/catalog/api.ts`, `src/features/catalog/hooks.ts`

```ts
export const catalogKeys = {
  menu: (sessionToken: string) => ['public-menu', sessionToken] as const,
}

export const menuQuery = (sessionToken: string) =>
  queryOptions({
    queryKey: catalogKeys.menu(sessionToken),
    queryFn: () => getPublicMenu(sessionToken),
  })

export const usePublicMenu = (sessionToken: string) => useQuery(menuQuery(sessionToken))
```

Import `getPublicMenu` from `@/api`, never from a concrete module. The query is disabled while `sessionToken` is empty.

Verify: the query runs once per session and caches across navigation.

### Step 8 — Create the menu home page `[REWORK]`

Files: `src/features/browse/pages/MenuHomePage.tsx`

- Apply `useTableSession()` first; it resolves `?meja`, opens the session, and strips the param.
- Redirect to `/tidak-valid` when `qr` is empty after the session attempt (covers `404` from the open).
- Read the menu with `session.sessionToken`; on `404 NOT_FOUND` redirect to `/tidak-valid`.
- On `401 UNAUTHORIZED` re-open the session from `session.qr` once, store the new token, and refetch; if the re-open returns `404`, redirect to `/tidak-valid`.
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

### Step 18 — Guard the empty-table edge cases `[REWORK]`

Files: `src/features/browse/pages/MenuHomePage.tsx`, `src/features/browse/useTableSession.ts`

- `/` with no `meja` and no session `qr` → `/tidak-valid`.
- `/` with `meja` that resolves to `404` on the session open → `/tidak-valid`.
- A stored `sessionToken` that returns `401` → re-open once from `session.qr`, then `/tidak-valid` if that also fails.

Verify: clearing `localStorage` and opening `/` lands on `/tidak-valid`.

### Step 19 — Add header slots and the order-history entry

Files: `src/components/AppShell.tsx`, `src/features/orders/status.ts`, `src/features/orders/status.test.ts`, `src/features/browse/pages/MenuHomePage.tsx`

- `AppShell` gains `leading?: ReactNode` and `trailing?: ReactNode`; the title becomes `truncate`, the trailing slot is `ml-auto shrink-0`.
- Export `isFinished` from `features/orders/status.ts` and add `unfinishedOrderCount(orders: TrackedOrder[])` next to it; the badge and `useOrderList` share one terminal-status predicate.
- `/` renders a `Receipt` icon in the trailing slot when `session.orders.length > 0`; the link targets `/status`.
- The badge shows `unfinishedOrderCount` and hides at `0`; the number is `aria-hidden` and the link carries `aria-label` ("Pesanan" or "Pesanan, N belum selesai").
- No polling on `/`; the badge reads stored snapshots.

Verify: reloading `/` with unfinished orders shows the badge; finishing or cancelling them hides the badge but keeps the icon.

## Phase Checklist

- [x] Routes all resolve; `*` redirects to `/`.
- [x] `?meja` applies to the session then disappears from the URL.
- [x] Two tabs share the session through the `storage` event.
- [x] A new `qr` clears cart, orders, and the session token.
- [x] Category tabs and search filter the grid.
- [x] Quick add merges into one line with clamped qty.
- [x] Menu detail add and `?edit` save both work, including the merge case.
- [x] Loading, empty, and error states render.
- [x] Header slots exist; `/` exposes an order-history entry with an unfinished count.
- [x] `npm run lint && npm run format:check && npm run build` pass.

## Exit Criteria

- [x] Browsing and cart editing work end-to-end on mock data.
- [x] No money aggregate is computed anywhere.
- [x] Phase 2.5 can build the cart page on top of `cartLines` and `session.cart`.

## Gotchas

- Do not store `qr` or `sessionToken` in a second place; the session store is the only copy.
- Do not add a money total to the cart bar.
- Keep `browseState` selection in memory only; it must not go into `localStorage`.
