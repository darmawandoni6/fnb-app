import { ITEM_STATUS, ORDER_STATUS, ORDER_TYPE, PAYMENT_METHOD, PAYMENT_STATUS } from '@/constants'
import type { Order, OrderItem } from '@/types'

import { formatOrderNumber } from '@/lib/orderNumber'

import { menus } from './menus'

// Deterministic LCG pseudo-random generator
let seed = 123456789
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

export const generateHistoricalOrders = (): Order[] => {
  const generated: Order[] = []
  const now = new Date()

  // Generate for the last 30 days (day 0 = today, day 29 = 29 days ago)
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const targetDate = new Date(now.getTime() - dayOffset * 86_400_000)
    const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6
    const ordersTodayCount = isWeekend
      ? Math.floor(random() * 6) + 10
      : Math.floor(random() * 5) + 6

    for (let orderIndex = 0; orderIndex < ordersTodayCount; orderIndex++) {
      const orderId = `hist-ord-${dayOffset}-${orderIndex + 1}`
      const isDineIn = random() > 0.4
      const tableNum = isDineIn ? String(Math.floor(random() * 8) + 1) : null
      const isCash = random() > 0.45

      // Random hours between 09:00 and 21:00
      const hour = Math.floor(random() * 12) + 9
      const minute = Math.floor(random() * 60)
      const second = Math.floor(random() * 60)
      const orderTime = new Date(targetDate)
      orderTime.setHours(hour, minute, second, 0)

      // Random items (1 to 3 items)
      const itemCount = Math.floor(random() * 3) + 1
      const orderItems: OrderItem[] = []
      for (let itemIdx = 0; itemIdx < itemCount; itemIdx++) {
        const selectedMenu = menus[Math.floor(random() * menus.length)]
        const qty = Math.floor(random() * 2) + 1
        orderItems.push({
          id: `item-${orderId}-${itemIdx + 1}`,
          menu_id: selectedMenu.id,
          menu_name_snapshot: selectedMenu.name,
          qty,
          price: selectedMenu.price,
          note: null,
          status: ITEM_STATUS.COMPLETED,
          ready_at: orderTime.toISOString(),
          delivered_at: orderTime.toISOString(),
          completed_at: orderTime.toISOString(),
          cancelled_at: null,
        })
      }

      const subtotal = orderItems.reduce((acc, curr) => acc + curr.qty * curr.price, 0)
      const serviceRate = 5
      const taxRate = 10
      const serviceAmount = Math.round((subtotal * serviceRate) / 100)
      const taxAmount = Math.round(((subtotal + serviceAmount) * taxRate) / 100)
      const totalAmount = subtotal + serviceAmount + taxAmount

      generated.push({
        id: orderId,
        order_number: formatOrderNumber(
          isDineIn ? ORDER_TYPE.DINE_IN : ORDER_TYPE.TAKE_AWAY,
          orderTime.toISOString(),
          orderIndex + 1,
        ),
        order_type: isDineIn ? ORDER_TYPE.DINE_IN : ORDER_TYPE.TAKE_AWAY,
        table_id: isDineIn ? `table-${tableNum}` : null,
        table_number: tableNum,
        table_session_id: isDineIn ? `session-hist-${dayOffset}-${orderIndex}` : null,
        created_by: isDineIn ? null : 'user-2',
        created_by_name: isDineIn ? null : 'Kasir',
        customer_name: isDineIn ? 'Tamu' : 'Pelanggan',
        customer_phone: null,
        status: ORDER_STATUS.SELESAI,
        payment_status: PAYMENT_STATUS.LUNAS,
        payment_method: isCash ? PAYMENT_METHOD.CASH : PAYMENT_METHOD.NON_CASH,
        payment_ref: null,
        paid_at: orderTime.toISOString(),
        amount_received: isCash ? totalAmount : null,
        change_amount: isCash ? 0 : null,
        cancel_reason: null,
        canceled_at: null,
        subtotal_amount: subtotal,
        service_rate_snapshot: serviceRate,
        service_amount: serviceAmount,
        tax_rate_snapshot: taxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        created_at: orderTime.toISOString(),
        items: orderItems,
      })
    }
  }

  // Sort newest first
  return generated.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}
