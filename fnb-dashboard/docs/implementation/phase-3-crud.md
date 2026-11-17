# Phase 3 (Dashboard) — Operations Administration CRUD (Mock)

Plan for PRD "Phase 2 — Operations Administration" features, built against the mock layer (`src/api/`).

Naming note: `phase-3.md` in `implementation-plan.md` is API integration. This file is `phase-3-crud.md` to avoid collision. Still fully mocked — no axios, no real backend.

Goal: replace all owner stub pages with working CRUD screens. Signatures follow `../docs/api.md` so the future API swap changes handlers only, not UI.

## Scope

- Menu & category CRUD + mark unavailable.
- Table CRUD + QR token display.
- Stock: ingredient CRUD, restock, recipe items, low-stock warning, stock movements.
- Users CRUD (create `CASHIER`/`KITCHEN`, activate/deactivate).
- Settings (`cafe_name`, `tax_percent`, `is_open`).

Out of scope:

- Menu photo upload (needs backend static files; UI ships an `image_url` field, upload lands with API phase).
- Charts/reports (PRD Phase 3 Insights — Reports stays a stub).
- Recipe-edit restriction while `is_open` (server-side rule, enforced when real API lands).

## Step 1 — Types and mock handlers

1. **Extend `src/types/stock.ts`**

   ```ts
   export type StockMovement = {
     id: string
     ingredient_id: string
     type: 'IN' | 'OUT'
     qty: number
     created_at: string
     note?: string
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

6. **`src/components/data-table.tsx`** — thin wrapper: `Table` + generic column config + loading skeleton + `Empty` state. ponytail: no TanStack Table — a column map over `TableRow`s suffices at this scale; swap when sorting/pagination are needed.

7. **`src/components/confirm-dialog.tsx`** — `AlertDialog` wrapper used by all deletes/deactivations.

8. **Pattern per resource** (repeat, do not over-abstract):
   - `use<Thing>s()` — TanStack Query, default `staleTime`; no polling on CRUD pages (only orders poll).
   - `<Thing>FormDialog` — React Hook Form + Zod schema, shared between create/edit via optional `editing?: Thing` prop.
   - Mutations call `api.*`; `onSuccess` → invalidate query key + `toast.success`; `onError` → `toastApiError`.

## Step 3 — Menus page (`src/pages/MenusPage.tsx`)

9. Categories with `sort_order` (auto-assigned at end + editable number input), menus grouped by category right (Card grid). Category header shows Edit/Delete; delete disabled when category has menus.
10. `menuSchema`: `name` min 1, `price` integer ≥ 0, `category_id` required, `image_url` optional, `is_available` boolean. `category_id` is editable in form (moves menu between categories).
11. Menu card: image (`object-cover`, h-28) dimmed (`opacity-60 grayscale`) when unavailable, fallback to 2-char initials in pastel color block (shared `src/lib/menu.ts`), name, price (`formatRupiah`). Card footer: availability `Switch` (`Tersedia`/`Habis`) + `Edit` button.
12. Card footer switch toggles `is_available` via `updateMenu`; no dropdown, **no Delete button on menu card** — PRD Phase 2 specifies "Mark menus unavailable" only; soft delete remains in mock handler for API parity.
13. Menu form (`sm:max-w-lg`): live image preview, 2-column grid on `sm` with required markers. Price input masked as `type="text" inputMode="numeric"` rendered with `toLocaleString('id-ID')` and `Rp` prefix (same pattern as `OrderPaymentPage` "Uang Diterima"); value sent to API stays integer rupiah. All fields keep the component default height (`h-8`) — the price input only adds the `Rp` prefix and mono font, never a height override. Image accepts a URL; upload via multipart deferred to API phase (PRD §7 "Upload menu photos locally through the backend and static files").
14. `Category` type gains `sort_order: number` (PRD §9). `getMenuCategories` returns categories sorted by `sort_order` asc. `createCategory` auto-assigns `sort_order = count + 1`. `updateCategory` accepts `sort_order`.
15. `updateMenu` mock handler accepts `category_id?` and moves the menu between category arrays in `db.categories`.
16. Mock seed in `src/mocks/index.ts` fixed: `category.menus` references same objects as `db.menus` so toggling availability in UI reflects immediately.

## Step 4 — Tables page (`src/pages/TablesPage.tsx`)

17. List: number, `is_active` badge, `qr_token` (truncated, copy via `navigator.clipboard`), Edit, Deactivate.
18. `tableSchema`: `number` min 1.
19. Mock `createTable` generates `qr_token` — same shape the backend will return. ponytail: QR image rendering deferred; show token + copy, add `qrcode` package when the QR Menu needs scannable images.

## Step 5 — Stock page (`src/pages/StockPage.tsx`)

20. Tabs: `Ingredients` | `Recipes` | `Movements`.
21. Ingredients: name, unit, stock (`Badge` variant `destructive` when stock < `LOW_STOCK_THRESHOLD` — new constant in `src/constants/stock.ts`, default 10), restock button (dialog: qty integer ≥ 1), create/edit.
22. Recipes: rows menu → ingredient → qty; create dialog with `Select` for menu and ingredient; edit qty; delete.
23. Movements: simple list table (`IN`/`OUT`/`RESTORE` badge, qty, date, ingredient name).

## Step 6 — Users page (`src/pages/UsersPage.tsx`)

24. List: name, email, role `Badge`, `is_active` badge, toggle activate/deactivate (`ConfirmDialog`), Edit name.
25. Create dialog: name, email, role `Select` (`CASHIER`/`KITCHEN` only).
26. Deactivating own account is blocked in the handler and disabled in the UI.

## Step 7 — Settings page (`src/pages/SettingsPage.tsx`)

27. Form: `cafe_name` (Input), `tax_percent` (number Input, 0–100), `is_open` (`Switch` with description "Toko tutup menolak order baru").
28. `settingsSchema` (Zod); save via `updateSettings`; invalidate `['settings']` (the manual-order dialog reads it).
29. Turning the store off shows an inline warning.

## Step 8 — Wire routes

30. `src/App.tsx`: replace `StubPage` entries with the real pages (`MENUS`, `TABLES`, `STOCK`, `USERS`, `SETTINGS`). Keep `Reports` as `StubPage` (PRD Phase 3 Insights).

## Step 9 — Verify

```bash
npm run lint
npm run format:check
npm run build
```

Manual checklist:

- Owner: all 6 pages CRUD works; CASHIER/KITCHEN blocked by `RoleGuard`.
- Low-stock badge appears under threshold; restock increases stock and writes a movement.
- Toggling a menu unavailable shows it disabled in the manual-order dialog.
- Settings `is_open` off disables `CreateOrderDialog` (existing behavior re-verified).
- Deactivated user cannot login (mock `login` already checks `is_active`).

## Definition of Done

- [ ] All mock handlers per Step 1 exist, typed, role-guarded, error-coded.
- [ ] Menus, Tables, Stock, Users, Settings pages replace stubs.
- [ ] Low-stock warning, restock, and movements work.
- [ ] Settings changes reflect in the order creation flow.
- [ ] Reports remains the only stub.
- [ ] lint, format:check, build pass.
