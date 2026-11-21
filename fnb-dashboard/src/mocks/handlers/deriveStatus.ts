import { ITEM_STATUS, ORDER_STATUS, type OrderStatus, PAYMENT_STATUS } from '@/constants'
import type { Order } from '@/types'

/** PRD §5.3 — the order status is a stored aggregate derived from items + payment. */
export const deriveOrderStatus = (order: Order): OrderStatus => {
  const active = order.items.filter(({ status }) => status !== ITEM_STATUS.CANCELLED)
  if (active.length === 0) return ORDER_STATUS.DIBATALKAN
  if (order.payment_status !== PAYMENT_STATUS.LUNAS) return ORDER_STATUS.MENUNGGU
  const allTerminal = active.every(({ status }) => status === ITEM_STATUS.COMPLETED)
  return allTerminal ? ORDER_STATUS.SELESAI : ORDER_STATUS.DIPROSES
}
