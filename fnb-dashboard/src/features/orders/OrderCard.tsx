import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { ITEM_STATUS, ORDER_TYPE, PAYMENT_STATUS } from '@/constants'
import type { Order, OrderItem } from '@/types'
import { toast } from 'sonner'

import { formatRupiah, formatTime } from '@/lib/format'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

import { CancelItemDialog } from './CancelItemDialog'
import { PaymentDialog } from './PaymentDialog'

const onError = (error: unknown) =>
  toast.error((error as { message?: string }).message ?? 'Terjadi kesalahan')

export function OrderCard({
  order,
  showCashierActions,
  onClick,
}: {
  order: Order
  showCashierActions: boolean
  onClick?: () => void
}) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['orders'] })

  const deliverable = deliveredItem(order)
  const deliver = useMutation({
    mutationFn: () => api.updateItemStatus(order.id, deliverable!.id, 'DELIVERED'),
    onSuccess: invalidate,
    onError,
  })

  return (
    <Card className="cursor-pointer gap-3" onClick={onClick}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {order.order_type === ORDER_TYPE.QR ? (
            <Badge variant="secondary">QR</Badge>
          ) : (
            <Badge variant="outline">MANUAL</Badge>
          )}
          <span>#{order.id}</span>
          {order.table_number && (
            <span className="text-muted-foreground">Meja {order.table_number}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="text-muted-foreground">{formatTime(order.created_at)}</div>
        <ul className="flex flex-col gap-1">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2">
              <span>
                {item.menu_name} ×{item.qty}
              </span>
              <Badge variant="outline">{item.status}</Badge>
            </li>
          ))}
        </ul>
        <div className="font-medium">{formatRupiah(order.total_amount)}</div>
        {order.payment_status === PAYMENT_STATUS.LUNAS ? (
          <Badge>{order.payment_method}</Badge>
        ) : (
          <Badge variant="destructive">BELUM</Badge>
        )}
      </CardContent>
      {showCashierActions && (
        <CardFooter className="gap-2">
          {order.payment_status === PAYMENT_STATUS.BELUM && (
            <PaymentDialog order={order} onSuccess={invalidate} />
          )}
          {deliveredItem(order) && (
            <Button size="sm" disabled={deliver.isPending} onClick={() => deliver.mutate()}>
              Antar (DELIVERED)
            </Button>
          )}
          {order.items.some((item) => item.status === ITEM_STATUS.PENDING) && (
            <CancelItemDialog order={order} onSuccess={invalidate} />
          )}
        </CardFooter>
      )}
    </Card>
  )
}

function deliveredItem(order: Order): OrderItem | undefined {
  return order.items.find((item) => item.status === ITEM_STATUS.READY)
}
