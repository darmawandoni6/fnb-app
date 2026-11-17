# FNB Dashboard — Implementation Plan

## Scope

Plan for the internal dashboard based on:

- `../docs/PRD.md`
- `../docs/flow.md`
- `../docs/api.md`
- `../docs/api-response.md`
- `docs/tech-stack.md`

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

    - QR and `MANUAL` orders.
    - Order statuses `MENUNGGU`, `DIPROSES`, `SIAP`, `DIANTAR`, `SELESAI`, `DIBATALKAN`.
    - Item statuses `PENDING`, `COOKING`, `READY`, `DELIVERED`, `CANCELLED`.
    - Payments `BELUM` and `LUNAS`.
    - Menus and categories.
    - Tables, users, ingredients, and settings.

12. Implement mock transitions per PRD §5.2:

    - `PENDING` → `COOKING`
    - `COOKING` → `READY`
    - `READY` → `DELIVERED`
    - `PENDING` → `CANCELLED`

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
28. Create `OrdersPage` as a kanban board:

    - `MENUNGGU`
    - `DIPROSES`
    - `SIAP`
    - `DIANTAR`
    - `SELESAI`

29. Create `OrderCard` containing:

    - Order number.
    - Order type (QR or manual).
    - Table number.
    - Order time.
    - Total.
    - Payment badge.
    - Item list.
    - Item status.
    - Action buttons.

30. Implement cashier actions:

    - Mark order `LUNAS`.
    - Choose payment method `CASH` or `NON_CASH`.
    - `READY` → `DELIVERED`.
    - Cancel a `PENDING` item.

31. Create `PaymentDialog`.
32. Disable actions when the role or transition is not allowed.
33. Add loading skeletons and empty states.

### 2.4 Kitchen Board

34. Create `KitchenPage`.
35. Query orders with the required status filter, e.g. `?status=DIPROSES`.
36. Display items in columns:

    - `PENDING`
    - `COOKING`
    - `READY`

37. Implement kitchen actions:

    - `PENDING` → `COOKING`.
    - `COOKING` → `READY`.

38. Ensure a `BELUM` order cannot move to `COOKING`.
39. Use a wide layout for kitchen monitors.

### 2.5 Manual Order (POS & Payment Flow)

See `docs/implementation/phase-2.6-pos.md` for detail.

40. Create dedicated POS page (`NewOrderPage` at `/orders/new`) replacing the simple modal dialog:
    - Left column: Category tabs, search input, and menu catalog grid with 2-character initials when images are absent.
    - Right column: Order cart panel with Dine In (mandatory table select) vs Take Away toggle, mandatory customer name, item notes, subtotal, tax calculation, and hold draft (park order to `localStorage`).
41. Create dedicated Checkout & Payment page (`OrderPaymentPage` at `/orders/:id/payment`):
    - Order preview & handling cashier info.
    - Cash payment (amount received, quick nominal buttons, change calculation) and Non-cash payment (QRIS, Debit, Transfer).
    - Status lifecycle: order starts as `MENUNGGU` & `BELUM`, updates to `LUNAS` upon payment completion, making it available for kitchen cooking (`PENDING` → `COOKING` → `DIPROSES`).
    - Printable receipt modal with `window.print()` and return navigation.
    - Back returns to `/orders/new`; unpaid orders require confirmation before leaving.
    - Unpaid orders with all items `PENDING` can be cancelled after confirmation; cancellation restores mock stock.
    - Order-board payment actions use this checkout page instead of the legacy payment modal.
42. Submit `createManualOrder` with items, customer name, dining option, and table number.
43. Handle `STORE_CLOSED` with a toast and disable actions.
44. Add mock/API contract `POST /orders/:id/cancel` for unpaid orders whose items are all `PENDING`, including stock restoration.

### 2.6 Owner Stub Pages

48. Create stub pages for:

    - Menus.
    - Tables.
    - Stock.
    - Reports.
    - Settings.
    - Users.

49. Use the `Empty` component for features not yet in Phase 1.

### 2.7 Reports Slicing (Mock)

See `docs/implementation/phase-3.5-reports.md` for detail.

- Slicing Tabbed View for `/reports` (`OWNER` role).
- Global Preset Filter (`today`, `last_7_days`, `last_30_days`, `this_month`).
- Tab 1: Ringkasan Sales Overview KPI Cards + Sales Trend Chart (Recharts).
- Tab 2: Menu & Category Performance Charts (Top 10 Menus + Category Share).
- Tab 3: Transaction History Table + Client-side CSV Export.
- Mock contracts and 30-day realistic historical generator in `src/mocks/`.

### 2.7 Reports Slicing (Mock)

See `docs/implementation/phase-3.5-reports.md` for detail.

- Slicing Tabbed View for `/reports` (`OWNER` role).
- Global Preset Filter (`today`, `last_7_days`, `last_30_days`, `this_month`).
- Tab 1: Ringkasan Sales Overview KPI Cards + Sales Trend Chart (Recharts).
- Tab 2: Menu & Category Performance Charts (Top 10 Menus + Category Share).
- Tab 3: Transaction History Table + Client-side CSV Export.
- Mock contracts and 30-day realistic historical generator in `src/mocks/`.

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
    5. Tables.
    6. Stock.
    7. Users and settings.

55. Implement the order endpoints:

    - `GET /orders`.
    - `GET /orders/:id`.
    - `POST /orders/manual`.
    - `PATCH /orders/:id/payment`.
    - `PATCH /orders/:id/items/:item_id/status`.
    - `POST /orders/:id/items/:item_id/cancel`.

55b. Mock alignment with PRD §9 & flow.md (separate commit): - `cancelItem` restores recipe stock, writes `StockMovement` with type `RESTORE` and `order_item_id`. - `StockMovement` type extended: `IN` | `OUT` | `RESTORE` | `ADJUSTMENT` + optional `order_item_id`. - When all items become `CANCELLED`, set `subtotal_amount = tax_amount = total_amount = 0` and order status `DIBATALKAN`. - Remove full-order cancel endpoint `POST /orders/:id/cancel` (not in PRD §10). Payment page cancels all `PENDING` items by iterating `cancelItem`. - Note: refund calculation for `LUNAS` orders (PRD §9 baris 375-395) recorded as gap; no `Refund` type in mock yet.

56. Verify live API polling with two dashboard sessions.
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
- [ ] Mock item statuses follow the transition matrix.
- [ ] Mock error codes appear as toasts.

### API

- [ ] Backend is running on `:8081`.
- [ ] Live login works.
- [ ] Page refresh keeps the session via the refresh cookie.
- [ ] Logout clears the session.
- [ ] Cashier can create a manual order.
- [ ] Cashier can mark payment `LUNAS`.
- [ ] Kitchen can only process paid orders.
- [ ] Cashier can change `READY` to `DELIVERED`.
- [ ] Live polling updates the board within 5 seconds.
- [ ] API errors follow the backend envelope and error codes.

## Excluded

- Unit testing.
- Component testing.
- E2E testing.
- WebSocket or SSE.
- Redux or Zustand.
- Chart library until reports are implemented.
- Playwright until the MVP flow is stable.
