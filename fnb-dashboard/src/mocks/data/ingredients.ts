import type { Ingredient, RecipeItem } from '@/types'

export const ingredients: Ingredient[] = [
  { id: 'ingredient-1', name: 'Biji kopi', unit: 'gram', stock_qty: 250, min_stock: 300 },
  { id: 'ingredient-2', name: 'Susu', unit: 'ml', stock_qty: 800, min_stock: 1000 },
  { id: 'ingredient-3', name: 'Beras', unit: 'gram', stock_qty: 4000, min_stock: 1000 },
  { id: 'ingredient-4', name: 'Teh', unit: 'gram', stock_qty: 0, min_stock: 200 },
  { id: 'ingredient-5', name: 'Kentang', unit: 'gram', stock_qty: 1200, min_stock: 500 },
]

export const recipeItems: RecipeItem[] = [
  { id: 'recipe-1', menu_id: 'menu-1', ingredient_id: 'ingredient-1', qty_used: 20 },
  { id: 'recipe-2', menu_id: 'menu-1', ingredient_id: 'ingredient-2', qty_used: 150 },
  { id: 'recipe-3', menu_id: 'menu-2', ingredient_id: 'ingredient-1', qty_used: 18 },
  { id: 'recipe-4', menu_id: 'menu-5', ingredient_id: 'ingredient-3', qty_used: 150 },
  { id: 'recipe-5', menu_id: 'menu-6', ingredient_id: 'ingredient-5', qty_used: 200 },
]
