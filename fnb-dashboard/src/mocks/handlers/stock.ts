import { API_ERROR_CODE, USER_ROLE } from '@/constants'
import { db } from '@/mocks/db'
import type { Ingredient, RecipeItem, StockMovement } from '@/types'

import { delay, fail, findOrThrow, requireRole } from './shared'

export const getIngredients = async (): Promise<Ingredient[]> => {
  await delay()
  return db.ingredients.map((ingredient) => ({ ...ingredient }))
}

export const createIngredient = async ({
  name,
  unit,
  stock,
}: {
  name: string
  unit: string
  stock: number
}): Promise<Ingredient> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  if (!name.trim() || !unit.trim())
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nama dan satuan wajib diisi')
  if (!Number.isInteger(stock) || stock < 0)
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Stok tidak valid')
  const ingredient: Ingredient = { id: `ingredient-${Date.now()}`, name, unit, stock }
  db.ingredients.push(ingredient)
  return { ...ingredient }
}

export const updateIngredient = async (
  id: string,
  body: { name?: string; unit?: string },
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
  return { ...ingredient }
}

export const restockIngredient = async (
  id: string,
  { qty }: { qty: number },
): Promise<Ingredient> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  if (!Number.isInteger(qty) || qty < 1) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Jumlah tidak valid')
  const ingredient = findOrThrow(
    db.ingredients.find((candidate) => candidate.id === id),
    API_ERROR_CODE.NOT_FOUND,
    'Bahan tidak ditemukan',
  )
  ingredient.stock += qty
  db.stockMovements.unshift({
    id: `movement-${Date.now()}`,
    ingredient_id: id,
    type: 'IN',
    qty,
    created_at: new Date().toISOString(),
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
  qty,
}: {
  menu_id: string
  ingredient_id: string
  qty: number
}): Promise<RecipeItem> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  if (!Number.isInteger(qty) || qty < 1) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Jumlah tidak valid')
  if (!db.menus.some((menu) => menu.id === menu_id))
    fail(API_ERROR_CODE.NOT_FOUND, 'Menu tidak ditemukan')
  if (!db.ingredients.some((ingredient) => ingredient.id === ingredient_id)) {
    fail(API_ERROR_CODE.NOT_FOUND, 'Bahan tidak ditemukan')
  }
  const recipeItem: RecipeItem = { id: `recipe-${Date.now()}`, menu_id, ingredient_id, qty }
  db.recipeItems.push(recipeItem)
  return { ...recipeItem }
}

export const updateRecipeItem = async (
  id: string,
  { qty }: { qty: number },
): Promise<RecipeItem> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  if (!Number.isInteger(qty) || qty < 1) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Jumlah tidak valid')
  const recipeItem = findOrThrow(
    db.recipeItems.find((candidate) => candidate.id === id),
    API_ERROR_CODE.NOT_FOUND,
    'Recipe tidak ditemukan',
  )
  recipeItem.qty = qty
  return { ...recipeItem }
}

export const deleteRecipeItem = async (id: string): Promise<void> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  findOrThrow(
    db.recipeItems.find((candidate) => candidate.id === id),
    API_ERROR_CODE.NOT_FOUND,
    'Recipe tidak ditemukan',
  )
  db.recipeItems = db.recipeItems.filter((candidate) => candidate.id !== id)
}

export const getStockMovements = async (ingredientId?: string): Promise<StockMovement[]> => {
  await delay()
  return db.stockMovements.filter(
    (movement) => !ingredientId || movement.ingredient_id === ingredientId,
  )
}
