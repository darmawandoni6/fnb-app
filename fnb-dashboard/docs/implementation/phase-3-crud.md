# Phase 3 (Dashboard) — Operations Administration CRUD (Mock)

Plan for PRD "Phase 2 — Operations Administration" features, built against the mock layer (`src/api/`).

Naming note: `phase-3.md` in `implementation-plan.md` is API integration. This file is `phase-3-crud.md` to avoid collision. Still fully mocked — no axios, no real backend.

Goal: replace all owner stub pages with working CRUD screens. Signatures follow `../docs/api.md` so the future API swap changes handlers only, not UI.

## Scope

- Menu & category CRUD + mark unavailable.
- Table creation, QR grid, QR preview, and bulk QR printing.
- Stock: ingredient CRUD, restock, recipe items, low-stock warning, stock movements.
- Users CRUD (create `CASHIER`/`KITCHEN`, activate/deactivate).
- Settings (`cafe_name`, `tax_percent`, `is_open`).

Out of scope:

- Menu photo upload (needs backend static files; UI ships an `image_url` field, upload lands with API phase).
- Table QR token rotation (needs `POST /tables/:id/rotate-qr`; existing labels would have to be reprinted).
- Editing an existing table number (create-only; wrong numbers are deactivated and recreated).
- Charts/reports (PRD Phase 3 Insights — Reports stays a stub).
- Recipe-edit restriction while `is_open` (server-side rule, enforced when real API lands).

## Step 1 — Types and mock handlers

1. **Extend `src/types/stock.ts`**

   ```ts
   export type StockMovement = {
     id: string
     ingredient_id: string
     type: 'IN' | 'OUT' | 'RESTORE' | 'ADJUSTMENT'
     qty: number
     created_at: string
     note?: string
     order_item_id?: string | null
   }
   ```

2. **Mock fixtures**: add `src/mocks/data/stockMovements.ts` with seeded `IN` movements.

3. **New/extended handlers** (mock signatures = future `src/api/http` functions):

   `src/mocks/handlers/menus.ts` (extend):
   - `getMenuCategories()` — exists.
   - `createMenu({ name, price, category_id, image_url })` → `Menu`
   - `updateMenu(id, { name?, price?, is_available?, image_url? })` → `Menu`
   - `deleteMenu(id)` → void (soft: `is_available: false`)
   - `createCategory({ name })`, `updateCategory(id, { name })`, `deleteCategory(id)` — delete blocked when category has menus → `VALIDATION_ERROR`

   `src/mocks/handlers/tables.ts` (new):
   - `getTables()` → `Table[]`
   - `createTable({ number })` → `Table` (mock generates `qr_token`)
   - `updateTable(id, { number?, is_active? })` → `Table`
   - `deleteTable(id)` → void (deactivate)
   - OWNER-only → `FORBIDDEN` otherwise.

   `src/mocks/handlers/stock.ts` (new):
   - `getIngredients()` → `Ingredient[]`
   - `createIngredient({ name, unit, stock })` → `Ingredient`
   - `updateIngredient(id, { name?, unit? })` → `Ingredient`
   - `restockIngredient(id, { qty })` → `Ingredient` (adds stock, writes movement `IN`, OWNER-only)
   - `getRecipeItems()` → `RecipeItem[]`
   - `createRecipeItem({ menu_id, ingredient_id, qty })`, `updateRecipeItem(id, { qty })`, `deleteRecipeItem(id)`
   - `getStockMovements(ingredient_id?)` → `StockMovement[]`

   `src/mocks/handlers/users.ts` (new):
   - `getUsers()` → `User[]`
   - `createUser({ name, email, role })` → `User` (role limited to `CASHIER`/`KITCHEN` → `VALIDATION_ERROR` otherwise; duplicate email → `VALIDATION_ERROR`)
   - `updateUser(id, { name?, is_active? })` → `User`; deactivating self → `VALIDATION_ERROR`
   - OWNER-only.

   `src/mocks/handlers/settings.ts` (new):
   - `getSettings()` — moved from `auth.ts`.
   - `updateSettings({ cafe_name?, tax_percent?, is_open? })` → `Settings`; OWNER-only; `tax_percent` must be an integer 0–100.

   Re-export everything in `src/mocks/handlers/index.ts`.

4. **ponytail:** no pagination/search params in mock handlers — add when real API shapes demand them.

## Step 2 — Shared CRUD building blocks

5. **`src/lib/errors.ts`** — `toastApiError(error)`: toasts `message`. Replaces repeated `onError` lambdas from Phase 2 (no behavior change).

6. **`src/components/data-table.tsx`** — generic data table on `@tanstack/react-table@9` (`useTable` + `tableFeatures`: `columnFilteringFeature`, `rowSortingFeature`, `filteredRowModel`, `sortedRowModel`). Props: `columns`, `data`, `empty`. Renders `Table` primitives, empty-state row, and exposes toolbar controls via column filter state at the call site. First consumer: `/stock` ingredients.

7. **`src/components/confirm-dialog.tsx`** — `AlertDialog` wrapper used by all deletes/deactivations.

8. **Pattern per resource** (repeat, do not over-abstract):
   - `use<Thing>s()` — TanStack Query, default `staleTime`; no polling on CRUD pages (only orders poll).
   - `<Thing>FormDialog` — React Hook Form + Zod schema, shared between create/edit via optional `editing?: Thing` prop.
   - Mutations call `api.*`; `onSuccess` → invalidate query key + `toast.success`; `onError` → `toastApiError`.

## Step 3 — Menus page (`src/pages/MenusPage.tsx`)

9. Categories with `sort_order` (auto-assigned at end + editable number input), menus grouped by category right (Card grid). Category header shows Edit/Delete; delete disabled when category has menus.
10. `menuSchema`: `name` min 1, `price` integer ≥ 0, `category_id` required, `image_url` optional, `is_available` boolean. `category_id` is editable in form (moves menu between categories).
11. Menu card: image (`object-cover`, h-28) dimmed (`opacity-60 grayscale`) when unavailable, fallback to 2-char initials in pastel color block (shared `src/lib/menu.ts`), name, price (`formatRupiah`). Card footer: availability `Switch` (`Tersedia`/`Habis`) + `Resep` button (ingredient count badge) + `Edit` button.
12. Card footer switch toggles `is_available` via `updateMenu`; no dropdown, **no Delete button on menu card** — PRD Phase 2 specifies "Mark menus unavailable" only; soft delete remains in mock handler for API parity.
13. Menu form (`sm:max-w-lg`): live image preview, 2-column grid on `sm` with required markers. Price input masked as `type="text" inputMode="numeric"` rendered with `toLocaleString('id-ID')` and `Rp` prefix (same pattern as `OrderPaymentPage` "Uang Diterima"); value sent to API stays integer rupiah. All fields keep the component default height (`h-8`) — the price input only adds the `Rp` prefix and mono font, never a height override. Image accepts a URL; upload via multipart deferred to API phase (PRD §7 "Upload menu photos locally through the backend and static files").
14. `Category` type gains `sort_order: number` (PRD §9). `getMenuCategories` returns categories sorted by `sort_order` asc. `createCategory` auto-assigns `sort_order = count + 1`. `updateCategory` accepts `sort_order`.
15. `updateMenu` mock handler accepts `category_id?` and moves the menu between category arrays in `db.categories`.
16. Mock seed in `src/mocks/index.ts` fixed: `category.menus` references same objects as `db.menus` so toggling availability in UI reflects immediately.

Recipe editing lives on the menu card, not `/stock`: `src/features/menus/RecipeDialog.tsx` opens from the `Resep` button and shows that menu's ingredient table with editable `qty_used`, an add row (ingredient `Select` + qty), and delete via `ConfirmDialog`. Per PRD §8 the handler rejects create/update/delete with `STORE_CLOSED` while `settings.is_open = true`; the dialog stays readable and disables every action behind a "tutup toko dulu" banner.

## Step 4 — Tables page (`src/pages/TablesPage.tsx`)

17. Grid of table cards (`sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`). Each card: `Meja {number}`, QR thumbnail (`QRCodeSVG`, size 96, `marginSize={2}`, level `M`, dimmed when inactive), status badge, availability `Switch` (two-way, `updateTable` `is_active`), and a `Preview QR` button. No edit action — table numbers are create-only in this slice.
18. `tableSchema`: `number` min 1. `+ Meja` dialog creates a table; mock `createTable` generates `qr_token`.
19. `getTables` sorts by `table_number` numerically (fallback `localeCompare`), and `updateTable` rejects a duplicate number with `VALIDATION_ERROR` — same rule as `createTable`.
20. `TableQrDialog`: large QR (`size={224}`, `marginSize={4}`, level `M`), `qr_token` in mono with copy, `Cetak` (`window.print()`), and `Buka QR Menu` (`window.open(getTableQrUrl(token), '_blank', 'noopener,noreferrer')`). Token + copy exist so the public endpoints can be tested without scanning.
21. No "generate ulang" action: `qr_token` is immutable in M1, so re-rendering only redraws the same image. Recorded gap — add the button when `POST /tables/:id/rotate-qr` exists (old QR stops working, labels must be reprinted).
22. `PrintAllTablesDialog`: header button opens a 2×2 A4 preview of active tables only, then `Cetak`. Cards come from `TableQrCard` (same component as the preview dialog): `settings.cafe_name` header, "Scan untuk lihat menu" caption, QR, then a small `Meja` label with the number in large type. Printing relies on the print-only container in `src/index.css`, which also fixes `PaymentReceiptDialog` printing the whole dashboard.
23. `src/lib/qr.ts` exposes `QR_MENU_URL` and `getTableQrUrl(token)` = `${VITE_QR_MENU_URL}/?meja=<qr_token>`. No default: when the env is empty the QR dialog warns and `Buka QR Menu` is disabled. Contract documented in `docs/api.md`.

## Step 5 — Stock page (`src/pages/StockPage.tsx`)

20. Layout: one screen, no tabs and no summary cards. `grid gap-4 lg:grid-cols-3` — ingredients panel `lg:col-span-2`, movements panel `lg:col-span-1`; below `lg` they stack with ingredients first. Ingredient counts live in the status filter chips.
21. Types follow PRD §9: `Ingredient.stock_qty` + `Ingredient.min_stock`, `RecipeItem.qty_used`, `StockMovement.order_id`. `LOW_STOCK_THRESHOLD` is deleted from `src/constants/stock.ts`.
22. Ingredients panel is a `Card` (title + description) wrapping the generic `src/components/data-table.tsx` (TanStack Table v9): a name search column filter, chips `Semua (n)` / `Menipis (n)` / `Habis (n)` / `Aman (n)` driving the `status` filter, sorting on `name` and `stock_qty`, and pagination (`pageSize` 10, footer shows range + Sebelumnya/Berikutnya, rendered whenever rows exist so the range line is always visible).
23. Columns: Nama bahan, Sisa stok (number colored `text-destructive` at 0, `amber-700/dark:amber-300` when `0 < stock_qty <= min_stock`, `emerald-700/dark:emerald-300` otherwise, muted unit beside it), Batas bawah (`min_stock` + unit), Status `Badge`, Aksi dropdown. All quantities render through `formatNumber` (`src/lib/format.ts`, `id-ID`) so thousands use dots (`1.000`, `+2.000`).
24. One color per status, shared by number, chip, and badge: Habis `text-destructive` on `bg-destructive/10`; Menipis amber 700/300 on `bg-amber-500/10`; Aman emerald 700/300 on `bg-emerald-500/10`; neutral `Semua` uses `bg-muted`. Chip active = soft tint + `ring-1` in the status color; badges use `variant="outline"` plus the same tint. Movement type badges stay neutral `outline` because the signed qty already carries direction. See `/home/doni/.opencode/plan/stock-color-pattern.md`.
25. Aksi dropdown: Restock (`IN`, optional note), Sesuaikan stok (`ADJUSTMENT` opname), Edit bahan (name/unit/`min_stock`), Lihat pemakaian (read-only dialog with menu names + qty per portion). No delete — PRD never lists it and `recipe_items`/`stock_movements` reference ingredients.
26. `ingredientSchema` requires `min_stock` (integer ≥ 0, default 0). `restockSchema` adds an optional `note`. `adjustStockSchema` takes the counted `stock_qty` plus an optional note.
27. Movements panel is a grouped list, not a table: chips `Semua` / `Masuk` / `Keluar` map by the PRD §9 qty sign (`qty > 0` masuk covers `IN`, `RESTORE`, positive `ADJUSTMENT`; `qty < 0` keluar covers `OUT`, negative `ADJUSTMENT`). Rows show ingredient + relative time, type `Badge`, signed colored qty with unit, and note (`#order_id` or free text); grouped by `Hari ini` / `Kemarin` / date. Internal scroll (`lg:h-[calc(100vh-8rem)]`, mobile `max-h-96`), all movements newest first.
28. Restock writes `IN`; Sesuaikan writes `ADJUSTMENT` with the signed delta and rejects an unchanged count. Opname is an extension beyond PRD Phase 2 — documented in `docs/api.md` and `docs/flow.md`.
29. Order creation writes `OUT` (negative) per recipe with `order_id`/`order_item_id`; item cancellation writes `RESTORE` (positive). The log is append-only; corrections are new `ADJUSTMENT` rows.
30. Seed: realistic `min_stock`, several lowered stocks, one ingredient at 0, movements spread across days. `src/mocks/selfcheck.ts`: assert `min_stock` persists, order writes a negative `OUT`, adjust writes `ADJUSTMENT`, cancel writes `RESTORE`, and recipe writes are rejected with `STORE_CLOSED` while the store is open.

## Step 6 — Users page (`src/pages/UsersPage.tsx`)

30. List: name, email, role `Badge`, `is_active` badge, toggle activate/deactivate (`ConfirmDialog`), Edit name.
31. Create dialog: name, email, role `Select` (`CASHIER`/`KITCHEN` only).
32. Deactivating own account is blocked in the handler and disabled in the UI.

## Step 7 — Settings page (`src/pages/SettingsPage.tsx`)

33. Form: `cafe_name` (Input), `tax_percent` (number Input, 0–100), `is_open` (`Switch` with description "Toko tutup menolak order baru").
34. `settingsSchema` (Zod); save via `updateSettings`; invalidate `['settings']` (the manual-order dialog reads it).
35. Turning the store off shows an inline warning.

## Step 8 — Wire routes

36. `src/App.tsx`: replace `StubPage` entries with the real pages (`MENUS`, `TABLES`, `STOCK`, `USERS`, `SETTINGS`). Keep `Reports` as `StubPage` (PRD Phase 3 Insights).

## Step 9 — Verify

```bash
npm run lint
npm run format:check
npm run build
```

Manual checklist:

- Owner: all 6 pages CRUD works; CASHIER/KITCHEN blocked by `RoleGuard`.
- Low-stock card populates from the seed; menipis/habis badges match `min_stock`; restock increases stock and writes `IN`; `Sesuaikan stok` writes `ADJUSTMENT`; creating and cancelling an order writes `OUT`/`RESTORE`.
- Toggling a menu unavailable shows it disabled in the manual-order dialog.
- Tables grid shows QR thumbnails; switch deactivates/activates a table; duplicate numbers are rejected.
- `Cetak Semua QR` prints only active tables, 2×2 per A4, without dashboard chrome.
- With `VITE_QR_MENU_URL` empty, `Buka QR Menu` is disabled and the QR dialog warns; with it set, the button opens `${VITE_QR_MENU_URL}/?meja=<qr_token>` in a new tab.
- Settings `is_open` off disables `CreateOrderDialog` (existing behavior re-verified).
- Deactivated user cannot login (mock `login` already checks `is_active`).

## Definition of Done

- [ ] All mock handlers per Step 1 exist, typed, role-guarded, error-coded.
- [ ] Menus, Tables, Stock, Users, Settings pages replace stubs.
- [ ] Low-stock warning, restock, and movements work.
- [ ] Settings changes reflect in the order creation flow.
- [ ] Reports remains the only stub.
- [ ] lint, format:check, build pass.
