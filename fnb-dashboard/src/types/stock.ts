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
