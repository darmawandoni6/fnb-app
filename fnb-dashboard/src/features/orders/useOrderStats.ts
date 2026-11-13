import { useMemo } from 'react'

import { ORDER_STATUS, type OrderStatus } from '@/constants/orderStatus'
import { PAYMENT_STATUS } from '@/constants/paymentStatus'
import { todayUTC } from '@/lib/format'

import { useOrders } from './useOrders'

const activeStatuses: OrderStatus[] = [
  ORDER_STATUS.MENUNGGU,
  ORDER_STATUS.DIPROSES,
  ORDER_STATUS.SIAP,
  ORDER_STATUS.DIANTAR,
]

export function useOrderStats() {
  const { data: orders } = useOrders({ date: todayUTC() })

  return useMemo(() => {
    const list = orders ?? []
    return {
      activeCount: list.filter((order) => activeStatuses.includes(order.status)).length,
      unpaidCount: list.filter((order) => order.payment_status === PAYMENT_STATUS.BELUM).length,
      doneCount: list.filter((order) => order.status === ORDER_STATUS.SELESAI).length,
      salesToday: list.reduce(
        (sum, order) =>
          order.payment_status === PAYMENT_STATUS.LUNAS ? sum + order.total_amount : sum,
        0,
      ),
    }
  }, [orders])
}
