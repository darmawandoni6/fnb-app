# Phase 2.6 (Dashboard) — Manual Order POS & Payment Flow

Plan for refactoring the manual order feature from a simple dialog into a dedicated **Point of Sale (POS)** interface (`/orders/new`) and a standalone **Payment Checkout Page** (`/orders/:id/payment`), strictly complying with the PRD § 5 status and payment lifecycle.

## Scope

- **New POS Page (`/orders/new`)**:
  - `CASHIER` only (BR-01, BR-24): manual orders are `TAKE_AWAY`; there is no `DINE_IN` toggle and no table selection.
  - **Left Column**: Menu Catalog Grid per category with category tabs, search bar, and 2-character initials placeholder (e.g. `KS`, `AM`) when `image_url` is absent.
  - **Right Column**: Order Cart Panel with:
    - Customer Name (mandatory for all manual orders, BR-22) and optional phone.
    - Cart items list: qty counter, item remove, optional item note.
    - Summary calculation: Subtotal, Service charge ({service_rate}%), Tax ({tax_rate}%), Grand Total (PRD §6). Preview only; the server returns the authoritative amounts.
    - **Hold Draft (Park Order)**: Save cart to `localStorage` (`fnb_pos_drafts`) to skip and serve the next customer in queue, with resume/restore option.
    - Action: "Lanjut ke Pembayaran" creates order (`status: MENUNGGU`, item: `PENDING`, payment: `BELUM`), decreases stock, and navigates to `/orders/:id/payment`.
- **Payment Page (`/orders/:id/payment`)**:
  - Order preview: Items, notes, take away label, customer name, bill summary (subtotal, service charge, tax, total).
  - Staff info: Logged-in cashier name and role.
  - Payment Method:
    - **Cash (CASH)**: Input amount received, quick cash buttons (`Uang Pas`, `50k`, `100k`, `200k`), automatic change (_kembalian_) calculation.
    - **Non-Cash (NON_CASH)**: manual confirmation until Midtrans is live; no gateway reference is stored.
  - "Selesaikan Pembayaran": Calls `api.updatePayment` -> moves payment to `LUNAS`; order becomes `DIPROSES` (PRD §5.3). Repeated confirmation returns the same order (BR-11).
  - Printable Receipt Modal: `order_number`, service charge, tax, cash detail; print button (`window.print()`), "Buat Pesanan Baru", and "Ke Board Orders".
  - Back navigation returns to `/orders/new`; unpaid orders require confirmation before leaving.
  - Layout uses a wide order summary on the left and sticky payment panel on the right.
  - Unpaid order cancellation calls `POST /orders/:id/cancel` (order-level, `OWNER` only); the action is not shown to `CASHIER`.
  - Order-board payment actions open this full payment page instead of the legacy payment modal.

## Step 1 — Types & Routes

1. **`src/constants/routes.ts`**:
   - `ORDERS_NEW: '/orders/new'`
   - `ORDERS_PAYMENT: '/orders/:id/payment'`
2. **`src/types/order.ts`**:
   - Extend `Order`: `customer_name: string`, `customer_phone: string | null`, `created_by: string | null`, `order_number: string`.
   - No `dining_option`: `order_type` is already `TAKE_AWAY` for manual orders (PRD §10.1, §18 #19).

## Step 2 — Mock Handlers & Business Logic

1. **`src/mocks/handlers/orders.ts`**:
   - `createManualOrder` accepts and persists `customer_name`, `customer_phone`, `payment_method`; it always sets `order_type: TAKE_AWAY`, `table_id: null`, `table_session_id: null`, and `created_by` from the session (PRD §11.3).
   - Role guard: `CASHIER` only (BR-01, BR-24).
   - Totals use `service_rate` + `tax_rate` snapshots from settings; stock is decremented and the order starts `MENUNGGU` / `BELUM`.
2. **`src/mocks/handlers/payments.ts`**: idempotent `BELUM → LUNAS`; repeated calls return the same order.

## Step 3 — Feature Layer (`src/features/manual-order/`)

1. **`manualOrderUtils.ts`**: `getMenuInitials(name: string): string` for 2-character initials.
2. **`usePosDrafts.ts`**: LocalStorage helper to park/resume orders.
3. **`MenuCatalogGrid.tsx`**: Category filter tabs, search input, menu grid cards with initials and active cart quantity badges.
4. **`OrderCartPanel.tsx`**: Customer name + optional phone inputs, cart items list + notes, subtotal, service charge, tax, grand total, hold draft button, and checkout action.
5. **`PaymentReceiptDialog.tsx`**: Printable receipt dialog with `order_number`, service charge, tax, cashier name, cash detail, and action buttons.

## Step 4 — Pages & Routes Integration

1. **`src/pages/NewOrderPage.tsx`**: Responsive POS screen combining `MenuCatalogGrid` and `OrderCartPanel`.
2. **`src/pages/OrderPaymentPage.tsx`**: Standalone checkout page handling cash/non-cash settlement.
3. **`src/pages/OrdersPage.tsx`**: Update `+ Order Manual` button to navigate directly to `/orders/new`; visible to `CASHIER` only.
4. **`src/App.tsx`**: Register `/orders/new` and `/orders/:id/payment` guarded for `CASHIER`; `/orders/:id/payment` also reachable by `OWNER` for the cash-confirmation backup (PRD §9).

## Step 5 — Verification

```bash
export PATH="/home/doni/.nvm/versions/node/v24.22.1/bin:$PATH"
npm run lint
npm run format:check
npm run build
```
