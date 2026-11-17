import { api } from '@/api'
import { ITEM_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from '@/constants'

import { db } from './db'

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

  // Cancel: restores stock with RESTORE movement and zeroes totals.
  const created = await api.createManualOrder({
    items: [{ menu_id: 'menu-1', qty: 1, note: null }],
  })
  const stockBefore = db.ingredients.find(({ id }) => id === 'ingredient-1')!.stock
  const cancelled = await api.cancelItem(created.id, created.items[0]!.id)
  assert(cancelled.status === 'DIBATALKAN', 'cancelling all items sets DIBATALKAN')
  assert(cancelled.total_amount === 0, 'cancelled order totals are zero')
  assert(
    db.ingredients.find(({ id }) => id === 'ingredient-1')!.stock > stockBefore,
    'cancel restores ingredient stock',
  )
  assert(
    db.stockMovements.some(
      (movement) => movement.type === 'RESTORE' && movement.order_item_id === created.items[0]!.id,
    ),
    'cancel writes RESTORE movement with order_item_id',
  )
  await throwsCode(() => api.cancelItem(created.id, created.items[0]!.id), 'INVALID_TRANSITION')

  await throwsCode(
    () => api.updateItemStatus('order-1', 'item-1', ITEM_STATUS.COOKING),
    'PAYMENT_REQUIRED',
  )
  const paid = await api.updatePayment('order-1', {
    payment_status: PAYMENT_STATUS.LUNAS,
    payment_method: PAYMENT_METHOD.CASH,
  })
  assert(paid.payment_status === PAYMENT_STATUS.LUNAS, 'payment succeeds')
  await api.updateItemStatus('order-1', 'item-1', ITEM_STATUS.COOKING)
  await api.updateItemStatus('order-1', 'item-1', ITEM_STATUS.READY)
  await api.updateItemStatus('order-1', 'item-1', ITEM_STATUS.DELIVERED)
  await throwsCode(
    () =>
      api.updatePayment('order-1', {
        payment_status: PAYMENT_STATUS.LUNAS,
        payment_method: PAYMENT_METHOD.CASH,
      }),
    'INVALID_TRANSITION',
  )
  db.currentUserId = 'user-2'
  await throwsCode(
    () => api.updateItemStatus('order-2', 'item-3', ITEM_STATUS.COOKING),
    'FORBIDDEN',
  )
  db.currentUserId = 'user-1'
  db.settings.is_open = false
  await throwsCode(
    () => api.createManualOrder({ items: [{ menu_id: 'menu-1', qty: 1, note: null }] }),
    'STORE_CLOSED',
  )
  db.settings.is_open = true

  // Tables: token generated, numbers stay unique, deactivate keeps the token.
  const tableA = await api.createTable({ number: '9' })
  assert(tableA.qr_token.length > 0, 'createTable generates a qr_token')
  assert(tableA.is_active === true, 'createTable starts active')
  const tableB = await api.createTable({ number: '10' })
  await throwsCode(() => api.createTable({ number: '9' }), 'VALIDATION_ERROR')
  await throwsCode(() => api.updateTable(tableB.id, { number: '9' }), 'VALIDATION_ERROR')
  const listed = await api.getTables()
  assert(
    listed.findIndex(({ id }) => id === tableA.id) < listed.findIndex(({ id }) => id === tableB.id),
    'tables sort numerically (9 before 10)',
  )
  await api.deleteTable(tableA.id)
  const afterDelete = (await api.getTables()).find(({ id }) => id === tableA.id)
  assert(afterDelete?.is_active === false, 'deleteTable deactivates the table')
  assert(afterDelete?.qr_token === tableA.qr_token, 'deactivate keeps the qr_token')

  console.warn('Mock self-check passed')
}
