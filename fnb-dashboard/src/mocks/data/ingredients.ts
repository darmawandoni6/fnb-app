import type { Ingredient, RecipeItem } from '@/types'

export const ingredients: Ingredient[] = [
  { id: 'ingredient-1', name: 'Biji kopi', unit: 'gram', stock: 1000 },
  { id: 'ingredient-2', name: 'Susu', unit: 'ml', stock: 3000 },
  { id: 'ingredient-3', name: 'Beras', unit: 'gram', stock: 5000 },
  { id: 'ingredient-4', name: 'Teh', unit: 'gram', stock: 500 },
  { id: 'ingredient-5', name: 'Kentang', unit: 'gram', stock: 2000 },
]

export const recipeItems: RecipeItem[] = [
  { id: 'recipe-1', menu_id: 'menu-1', ingredient_id: 'ingredient-1', qty: 20 },
  { id: 'recipe-2', menu_id: 'menu-1', ingredient_id: 'ingredient-2', qty: 150 },
  { id: 'recipe-3', menu_id: 'menu-2', ingredient_id: 'ingredient-1', qty: 18 },
  { id: 'recipe-4', menu_id: 'menu-5', ingredient_id: 'ingredient-3', qty: 150 },
  { id: 'recipe-5', menu_id: 'menu-6', ingredient_id: 'ingredient-5', qty: 200 },
]
