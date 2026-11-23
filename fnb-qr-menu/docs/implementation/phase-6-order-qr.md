# Phase 6 — Order QR

Granular plan for the "Tunjukkan QR" button on the order status screen.

## Scope

The cashier needs the order without typing: the customer shows a QR that opens the dashboard order board already filtered to that `order_number`. Pairs with `fnb-dashboard` phase 6 (`docs/implementation/phase-6-order-search.md`).

## Status

DONE — shipped.

## Files

- `src/lib/orderQr.ts`
- `src/features/orders/components/OrderQrDialog.tsx`
- `src/features/orders/components/OrderCard.tsx`
- `.env`, `.env.example`

## Tasks

- [x] `getOrderQrUrl(orderNumber)` = `${VITE_DASHBOARD_URL}/orders?q=<encoded order_number>`; trailing slashes trimmed, value URL-encoded.
- [x] `hasDashboardUrl` hides the button when the variable is empty — same pattern as `hasQrMenuUrl` in the dashboard.
- [x] `OrderQrDialog`: shadcn `Dialog` + `QRCodeSVG` (208 px, level `M`) with the order number printed under the QR.
- [x] Button sits in the expanded card body, stopPropagation so it does not toggle the accordion.
- [x] No API call and no new endpoint: the QR carries a dashboard deep link, not a lookup token.

## Verification

- Button appears only when `VITE_DASHBOARD_URL` is set; clearing it hides the button and the dialog never renders.
- Scanning the QR lands on `/orders?q=<order_number>` with the board filtered to that order.
- Button does not collapse or expand the card it lives in.
- `npm run lint && npm run format:check && npm run build` pass.

## Notes

- No camera scanner in the dashboard: the cashier scans with the phone's own camera app and the deep link does the work.
- No copy-number button and no text-only QR variant; the deep link is strictly more useful for the stated goal.
