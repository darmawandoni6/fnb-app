import type { Order } from '@/types'

import { formatRupiah } from '@/lib/format'

import { Badge } from '@/components/ui/badge'
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

export function OrderDetailDialog({
  order,
  onClose,
}: {
  order: Order | null
  onClose: () => void
}) {
  if (!order) return null

  return (
    <Dialog open={order !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Order #{order.id}</DialogTitle>
          <DialogDescription>
            {order.order_type}
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
                  {item.menu_name}
                  {item.note && <p className="text-muted-foreground text-xs">{item.note}</p>}
                </TableCell>
                <TableCell className="text-right">{item.qty}</TableCell>
                <TableCell className="text-right">{formatRupiah(item.unit_price)}</TableCell>
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
            <span className="text-muted-foreground">Pajak ({order.tax_percent}%)</span>
            <span>{formatRupiah(order.tax_amount)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Total</span>
            <span>{formatRupiah(order.total_amount)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
