# Phase 2.9 — Stock

Granular plan for executing section 2.9 from `../implementation-plan.md`.

## Scope

`/stock` for `OWNER` (full) and `CASHIER` (read-only). Ingredients, recipes consumption, movements, restock, and opname. PRD §7.2, §7.4, §10.8–§10.10, BR-21.

## Status

DONE — all tasks complete.

## Files

- `src/pages/StockPage.tsx`
- `src/features/stock/IngredientsPanel.tsx`
- `src/features/stock/MovementsPanel.tsx`
- `src/features/stock/IngredientFormDialog.tsx`
- `src/features/stock/RestockDialog.tsx`
- `src/features/stock/AdjustStockDialog.tsx`
- `src/features/stock/IngredientUsageDialog.tsx`
- `src/features/stock/stockSchemas.ts`
- `src/components/data-table.tsx`

## Tasks

- [x] Types follow PRD §10.8–§10.10: `stock_qty`, `min_stock`, `qty_used`, and `stock_movements.order_id`; no global low-stock threshold constant.
- [x] One-screen two-panel layout: ingredients two thirds left, movements one third right, stacked below `lg`.
- [x] Ingredients panel uses `data-table.tsx` (TanStack Table) with name search, status chips `Semua` / `Menipis` / `Habis` / `Aman` with counts, sorting, and pagination.
- [x] Three-tier stock colour shared across the number, the chip, and the badge; quantities formatted through `id-ID`.
- [x] Aksi menu: restock (`IN`), stock opname (`ADJUSTMENT`, rejects a count equal to the current stock), edit ingredient, read-only usage.
- [x] Movements panel: grouped by date, chips `Semua` / `Masuk` / `Keluar` mapped from the sign, signed coloured quantity, `#order_id` note, internal scroll.
- [x] Order creation writes `OUT` per recipe item; cancellation writes `RESTORE`; the log stays append-only.
- [x] `CASHIER` reads ingredients and movements and sees no mutating controls.

## Verification

- Opname with an unchanged count returns `VALIDATION_ERROR`.
- Creating an order decreases stock and appends `OUT` rows; cancelling restores it with `RESTORE` rows.
- `CASHIER` sees no create, restock, opname, or edit control.
