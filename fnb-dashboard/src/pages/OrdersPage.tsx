import { useState } from 'react'

import { ORDER_STATUS, type OrderStatus } from '@/constants/orderStatus'

import { useAuth } from '@/auth/context'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { CreateOrderDialog } from '@/features/manual-order/CreateOrderDialog'
import { OrderCard } from '@/features/orders/OrderCard'
import { useOrders } from '@/features/orders/useOrders'

const columns = [
  ORDER_STATUS.MENUNGGU,
  ORDER_STATUS.DIPROSES,
  ORDER_STATUS.SIAP,
  ORDER_STATUS.DIANTAR,
  ORDER_STATUS.SELESAI,
] as const

export function OrdersPage() {
  const { user } = useAuth()
  const { data: orders, isPending } = useOrders()
  const [createOpen, setCreateOpen] = useState(false)
  const canAct = user?.role === 'OWNER' || user?.role === 'CASHIER'

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Orders</h1>
        {canAct && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            + Order Manual
          </Button>
        )}
      </div>
      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} />
      {isPending ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {columns.map((status) => (
            <div key={status} className="flex flex-col gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      ) : orders && orders.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {columns.map((status: OrderStatus) => (
            <div key={status} className="flex min-w-0 flex-col gap-3">
              <h2 className="text-sm font-semibold">{status}</h2>
              {orders
                .filter((order) => order.status === status)
                .map((order) => (
                  <OrderCard key={order.id} order={order} showCashierActions={canAct} />
                ))}
            </div>
          ))}
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">🍽️</EmptyMedia>
            <EmptyTitle>Belum ada order</EmptyTitle>
            <EmptyDescription>Order baru akan muncul di sini.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}
