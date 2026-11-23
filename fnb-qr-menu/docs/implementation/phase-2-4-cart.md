# Phase 2.4 — Cart

Granular plan for executing section 2.4 from `../implementation-plan.md`.

## Scope

`/keranjang` cart list: line rendering, quantity and note editing, removal, hidden-menu handling, and the no-aggregate footer.

## Status

DONE — cart shipped.

## Files

- `src/features/checkout/pages/CartPage.tsx`
- `src/features/checkout/components/CartLineRow.tsx`
- `src/features/browse/cart.ts`

## Tasks

- [x] Render rows from `cartLines(session.cart, menus)`.
- [x] Row shows name, unit price, quantity stepper, inline note, and remove control.
- [x] Stepper clamps to `MAX_QTY`; removing the last unit removes the line after confirmation.
- [x] Note edits persist to `session.cart` immediately and cap at `NOTE_MAX`.
- [x] Thumbnail from `image_url`, initials placeholder otherwise.
- [x] Touch targets at least 44×44 px.
- [x] Empty state with a link back to `/`.
- [x] Lines whose menu is missing from the menu response are hidden and excluded from the submit payload, but kept in the session.
- [x] All-hidden cart shows "menu sudah tidak tersedia" and blocks submit.
- [x] Footer reads "N item · total dihitung kasir"; no subtotal, service, tax, or total anywhere.
- [x] Header `leading` back link to `/`, `aria-label="Kembali"`, visible even with an empty cart.
- [x] Submit disabled when the cart is empty, fully hidden, or `is_open` is false.

## Verification

- Stepper, note edit, and remove update `session.cart` immediately.
- Searching the rendered DOM for a total finds unit prices only.
- Removing a menu from the mock response hides its line and keeps the cart otherwise intact.
- `npm run lint && npm run format:check && npm run build` pass.

## Notes

- Do not compute prices, tax, or totals.
- Do not drop a hidden line from the session.
