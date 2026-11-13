export type Ingredient = {
  id: string
  name: string
  unit: string
  stock: number
}

export type RecipeItem = {
  id: string
  menu_id: string
  ingredient_id: string
  qty: number
}

export type StockMovement = {
  id: string
  ingredient_id: string
  type: 'IN' | 'OUT'
  qty: number
  created_at: string
  note?: string
}
