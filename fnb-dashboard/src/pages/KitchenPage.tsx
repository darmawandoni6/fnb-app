import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { ITEM_STATUS, type ItemStatus } from '@/constants'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrders } from '@/features/orders/useOrders'

const columns: ItemStatus[] = [ITEM_STATUS.PENDING, ITEM_STATUS.COOKING, ITEM_STATUS.READY]
const onError = (error: unknown) =>
  toast.error((error as { message?: string }).message ?? 'Terjadi kesalahan')

export function KitchenPage() {
  const { data: orders, isPending } = useOrders({ status: 'DIPROSES' })
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['orders'] })

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
      ) : orders && orders.length > 0 ? (
        <div className="grid grid-cols-3 gap-4">
          {columns.map((status) => (
            <div key={status} className="flex min-w-0 flex-col gap-3">
              <h2 className="text-sm font-semibold">{status}</h2>
              {orders.flatMap((order) =>
                order.items
                  .filter((item) => item.status === status)
                  .map((item) => (
                    <KitchenItemCard
                      key={item.id}
                      orderId={order.id}
                      itemId={item.id}
                      label={item.menu_name}
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
            <EmptyTitle>Tidak ada item diproses</EmptyTitle>
            <EmptyDescription>Order DIPROSES akan muncul di sini.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}

function KitchenItemCard({
  orderId,
  itemId,
  label,
  tableNumber,
  onAdvance,
}: {
  orderId: string
  itemId: string
  label: string
  tableNumber: string | null
  onAdvance: () => void
}) {
  const advance = useMutation({
    mutationFn: (next: ItemStatus) => api.updateItemStatus(orderId, itemId, next),
    onSuccess: onAdvance,
    onError,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {tableNumber && <Badge variant="secondary">Meja {tableNumber}</Badge>}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button
          size="sm"
          disabled={advance.isPending}
          onClick={() => advance.mutate(ITEM_STATUS.COOKING)}
        >
          Mulai masak
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={advance.isPending}
          onClick={() => advance.mutate(ITEM_STATUS.READY)}
        >
          Siap
        </Button>
      </CardContent>
    </Card>
  )
}
