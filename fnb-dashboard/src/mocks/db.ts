import type {
  AuditLogEntry,
  Category,
  Ingredient,
  Menu,
  Order,
  RecipeItem,
  Settings,
  StockMovement,
  Table,
  TableSession,
  User,
} from '@/types'

// ponytail: module state resets on page reload; replace with API persistence in Phase 3.
export const db = {
  orders: [] as Order[],
  menus: [] as Menu[],
  categories: [] as Category[],
  tables: [] as Table[],
  tableSessions: [] as TableSession[],
  users: [] as User[],
  ingredients: [] as Ingredient[],
  recipeItems: [] as RecipeItem[],
  settings: {
    cafe_name: 'Demo Cafe',
    service_rate: 5,
    tax_rate: 10,
    is_open: true,
    cash_timeout_minutes: 15,
    delivered_auto_complete_minutes: 5,
    ready_auto_deliver_minutes: 10,
    ready_auto_deliver_warning_minutes: 2,
  } as Settings,
  stockMovements: [] as StockMovement[],
  auditLog: [] as AuditLogEntry[],
  currentUserId: '',
}
