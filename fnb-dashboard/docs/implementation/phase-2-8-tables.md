# Phase 2.8 — Tables and QR

Granular plan for executing section 2.8 from `../implementation-plan.md`.

## Scope

`/tables` for `OWNER`: table CRUD, QR preview, and bulk printing. PRD §10.4, §4.6.

## Status

DONE — all tasks complete.

## Files

- `src/pages/TablesPage.tsx`
- `src/features/tables/TableCard.tsx`
- `src/features/tables/TableFormDialog.tsx`
- `src/features/tables/TableQrDialog.tsx`
- `src/features/tables/TableQrCard.tsx`
- `src/features/tables/PrintAllTablesDialog.tsx`
- `src/features/tables/tableSchema.ts`

## Tasks

- [x] Card grid with table number, QR thumbnail, availability badge, activation switch, and preview action.
- [x] Create and edit tables; `table_number` stays unique.
- [x] Deactivation keeps the row and its `qr_token`; scans are rejected by the server.
- [x] QR preview dialog with a 224 px `QRCodeSVG`, the token with a copy action, print, and open QR Menu in a new tab.
- [x] Bulk print dialog: 2×2 A4 preview of active tables, then `window.print()`.
- [x] Shared `TableQrCard` so the preview equals the printed sheet; cafe name comes from settings.
- [x] QR encodes `${VITE_QR_MENU_URL}/?meja=<qr_token>`; when the variable is empty the open action is disabled and the dialog warns.
- [x] `@media print` rules in `src/index.css` shared with the payment receipt.
- [x] No QR regeneration: the token is immutable, and the regeneration endpoint is deferred.

## Verification

- Printed sheet and preview render the same card for the same table.
- Empty `VITE_QR_MENU_URL` disables the open action and shows the warning.
- Deactivated tables are excluded from the bulk print.
