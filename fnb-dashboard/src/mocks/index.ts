import { ingredients, recipeItems } from './data/ingredients'
import { categories, menus } from './data/menus'
import { orders } from './data/orders'
import { settings } from './data/settings'
import { stockMovements } from './data/stockMovements'
import { tables } from './data/tables'
import { users } from './data/users'
import { db } from './db'

export * from './handlers'

const seed = () => {
  db.orders = structuredClone(orders)
  db.menus = structuredClone(menus)
  db.categories = structuredClone(categories)
  db.tables = structuredClone(tables)
  db.users = structuredClone(users)
  db.ingredients = structuredClone(ingredients)
  db.recipeItems = structuredClone(recipeItems)
  db.stockMovements = structuredClone(stockMovements)
  db.settings = structuredClone(settings)
}

seed()
