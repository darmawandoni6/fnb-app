# Phase 2.5 — Sidebar Template + Orders Dashboard Enhancements

## Part A — shadcn `sidebar-08` Template

Goal: replace manual `DashboardLayout` sidebar with the official collapsible inset sidebar block.

### Steps

1. **Install block**

   ```bash
   npx shadcn@latest add sidebar-08
   ```

   Gotchas (AGENTS.md):
   - If `EALLOWSCRIPTS`, pre-install missing deps manually then re-run.
   - Check output lands in `src/`, not a stray literal `@/` folder — move if needed.
   - Inspect generated files for `next/*` imports; replace with Vite equivalents.

2. **Adjust for Vite + react-router**
   - Replace `next/navigation` (`usePathname`, `useRouter`) with `react-router-dom` (`useLocation`, `useNavigate`).
   - `next-themes` already installed; `Toaster`/theme usage stays.
   - Keep existing route constants from `src/constants/routes.ts`.

3. **Create `src/components/app-sidebar.tsx`**
   - `AppSidebar` receives user from `useAuth()`.
   - Nav items built from existing `dashboardLinks(role)` in `src/auth/guards.tsx` (single source of truth stays there).
   - Footer: user name + role + logout button.

4. **Refactor `src/pages/DashboardLayout.tsx`**
   - Wrap: `SidebarProvider` → `AppSidebar` + `SidebarInset`.
   - `SidebarInset` header: `SidebarTrigger` + page title.
   - `<main>` renders `<Outlet />`.
   - Remove old `<aside>` markup; keep logout behavior.

5. **Verify**
   ```bash
   npm run lint && npm run format:check && npm run build
   ```
   Manual: sidebar collapses/expands, active item highlights per route, all roles see correct menus, logout works.

## Part B — Orders Dashboard Enhancements

Feature coverage from Phase 2 already: active orders (kanban), unpaid badge per card, `SELESAI` column. This part adds what is missing:

- Summary stat cards (counts + sales today).
- Dedicated "belum bayar" filter/view.
- Today's sales total (sum of `LUNAS` orders for today's UTC date, using `total_amount` from server data — display only).
- Order tracking detail (dialog per order).

### Steps

6. **`src/features/orders/useOrderStats.ts`**
   - Reuses `useOrders({ date: todayUTC() })` output (same query key as board — single poll, no extra requests).
   - Helper `todayUTC()` in `src/lib/format.ts`: `new Date().toISOString().slice(0, 10)`.
   - Computes (display-only aggregation of server data):
     - `activeCount` — status in `MENUNGGU | DIPROSES | SIAP | DIANTAR`
     - `unpaidCount` — `payment_status === 'BELUM'`
     - `doneCount` — status `SELESAI`
     - `salesToday` — sum `total_amount` where `payment_status === 'LUNAS'`
   - ponytail: aggregation is a reduce over already-fetched data, not a new endpoint; replace with server stats endpoint if Phase 3 insights demands it.

7. **Stat cards row above kanban in `OrdersPage`**
   - 4 `Card`s: Pesanan Aktif, Belum Bayar, Selesai Hari Ini, Penjualan Hari Ini (`formatRupiah`).
   - Cards for `Belum Bayar` and `Selesai` act as filters: clicking toggles the board view mode (`all | unpaid | done`).

8. **Order tracking detail dialog (`src/features/orders/OrderDetailDialog.tsx`)**
   - Triggered by clicking an `OrderCard`.
   - Shows full items table (`Table` component): name, qty, note, unit price, item status.
   - Totals block: subtotal, tax, total (all from `Order` fields — read-only).
   - Timeline of item statuses (`PENDING`/`COOKING`/`READY`/`DELIVERED`/`CANCELLED`) — tracking view, no actions here.
   - Payment info: status + method.

9. **Verify**
   - Stats update within 5 s via existing polling.
   - Filters toggle correctly.
   - Detail dialog renders all order data.
   ```bash
   npm run lint && npm run format:check && npm run build
   ```

## Out of scope (deferred to PRD Phase 3 Insights)

- Charts, transaction history table, downloadable reports.

## Definition of Done

- [ ] sidebar-08 installed, adapted to react-router, no Next imports remain.
- [ ] Sidebar collapses; role-based menu preserved; logout accessible.
- [ ] 4 stat cards render live data; sales figure uses server amounts only.
- [ ] Board filter modes: all / unpaid / done.
- [ ] Order detail dialog shows items, totals, payment, item status timeline.
- [ ] lint, format:check, build all pass.
