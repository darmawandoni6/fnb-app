import { api } from '@/api'
import {
  ITEM_STATUS,
  type ItemStatus,
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  type PaymentStatus,
} from '@/constants'
import type { Order } from '@/types'

import { db } from './db'
import { deriveOrderStatus } from './handlers/deriveStatus'

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(`Mock self-check failed: ${message}`)
}

const throwsCode = async (callback: () => Promise<unknown>, code: string) => {
  try {
    await callback()
  } catch (error) {
    assert((error as { code?: string }).code === code, `${code} expected`)
    return
  }
  throw new Error(`Mock self-check failed: ${code} not thrown`)
}

export const runMockSelfCheck = async () => {
  db.currentUserId = 'user-1'

  // Menus: category move, soft delete, category ordering.
  const moved = await api.updateMenu('menu-1', { category_id: 'category-3' })
  assert(moved.id === 'menu-1', 'updateMenu moves category')
  const foodCategory = db.categories.find(({ id }) => id === 'category-3')
  assert(
    foodCategory?.menus.some(({ id }) => id === 'menu-1') === true,
    'menu lands in the target category',
  )
  const ordered = await api.getMenuCategories()
  assert(
    ordered.every(
      (category, index) => index === 0 || category.sort_order >= ordered[index - 1].sort_order,
    ),
    'categories are sorted by sort_order',
  )
  await api.deleteMenu('menu-2')
  assert(
    db.menus.find(({ id }) => id === 'menu-2')?.is_available === false,
    'deleteMenu soft deletes',
  )
  await api.updateMenu('menu-1', { category_id: 'category-1' })

  // Menus: cashier may only toggle availability.
  db.currentUserId = 'user-2'
  const hidden = await api.updateMenu('menu-3', { is_available: false })
  assert(hidden.is_available === false, 'cashier can toggle menu availability')
  await throwsCode(() => api.updateMenu('menu-3', { price: 1000 }), 'FORBIDDEN')
  await throwsCode(() => api.updateMenu('menu-3', { name: 'Matcha' }), 'FORBIDDEN')
  db.currentUserId = 'user-1'
  await api.updateMenu('menu-3', { is_available: true })

  // Order creation: CASHIER only, TAKE_AWAY only, TA-### number, OUT movement, service + tax snapshots.
  db.currentUserId = 'user-2'
  const created = await api.createManualOrder({
    items: [{ menu_id: 'menu-1', qty: 1, note: null }],
    customer_name: 'Budi',
  })
  assert(created.order_type === ORDER_TYPE.TAKE_AWAY, 'manual order is TAKE_AWAY')
  assert(created.order_number.startsWith('TA-'), 'take away number uses TA- prefix')
  assert(created.table_id === null, 'manual order has no table')
  assert(
    created.service_amount === Math.round((created.subtotal_amount * 5) / 100),
    'service amount follows the snapshot rate',
  )
  assert(
    created.total_amount === created.subtotal_amount + created.service_amount + created.tax_amount,
    'total = subtotal + service + tax',
  )
  const stockBefore = db.ingredients.find(({ id }) => id === 'ingredient-1')!.stock_qty
  assert(
    db.stockMovements.some(
      (movement) =>
        movement.type === 'OUT' &&
        movement.qty < 0 &&
        movement.order_id === created.id &&
        movement.order_item_id === created.items[0]!.id,
    ),
    'order creation writes a negative OUT movement with order ids',
  )
  db.currentUserId = 'user-1'
  await throwsCode(
    () =>
      api.createManualOrder({
        items: [{ menu_id: 'menu-1', qty: 1, note: null }],
        customer_name: 'X',
      }),
    'FORBIDDEN',
  )
  db.currentUserId = 'user-2'

  // Order-level cancel: OWNER only, restores stock, DIBATALKAN.
  await throwsCode(() => api.cancelOrder(created.id, 'uji'), 'FORBIDDEN')
  db.currentUserId = 'user-1'
  const cancelled = await api.cancelOrder(created.id, 'uji')
  assert(cancelled.status === ORDER_STATUS.DIBATALKAN, 'cancel sets DIBATALKAN')
  assert(
    cancelled.items.every(({ status }) => status === ITEM_STATUS.CANCELLED),
    'every item becomes CANCELLED',
  )
  assert(
    db.ingredients.find(({ id }) => id === 'ingredient-1')!.stock_qty > stockBefore,
    'cancel restores ingredient stock',
  )
  assert(
    db.stockMovements.some(
      (movement) =>
        movement.type === 'RESTORE' &&
        movement.qty > 0 &&
        movement.order_id === created.id &&
        movement.order_item_id === created.items[0]!.id,
    ),
    'cancel writes RESTORE movement with order ids',
  )
  await throwsCode(() => api.cancelOrder(created.id, 'uji'), 'INVALID_TRANSITION')

  // Ingredients: min_stock is stored and editable, restock/adjust write signed movements.
  const newIngredient = await api.createIngredient({
    name: 'Gula',
    unit: 'gram',
    stock_qty: 100,
    min_stock: 20,
  })
  assert(newIngredient.min_stock === 20, 'createIngredient stores min_stock')
  assert(
    db.stockMovements.some(
      (movement) =>
        movement.ingredient_id === newIngredient.id &&
        movement.type === 'ADJUSTMENT' &&
        movement.qty === 100,
    ),
    'createIngredient writes an opening ADJUSTMENT',
  )
  const updatedIngredient = await api.updateIngredient(newIngredient.id, { min_stock: 30 })
  assert(updatedIngredient.min_stock === 30, 'updateIngredient updates min_stock')
  const restocked = await api.restockIngredient(newIngredient.id, { qty: 25, note: 'uji' })
  assert(restocked.stock_qty === 125, 'restock increases stock_qty')
  assert(
    db.stockMovements.some(
      (movement) =>
        movement.ingredient_id === newIngredient.id &&
        movement.type === 'IN' &&
        movement.qty === 25 &&
        movement.note === 'uji',
    ),
    'restock writes IN movement with note',
  )
  const adjusted = await api.adjustIngredient(newIngredient.id, { stock_qty: 60 })
  assert(adjusted.stock_qty === 60, 'adjustIngredient replaces stock_qty')
  assert(
    db.stockMovements.some(
      (movement) =>
        movement.ingredient_id === newIngredient.id &&
        movement.type === 'ADJUSTMENT' &&
        movement.qty === -65,
    ),
    'adjustIngredient writes a signed ADJUSTMENT',
  )
  await throwsCode(
    () => api.adjustIngredient(newIngredient.id, { stock_qty: 60 }),
    'VALIDATION_ERROR',
  )
  const adjustMovements = await api.getStockMovements({
    ingredient_id: newIngredient.id,
    type: 'ADJUSTMENT',
  })
  assert(adjustMovements.length === 2, 'getStockMovements filters by ingredient and type')

  // Payment + item transitions.
  await throwsCode(
    () => api.updateItemStatus('order-1', 'item-1', ITEM_STATUS.COOKING),
    'PAYMENT_REQUIRED',
  )
  const paid = await api.updatePayment('order-1', {
    payment_method: PAYMENT_METHOD.CASH,
    amount_received: 50000,
    change_amount: 50000 - 33000,
  })
  assert(paid.payment_status === PAYMENT_STATUS.LUNAS, 'payment succeeds')
  assert(paid.amount_received === 50000, 'payment stores amount received')
  assert(paid.change_amount === 17000, 'payment stores change amount')
  assert(paid.status === ORDER_STATUS.DIPROSES, 'paid order with active items is DIPROSES')
  const cooking = await api.updateItemStatus('order-1', 'item-1', ITEM_STATUS.COOKING)
  assert(cooking.status === ORDER_STATUS.DIPROSES, 'COOKING keeps the order in DIPROSES')
  await api.updateItemStatus('order-1', 'item-1', ITEM_STATUS.READY)
  await api.updateItemStatus('order-1', 'item-1', ITEM_STATUS.DELIVERED)
  const completed = await api.updateItemStatus('order-1', 'item-1', ITEM_STATUS.COMPLETED)
  await api.updateItemStatus('order-1', 'item-2', ITEM_STATUS.COOKING)
  await api.updateItemStatus('order-1', 'item-2', ITEM_STATUS.READY)
  await api.updateItemStatus('order-1', 'item-2', ITEM_STATUS.DELIVERED)
  const finished = await api.updateItemStatus('order-1', 'item-2', ITEM_STATUS.COMPLETED)
  assert(completed.status === ORDER_STATUS.DIPROSES, 'one item left keeps DIPROSES')
  assert(finished.status === ORDER_STATUS.SELESAI, 'every item COMPLETED sets SELESAI')
  await throwsCode(
    () => api.updateItemStatus('order-1', 'item-2', ITEM_STATUS.COMPLETED),
    'INVALID_TRANSITION',
  )

  db.currentUserId = 'user-3'
  const kitchenOrders = await api.getOrders()
  assert(
    kitchenOrders.every(({ payment_status }) => payment_status === PAYMENT_STATUS.LUNAS),
    'kitchen list is paid only',
  )
  await throwsCode(() => api.getOrder('order-8'), 'NOT_FOUND')
  db.currentUserId = 'user-1'

  // Status derivation matrix (PRD §5.3).
  const orderWith = (statuses: ItemStatus[], payment: PaymentStatus): Order => ({
    id: 'check',
    order_number: 'TA-999',
    order_type: ORDER_TYPE.TAKE_AWAY,
    table_id: null,
    table_number: null,
    table_session_id: null,
    created_by: null,
    created_by_name: null,
    customer_name: 'Cek',
    customer_phone: null,
    status: ORDER_STATUS.MENUNGGU,
    payment_status: payment,
    payment_method: null,
    payment_ref: null,
    paid_at: null,
    amount_received: null,
    change_amount: null,
    cancel_reason: null,
    canceled_at: null,
    subtotal_amount: 0,
    service_rate_snapshot: 0,
    service_amount: 0,
    tax_rate_snapshot: 0,
    tax_amount: 0,
    total_amount: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    items: statuses.map((status, index) => ({
      id: `check-item-${index}`,
      menu_id: 'menu-1',
      menu_name_snapshot: 'Kopi Susu',
      qty: 1,
      price: 0,
      note: null,
      status,
      ready_at: null,
      delivered_at: null,
      completed_at: null,
      cancelled_at: null,
    })),
  })
  assert(
    deriveOrderStatus(
      orderWith([ITEM_STATUS.DELIVERED, ITEM_STATUS.COOKING], PAYMENT_STATUS.LUNAS),
    ) === ORDER_STATUS.DIPROSES,
    'delivered + cooking aggregates to DIPROSES',
  )
  assert(
    deriveOrderStatus(orderWith([ITEM_STATUS.PENDING, ITEM_STATUS.READY], PAYMENT_STATUS.LUNAS)) ===
      ORDER_STATUS.DIPROSES,
    'pending + ready aggregates to DIPROSES',
  )
  assert(
    deriveOrderStatus(
      orderWith([ITEM_STATUS.DELIVERED, ITEM_STATUS.DELIVERED], PAYMENT_STATUS.BELUM),
    ) === ORDER_STATUS.MENUNGGU,
    'unpaid aggregates to MENUNGGU',
  )
  assert(
    deriveOrderStatus(
      orderWith([ITEM_STATUS.COMPLETED, ITEM_STATUS.COMPLETED], PAYMENT_STATUS.LUNAS),
    ) === ORDER_STATUS.SELESAI,
    'every item COMPLETED while paid aggregates to SELESAI',
  )
  assert(
    deriveOrderStatus(
      orderWith([ITEM_STATUS.COMPLETED, ITEM_STATUS.CANCELLED], PAYMENT_STATUS.LUNAS),
    ) === ORDER_STATUS.SELESAI,
    'COMPLETED + CANCELLED aggregates to SELESAI',
  )
  assert(
    deriveOrderStatus(orderWith([ITEM_STATUS.CANCELLED], PAYMENT_STATUS.BELUM)) ===
      ORDER_STATUS.DIBATALKAN,
    'all items cancelled aggregates to DIBATALKAN',
  )

  // Payment is idempotent (BR-11).
  const repaid = await api.updatePayment('order-1', { payment_method: PAYMENT_METHOD.NON_CASH })
  assert(repaid.payment_status === PAYMENT_STATUS.LUNAS, 'repeat payment is a no-op')
  assert(repaid.payment_method === PAYMENT_METHOD.CASH, 'repeat payment keeps the first method')

  db.currentUserId = 'user-2'
  await throwsCode(
    () => api.updateItemStatus('order-2', 'item-3', ITEM_STATUS.COOKING),
    'FORBIDDEN',
  )
  db.currentUserId = 'user-2'
  db.settings.is_open = false
  await throwsCode(
    () =>
      api.createManualOrder({
        items: [{ menu_id: 'menu-1', qty: 1, note: null }],
        customer_name: 'X',
      }),
    'STORE_CLOSED',
  )
  db.settings.is_open = true
  db.currentUserId = 'user-1'

  // Recipes: rejected while the store is open, editable when closed (PRD §8).
  await throwsCode(
    () => api.createRecipeItem({ menu_id: 'menu-3', ingredient_id: 'ingredient-4', qty_used: 5 }),
    'STORE_CLOSED',
  )
  db.settings.is_open = false
  const recipe = await api.createRecipeItem({
    menu_id: 'menu-3',
    ingredient_id: 'ingredient-4',
    qty_used: 5,
  })
  await throwsCode(
    () => api.createRecipeItem({ menu_id: 'menu-3', ingredient_id: 'ingredient-4', qty_used: 6 }),
    'VALIDATION_ERROR',
  )
  const updatedRecipe = await api.updateRecipeItem(recipe.id, { qty_used: 8 })
  assert(updatedRecipe.qty_used === 8, 'updateRecipeItem updates qty_used')
  await api.deleteRecipeItem(recipe.id)
  assert(
    !db.recipeItems.some(({ id }) => id === recipe.id),
    'deleteRecipeItem removes the recipe item',
  )
  db.settings.is_open = true

  // Tables: token generated, numbers stay unique, deactivate keeps the token.
  const tableA = await api.createTable({ table_number: '9' })
  assert(tableA.qr_token.length > 0, 'createTable generates a qr_token')
  assert(tableA.is_active === true, 'createTable starts active')
  const tableB = await api.createTable({ table_number: '10' })
  await throwsCode(() => api.createTable({ table_number: '9' }), 'VALIDATION_ERROR')
  await throwsCode(() => api.updateTable(tableB.id, { table_number: '9' }), 'VALIDATION_ERROR')
  const listed = await api.getTables()
  assert(
    listed.findIndex(({ id }) => id === tableA.id) < listed.findIndex(({ id }) => id === tableB.id),
    'tables sort numerically (9 before 10)',
  )
  await api.deleteTable(tableA.id)
  const afterDelete = (await api.getTables()).find(({ id }) => id === tableA.id)
  assert(afterDelete?.is_active === false, 'deleteTable deactivates the table')
  assert(afterDelete?.qr_token === tableA.qr_token, 'deactivate keeps the qr_token')

  // Table session: read then close (PRD §4.6).
  const session = await api.getTableSession('table-1')
  assert(session.status === 'OPEN', 'table-1 has an open session')
  const closedSession = await api.closeTableSession('table-1')
  assert(closedSession.status === 'CLOSED', 'closeTableSession closes the session')
  assert(closedSession.ended_at !== null, 'closed session records ended_at')
  await throwsCode(() => api.getTableSession('table-1'), 'NOT_FOUND')

  // Audit log: OWNER only.
  const auditLog = await api.getAuditLog()
  assert(auditLog.length > 0, 'audit log records changes')
  db.currentUserId = 'user-2'
  await throwsCode(() => api.getAuditLog(), 'FORBIDDEN')
  db.currentUserId = 'user-1'

  // Settings: new rates and timers.
  const updatedSettings = await api.updateSettings({ service_rate: 7, tax_rate: 11 })
  assert(updatedSettings.service_rate === 7, 'updateSettings stores service_rate')
  assert(updatedSettings.tax_rate === 11, 'updateSettings stores tax_rate')
  await throwsCode(() => api.updateSettings({ cash_timeout_minutes: 0 }), 'VALIDATION_ERROR')
  db.currentUserId = 'user-2'
  await throwsCode(() => api.updateSettings({ tax_rate: 5 }), 'FORBIDDEN')
  db.currentUserId = 'user-1'

  console.warn('Mock self-check passed')
}
