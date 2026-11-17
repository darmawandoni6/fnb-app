import { API_ERROR_CODE, USER_ROLE } from '@/constants'
import { db } from '@/mocks/db'
import type { Ingredient, RecipeItem, StockMovement, StockMovementType } from '@/types'

import { delay, fail, findOrThrow, requireRole } from './shared'

export type StockMovementFilters = {
  ingredient_id?: string
  type?: StockMovementType
  from?: string
  to?: string
}

const requireStockQty = (value: number) => {
  if (!Number.isInteger(value) || value < 0)
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Stok tidak valid')
}

// PRD §8: recipes are finalized before opening; edits only while the store is closed.
const requireStoreClosed = () => {
  if (db.settings.is_open) fail(API_ERROR_CODE.STORE_CLOSED, 'Tutup toko dulu untuk mengubah resep')
}

export const getIngredients = async (): Promise<Ingredient[]> => {
  await delay()
  return db.ingredients.map((ingredient) => ({ ...ingredient }))
}

export const createIngredient = async ({
  name,
  unit,
  stock_qty,
  min_stock,
}: {
  name: string
  unit: string
  stock_qty: number
  min_stock: number
}): Promise<Ingredient> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  if (!name.trim() || !unit.trim())
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nama dan satuan wajib diisi')
  requireStockQty(stock_qty)
  requireStockQty(min_stock)
  const ingredient: Ingredient = {
    id: `ingredient-${Date.now()}`,
    name,
    unit,
    stock_qty,
    min_stock,
  }
  db.ingredients.push(ingredient)
  if (stock_qty > 0) {
    db.stockMovements.unshift({
      id: `movement-opening-${Date.now()}`,
      ingredient_id: ingredient.id,
      type: 'ADJUSTMENT',
      qty: stock_qty,
      created_at: new Date().toISOString(),
      note: 'Stok awal',
    })
  }
  return { ...ingredient }
}

export const updateIngredient = async (
  id: string,
  body: { name?: string; unit?: string; min_stock?: number },
): Promise<Ingredient> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  const ingredient = findOrThrow(
    db.ingredients.find((candidate) => candidate.id === id),
    API_ERROR_CODE.NOT_FOUND,
    'Bahan tidak ditemukan',
  )
  if (body.name !== undefined) {
    if (!body.name.trim()) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nama wajib diisi')
    ingredient.name = body.name
  }
  if (body.unit !== undefined) {
    if (!body.unit.trim()) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Satuan wajib diisi')
    ingredient.unit = body.unit
  }
  if (body.min_stock !== undefined) {
    requireStockQty(body.min_stock)
    ingredient.min_stock = body.min_stock
  }
  return { ...ingredient }
}

export const restockIngredient = async (
  id: string,
  { qty, note }: { qty: number; note?: string },
): Promise<Ingredient> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  if (!Number.isInteger(qty) || qty < 1) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Jumlah tidak valid')
  const ingredient = findOrThrow(
    db.ingredients.find((candidate) => candidate.id === id),
    API_ERROR_CODE.NOT_FOUND,
    'Bahan tidak ditemukan',
  )
  ingredient.stock_qty += qty
  db.stockMovements.unshift({
    id: `movement-in-${Date.now()}`,
    ingredient_id: id,
    type: 'IN',
    qty,
    created_at: new Date().toISOString(),
    note: note?.trim() || undefined,
  })
  return { ...ingredient }
}

export const adjustIngredient = async (
  id: string,
  { stock_qty, note }: { stock_qty: number; note?: string },
): Promise<Ingredient> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  requireStockQty(stock_qty)
  const ingredient = findOrThrow(
    db.ingredients.find((candidate) => candidate.id === id),
    API_ERROR_CODE.NOT_FOUND,
    'Bahan tidak ditemukan',
  )
  const delta = stock_qty - ingredient.stock_qty
  if (delta === 0) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Stok fisik sama dengan stok sistem')
  ingredient.stock_qty = stock_qty
  db.stockMovements.unshift({
    id: `movement-adjust-${Date.now()}`,
    ingredient_id: id,
    type: 'ADJUSTMENT',
    qty: delta,
    created_at: new Date().toISOString(),
    note: note?.trim() || 'Koreksi stok',
  })
  return { ...ingredient }
}

export const getRecipeItems = async (): Promise<RecipeItem[]> => {
  await delay()
  return db.recipeItems.map((recipeItem) => ({ ...recipeItem }))
}

export const createRecipeItem = async ({
  menu_id,
  ingredient_id,
  qty_used,
}: {
  menu_id: string
  ingredient_id: string
  qty_used: number
}): Promise<RecipeItem> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  requireStoreClosed()
  if (!Number.isInteger(qty_used) || qty_used < 1)
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Jumlah tidak valid')
  if (!db.menus.some((menu) => menu.id === menu_id))
    fail(API_ERROR_CODE.NOT_FOUND, 'Menu tidak ditemukan')
  if (!db.ingredients.some((ingredient) => ingredient.id === ingredient_id)) {
    fail(API_ERROR_CODE.NOT_FOUND, 'Bahan tidak ditemukan')
  }
  if (
    db.recipeItems.some(
      (recipeItem) => recipeItem.menu_id === menu_id && recipeItem.ingredient_id === ingredient_id,
    )
  ) {
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Bahan sudah ada di resep menu ini')
  }
  const recipeItem: RecipeItem = { id: `recipe-${Date.now()}`, menu_id, ingredient_id, qty_used }
  db.recipeItems.push(recipeItem)
  return { ...recipeItem }
}

export const updateRecipeItem = async (
  id: string,
  { qty_used }: { qty_used: number },
): Promise<RecipeItem> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  requireStoreClosed()
  if (!Number.isInteger(qty_used) || qty_used < 1)
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Jumlah tidak valid')
  const recipeItem = findOrThrow(
    db.recipeItems.find((candidate) => candidate.id === id),
    API_ERROR_CODE.NOT_FOUND,
    'Recipe tidak ditemukan',
  )
  recipeItem.qty_used = qty_used
  return { ...recipeItem }
}

export const deleteRecipeItem = async (id: string): Promise<void> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  requireStoreClosed()
  findOrThrow(
    db.recipeItems.find((candidate) => candidate.id === id),
    API_ERROR_CODE.NOT_FOUND,
    'Recipe tidak ditemukan',
  )
  db.recipeItems = db.recipeItems.filter((candidate) => candidate.id !== id)
}

export const getStockMovements = async (
  filters?: StockMovementFilters,
): Promise<StockMovement[]> => {
  await delay()
  return db.stockMovements
    .filter(
      (movement) =>
        (!filters?.ingredient_id || movement.ingredient_id === filters.ingredient_id) &&
        (!filters?.type || movement.type === filters.type) &&
        (!filters?.from || movement.created_at >= filters.from) &&
        (!filters?.to || movement.created_at <= filters.to),
    )
    .map((movement) => ({ ...movement }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}
