# Phase 2.7 — Menus and Recipes

Granular plan for executing section 2.7 from `../implementation-plan.md`.

## Scope

`/menus` catalog: categories, menus, and recipes. `OWNER` has full CRUD; `CASHIER` may only flip `is_available`. PRD §7.2, §7.4, BR-23.

## Status

DONE — all tasks complete.

## Files

- `src/pages/MenusPage.tsx`
- `src/features/menus/MenuCard.tsx`
- `src/features/menus/MenuFormDialog.tsx`
- `src/features/menus/CategorySection.tsx`
- `src/features/menus/CategoryFormDialog.tsx`
- `src/features/menus/DeleteCategoryButton.tsx`
- `src/features/menus/RecipeDialog.tsx`
- `src/features/menus/menuSchema.ts`
- `src/App.tsx` (route guard)
- `src/auth/guards.tsx` (sidebar group)

## Tasks

- [x] Category CRUD; deleting a category with menus returns `INVALID_TRANSITION`.
- [x] Menu CRUD with name, price, category, availability, and optional image.
- [x] Recipe editing through `RecipeDialog`, rejected with `STORE_CLOSED` while `settings.is_open` is true (BR-23); reading recipes stays allowed.
- [x] Open `/menus` to `CASHIER` in `App.tsx` (add `USER_ROLE.CASHIER` to the route guard) and add the sidebar entry for the cashier.
- [x] Cashier view: catalog read-only except an availability switch per menu, calling `updateMenu(id, { is_available })`.
- [x] Hide `MenuFormDialog`, `CategoryFormDialog`, `DeleteCategoryButton`, and `RecipeDialog` from `CASHIER`; the mock already answers `FORBIDDEN` for other fields, so the UI must not offer them.

## Verification

- `CASHIER` can switch availability and sees the effect in the POS catalog.
- `CASHIER` sees no create, edit, delete, or recipe controls.
- Recipe edit while the store is open shows the `STORE_CLOSED` message from the server.
- `KITCHEN` still has no access to `/menus`.
