# Phase 2.7 — Closed and Invalid

Granular plan for executing section 2.7 from `../implementation-plan.md`.

## Scope

Terminal states: `/tutup` for a closed store with an opt-in browse-only mode, and `/tidak-valid` for unknown or deactivated table tokens.

## Status

DONE — both screens shipped.

## Files

- `src/features/checkout/pages/ClosedPage.tsx`
- `src/features/checkout/pages/InvalidTablePage.tsx`

## Tasks

- [x] `/tutup` explains that the store is not taking orders and offers "Lihat menu saja".
- [x] Browse-only sets `browseOnly` and navigates to `/`; the home banner and disabled add controls follow.
- [x] Visiting `/tutup` while `is_open` is true redirects to `/`.
- [x] `/tidak-valid` tells the customer to scan the table QR again.
- [x] Unknown and deactivated `qr_token` both land on `/tidak-valid` through the session-open `404`.
- [x] No retry loop on `/tidak-valid`; the customer must rescan.
- [x] Both screens are dead ends with no header back link.
- [x] `/keranjang` and `/status` own their `leading` back links.

## Verification

- `demo-invalid` and an unknown token land on `/tidak-valid`.
- `demo-tutup` lands on `/tutup`; browse-only survives reload and shows the banner.
- Reopening the store and reloading `/` returns to the menu.

## Notes

- `/tutup` reads `is_open` from the menu query only; there are no opening hours.
- Menu polling stops when the store reads closed, so reopening requires a reload. Phase 5 records this behaviour.
