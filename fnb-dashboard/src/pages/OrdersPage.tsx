import { useState } from 'react'

import type { Order } from '@/types'

import { ORDER_STATUS, type OrderStatus } from '@/constants/orderStatus'
import { PAYMENT_STATUS } from '@/constants/paymentStatus'
import { formatRupiah } from '@/lib/format'

import { useAuth } from '@/auth/context'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { CreateOrderDialog } from '@/features/manual-order/CreateOrderDialog'
import { OrderCard } from '@/features/orders/OrderCard'
import { OrderDetailDialog } from '@/features/orders/OrderDetailDialog'
import { useOrderStats } from '@/features/orders/useOrderStats'
import { useOrders } from '@/features/orders/useOrders'

const columns = [
  ORDER_STATUS.MENUNGGU,
  ORDER_STATUS.DIPROSES,
  ORDER_STATUS.SIAP,
  ORDER_STATUS.DIANTAR,
  ORDER_STATUS.SELESAI,
] as const

type ViewMode = 'all' | 'unpaid' | 'done'

export function OrdersPage() {
  const { user } = useAuth()
  const { data: orders, isPending } = useOrders()
  const stats = useOrderStats()
  const [createOpen, setCreateOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const canAct = user?.role === 'OWNER' || user?.role === 'CASHIER'

  const visibleOrders = (orders ?? []).filter((order) => {
    if (viewMode === 'unpaid') return order.payment_status === PAYMENT_STATUS.BELUM
    if (viewMode === 'done') return order.status === ORDER_STATUS.SELESAI
    return true
  })

  const toggleView = (mode: ViewMode) => setViewMode((current) => (current === mode ? 'all' : mode))

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
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pesanan Aktif" value={String(stats.activeCount)} />
        <StatCard
          label="Belum Bayar"
          value={String(stats.unpaidCount)}
          active={viewMode === 'unpaid'}
          onClick={() => toggleView('unpaid')}
        />
        <StatCard
          label="Selesai Hari Ini"
          value={String(stats.doneCount)}
          active={viewMode === 'done'}
          onClick={() => toggleView('done')}
        />
        <StatCard label="Penjualan Hari Ini" value={formatRupiah(stats.salesToday)} />
      </div>
      <OrderDetailDialog order={selectedOrder} onClose={() => setSelectedOrder(null)} />
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
      ) : visibleOrders.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {columns.map((status: OrderStatus) => (
            <div key={status} className="flex min-w-0 flex-col gap-3">
              <h2 className="text-sm font-semibold">{status}</h2>
              {visibleOrders
                .filter((order) => order.status === status)
                .map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    showCashierActions={canAct}
                    onClick={() => setSelectedOrder(order)}
                  />
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

function StatCard({
  label,
  value,
  active,
  onClick,
}: {
  label: string
  value: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <Card
      className={onClick ? 'hover:border-primary cursor-pointer transition-colors' : undefined}
      onClick={onClick}
    >
      <CardContent className="flex flex-col gap-1 px-4 py-3">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className={`text-lg font-semibold ${active ? 'text-primary' : ''}`}>{value}</span>
      </CardContent>
    </Card>
  )
}
