import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { ITEM_STATUS, type ItemStatus, ORDER_STATUS, PAYMENT_STATUS } from '@/constants'
import type { Order, OrderItem } from '@/types'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrders } from '@/features/orders/useOrders'

const columns: ItemStatus[] = [ITEM_STATUS.PENDING, ITEM_STATUS.COOKING, ITEM_STATUS.READY]

const BOARD_STATUSES: Order['status'][] = [
  ORDER_STATUS.MENUNGGU,
  ORDER_STATUS.DIPROSES,
  ORDER_STATUS.DIANTAR,
]

const isBoardOrder = (order: Order) =>
  order.payment_status === PAYMENT_STATUS.LUNAS &&
  BOARD_STATUSES.includes(order.status) &&
  order.items.some(({ status }) => status === ITEM_STATUS.PENDING || status === ITEM_STATUS.COOKING)

const onError = (error: unknown) =>
  toast.error((error as { message?: string }).message ?? 'Terjadi kesalahan')

export function KitchenPage() {
  const { data: orders, isPending } = useOrders()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['orders'] })
  const boardOrders = (orders ?? []).filter(isBoardOrder)

  return (
    <div className="min-w-full">
      <h1 className="mb-4 text-lg font-semibold">Kitchen Board</h1>
      {isPending ? (
        <div className="grid grid-cols-3 gap-4">
          {columns.map((status) => (
            <div key={status} className="flex flex-col gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      ) : boardOrders.length > 0 ? (
        <div className="grid grid-cols-3 gap-4">
          {columns.map((status) => (
            <div key={status} className="flex min-w-0 flex-col gap-3">
              <h2 className="text-sm font-semibold">{status}</h2>
              {boardOrders.flatMap((order) =>
                order.items
                  .filter((item) => item.status === status)
                  .map((item) => (
                    <KitchenItemCard
                      key={item.id}
                      orderId={order.id}
                      item={item}
                      tableNumber={order.table_number}
                      onAdvance={invalidate}
                    />
                  )),
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">👨‍🍳</EmptyMedia>
            <EmptyTitle>Belum ada order lunas yang menunggu</EmptyTitle>
            <EmptyDescription>
              Order lunas berstatus MENUNGGU atau DIPROSES akan muncul di sini.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}

function KitchenItemCard({
  orderId,
  item,
  tableNumber,
  onAdvance,
}: {
  orderId: string
  item: OrderItem
  tableNumber: string | null
  onAdvance: () => void
}) {
  const advance = useMutation({
    mutationFn: (next: ItemStatus) => api.updateItemStatus(orderId, item.id, next),
    onSuccess: onAdvance,
    onError,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {tableNumber && <Badge variant="secondary">Meja {tableNumber}</Badge>}
          {item.menu_name}
        </CardTitle>
        <p className="text-muted-foreground text-xs">
          #{orderId} · {item.qty}x
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {item.note && <p className="text-muted-foreground text-xs italic">Catatan: {item.note}</p>}
        {item.status === ITEM_STATUS.PENDING && (
          <Button
            size="sm"
            disabled={advance.isPending}
            onClick={() => advance.mutate(ITEM_STATUS.COOKING)}
          >
            Mulai masak
          </Button>
        )}
        {item.status === ITEM_STATUS.COOKING && (
          <Button
            size="sm"
            variant="outline"
            disabled={advance.isPending}
            onClick={() => advance.mutate(ITEM_STATUS.READY)}
          >
            Siap
          </Button>
        )}
        {item.status === ITEM_STATUS.READY && (
          <Badge variant="secondary" className="w-fit">
            Menunggu kasir
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}
