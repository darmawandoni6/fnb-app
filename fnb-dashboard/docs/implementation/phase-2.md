# Phase 2 — UI Slicing with Mock

Granular plan for executing Phase 2 from `../implementation-plan.md`.

Goal: all three role UIs working against mock API via `src/api/`. No real auth flow — mock login with role selection.

## Structure Additions

```text
src/auth/          # AuthContext, ProtectedRoute, RoleGuard
src/features/      # orders/, kitchen/, manual-order/, stubs
src/pages/         # LoginPage, OrdersPage, KitchenPage, stub pages
```

## Step 1 — App Shell

1. **`main.tsx`** — remove self-check call, wrap: `QueryClientProvider` → `AuthProvider` → `RouterProvider` → `Toaster`. `QueryClient` defaults: `staleTime: 4_000`, `retry: 1`.
2. **Routes** with `createBrowserRouter`: `/login`; protected `/` layout; `/orders` for `CASHIER`/`OWNER`; `/kitchen` for `KITCHEN`/`OWNER`; `/menus`, `/tables`, `/stock`, `/users`, `/settings`, `/reports` for `OWNER`.
3. **`src/auth/context.tsx`** — `AuthContext` with `{ user, isLoading, login, logout }`. Access token stays in memory only. On mount, call `api.refresh()` once; `UNAUTHORIZED` leaves user logged out.
4. **`ProtectedRoute`** — redirect `/login` without user. **`RoleGuard`** — render `Empty` forbidden state or redirect for unauthorized role.
5. **Dashboard layout** — role sidebar:
   - OWNER: Orders, Menus, Tables, Stock, Users, Settings, Reports
   - CASHIER: Orders
   - KITCHEN: Kitchen Board
   - Non-Phase-2 items use `Empty` “Coming soon” stubs.
6. **Mock login role selection** — show three seeded demo accounts so all roles are slicable.

## Step 2 — Auth Feature

7. **`LoginPage`** — card with email/password fields and demo role buttons.
8. **`src/features/auth/loginSchema.ts`** — Zod: valid email, password min 1.
9. React Hook Form + `zodResolver`; submit calls `api.login`, then navigate to `ROUTES.DASHBOARD`. Show loading, inline errors, and success/failure toast via Sonner.

## Step 3 — Cashier Order Board

10. **`src/features/orders/useOrders(filters)`** — TanStack Query key `['orders', filters]`, `queryFn: api.getOrders`, `refetchInterval: 5_000`.
11. **`OrdersPage`** — kanban columns `MENUNGGU`, `DIPROSES`, `SIAP`, `DIANTAR`, `SELESAI`. Bucket by backend `order.status` for display only; never recompute status or money.
12. **`OrderCard`** — order ID, QR/MANUAL badge, table, time, rupiah total, payment badge/method, item list/status, actions.
13. **Cashier actions** — mutations invalidate `['orders']` on success:
    - Mark `LUNAS` through `PaymentDialog` with `CASH`/`NON_CASH`.
    - `READY` → `DELIVERED`.
    - Cancel `PENDING` item after `AlertDialog` confirmation.
14. **`PaymentDialog`** — payment method select; disable while pending; errors toast backend `message` and branch by `code`.
15. Hide invalid role/transition actions. Server/mock handler remains authorization source.
16. Add loading skeletons and empty states.

## Step 4 — Kitchen Board

17. **`KitchenPage`** — wide layout for kitchen monitors.
18. Query `useOrders({ status: 'DIPROSES' })` with `refetchInterval: 5_000`.
19. Item columns: `PENDING`, `COOKING`, `READY`; cards show order plus item.
20. Kitchen actions: `PENDING` → `COOKING`; `COOKING` → `READY`. Toast `PAYMENT_REQUIRED` and other API errors.

## Step 5 — Manual Order

21. **`CreateOrderDialog`** — OrdersPage entry point for CASHIER/OWNER; menus grouped by category from `api.getMenuCategories()`.
22. Quantity controls and optional item notes with `Textarea`.
23. Display-only price summary. Server remains total source of truth.
24. **`manualOrderSchema`** — `items` min 1; integer `qty >= 1`; optional `note`.
25. Submit `api.createManualOrder`; success closes dialog, invalidates orders, toast.
26. Error handling:
    - `STORE_CLOSED` → toast and disable form.
    - `STOCK_NOT_ENOUGH` / `VALIDATION_ERROR` → toast `message`.
27. Add `getSettings()` to mock handlers and disable form when `settings.is_open` is false.

## Step 6 — Owner Stub Pages

28. Create shared `StubPage` using `Empty`, with title prop, for Menus, Tables, Stock, Reports, Settings, Users.

## Step 7 — Formatting and Verification

Money formatting is required now: add `src/lib/format.ts` with `Intl.NumberFormat('id-ID')`. Keep integer rupiah.

No new dependencies. Use uncontrolled dialog state where possible; use React Hook Form only where schema exists.

```bash
npm run lint
npm run format:check
npm run build
```

Manual checks:

- Login as each mock role.
- OWNER sees owner menu; CASHIER sees Orders; KITCHEN sees Kitchen Board.
- Protected routes reject unauthenticated users.
- Orders and kitchen polling updates within 5 seconds.
- Payment succeeds and invalid payment shows error toast.
- Item transitions follow backend matrix.
- Manual order creates order and refreshes board.
- Closed store disables manual-order form.
- Loading, empty, error, and success states display.

## Definition of Done

- [ ] App shell, auth context, protected routes, role guards exist.
- [ ] Login supports all seeded mock roles.
- [ ] Cashier board supports payment, delivery, and cancellation flows.
- [ ] Kitchen board supports cooking and ready flows.
- [ ] Manual order supports menus, quantities, notes, validation, and errors.
- [ ] Owner stub pages exist.
- [ ] Polling uses 5-second interval and cleans up on unmount.
- [ ] No client-side status or money source-of-truth logic.
- [ ] `npm run lint`, `npm run format:check`, and `npm run build` pass.
