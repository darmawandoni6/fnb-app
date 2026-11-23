import {
  API_ERROR_CODE,
  ITEM_STATUS,
  type ItemStatus,
  ORDER_STATUS,
  type OrderType,
  PAYMENT_STATUS,
  USER_ROLE,
} from '@/constants'
import { db } from '@/mocks/db'
import type { Order } from '@/types'

import { businessDay, formatOrderNumber, orderNumberSequence } from '@/lib/orderNumber'

import { deriveOrderStatus } from './deriveStatus'
import { audit, currentUser, delay, fail, findOrThrow, isStaff, requireRole } from './shared'

type OrderFilters = {
  status?: Order['status']
  table_id?: string
  order_type?: OrderType
  date?: string
}
type OrderItemInput = { menu_id: string; qty: number; note: string | null }
type CreateManualOrderInput = {
  items: OrderItemInput[]
  customer_name: string
  customer_phone?: string | null
  payment_method?: 'CASH' | 'NON_CASH'
}

const findOrder = (id: string): Order => {
  const order = db.orders.find((candidate) => candidate.id === id)
  return order ?? fail(API_ERROR_CODE.NOT_FOUND, 'Order not found')
}

const findMenu = (id: string) => {
  const menu = db.menus.find((candidate) => candidate.id === id)
  return menu ?? fail(API_ERROR_CODE.VALIDATION_ERROR, 'Menu is unavailable')
}

/** `../docs/api.md`: `DI-YYYYMMDD-SSS` / `TA-YYYYMMDD-SSS`, daily sequence per order type. */
const nextOrderNumber = (orderType: OrderType): string => {
  const day = businessDay()
  const highest = db.orders
    .filter((order) => order.order_type === orderType)
    .reduce(
      (max, order) => Math.max(max, orderNumberSequence(order.order_number, orderType, day)),
      0,
    )
  return formatOrderNumber(orderType, day, highest + 1)
}

export const getOrders = async (filters?: OrderFilters): Promise<Order[]> => {
  await delay()
  const paidOnly = currentUser().role === USER_ROLE.KITCHEN
  const day = filters?.date ?? businessDay()
  const orders = db.orders.filter(
    (order) =>
      (!paidOnly || order.payment_status === PAYMENT_STATUS.LUNAS) &&
      (!filters?.status || order.status === filters.status) &&
      (!filters?.table_id || order.table_id === filters.table_id) &&
      (!filters?.order_type || order.order_type === filters.order_type) &&
      businessDay(order.created_at) === day,
  )
  return orders.map((order) => structuredClone(order))
}

export const getOrder = async (id: string): Promise<Order> => {
  await delay()
  const order = findOrder(id)
  if (currentUser().role === USER_ROLE.KITCHEN && order.payment_status !== PAYMENT_STATUS.LUNAS)
    fail(API_ERROR_CODE.NOT_FOUND, 'Order not found')
  return structuredClone(order)
}

export const createManualOrder = async (body: CreateManualOrderInput): Promise<Order> => {
  await delay()
  // BR-01 / BR-24: cashier and owner create orders, and only take away.
  requireRole(USER_ROLE.CASHIER, USER_ROLE.OWNER)
  if (!db.settings.is_open) fail(API_ERROR_CODE.STORE_CLOSED, 'Store is closed')
  if (!body.customer_name?.trim())
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Customer name is required')
  if (body.items.length === 0 || body.items.some(({ qty }) => !Number.isInteger(qty) || qty < 1)) {
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Order requires valid items')
  }
  const resolved = body.items.map((input) => {
    const menu = findMenu(input.menu_id)
    if (!menu.is_available) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Menu is unavailable')
    const recipes = db.recipeItems.filter(({ menu_id }) => menu_id === input.menu_id)
    recipes.forEach((recipe) => {
      const ingredient = db.ingredients.find(({ id }) => id === recipe.ingredient_id)
      if (!ingredient || ingredient.stock_qty < recipe.qty_used * input.qty)
        fail(API_ERROR_CODE.STOCK_NOT_ENOUGH, 'Insufficient stock')
    })
    return { input, menu, recipes }
  })
  const orderId = `order-${Date.now()}`
  const createdAt = new Date().toISOString()
  const items = resolved.map(({ input, menu }, index) => ({
    id: `item-${Date.now()}-${index}`,
    menu_id: menu.id,
    menu_name_snapshot: menu.name,
    qty: input.qty,
    price: menu.price,
    note: input.note,
    status: ITEM_STATUS.PENDING,
    ready_at: null,
    delivered_at: null,
    completed_at: null,
    cancelled_at: null,
  }))
  resolved.forEach(({ recipes }, itemIndex) =>
    recipes.forEach((recipe, recipeIndex) => {
      const ingredient = db.ingredients.find(({ id }) => id === recipe.ingredient_id)
      if (!ingredient) return
      const qty = recipe.qty_used * items[itemIndex]!.qty
      ingredient.stock_qty -= qty
      db.stockMovements.unshift({
        id: `movement-out-${Date.now()}-${itemIndex}-${recipeIndex}`,
        ingredient_id: ingredient.id,
        type: 'OUT',
        qty: -qty,
        created_at: new Date().toISOString(),
        note: `Pesanan #${orderId}`,
        order_id: orderId,
        order_item_id: items[itemIndex]!.id,
      })
    }),
  )
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0)
  const { service_rate, tax_rate } = db.settings
  const service_amount = Math.round((subtotal * service_rate) / 100)
  const tax_amount = Math.round(((subtotal + service_amount) * tax_rate) / 100)
  const staff = currentUser()
  const order: Order = {
    id: orderId,
    order_number: nextOrderNumber('TAKE_AWAY'),
    order_type: 'TAKE_AWAY',
    table_id: null,
    table_number: null,
    table_session_id: null,
    created_by: staff.id,
    created_by_name: staff.name,
    customer_name: body.customer_name.trim(),
    customer_phone: body.customer_phone ?? null,
    status: ORDER_STATUS.MENUNGGU,
    payment_status: PAYMENT_STATUS.BELUM,
    payment_method: null,
    payment_ref: null,
    paid_at: null,
    amount_received: null,
    change_amount: null,
    cancel_reason: null,
    canceled_at: null,
    subtotal_amount: subtotal,
    service_rate_snapshot: service_rate,
    service_amount,
    tax_rate_snapshot: tax_rate,
    tax_amount,
    total_amount: subtotal + service_amount + tax_amount,
    created_at: createdAt,
    items,
  }
  db.orders.unshift(order)
  audit({
    entity: 'order',
    entity_id: order.id,
    action: 'status_changed',
    from_value: null,
    to_value: ORDER_STATUS.MENUNGGU,
  })
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
  const orderItem = findOrThrow(
    order.items.find(({ id }) => id === itemId),
    API_ERROR_CODE.NOT_FOUND,
    'Item not found',
  )

  const from = orderItem.status
  const allowed =
    (from === ITEM_STATUS.PENDING && status === ITEM_STATUS.COOKING) ||
    (from === ITEM_STATUS.COOKING && status === ITEM_STATUS.READY) ||
    (from === ITEM_STATUS.READY && status === ITEM_STATUS.DELIVERED) ||
    (from === ITEM_STATUS.DELIVERED && status === ITEM_STATUS.COMPLETED)
  if (!allowed) fail(API_ERROR_CODE.INVALID_TRANSITION, 'Invalid item transition')

  // BR-02 / PRD §5.2: cooking before payment is rejected.
  if (status === ITEM_STATUS.COOKING && order.payment_status === PAYMENT_STATUS.BELUM)
    fail(API_ERROR_CODE.PAYMENT_REQUIRED, 'Payment required')

  // PRD §9 actor matrix.
  const takeAway = order.order_type === 'TAKE_AWAY'
  const allowedByRole =
    status === ITEM_STATUS.COOKING || status === ITEM_STATUS.READY
      ? user.role === USER_ROLE.KITCHEN || user.role === USER_ROLE.OWNER
      : user.role === USER_ROLE.OWNER ||
        user.role === USER_ROLE.KITCHEN ||
        (takeAway && user.role === USER_ROLE.CASHIER)
  if (!allowedByRole) fail(API_ERROR_CODE.FORBIDDEN, 'Role is not authorized')

  const now = new Date().toISOString()
  orderItem.status = status
  if (status === ITEM_STATUS.READY) orderItem.ready_at = now
  if (status === ITEM_STATUS.DELIVERED) orderItem.delivered_at = now
  if (status === ITEM_STATUS.COMPLETED) orderItem.completed_at = now
  const previousStatus = order.status
  order.status = deriveOrderStatus(order)
  audit({
    entity: 'order_item',
    entity_id: orderItem.id,
    action: 'status_changed',
    from_value: from,
    to_value: status,
  })
  if (previousStatus !== order.status) {
    audit({
      entity: 'order',
      entity_id: order.id,
      action: 'status_changed',
      from_value: previousStatus,
      to_value: order.status,
    })
  }
  return structuredClone(order)
}

/** PRD §4.7 / §11.3: order-level cancellation, unpaid only, OWNER or CASHIER. */
export const cancelOrder = async (id: string, reason: string): Promise<Order> => {
  await delay()
  requireRole(USER_ROLE.OWNER, USER_ROLE.CASHIER)
  const order = findOrder(id)
  if (order.status !== ORDER_STATUS.MENUNGGU || order.payment_status !== PAYMENT_STATUS.BELUM)
    fail(API_ERROR_CODE.INVALID_TRANSITION, 'Only unpaid MENUNGGU orders can be cancelled')
  if (!reason.trim()) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Cancel reason is required')

  const now = new Date().toISOString()
  order.items
    .filter((item) => item.status !== ITEM_STATUS.CANCELLED)
    .forEach((item) => {
      db.recipeItems
        .filter((recipe) => recipe.menu_id === item.menu_id)
        .forEach((recipe, index) => {
          const ingredient = db.ingredients.find(({ id }) => id === recipe.ingredient_id)
          if (!ingredient) return
          const qty = recipe.qty_used * item.qty
          ingredient.stock_qty += qty
          db.stockMovements.unshift({
            id: `movement-restore-${Date.now()}-${item.id}-${index}`,
            ingredient_id: ingredient.id,
            type: 'RESTORE',
            qty,
            created_at: now,
            note: `Batal pesanan #${order.order_number}`,
            order_id: order.id,
            order_item_id: item.id,
          })
        })
      item.status = ITEM_STATUS.CANCELLED
      item.cancelled_at = now
    })

  order.status = ORDER_STATUS.DIBATALKAN
  order.cancel_reason = reason.trim()
  order.canceled_at = now
  audit({
    entity: 'order',
    entity_id: order.id,
    action: 'order_cancelled',
    from_value: ORDER_STATUS.MENUNGGU,
    to_value: ORDER_STATUS.DIBATALKAN,
  })
  return structuredClone(order)
}

export { isStaff }
