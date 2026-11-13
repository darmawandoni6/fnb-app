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

9. Categories left (create/edit/delete), menus grouped by category right (Card grid).
10. `menuSchema`: `name` min 1, `price` integer ≥ 0, `category_id` required.
11. Menu card: name, price (`formatRupiah`), availability `Badge` + toggle `Switch` (`updateMenu` `is_available`), Edit/Delete.
12. Optional image URL field (`Input`), rendered as thumbnail when set. ponytail: real upload lands with the API phase.
13. Delete menu is soft (`is_available: false`) with `ConfirmDialog`.

## Step 4 — Tables page (`src/pages/TablesPage.tsx`)

14. List: number, `is_active` badge, `qr_token` (truncated, copy via `navigator.clipboard`), Edit, Deactivate.
15. `tableSchema`: `number` min 1.
16. Mock `createTable` generates `qr_token` — same shape the backend will return. ponytail: QR image rendering deferred; show token + copy, add `qrcode` package when the QR Menu needs scannable images.

## Step 5 — Stock page (`src/pages/StockPage.tsx`)

17. Tabs: `Ingredients` | `Recipes` | `Movements`.
18. Ingredients: name, unit, stock (`Badge` variant `destructive` when stock < `LOW_STOCK_THRESHOLD` — new constant in `src/constants/stock.ts`, default 10), restock button (dialog: qty integer ≥ 1), create/edit.
19. Recipes: rows menu → ingredient → qty; create dialog with `Select` for menu and ingredient; edit qty; delete.
20. Movements: simple list table (`IN`/`OUT` badge, qty, date, ingredient name).

## Step 6 — Users page (`src/pages/UsersPage.tsx`)

21. List: name, email, role `Badge`, `is_active` badge, toggle activate/deactivate (`ConfirmDialog`), Edit name.
22. Create dialog: name, email, role `Select` (`CASHIER`/`KITCHEN` only).
23. Deactivating own account is blocked in the handler and disabled in the UI.

## Step 7 — Settings page (`src/pages/SettingsPage.tsx`)

24. Form: `cafe_name` (Input), `tax_percent` (number Input, 0–100), `is_open` (`Switch` with description "Toko tutup menolak order baru").
25. `settingsSchema` (Zod); save via `updateSettings`; invalidate `['settings']` (the manual-order dialog reads it).
26. Turning the store off shows an inline warning.

## Step 8 — Wire routes

27. `src/App.tsx`: replace `StubPage` entries with the real pages (`MENUS`, `TABLES`, `STOCK`, `USERS`, `SETTINGS`). Keep `Reports` as `StubPage` (PRD Phase 3 Insights).

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
