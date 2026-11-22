import { useState } from 'react'

import { PAYMENT_STATUS } from '@/constants'
import type { Order } from '@/types'
import { Printer } from 'lucide-react'

import { formatRupiah } from '@/lib/format'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PaymentReceiptDialog } from '@/features/manual-order/PaymentReceiptDialog'
import { CancelOrderButton } from '@/features/orders/CancelOrderButton'
import { CloseTableSessionButton } from '@/features/orders/CloseTableSessionButton'

export function OrderDetailDialog({
  order,
  onClose,
}: {
  order: Order | null
  onClose: () => void
}) {
  const [receiptOpen, setReceiptOpen] = useState(false)

  if (!order) return null

  return (
    <>
      <Dialog open={order !== null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Order {order.order_number}</DialogTitle>
            <DialogDescription>
              {order.order_type === 'TAKE_AWAY' ? 'Take Away' : 'Dine In'}
              {order.table_number ? ` · Meja ${order.table_number}` : ''} · {order.payment_status}
              {order.payment_method ? ` · ${order.payment_method}` : ''}
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.menu_name_snapshot}
                    {item.note && <p className="text-muted-foreground text-xs">{item.note}</p>}
                  </TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right">{formatRupiah(item.price)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">{item.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Separator />
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatRupiah(order.subtotal_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Service ({order.service_rate_snapshot}%)
              </span>
              <span>{formatRupiah(order.service_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pajak ({order.tax_rate_snapshot}%)</span>
              <span>{formatRupiah(order.tax_amount)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span>{formatRupiah(order.total_amount)}</span>
            </div>
          </div>
          {order.payment_status === PAYMENT_STATUS.LUNAS && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs"
              onClick={() => setReceiptOpen(true)}
            >
              <Printer className="h-3.5 w-3.5" />
              Cetak Struk
            </Button>
          )}
          <CloseTableSessionButton order={order} />
          <CancelOrderButton order={order} />
        </DialogContent>
      </Dialog>

      <PaymentReceiptDialog
        order={order}
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
      />
    </>
  )
}
