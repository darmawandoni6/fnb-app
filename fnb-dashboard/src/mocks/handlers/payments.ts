import {
  API_ERROR_CODE,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  type PaymentMethod,
  USER_ROLE,
} from '@/constants'
import { db } from '@/mocks/db'
import type { Order } from '@/types'

import { deriveOrderStatus } from './deriveStatus'
import { audit, delay, fail, requireRole } from './shared'

/** PRD §11.3 / BR-11: only BELUM → LUNAS is a state change; a repeat is a no-op returning the same order. */
export const updatePayment = async (
  orderId: string,
  body: {
    payment_method: PaymentMethod
    amount_received?: number | null
    change_amount?: number | null
  },
): Promise<Order> => {
  await delay()
  requireRole(USER_ROLE.OWNER, USER_ROLE.CASHIER)
  if (!Object.values(PAYMENT_METHOD).includes(body.payment_method)) {
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Invalid payment method')
  }
  const order = db.orders.find(({ id }) => id === orderId)
  if (!order) fail(API_ERROR_CODE.NOT_FOUND, 'Order not found')
  const target: Order = order!
  if (target.payment_status === PAYMENT_STATUS.LUNAS) return structuredClone(target)
  if (target.status === 'DIBATALKAN') {
    fail(API_ERROR_CODE.INVALID_TRANSITION, 'Cancelled orders cannot be paid')
  }

  const isCash = body.payment_method === PAYMENT_METHOD.CASH
  target.payment_status = PAYMENT_STATUS.LUNAS
  target.payment_method = body.payment_method
  target.paid_at = new Date().toISOString()
  target.amount_received = isCash ? (body.amount_received ?? null) : null
  target.change_amount = isCash ? (body.change_amount ?? null) : null
  target.status = deriveOrderStatus(target)
  audit({
    entity: 'order',
    entity_id: target.id,
    action: 'payment_confirmed',
    from_value: PAYMENT_STATUS.BELUM,
    to_value: PAYMENT_STATUS.LUNAS,
  })
  return structuredClone(target)
}
