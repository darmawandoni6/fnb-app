export type Ingredient = {
  id: string
  name: string
  unit: string
  stock_qty: number
  min_stock: number
}

export type RecipeItem = {
  id: string
  menu_id: string
  ingredient_id: string
  qty_used: number
}

export type StockMovementType = 'IN' | 'OUT' | 'RESTORE' | 'ADJUSTMENT'

export type StockMovement = {
  id: string
  ingredient_id: string
  type: StockMovementType
  /** Signed per PRD §9: positive incoming (IN/RESTORE), negative outgoing (OUT). ADJUSTMENT carries the delta. */
  qty: number
  created_at: string
  note?: string
  order_id?: string | null
  order_item_id?: string | null
}
