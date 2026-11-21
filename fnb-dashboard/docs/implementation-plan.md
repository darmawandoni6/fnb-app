# FNB Dashboard — Implementation Plan

## Scope

Plan for the internal dashboard based on:

- `../docs/PRD.md`
- `../docs/flow.md`
- `../docs/api.md`
- `../docs/api-response.md`
- `docs/tech-stack.md`

`../docs/PRD.md` and `../docs/flow.md` are the source of truth. When this plan, the mock layer, or the code disagrees with them, the PRD wins and the other side is fixed.

Unit and component testing are excluded from this plan's scope.

## Phase 0 — Scaffold and Foundation

1. Scaffold Vite React TypeScript in `fnb-dashboard/`.
2. Remove partial `node_modules` if present, then run a fresh `npm install`.
3. Set up Tailwind CSS v4 and shadcn/ui.
4. Set up the `@/*` alias in `tsconfig.json` and `vite.config.ts`.
5. Install dependencies:

   - `react-router-dom`
   - `@tanstack/react-query`
   - `axios`
   - `zod`
   - `react-hook-form`
   - `@hookform/resolvers`
   - `prettier`
   - `@trivago/prettier-plugin-sort-imports`
   - `prettier-plugin-tailwindcss`

6. Set up `.env.example`:

   ```env
   VITE_API_URL=http://localhost:8081
   VITE_USE_MOCKS=true
   ```

7. Set up the formatter, linter, and project scripts.
8. Add the required shadcn components:

   - `button`
   - `card`
   - `badge`
   - `input`
   - `label`
   - `table`
   - `dialog`
   - `dropdown-menu`
   - `sonner`
   - `skeleton`
   - `select`
   - `textarea`
   - `alert-dialog`
   - `tabs`
   - `separator`
   - `empty`

9. Create constants:

   ```text
   src/constants/
   ├── roles.ts
   ├── orderStatus.ts
   ├── itemStatus.ts
   ├── paymentStatus.ts
   ├── orderType.ts
   ├── paymentMethod.ts
   ├── routes.ts
   └── errors.ts
   ```

10. Create domain types based on `api.md`:

    - `Order`
    - `OrderItem`
    - `Menu`
    - `Category`
    - `Table`
    - `User`
    - `Ingredient`
    - `Settings`
    - API success envelope
    - API error envelope

## Phase 1 — Mock Layer

The mock layer must have the same signature and return types as the API module so that API integration does not change UI components.

Structure:

```text
src/mocks/
├── data/
│   ├── orders.ts
│   ├── menus.ts
│   ├── tables.ts
│   ├── users.ts
│   ├── ingredients.ts
│   └── settings.ts
├── handlers/
│   ├── auth.ts
│   ├── orders.ts
│   ├── menus.ts
│   ├── payments.ts
│   └── index.ts
└── index.ts
```

11. Create realistic fixtures:

    - `DINE_IN` and `TAKE_AWAY` orders (PRD §10.1).
    - Order statuses `MENUNGGU`, `DIPROSES`, `SELESAI`, `DIBATALKAN` (PRD §5.1).
    - Item statuses `PENDING`, `COOKING`, `READY`, `DELIVERED`, `COMPLETED`, `CANCELLED` (PRD §5.2).
    - Payments `BELUM` and `LUNAS`.
    - Menus and categories.
    - Tables, users, ingredients, and settings.
    - `order_number` in `TA-###` / `DI-###` form.

12. Implement mock transitions per PRD §5.2:

    - `PENDING` → `COOKING`
    - `COOKING` → `READY`
    - `READY` → `DELIVERED`
    - `DELIVERED` → `COMPLETED`
    - `PENDING` → `CANCELLED`, only as part of order cancellation

    Order cancellation is order-level only (`POST /orders/:id/cancel`, `OWNER`, PRD §4.7/§11.3): every item becomes `CANCELLED`, stock is restored, and `RESTORE` movements are written. There is no item-level cancel endpoint in v1.

13. Mocks must return the same error codes as the backend:

    - `INVALID_TRANSITION`
    - `PAYMENT_REQUIRED`
    - `STORE_CLOSED`
    - `STOCK_NOT_ENOUGH`
    - `FORBIDDEN`

14. Add 200–500 ms mock latency so loading states can be verified manually.
15. Enable mocks with `VITE_USE_MOCKS=true`.

## Phase 2 — UI Slicing with Mock

### 2.1 App Shell

16. Set up `main.tsx` with:

    - `QueryClientProvider`
    - `RouterProvider`
    - `Toaster`
    - `AuthProvider`

17. Create routes:

    - `/login`
    - `/`
    - protected dashboard routes

18. Create `ProtectedRoute`, `RoleGuard`, and `AuthContext`.
19. In mock mode, login allows role selection so all three roles can be sliced.
20. Create the dashboard layout with a role-based sidebar menu (with groups and Lucide icons):

    - `OWNER`:
      - Operasional: Orders
      - Katalog & Meja: Menus, Tables, Stock
      - Bisnis & Sistem: Reports, Users, Settings
    - `CASHIER`:
      - Operasional: Orders
    - `KITCHEN`:
      - Dapur: Kitchen Board

21. Menu items outside Phase 1 render as `Coming soon` stubs.

### 2.2 Auth Feature

22. Create `LoginPage`.
23. Create `loginSchema` with Zod.
24. Use React Hook Form + `zodResolver`.
25. Handle loading and error states.

### 2.3 Cashier Order Board

26. Create `useOrders(filters)` using TanStack Query.
27. Set polling `refetchInterval: 5_000`.
28. Create `OrdersPage` as a kanban board over `order.status` (PRD §5.1):

    - `MENUNGGU`
    - `DIPROSES`
    - `SELESAI`
    - `DIBATALKAN`

29. Create `OrderCard` containing:

    - Order number (`TA-###` / `DI-###`).
    - Order type (`DINE_IN` / `TAKE_AWAY`).
    - Table number.
    - Order time.
    - Total.
    - Payment badge.
    - Item list.
    - Item status.
    - Action buttons.

30. Implement cashier actions (PRD §9):

    - Confirm payment `BELUM` → `LUNAS` with method `CASH` or `NON_CASH`.
    - `READY` → `DELIVERED` and `DELIVERED` → `COMPLETED` for `TAKE_AWAY` only.
    - No cancellation: cancelling an unpaid order is `OWNER`-only and order-level.

31. Create the payment page (see 2.5) instead of a modal dialog.
32. Disable actions when the role or transition is not allowed.
33. Add loading skeletons and empty states.

### 2.4 Kitchen Board

34. Create `KitchenPage` with two tabs (PRD §4.4, §7.3):

    - "Masak": items `PENDING` and `COOKING`.
    - "Pass/Counter": items `READY` and `DELIVERED`.

35. Query `GET /orders` and keep only `LUNAS` orders that still have active items; the kitchen never reads unpaid orders.
36. Display items per tab:

    - Masak columns: `PENDING`, `COOKING`.
    - Pass/Counter: `READY`, with the `DELIVERED → COMPLETED` override.

37. Implement kitchen actions (PRD §5.2):

    - `PENDING` → `COOKING`.
    - `COOKING` → `READY`.
    - `READY` → `DELIVERED`.
    - `DELIVERED` → `COMPLETED` override.

38. Ensure a `BELUM` order cannot move to `COOKING`; surface `PAYMENT_REQUIRED`.
39. Show the auto-deliver warning `ready_auto_deliver_warning_minutes` before `ready_auto_deliver_minutes` and the auto-complete timer, from `GET /settings`. Use a wide layout for kitchen monitors.

### 2.5 Manual Order (POS & Payment Flow)

See `docs/implementation/phase-2.6-pos.md` for detail.

40. Create dedicated POS page (`NewOrderPage` at `/orders/new`) replacing the simple modal dialog:
    - `TAKE_AWAY` only (BR-01): no `DINE_IN` toggle and no table select. `OWNER` cannot create orders (BR-24).
    - Left column: Category tabs, search input, and menu catalog grid with 2-character initials when images are absent.
    - Right column: Order cart panel with mandatory customer name, optional phone, item notes, subtotal, service charge, tax, grand total, and hold draft (park order to `localStorage`).
    - Totals in the cart are a preview; the server returns the authoritative amounts.
41. Create dedicated Checkout & Payment page (`OrderPaymentPage` at `/orders/:id/payment`):
    - Order preview & handling cashier info.
    - Cash payment (amount received, quick nominal buttons, change calculation) and non-cash confirmation (`NON_CASH`, no gateway reference until Midtrans is live).
    - Status lifecycle: order starts `MENUNGGU` & `BELUM`; confirming payment sets `LUNAS` and the order becomes `DIPROSES` (PRD §5.3).
    - Printable receipt (58/80 mm) with `window.print()`, showing `order_number`, service charge, tax, and the persisted `amount_received`/`change_amount`.
    - Back returns to `/orders/new`; unpaid orders require confirmation before leaving.
    - Unpaid order cancellation calls `POST /orders/:id/cancel`; the action is visible to `OWNER` only.
    - Order-board payment actions use this checkout page instead of the legacy payment modal.
42. Submit `createManualOrder` with items, customer name, optional phone, and payment method. The mock/API derives `order_type = TAKE_AWAY` and `table_id = null`.
43. Handle `STORE_CLOSED` with a toast and disable creation; existing orders stay readable and processable.
44. Add mock/API contract `POST /orders/:id/cancel` for unpaid orders (PRD §4.7), including stock restoration, `cancel_reason`, and `canceled_at`.

### 2.6 Owner Stub Pages

48. Create stub pages for:

    - Menus.
    - Tables.
    - Stock.
    - Reports.
    - Settings.
    - Users.
    - Audit Log.

49. Use the `Empty` component for features not yet in Phase 1.

### 2.7 Reports Slicing (Mock)

See `docs/implementation/phase-3.5-reports.md` for detail.

- Slicing Tabbed View for `/reports` (`OWNER` role).
- Global Preset Filter (`today`, `last_7_days`, `last_30_days`, `this_month`).
- Tab 1: Ringkasan Sales Overview KPI Cards + Sales Trend Chart (Recharts).
- Tab 2: Menu & Category Performance Charts (Top 10 Menus + Category Share).
- Tab 3: Transaction History Table + Client-side CSV Export.
- Mock contracts and 30-day realistic historical generator in `src/mocks/`.

### 2.8 Tables Grid & QR Printing (Mock)

See `docs/implementation/phase-3-crud.md` Step 4 for detail.

- `/tables` becomes a card grid: number, QR thumbnail, status badge, availability switch, preview action.
- QR preview dialog: 224px `QRCodeSVG`, token + copy, print, open QR Menu in a new tab.
- Bulk print dialog: 2×2 A4 preview of active tables, then `window.print()`.
- Shared `TableQrCard` (cafe name from settings, "Scan untuk lihat menu", QR, table number) so preview equals the printed sheet.
- Ownership of `VITE_QR_MENU_URL`; QR encodes `${VITE_QR_MENU_URL}/?meja=<qr_token>`.
- `@media print` rules in `src/index.css` shared with the payment receipt.
- No QR regeneration in M1: token is immutable, endpoint deferred.

### 2.9 Stock Redesign (Mock)

See `docs/implementation/phase-3-crud.md` Step 5, `/home/doni/.opencode/plan/stock-redesign.md` (data model), `/home/doni/.opencode/plan/stock-page-two-panel.md` (layout) and `/home/doni/.opencode/plan/stock-color-pattern.md` (color + separators) for detail.

- Types follow PRD §10.8–§10.10: `stock_qty`, `min_stock`, `qty_used`, `stock_movements.order_id`; global `LOW_STOCK_THRESHOLD` removed.
- One-screen two-panel layout (no tabs, no summary cards): ingredients 2/3 left, movements 1/3 right, stacked below `lg`.
- Ingredients panel uses the generic `src/components/data-table.tsx` (TanStack Table v9): name search, chips `Semua/Menipis/Habis/Aman` with counts, sorting on name and stock, pagination; stock number colored by three-tier threshold.
- One color per status across number, chip, and badge (Habis red, Menipis amber, Aman emerald, `Semua` neutral); quantities formatted `id-ID` (thousand separators). Movement type badges stay neutral.
- Aksi dropdown: Restock (`IN`), `Sesuaikan stok` (opname, `ADJUSTMENT`), Edit bahan, Lihat pemakaian (read-only).
- Recipes edited in `/menus` (`RecipeDialog` per menu card); PRD §8 enforced with `STORE_CLOSED` while the store is open.
- Movements panel: grouped-by-date list, chips `Semua/Masuk/Keluar` mapped by qty sign, signed colored qty, `#order_id` note, internal scroll.
- Order creation writes `OUT` per recipe; cancellation writes `RESTORE`; log is append-only.
- `docs/api.md` adds `min_stock`, `POST /ingredients/:id/adjust`, `GET /stock-movements`, and the recipe `STORE_CLOSED` rule; `docs/flow.md` adds Stock Opname and Recipe Management sections.

## 2.10 PRD Conformance (mock)

Sliced in the mock layer. They are part of the dashboard scope, not Phase 2 extras.

- **Money model (PRD §6)**: `subtotal_amount`, `service_rate_snapshot`, `service_amount`, `tax_rate_snapshot`, `tax_amount`, `total_amount`. Service is computed from the subtotal, tax from subtotal + service, round half up per component. All values integer rupiah.
- **Settings (PRD §10.16)**: `cafe_name`, `service_rate`, `tax_rate`, `is_open`, `cash_timeout_minutes`, `delivered_auto_complete_minutes`, `ready_auto_deliver_minutes`, `ready_auto_deliver_warning_minutes`. Settings page edits all of them; `tax_percent` is replaced by `tax_rate`.
- **Order number (PRD §7.5)**: `TA-###` / `DI-###`, reset daily per type. The board and the receipt display `order_number`, never the internal id.
- **Order lifecycle timers (PRD §4.3, §4.4)**: countdown for unpaid cash orders (`cash_timeout_minutes`), auto-deliver warning, auto-complete indicator. The scheduler stays server-side; the dashboard only displays the derived state.
- **Table session (PRD §4.6, §9)**: `GET /tables/:id/session` and `POST /tables/:id/session/close` (`CASHIER`, `OWNER`), plus a close action on the tables page and the order detail.
- **Audit log (PRD §7.4)**: `GET /audit-log` (`OWNER`) with a read-only table page.
- **Roles (PRD §9)**: `OWNER` confirms payment and cancels unpaid orders; `CASHIER` creates take away orders and owns `READY → DELIVERED → COMPLETED` for take away; `KITCHEN` owns `PENDING → COOKING → READY → DELIVERED` and the `COMPLETED` override.

## Phase 3 — API Integration

Prerequisite: `fnb-server` running at `http://localhost:8081`.

50. Create `src/api/client.ts`:

    - Axios instance.
    - `baseURL` from `VITE_API_URL`.
    - `withCredentials: true`.
    - Request interceptor for the bearer token.
    - Response handling for the envelope.
    - Error mapping to `ApiError { code, message }`.

51. Implement the auth API:

    - `POST /auth/login`.
    - `POST /auth/refresh`.
    - `POST /auth/logout`.

52. Implement silent refresh at app load before protected routes render.
53. Implement the Axios 401 flow:

    1. Receive `401 UNAUTHORIZED`.
    2. Call refresh.
    3. Retry the request once.
    4. Redirect to `/login` if refresh fails.

54. Swap mock implementations per resource without changing components:

    1. Auth.
    2. Orders.
    3. Payments.
    4. Menus.
    5. Tables and table sessions.
    6. Stock.
    7. Users, settings, and audit log.

55. Implement the order endpoints:

    - `GET /orders`.
    - `GET /orders/:id`.
    - `POST /orders/manual`.
    - `PATCH /orders/:id/payment`.
    - `PATCH /orders/:id/items/:item_id/status`.
    - `POST /orders/:id/cancel` (`OWNER`, unpaid orders only).

55b. Mock alignment with PRD §5 and §9 (separate commit):

    - Order-level cancel: `POST /orders/:id/cancel` sets every item `CANCELLED`, writes `RESTORE` movements with `order_id`/`order_item_id`, fills `cancel_reason`/`canceled_at`, keeps the price snapshot, and derives `DIBATALKAN`.
    - `StockMovement` type: `IN` | `OUT` | `RESTORE` | `ADJUSTMENT` + optional `order_item_id`.
    - Payment confirmation is idempotent: repeating `PATCH /orders/:id/payment` returns `200` with the same order and writes no second `payment_log` (BR-11).
    - Item statuses follow PRD §5.2 including `COMPLETED`; `COMPLETED` is the only terminal item state besides `CANCELLED`.
    - No refund path in v1; refunds stay manual (BR-20).

55c. Real time per PRD §11.4: connect `GET /ws`, subscribe to `order:{id}`, refetch on `order.created` / `order.updated` / `item.updated` / `session.closed`, and keep polling 3–5 s as the fallback while the socket is down.

56. Verify live polling and socket updates with two dashboard sessions.
57. Verify error codes end-to-end:

    - `PAYMENT_REQUIRED`.
    - `INVALID_TRANSITION`.
    - `STORE_CLOSED`.
    - `STOCK_NOT_ENOUGH`.
    - `FORBIDDEN`.

58. Once the API is stable, set `VITE_USE_MOCKS=false` in the integration environment.

## Phase 4 — Polish

59. Add a rupiah formatter using `Intl.NumberFormat('id-ID')`.
60. Add time formatters using `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat` if needed.
61. Optimize the responsive layout for cashier tablets and kitchen monitors.
62. Ensure loading, empty, error, and success states exist on every data page.
63. Update `AGENTS.md` from planned status to the actual scaffold status and commands.
64. Update documentation if structure or dependencies change.

## Manual Verification Checklist

### Foundation

- [ ] `npm run dev` works.
- [ ] `npm run build` works.
- [ ] `npm run lint` works.
- [ ] `npm run format:check` works.

### Mock

- [ ] Login can select a mock role.
- [ ] OWNER sees the owner menu.
- [ ] CASHIER sees the order board.
- [ ] KITCHEN sees the kitchen board.
- [ ] Mock polling updates data.
- [ ] Mock payment succeeds.
- [ ] Mock item statuses follow the transition matrix, including `DELIVERED → COMPLETED`.
- [ ] Mock order cancellation is order-level, `OWNER`-only, and restores stock.
- [ ] Mock error codes appear as toasts.

### PRD conformance

- [ ] Order status set is `MENUNGGU`, `DIPROSES`, `SELESAI`, `DIBATALKAN`; no `SIAP`/`DIANTAR`.
- [ ] Item status set includes `COMPLETED`; order becomes `SELESAI` only when every item is `COMPLETED` or `CANCELLED`.
- [ ] Totals use `service_rate` + `tax_rate` snapshots, integer rupiah, round half up.
- [ ] `order_number` follows `TA-###` / `DI-###`.
- [ ] Cashier creates `TAKE_AWAY` orders only; owner creates none.
- [ ] Payment confirmation is idempotent.
- [ ] Kitchen has "Masak" and "Pass/Counter" tabs with the auto-deliver warning.
- [ ] Table session can be closed by `CASHIER`/`OWNER`.
- [ ] Audit log is readable by `OWNER`.

### API

- [ ] Backend is running on `:8081`.
- [ ] Live login works.
- [ ] Page refresh keeps the session via the refresh cookie.
- [ ] Logout clears the session.
- [ ] Cashier can create a take away order.
- [ ] Cashier can mark payment `LUNAS`.
- [ ] Kitchen can only process paid orders.
- [ ] Cashier can move take away items `READY → DELIVERED → COMPLETED`.
- [ ] Kitchen can move items `PENDING → COOKING → READY → DELIVERED` and override `COMPLETED`.
- [ ] Owner can cancel an unpaid order, and stock is restored.
- [ ] Live polling updates the board within 5 seconds; the socket updates it faster when connected.
- [ ] API errors follow the backend envelope and error codes.

## Excluded

- Unit testing.
- Component testing.
- E2E testing.
- Redux or Zustand.
- Playwright until the MVP flow is stable.

WebSocket is in scope (PRD §11.4); polling 3–5 s is the fallback, not the primary transport. Reports endpoints stay out of Phase 3 (PRD §17 phase 2) and keep running on mocks.
