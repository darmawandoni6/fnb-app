# Phase 2.2 — Menu Home

Granular plan for executing section 2.2 from `../implementation-plan.md`.

## Scope

`/` browse screen: catalog query, table guards, categories, search, menu grid, quick add, cart bar, closed banner, loading/empty/error states, and the order-history entry.

## Status

DONE — menu home shipped.

## Files

- `src/features/browse/pages/MenuHomePage.tsx`
- `src/features/browse/components/MenuItemCard.tsx`, `CategoryTabs.tsx`, `SearchField.tsx`, `CartBar.tsx`
- `src/features/catalog/queries.ts`, `api.ts`, `hooks.ts`
- `src/features/orders/status.ts` (badge predicate only)

## Tasks

- [x] Catalog query keyed by session token, disabled while the token is empty; import `getPublicMenu` from `@/api` only.
- [x] Apply `useTableSession()` before reading the menu; strip `?meja` after it is applied.
- [x] Redirect to `/tidak-valid` when `qr` is missing or the query returns `404 NOT_FOUND`.
- [x] Redirect to `/tutup` when `is_open` is `false` and `browseOnly` is false.
- [x] Category tabs: "Semua" plus one per category; selection kept in memory through `browseState`.
- [x] Search by menu name, case-insensitive, with an empty state and a clear action.
- [x] Omit categories with no menus.
- [x] Menu card: name, `formatRupiah` price, optional image, two-character initials placeholder, quick-add.
- [x] Quick add writes one cart line and toasts; repeated adds merge into one line.
- [x] Add buttons disabled with a closed note when ordering is blocked.
- [x] `browseOnly` shows a persistent closed banner.
- [x] Skeleton grid, empty state, and retry state for `INTERNAL_ERROR` or network failure.
- [x] Sticky cart bar with item count and a link to `/keranjang`; hidden when empty; no money total.
- [x] Header `trailing` slot shows a `Receipt` icon when `session.orders` is non-empty; badge counts unfinished orders and hides at 0.
- [x] Badge reads stored snapshots only; `/` does not poll.

## Verification

- `demo-invalid` and unknown tokens land on `/tidak-valid`.
- `demo-meja` renders categories, search, and menus; reload keeps the session.
- `demo-tutup` routes to `/tutup`; browse-only returns to `/` with the banner and disabled adds.
- Search nonsense shows the empty state, not a blank page.
- Adding one item reveals the cart bar; removing it hides the bar.
- Reloading `/` with unfinished orders shows the badge; terminal orders hide the number but keep the icon.

## Notes

- Do not compute a cart total anywhere.
- Do not poll on `/`; the badge is snapshot-based.
- Keep the selection in `browseState`, not `localStorage`.
