import { ingredients, recipeItems } from './data/ingredients'
import { categories, menus } from './data/menus'
import { orders } from './data/orders'
import { generateHistoricalOrders } from './data/reports'
import { settings } from './data/settings'
import { stockMovements } from './data/stockMovements'
import { tableSessions, tables } from './data/tables'
import { users } from './data/users'
import { db } from './db'

export * from './handlers'

const seed = () => {
  db.orders = [...structuredClone(orders), ...generateHistoricalOrders()]
  db.menus = structuredClone(menus)
  // Build categories referencing the same menu objects from db.menus
  const menuById = new Map(db.menus.map((m) => [m.id, m]))
  db.categories = structuredClone(categories).map((cat) => ({
    ...cat,
    menus: cat.menus.map((m) => menuById.get(m.id)!).filter(Boolean),
  }))
  db.tables = structuredClone(tables)
  db.tableSessions = structuredClone(tableSessions)
  db.users = structuredClone(users)
  db.ingredients = structuredClone(ingredients)
  db.recipeItems = structuredClone(recipeItems)
  db.stockMovements = structuredClone(stockMovements)
  db.settings = structuredClone(settings)
  db.auditLog = []
}

seed()
