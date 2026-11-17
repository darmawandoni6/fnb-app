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
  type: 'IN' | 'OUT' | 'RESTORE' | 'ADJUSTMENT'
  qty: number
  created_at: string
  note?: string
  order_item_id?: string | null
}
