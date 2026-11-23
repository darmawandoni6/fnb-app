# Phase 2.3 — Menu Detail

Granular plan for executing section 2.3 from `../implementation-plan.md`.

## Scope

`/menu/:menuId` detail screen for add and edit flows, including quantity limits, note limits, and merge semantics.

## Status

DONE — menu detail shipped.

## Files

- `src/features/browse/pages/MenuDetailPage.tsx`
- `src/features/browse/cart.ts` (`addToCart`, `saveCartLine`, `qtyOf`)

## Tasks

- [x] Read `menuId` from the route; unknown id redirects to `/`.
- [x] Hero image or initials, name, and unit price from the menu query cache.
- [x] Quantity stepper clamped to `MAX_QTY` 50; note field capped at `NOTE_MAX` 120.
- [x] Add mode: `addToCart`, toast "added", navigate to `/`.
- [x] Edit mode with `?edit=<lineKey>`: prefill qty and note from the matching line, then `saveCartLine`.
- [x] Saving a note that already exists on the same menu merges both lines and toasts `merged`.
- [x] Distinguish `added`, `saved`, and `merged` outcomes.
- [x] Inline labeled back link ("Kembali ke Menu" / "Kembali ke Keranjang"); no header back slot.
- [x] Add/edit controls disabled when ordering is blocked (`!is_open` or `browseOnly`).

## Verification

- Unknown id redirects; a valid id renders name, price, image or initials.
- Add twice produces one line with qty 2.
- Editing a line to an existing note collapses two lines into one.
- Note over 120 characters is truncated by the input.
- Store closed disables add and save.

## Notes

- `lineKey` is `menuId|note.trim().toLowerCase()`; do not invent a second identity.
- Never compute a line total.
