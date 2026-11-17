import { ITEM_STATUS, ORDER_STATUS, ORDER_TYPE, PAYMENT_METHOD, PAYMENT_STATUS } from '@/constants'
import type { Order, OrderItem } from '@/types'

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
      const isQr = random() > 0.4
      const tableNum = isQr ? String(Math.floor(random() * 8) + 1) : null
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
          menu_name: selectedMenu.name,
          qty,
          unit_price: selectedMenu.price,
          note: null,
          status: ITEM_STATUS.DELIVERED,
        })
      }

      const subtotal = orderItems.reduce((acc, curr) => acc + curr.qty * curr.unit_price, 0)
      const taxPercent = 10
      const taxAmount = Math.round((subtotal * taxPercent) / 100)
      const totalAmount = subtotal + taxAmount

      generated.push({
        id: orderId,
        order_type: isQr ? ORDER_TYPE.QR : ORDER_TYPE.MANUAL,
        table_id: isQr ? `table-${tableNum}` : null,
        table_number: tableNum,
        status: ORDER_STATUS.SELESAI,
        payment_status: PAYMENT_STATUS.LUNAS,
        payment_method: isCash ? PAYMENT_METHOD.CASH : PAYMENT_METHOD.NON_CASH,
        subtotal_amount: subtotal,
        tax_amount: taxAmount,
        tax_percent: taxPercent,
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
