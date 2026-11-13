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
  console.warn('Mock self-check passed')
}
