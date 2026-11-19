# Phase 3.6 (Dashboard) — Receipt Reprint & Cashier Stock Access

Plan for two dashboard gaps found after Phase 3.5: cashiers cannot reprint a receipt once the payment dialog is closed, and the `CASHIER` role has no stock page even though PRD §Roles and `../docs/api.md` allow `GET /stock`.

Mock layer only (`src/api/` re-exports `src/mocks/`); real HTTP handlers land in Phase 3.

## Scope

- **Receipt reprint**: persist the cash amount received and change on the order, then allow reprinting from the payment page (paid orders) and from the order detail dialog on the order board.
- **Cafe name on receipt**: replace the hardcoded `"FNB CAFE & RESTO"` with `settings.cafe_name`.
- **Cashier stock access**: expose `Stock` to `CASHIER` as read-only. Mutations stay `OWNER`-only; mock handlers already enforce `requireRole(USER_ROLE.OWNER)` in `src/mocks/handlers/stock.ts`.
- Out of scope: a dedicated receipt history page, backend changes, and reprint from Reports (owner-only page).

## Current State

- `PaymentReceiptDialog` opens only from `receiptOpen`, set `true` in the payment mutation's `onSuccess` (`src/pages/OrderPaymentPage.tsx:79`). Revisiting a `LUNAS` order shows no reprint button, and `OrderDetailDialog` has no print action.
- `amount_received` / `change_amount` live only in page state; the `Order` type has no field for them, so a reprint could not show cash detail.
- `dashboardNavGroups` lists only `Orders` for `CASHIER` (`src/auth/guards.tsx:66`), and `/stock` is guarded by `owner` (`src/App.tsx:78`).

## Step 1 — Persist Payment Cash Detail

1. **`src/types/order.ts`**: add to `Order`:
   ```ts
   amount_received?: number | null
   change_amount?: number | null
   ```
2. **`src/mocks/handlers/payments.ts`**: extend the `updatePayment` body with `amount_received?` and `change_amount?`, and store both on the order (`null` for `NON_CASH`).
3. **`src/mocks/data/orders.ts`**: backfill seeded `LUNAS` orders so reprint is complete (`amount_received = total_amount`, `change_amount = 0` for `CASH`).
4. **`src/mocks/selfcheck.ts`**: assert `paid.amount_received` is set after `updatePayment`.
5. **`../docs/api.md`** (Payment section, ~line 124): document `amount_received` and `change_amount` in the `PATCH /orders/:id/payment` request/response so Phase 3 provides them.

## Step 2 — Receipt Reprint

1. **`src/features/manual-order/PaymentReceiptDialog.tsx`**
   - Read `order.amount_received` / `order.change_amount`; drop the `amountReceived` / `changeAmount` props. Cash lines stay conditional so `NON_CASH` and legacy orders render cleanly.
   - Replace the hardcoded cafe name with `settings.cafe_name` via `useQuery({ queryKey: ['settings'], queryFn: api.getSettings })`, fallback `'Kafe'`.
   - Make `onNewOrder` optional; when absent, render a full-width `Selesai` button calling `onClose`.
2. **`src/pages/OrderPaymentPage.tsx`**
   - Send `amount_received` / `change_amount` in `handleSettlePayment` for `CASH`.
   - Add a `Cetak Ulang Struk` button next to the `Pesanan Sudah Lunas` badge, shown only when `isAlreadyPaid`, calling `setReceiptOpen(true)`. The dialog already receives `order` at line 473.
3. **`src/features/orders/OrderDetailDialog.tsx`**
   - Add a `Cetak Struk` footer button when `payment_status === LUNAS`, opening `PaymentReceiptDialog` from local state, without `onNewOrder`.

## Step 3 — Cashier Stock Access

1. **`src/auth/guards.tsx`** (`CASHIER` branch): add a nav group with `Stock` (`ROUTES.STOCK`, `Boxes` icon).
2. **`src/App.tsx`**: guard `/stock` with `staff` (`OWNER`, `CASHIER`) instead of `owner`.
3. Read-only UI for non-`OWNER` (server authorization already enforced in mock handlers):
   - `src/pages/StockPage.tsx`: hide `IngredientFormDialog` for non-`OWNER`.
   - `src/features/stock/IngredientsPanel.tsx` → `IngredientActions`: keep only `Lihat pemakaian` for non-`OWNER`; hide Restock, Sesuaikan stok, and Edit bahan.
   - Role checks use `useAuth()` with `USER_ROLE.OWNER` (constants, not string literals).

## Step 4 — Verification

```bash
npm run lint
npm run format:check
npm run build
```

Manual check with `npm run dev`, logged in as `kasir@demo.cafe`:

- Sidebar shows `Orders` and `Stock`; the stock page has no add/restock/edit controls.
- Cash payment receipt shows amount received and change.
- Closing the receipt and reopening it from `Cetak Ulang Struk` and from the order detail dialog shows identical content.
- Renaming the cafe in Settings changes the receipt header on reprint.

## Commits

```
feat(orders): persist payment cash detail and allow receipt reprint
feat(stock): give cashier read-only stock access
```
