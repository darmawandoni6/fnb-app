import { useState } from 'react'

import { useNavigate, useSearchParams } from 'react-router-dom'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import type { Order } from '@/types'
import { RefreshCw, Search, X } from 'lucide-react'
import { toast } from 'sonner'

import { ORDER_STATUS, type OrderStatus } from '@/constants/orderStatus'
import { PAYMENT_STATUS } from '@/constants/paymentStatus'
import { ROUTES } from '@/constants/routes'
import { toastApiError } from '@/lib/errors'
import { formatRupiah } from '@/lib/format'

import { useAuth } from '@/auth/context'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { OrderCard } from '@/features/orders/OrderCard'
import { OrderDetailDialog } from '@/features/orders/OrderDetailDialog'
import { useOrderStats } from '@/features/orders/useOrderStats'
import { useOrders } from '@/features/orders/useOrders'

const columns = [
  ORDER_STATUS.MENUNGGU,
  ORDER_STATUS.DIPROSES,
  ORDER_STATUS.SELESAI,
  ORDER_STATUS.DIBATALKAN,
] as const

type ViewMode = 'all' | 'unpaid' | 'done'

export function OrdersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: orders, isPending } = useOrders()
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings })
  const stats = useOrderStats()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const canAct = user?.role === 'OWNER' || user?.role === 'CASHIER'
  const canCreate = user?.role === 'CASHIER' || user?.role === 'OWNER'

  const refresh = async () => {
    setIsRefreshing(true)
    try {
      await queryClient.invalidateQueries({ queryKey: ['orders'] }, { throwOnError: true })
      toast.success('Data order diperbarui')
    } catch (error) {
      toastApiError(error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const search = query.trim().toLowerCase()
  const visibleOrders = (orders ?? [])
    .filter((order) => {
      if (viewMode === 'unpaid') return order.payment_status === PAYMENT_STATUS.BELUM
      if (viewMode === 'done') return order.status === ORDER_STATUS.SELESAI
      return true
    })
    .filter((order) => !search || order.order_number.toLowerCase().includes(search))

  const toggleView = (mode: ViewMode) => setViewMode((current) => (current === mode ? 'all' : mode))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Orders</h1>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 size-4" />
            <Input
              type="search"
              placeholder="Cari nomor order..."
              aria-label="Cari nomor order"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-48 pr-7 pl-8"
            />
            {query && (
              <button
                type="button"
                aria-label="Hapus pencarian"
                onClick={() => setQuery('')}
                className="text-muted-foreground hover:text-foreground absolute right-2 flex size-4 items-center justify-center"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={isRefreshing}>
            <RefreshCw className={isRefreshing ? 'size-4 animate-spin' : 'size-4'} />
            {isRefreshing ? 'Memuat...' : 'Refresh'}
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => navigate(ROUTES.ORDERS_NEW)}>
              + Order Manual
            </Button>
          )}
        </div>
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
      {isPending ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {columns.map((status) => (
            <div key={status} className="flex flex-col gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      ) : visibleOrders.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
                    timeoutMinutes={settings?.cash_timeout_minutes ?? 0}
                    onClick={() => setSelectedOrder(order)}
                  />
                ))}
            </div>
          ))}
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">{search ? '🔍' : '🍽️'}</EmptyMedia>
            <EmptyTitle>{search ? 'Order tidak ditemukan' : 'Belum ada order'}</EmptyTitle>
            <EmptyDescription>
              {search
                ? `Tidak ada order dengan nomor "${query.trim()}".`
                : 'Order baru akan muncul di sini.'}
            </EmptyDescription>
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
