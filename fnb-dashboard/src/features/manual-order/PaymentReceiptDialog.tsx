import { useQuery } from '@tanstack/react-query'

import { api } from '@/api'
import type { Order } from '@/types'
import { CheckCircle2, Printer, RotateCcw, ShoppingBag } from 'lucide-react'

import { formatRupiah, formatTime } from '@/lib/format'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

type PaymentReceiptDialogProps = {
  order: Order | null
  open: boolean
  onClose: () => void
  onNewOrder?: () => void
  onBackToOrders?: () => void
}

export function PaymentReceiptDialog({
  order,
  open,
  onClose,
  onNewOrder,
  onBackToOrders,
}: PaymentReceiptDialogProps) {
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings })

  if (!order) return null

  const amountReceived = order.amount_received
  const changeAmount = order.change_amount

  const handlePrint = () => {
    window.print()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-lg font-bold">Pembayaran Berhasil!</DialogTitle>
          <DialogDescription className="text-center text-xs">
            Pesanan {order.order_number} telah lunas dan siap diproses dapur.
          </DialogDescription>
        </DialogHeader>

        {/* Printable Struk Card */}
        <div data-print-area className="bg-muted/30 rounded-lg border p-4 font-mono text-xs">
          <div className="text-center">
            <h4 className="text-sm font-bold">{settings?.cafe_name ?? 'Kafe'}</h4>
            <p className="text-muted-foreground text-[11px]">Struk Pembayaran Kasir</p>
          </div>

          <Separator className="my-2.5" />

          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">No. Pesanan:</span>
              <span className="font-medium">{order.order_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Waktu:</span>
              <span>
                {order.created_at.slice(0, 10)} {formatTime(order.created_at)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pelanggan:</span>
              <span className="font-medium">{order.customer_name ?? 'Pelanggan'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Layanan:</span>
              <span>
                {order.order_type === 'TAKE_AWAY'
                  ? 'Take Away (Bungkus)'
                  : `Dine In (Meja ${order.table_number ?? '-'})`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kasir:</span>
              <span>{order.created_by_name ?? 'Kasir'}</span>
            </div>
          </div>

          <Separator className="my-2.5" />

          {/* Items Table */}
          <div className="space-y-1.5">
            {order.items.map((item) => (
              <div key={item.id} className="flex flex-col">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{item.menu_name_snapshot}</span>
                  <span>{formatRupiah(item.qty * item.price)}</span>
                </div>
                <div className="text-muted-foreground flex justify-between text-[10px]">
                  <span>
                    {item.qty} x {formatRupiah(item.price)}
                    {item.note ? ` (${item.note})` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-2.5" />

          {/* Totals */}
          <div className="space-y-1 text-xs">
            <div className="text-muted-foreground flex justify-between">
              <span>Subtotal:</span>
              <span>{formatRupiah(order.subtotal_amount)}</span>
            </div>
            <div className="text-muted-foreground flex justify-between">
              <span>Service ({order.service_rate_snapshot}%):</span>
              <span>{formatRupiah(order.service_amount)}</span>
            </div>
            <div className="text-muted-foreground flex justify-between">
              <span>Pajak ({order.tax_rate_snapshot}%):</span>
              <span>{formatRupiah(order.tax_amount)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span>Total:</span>
              <span>{formatRupiah(order.total_amount)}</span>
            </div>
          </div>

          <Separator className="my-2.5" />

          {/* Payment Method Details */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Metode Pembayaran:</span>
              <span className="font-bold">
                {order.payment_method === 'CASH' ? 'TUNAI (CASH)' : 'NON-TUNAI'}
              </span>
            </div>
            {order.payment_method === 'CASH' && amountReceived != null && (
              <>
                <div className="text-muted-foreground flex justify-between">
                  <span>Uang Diterima:</span>
                  <span>{formatRupiah(amountReceived)}</span>
                </div>
                <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>Kembalian:</span>
                  <span>{formatRupiah(changeAmount ?? 0)}</span>
                </div>
              </>
            )}
          </div>

          <div className="text-muted-foreground mt-4 text-center text-[10px]">
            Terima kasih telah berkunjung!
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 text-xs"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            Cetak Struk
          </Button>

          {onNewOrder && onBackToOrders ? (
            <div className="grid w-full grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                className="w-full gap-1.5 text-xs"
                onClick={onNewOrder}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Pesanan Baru
              </Button>
              <Button type="button" className="w-full gap-1.5 text-xs" onClick={onBackToOrders}>
                <ShoppingBag className="h-3.5 w-3.5" />
                Ke Order Board
              </Button>
            </div>
          ) : (
            <Button type="button" className="w-full text-xs" onClick={onClose}>
              Selesai
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
