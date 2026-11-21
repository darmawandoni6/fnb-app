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
11. **`OrdersPage`** — kanban columns `MENUNGGU`, `DIPROSES`, `SELESAI`, `DIBATALKAN` (PRD §5.1). Bucket by backend `order.status` for display only; never recompute status or money.
12. **`OrderCard`** — `order_number`, `DINE_IN`/`TAKE_AWAY` badge, table, time, rupiah total, payment badge/method, item list/status, actions.
13. **Cashier actions** — mutations invalidate `['orders']` on success:
    - Confirm `BELUM` → `LUNAS` through the payment page with `CASH`/`NON_CASH`.
    - `READY` → `DELIVERED` and `DELIVERED` → `COMPLETED` for `TAKE_AWAY` only.
    - No cancellation; cancelling an unpaid order is `OWNER`-only and order-level.
14. **Payment page** — cash tendering (`amount_received`, `change_amount`) and non-cash confirmation; idempotent retry; disable while pending; errors toast backend `message` and branch by `code`.
15. Hide invalid role/transition actions. Server/mock handler remains authorization source.
16. Add loading skeletons and empty states.

## Step 4 — Kitchen Board

17. **`KitchenPage`** — wide layout for kitchen monitors, two tabs: "Masak" and "Pass/Counter" (PRD §4.4).
18. Query `useOrders()` with `refetchInterval: 5_000`; keep only `LUNAS` orders that still have an item outside `COMPLETED`/`CANCELLED`.
19. Item columns: Masak `PENDING`, `COOKING`; Pass/Counter `READY`, `DELIVERED`; cards show order plus item.
20. Kitchen actions: `PENDING` → `COOKING`; `COOKING` → `READY`; `READY` → `DELIVERED`; `DELIVERED` → `COMPLETED` override. Toast `PAYMENT_REQUIRED` and other API errors.
21. Show the auto-deliver warning from `ready_auto_deliver_warning_minutes` before `ready_auto_deliver_minutes`.

## Step 5 — Manual Order

22. **`CreateOrderDialog`** — OrdersPage entry point for `CASHIER` only (BR-01, BR-24); menus grouped by category from `api.getMenuCategories()`. `TAKE_AWAY` only, no table selection.
23. Quantity controls and optional item notes with `Textarea`.
24. Display-only price summary with subtotal, service charge, tax, and total. Server remains total source of truth.
25. **`manualOrderSchema`** — `items` min 1; integer `qty >= 1`; optional `note`; required `customer_name`; optional `customer_phone`; required `payment_method`.
26. Submit `api.createManualOrder`; success closes dialog, invalidates orders, toast.
27. Error handling:
    - `STORE_CLOSED` → toast and disable form.
    - `STOCK_NOT_ENOUGH` / `VALIDATION_ERROR` → toast `message`.
28. Add `getSettings()` to mock handlers and disable form when `settings.is_open` is false.

## Step 6 — Owner Stub Pages

29. Create shared `StubPage` using `Empty`, with title prop, for Menus, Tables, Stock, Reports, Settings, Users, Audit Log.

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
- [ ] Cashier board supports payment and take away hand-over (`READY → DELIVERED → COMPLETED`).
- [ ] Kitchen board has Masak and Pass/Counter tabs with the full transition set.
- [ ] Manual order is `TAKE_AWAY` only and available to `CASHIER` only.
- [ ] Owner stub pages exist, including Audit Log.
- [ ] Polling uses a 5-second interval and cleans up on unmount.
- [ ] No client-side status or money source-of-truth logic.
- [ ] `npm run lint`, `npm run format:check`, and `npm run build` pass.
