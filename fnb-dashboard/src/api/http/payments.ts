import type { PaymentMethod } from '@/constants'
import type { Order } from '@/types'

import { request } from '../client'
import { type ServerOrder, toOrder } from './orders'

export const updatePayment = async (
  orderId: string,
  body: {
    payment_method: PaymentMethod
    amount_received?: number | null
    change_amount?: number | null
  },
): Promise<Order> => {
  const order = await request<ServerOrder>({
    method: 'PATCH',
    url: `/orders/${orderId}/payment`,
    data: body,
  })
  return toOrder(order)
}
