import type { Ingredient, RecipeItem, StockMovement } from '@/types'

import { request } from '../client'

type ServerIngredient = {
  id: string
  name: string
  unit: string
  stock_qty: number
  min_stock: number
  created_at: string
  updated_at: string
}

type ServerRecipeItem = RecipeItem

type ServerStockMovement = StockMovement

const toIngredient = (ing: ServerIngredient): Ingredient => ({
  id: ing.id,
  name: ing.name,
  unit: ing.unit,
  stock_qty: ing.stock_qty,
  min_stock: ing.min_stock,
})

export const getIngredients = () =>
  request<ServerIngredient[]>({ method: 'GET', url: '/ingredients' }).then((arr) =>
    arr.map(toIngredient),
  )

export const createIngredient = async ({
  name,
  unit,
  min_stock,
}: {
  name: string
  unit: string
  min_stock: number
}): Promise<Ingredient> => {
  const ing = await request<ServerIngredient>({
    method: 'POST',
    url: '/ingredients',
    data: { name, unit, min_stock },
  })
  return toIngredient(ing)
}

export const updateIngredient = async (
  id: string,
  { name, unit, min_stock }: { name?: string; unit?: string; min_stock?: number },
): Promise<Ingredient> => {
  const ingredients = await request<ServerIngredient[]>({ method: 'GET', url: '/ingredients' })
  const current = ingredients.find((ing) => ing.id === id)
  if (!current) throw new Error('Ingredient not found')
  const data: { name: string; unit: string; min_stock: number } = {
    name: current.name,
    unit: current.unit,
    min_stock: current.min_stock,
  }
  if (name !== undefined) data.name = name
  if (unit !== undefined) data.unit = unit
  if (min_stock !== undefined) data.min_stock = min_stock
  const ing = await request<ServerIngredient>({
    method: 'PATCH',
    url: `/ingredients/${id}`,
    data,
  })
  return toIngredient(ing)
}

export const restockIngredient = async (
  id: string,
  { qty, note }: { qty: number; note?: string | null },
): Promise<Ingredient> => {
  await request<{ ingredient_id: string; qty: number }>({
    method: 'POST',
    url: `/ingredients/${id}/restock`,
    data: { qty, note },
  })
  const ingredients = await request<ServerIngredient[]>({ method: 'GET', url: '/ingredients' })
  const ing = ingredients.find((i) => i.id === id)
  if (!ing) throw new Error('Ingredient not found after restock')
  return toIngredient(ing)
}

export const adjustIngredient = async (
  id: string,
  { stock_qty, note }: { stock_qty: number; note?: string | null },
): Promise<Ingredient> => {
  await request<{ ingredient_id: string; stock_qty: number; delta: number }>({
    method: 'POST',
    url: `/ingredients/${id}/adjust`,
    data: { stock_qty, note },
  })
  const ingredients = await request<ServerIngredient[]>({ method: 'GET', url: '/ingredients' })
  const ing = ingredients.find((i) => i.id === id)
  if (!ing) throw new Error('Ingredient not found after adjust')
  return toIngredient(ing)
}

export const getStockMovements = (filters?: {
  ingredient_id?: string
  type?: StockMovement['type']
  from?: string
  to?: string
}) => request<ServerStockMovement[]>({ method: 'GET', url: '/stock-movements', params: filters })

export const getRecipeItems = () =>
  request<ServerRecipeItem[]>({ method: 'GET', url: '/recipe-items' })

export const createRecipeItem = async ({
  menu_id,
  ingredient_id,
  qty_used,
}: {
  menu_id: string
  ingredient_id: string
  qty_used: number
}): Promise<RecipeItem> =>
  request<ServerRecipeItem>({
    method: 'POST',
    url: '/recipe-items',
    data: { menu_id, ingredient_id, qty_used },
  })

export const updateRecipeItem = async (
  id: string,
  { qty_used }: { qty_used: number },
): Promise<RecipeItem> =>
  request<ServerRecipeItem>({ method: 'PATCH', url: `/recipe-items/${id}`, data: { qty_used } })

export const deleteRecipeItem = async (id: string): Promise<void> => {
  await request<void>({ method: 'DELETE', url: `/recipe-items/${id}` })
}
