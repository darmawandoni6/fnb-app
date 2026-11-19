import { ITEM_STATUS, ORDER_STATUS, type OrderStatus, PAYMENT_STATUS } from '@/constants'
import type { Order } from '@/types'

export const deriveOrderStatus = (order: Order): OrderStatus => {
  const active = order.items.filter(({ status }) => status !== ITEM_STATUS.CANCELLED)
  if (active.length === 0) return ORDER_STATUS.DIBATALKAN
  if (active.every(({ status }) => status === ITEM_STATUS.PENDING)) return ORDER_STATUS.MENUNGGU
  if (active.some(({ status }) => status === ITEM_STATUS.COOKING)) return ORDER_STATUS.DIPROSES
  if (active.every(({ status }) => status === ITEM_STATUS.DELIVERED)) {
    return order.payment_status === PAYMENT_STATUS.LUNAS
      ? ORDER_STATUS.SELESAI
      : ORDER_STATUS.DIANTAR
  }
  if (active.some(({ status }) => status === ITEM_STATUS.DELIVERED)) return ORDER_STATUS.DIANTAR
  if (active.every(({ status }) => status === ITEM_STATUS.READY)) return ORDER_STATUS.SIAP
  return ORDER_STATUS.DIPROSES
}
