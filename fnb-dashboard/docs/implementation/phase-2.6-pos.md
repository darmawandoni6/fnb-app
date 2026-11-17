# Phase 2.6 (Dashboard) — Manual Order POS & Payment Flow

Plan for refactoring the manual order feature from a simple dialog into a dedicated **Point of Sale (POS)** interface (`/orders/new`) and a standalone **Payment Checkout Page** (`/orders/:id/payment`), strictly complying with the PRD § 5 status and payment lifecycle.

## Scope

- **New POS Page (`/orders/new`)**:
  - **Left Column**: Menu Catalog Grid per category with category tabs, search bar, and 2-character initials placeholder (e.g. `KS`, `AM`) when `image_url` is absent.
  - **Right Column**: Order Cart Panel with:
    - Service Option: Toggle `Dine In` vs `Take Away`.
    - Active Table dropdown (mandatory when `Dine In`).
    - Customer Name (mandatory for all manual orders).
    - Cart items list: qty counter, item remove, optional item note.
    - Summary calculation: Subtotal, Tax ({tax_percent}% from settings), Grand Total.
    - **Hold Draft (Park Order)**: Save cart to `localStorage` (`fnb_pos_drafts`) to skip and serve the next customer in queue, with resume/restore option.
    - Action: "Lanjut ke Pembayaran" creates order (`status: MENUNGGU`, item: `PENDING`, payment: `BELUM`), decreases stock, and navigates to `/orders/:id/payment`.
- **Payment Page (`/orders/:id/payment`)**:
  - Order preview: Items, notes, table / take away, customer name, bill summary.
  - Staff info: Logged-in cashier name and role.
  - Payment Method:
    - **Cash (CASH)**: Input amount received, quick cash buttons (`Uang Pas`, `50k`, `100k`, `200k`), automatic change (_kembalian_) calculation.
    - **Non-Cash (NON_CASH)**: Channel selection (QRIS, Debit, Transfer).
  - "Selesaikan Pembayaran": Calls `api.updatePayment` -> moves payment to `LUNAS`. Order is now ready for Kitchen processing (`PENDING` -> `COOKING` -> `DIPROSES`).
  - Printable Receipt Modal: Print button (`window.print()`), "Buat Pesanan Baru", and "Ke Board Orders".
  - Back navigation returns to `/orders/new`; unpaid orders require confirmation before leaving.
  - Layout uses a wide order summary on the left and sticky payment panel on the right.
  - Unpaid orders with all items `PENDING` can be cancelled after confirmation; cancellation restores mock stock and returns to `/orders/new`.
  - Order-board payment actions open this full payment page instead of the legacy payment modal.

## Step 1 — Types & Routes

1. **`src/constants/routes.ts`**:
   - `ORDERS_NEW: '/orders/new'`
   - `ORDERS_PAYMENT: '/orders/:id/payment'`
2. **`src/types/order.ts`**:
   - `DiningOption`: `'DINE_IN' | 'TAKE_AWAY'`
   - Extend `Order`: `dining_option?: DiningOption`, `customer_name?: string | null`, `created_by_name?: string | null`.

## Step 2 — Mock Handlers & Business Logic

1. **`src/mocks/handlers/orders.ts`**:
   - Update `createManualOrder` to accept and persist `customer_name`, `dining_option`, `table_id`, `table_number`, and `created_by_name`.
   - Ensure stock is decremented and order starts with `status: MENUNGGU`, `payment_status: BELUM`.

## Step 3 — Feature Layer (`src/features/manual-order/`)

1. **`manualOrderUtils.ts`**: `getMenuInitials(name: string): string` for 2-character initials.
2. **`usePosDrafts.ts`**: LocalStorage helper to park/resume orders.
3. **`MenuCatalogGrid.tsx`**: Category filter tabs, search input, menu grid cards with initials and active cart quantity badges.
4. **`OrderCartPanel.tsx`**: Service toggle, table dropdown, customer name input, cart items list + notes, subtotal, tax calculation, hold draft button, and checkout action.
5. **`PaymentReceiptDialog.tsx`**: Printable receipt dialog with transaction summary, cashier name, payment details, and action buttons.

## Step 4 — Pages & Routes Integration

1. **`src/pages/NewOrderPage.tsx`**: Responsive POS screen combining `MenuCatalogGrid` and `OrderCartPanel`.
2. **`src/pages/OrderPaymentPage.tsx`**: Standalone checkout page handling cash/non-cash settlement.
3. **`src/pages/OrdersPage.tsx`**: Update `+ Order Manual` button to navigate directly to `/orders/new`.
4. **`src/App.tsx`**: Register `/orders/new` and `/orders/:id/payment` routes guarded for `OWNER` and `CASHIER`.

## Step 5 — Verification

```bash
export PATH="/home/doni/.nvm/versions/node/v24.22.1/bin:$PATH"
npm run lint
npm run format:check
npm run build
```
