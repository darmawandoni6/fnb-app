import {
  API_ERROR_CODE,
  ITEM_STATUS,
  type ItemStatus,
  ORDER_STATUS,
  type OrderStatus,
  PAYMENT_STATUS,
} from '@/constants'
import { db } from '@/mocks/db'
import type { Order } from '@/types'

import { currentUser, delay, fail, isStaff, requireRole } from './shared'

type OrderFilters = { status?: OrderStatus; table_id?: string; date?: string }
type OrderItemInput = { menu_id: string; qty: number; note: string | null }

const findOrder = (id: string): Order => {
  const order = db.orders.find((candidate) => candidate.id === id)
  return order ?? fail(API_ERROR_CODE.NOT_FOUND, 'Order not found')
}

const findMenu = (id: string) => {
  const menu = db.menus.find((candidate) => candidate.id === id)
  return menu ?? fail(API_ERROR_CODE.VALIDATION_ERROR, 'Menu is unavailable')
}

const deriveStatus = (order: Order): OrderStatus => {
  const active = order.items.filter(({ status }) => status !== ITEM_STATUS.CANCELLED)
  if (active.length === 0) return ORDER_STATUS.DIBATALKAN
  if (order.payment_status === PAYMENT_STATUS.BELUM) return ORDER_STATUS.MENUNGGU
  if (active.some(({ status }) => status === ITEM_STATUS.PENDING || status === ITEM_STATUS.COOKING))
    return ORDER_STATUS.DIPROSES
  if (active.every(({ status }) => status === ITEM_STATUS.DELIVERED)) return ORDER_STATUS.SELESAI
  if (active.some(({ status }) => status === ITEM_STATUS.DELIVERED)) return ORDER_STATUS.DIANTAR
  return ORDER_STATUS.SIAP
}

export const getOrders = async (filters?: OrderFilters): Promise<Order[]> => {
  await delay()
  const orders = db.orders.filter(
    (order) =>
      (!filters?.status || order.status === filters.status) &&
      (!filters?.table_id || order.table_id === filters.table_id) &&
      (!filters?.date || order.created_at.startsWith(filters.date)),
  )
  return orders.map((order) => structuredClone(order))
}

export const getOrder = async (id: string): Promise<Order> => {
  await delay()
  return structuredClone(findOrder(id))
}

export const createManualOrder = async (body: { items: OrderItemInput[] }): Promise<Order> => {
  await delay()
  requireRole('OWNER', 'CASHIER')
  if (!db.settings.is_open) fail(API_ERROR_CODE.STORE_CLOSED, 'Store is closed')
  if (body.items.length === 0 || body.items.some(({ qty }) => !Number.isInteger(qty) || qty < 1)) {
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Order requires valid items')
  }
  const resolved = body.items.map((input) => {
    const menu = findMenu(input.menu_id)
    if (!menu.is_available) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Menu is unavailable')
    const recipes = db.recipeItems.filter(({ menu_id }) => menu_id === input.menu_id)
    recipes.forEach((recipe) => {
      const ingredient = db.ingredients.find(({ id }) => id === recipe.ingredient_id)
      if (!ingredient || ingredient.stock < recipe.qty * input.qty)
        fail(API_ERROR_CODE.STOCK_NOT_ENOUGH, 'Insufficient stock')
    })
    return { input, menu, recipes }
  })
  resolved.forEach(({ input, recipes }) =>
    recipes.forEach((recipe) => {
      const ingredient = db.ingredients.find(({ id }) => id === recipe.ingredient_id)
      if (ingredient) ingredient.stock -= recipe.qty * input.qty
    }),
  )
  const items = resolved.map(({ input, menu }, index) => ({
    id: `item-${Date.now()}-${index}`,
    menu_id: menu.id,
    menu_name: menu.name,
    qty: input.qty,
    unit_price: menu.price,
    note: input.note,
    status: ITEM_STATUS.PENDING,
  }))
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.unit_price, 0)
  const order: Order = {
    id: `order-${Date.now()}`,
    order_type: 'MANUAL',
    table_id: null,
    table_number: null,
    status: ORDER_STATUS.MENUNGGU,
    payment_status: PAYMENT_STATUS.BELUM,
    payment_method: null,
    subtotal_amount: subtotal,
    tax_amount: Math.round((subtotal * db.settings.tax_percent) / 100),
    tax_percent: db.settings.tax_percent,
    total_amount: subtotal + Math.round((subtotal * db.settings.tax_percent) / 100),
    created_at: new Date().toISOString(),
    items,
  }
  db.orders.unshift(order)
  return structuredClone(order)
}

export const updateItemStatus = async (
  orderId: string,
  itemId: string,
  status: ItemStatus,
): Promise<Order> => {
  await delay()
  const user = currentUser()
  const order = findOrder(orderId)
  const item = order.items.find(({ id }) => id === itemId)
  if (!item) fail(API_ERROR_CODE.NOT_FOUND, 'Item not found')
  const orderItem = item!
  const allowed =
    (orderItem.status === ITEM_STATUS.PENDING && status === ITEM_STATUS.COOKING) ||
    (orderItem.status === ITEM_STATUS.COOKING && status === ITEM_STATUS.READY) ||
    (orderItem.status === ITEM_STATUS.READY && status === ITEM_STATUS.DELIVERED)
  if (!allowed) fail(API_ERROR_CODE.INVALID_TRANSITION, 'Invalid item transition')
  if (status === ITEM_STATUS.COOKING && order.payment_status === PAYMENT_STATUS.BELUM)
    fail(API_ERROR_CODE.PAYMENT_REQUIRED, 'Payment required')
  const kitchenAction = status === ITEM_STATUS.COOKING || status === ITEM_STATUS.READY
  if (kitchenAction && !['OWNER', 'KITCHEN'].includes(user.role))
    fail(API_ERROR_CODE.FORBIDDEN, 'Role is not authorized')
  if (status === ITEM_STATUS.DELIVERED && !isStaff(user.role))
    fail(API_ERROR_CODE.FORBIDDEN, 'Role is not authorized')
  orderItem.status = status
  order.status = deriveStatus(order)
  return structuredClone(order)
}

export const cancelItem = async (orderId: string, itemId: string): Promise<Order> => {
  await delay()
  requireRole('OWNER', 'CASHIER')
  const order = findOrder(orderId)
  const item = order.items.find(({ id }) => id === itemId)
  if (!item) fail(API_ERROR_CODE.NOT_FOUND, 'Item not found')
  const orderItem = item!
  if (orderItem.status !== ITEM_STATUS.PENDING)
    fail(API_ERROR_CODE.INVALID_TRANSITION, 'Only pending items can be cancelled')
  orderItem.status = ITEM_STATUS.CANCELLED
  order.status = deriveStatus(order)
  return structuredClone(order)
}
