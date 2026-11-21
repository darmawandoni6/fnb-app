import { useNavigate } from 'react-router-dom'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { ITEM_STATUS, ORDER_TYPE, PAYMENT_STATUS } from '@/constants'
import type { Order, OrderItem } from '@/types'
import { toast } from 'sonner'

import { ROUTES } from '@/constants/routes'
import { formatRupiah, formatTime } from '@/lib/format'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

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
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['orders'] })

  // PRD §9: cashier owns READY → DELIVERED → COMPLETED for take away only.
  const takeAway = order.order_type === ORDER_TYPE.TAKE_AWAY
  const handOver = itemWithStatus(order, ITEM_STATUS.READY)
  const complete = itemWithStatus(order, ITEM_STATUS.DELIVERED)

  const advance = useMutation({
    mutationFn: ({ item, status }: { item: OrderItem; status: string }) =>
      api.updateItemStatus(order.id, item.id, status as OrderItem['status']),
    onSuccess: invalidate,
    onError,
  })

  return (
    <Card className="cursor-pointer gap-3" onClick={onClick}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Badge variant={takeAway ? 'secondary' : 'outline'}>
            {takeAway ? 'TAKE AWAY' : 'DINE IN'}
          </Badge>
          <span>{order.order_number}</span>
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
                {item.menu_name_snapshot} ×{item.qty}
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
        <CardFooter className="gap-2" onClick={(e) => e.stopPropagation()}>
          {order.payment_status === PAYMENT_STATUS.BELUM && order.status !== 'DIBATALKAN' && (
            <Button
              size="sm"
              onClick={() => navigate(ROUTES.ORDERS_PAYMENT.replace(':id', order.id))}
            >
              Bayar (LUNAS)
            </Button>
          )}
          {takeAway && handOver && (
            <Button
              size="sm"
              disabled={advance.isPending}
              onClick={() => advance.mutate({ item: handOver, status: ITEM_STATUS.DELIVERED })}
            >
              Serahkan
            </Button>
          )}
          {takeAway && complete && (
            <Button
              size="sm"
              variant="outline"
              disabled={advance.isPending}
              onClick={() => advance.mutate({ item: complete, status: ITEM_STATUS.COMPLETED })}
            >
              Selesaikan
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}

function itemWithStatus(order: Order, status: OrderItem['status']) {
  return order.items.find((item) => item.status === status)
}
