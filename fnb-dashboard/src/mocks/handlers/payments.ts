import { API_ERROR_CODE, PAYMENT_METHOD, PAYMENT_STATUS, type PaymentMethod } from '@/constants'
import { db } from '@/mocks/db'
import type { Order } from '@/types'

import { delay, fail, requireRole } from './shared'

export const updatePayment = async (
  orderId: string,
  body: {
    payment_status: 'LUNAS'
    payment_method: PaymentMethod
    amount_received?: number | null
    change_amount?: number | null
  },
): Promise<Order> => {
  await delay()
  requireRole('OWNER', 'CASHIER')
  if (!Object.values(PAYMENT_METHOD).includes(body.payment_method)) {
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Invalid payment method')
  }
  const order = db.orders.find(({ id }) => id === orderId)
  if (!order) fail(API_ERROR_CODE.NOT_FOUND, 'Order not found')
  const targetOrder: Order = order!
  if (targetOrder.payment_status === PAYMENT_STATUS.LUNAS) {
    fail(API_ERROR_CODE.INVALID_TRANSITION, 'Payment is already settled')
  }
  targetOrder.payment_status = PAYMENT_STATUS.LUNAS
  targetOrder.payment_method = body.payment_method
  targetOrder.amount_received =
    body.payment_method === PAYMENT_METHOD.CASH ? body.amount_received : null
  targetOrder.change_amount =
    body.payment_method === PAYMENT_METHOD.CASH ? body.change_amount : null
  return targetOrder
}
