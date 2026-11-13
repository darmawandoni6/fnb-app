import type { Category, Ingredient, Menu, Order, RecipeItem, Settings, Table, User } from '@/types'

// ponytail: module state resets on page reload; replace with API persistence in Phase 3.
export const db = {
  orders: [] as Order[],
  menus: [] as Menu[],
  categories: [] as Category[],
  tables: [] as Table[],
  users: [] as User[],
  ingredients: [] as Ingredient[],
  recipeItems: [] as RecipeItem[],
  settings: { cafe_name: 'Demo Cafe', tax_percent: 10, is_open: true } as Settings,
  currentUserId: '',
}
