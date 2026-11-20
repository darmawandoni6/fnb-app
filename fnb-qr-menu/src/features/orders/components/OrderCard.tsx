import { useState } from 'react'

import { AlertTriangle, ChevronDown } from 'lucide-react'

import { API_ERROR } from '@/constants/errors'
import { ORDER_STATUS, ORDER_STATUS_LABEL } from '@/constants/orderStatus'
import type { OrderStatus } from '@/constants/orderStatus'
import { PAYMENT_STATUS, PAYMENT_STATUS_LABEL } from '@/constants/paymentStatus'
import { isApiError } from '@/lib/apiError'
import { formatRupiah } from '@/lib/formatRupiah'
import { cn } from '@/lib/utils'
import type { PublicOrderItem } from '@/types/order'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { TrackedOrder } from '@/features/session/store'

import { useCancelOrderItem, useTrackedOrder } from '../status'
import { OrderItemRow } from './OrderItemRow'
import { StatusStepper } from './StatusStepper'

const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  [ORDER_STATUS.MENUNGGU]: 'bg-secondary text-secondary-foreground',
  [ORDER_STATUS.DIPROSES]: 'bg-warning/10 text-warning',
  [ORDER_STATUS.SIAP]: 'bg-accent-soft text-accent-text',
  [ORDER_STATUS.DIANTAR]: 'bg-accent-soft text-accent-text',
  [ORDER_STATUS.SELESAI]: 'bg-positive/10 text-positive',
  [ORDER_STATUS.DIBATALKAN]: 'bg-destructive/10 text-destructive',
}

interface OrderCardProps {
  order: TrackedOrder
  open: boolean
  onToggle: () => void
  onRemove: (orderId: string) => void
}

export function OrderCard({ order, open, onToggle, onRemove }: OrderCardProps) {
  const query = useTrackedOrder(order, open)
  const cancelMutation = useCancelOrderItem(order)
  const [itemToCancel, setItemToCancel] = useState<PublicOrderItem | null>(null)

  const data = query.data ?? order.snapshot
  const isInvalid = Boolean(
    query.error && isApiError(query.error) && query.error.code === API_ERROR.NOT_FOUND,
  )
  const isPaid = data.paymentStatus === PAYMENT_STATUS.LUNAS
  const contentId = `order-content-${order.id}`

  function handleConfirmCancel() {
    if (!itemToCancel) return
    cancelMutation.mutate(itemToCancel.id, {
      onSettled: () => setItemToCancel(null),
    })
  }

  return (
    <div className="border-border bg-surface overflow-hidden rounded-2xl border shadow-xs">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
        className="hover:bg-surface-muted/50 flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p className="text-text truncate text-sm font-semibold">Pesanan #{order.id}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn('border-transparent', ORDER_STATUS_CLASS[data.status])}
            >
              {ORDER_STATUS_LABEL[data.status]}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                'border-transparent',
                isPaid ? 'bg-positive/10 text-positive' : 'bg-warning/10 text-warning',
              )}
            >
              {PAYMENT_STATUS_LABEL[data.paymentStatus]}
            </Badge>
          </div>
        </div>

        <span className="text-text shrink-0 text-sm font-semibold">
          {formatRupiah(data.totalAmount)}
        </span>
        <ChevronDown
          className={cn(
            'text-text-muted size-4 shrink-0 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div id={contentId} className="border-border flex flex-col gap-4 border-t px-4 py-4">
          {isInvalid ? (
            <div className="bg-destructive/10 text-destructive flex flex-col items-start gap-3 rounded-xl p-3.5 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-semibold">Pesanan tidak ditemukan</p>
                  <p className="text-destructive/80 mt-0.5 text-xs">
                    Data pesanan ini tidak lagi tersedia di server.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => onRemove(order.id)}
              >
                Hapus dari riwayat
              </Button>
            </div>
          ) : (
            <>
              <StatusStepper status={data.status} />

              {query.isError && (
                <p className="text-text-muted text-xs">
                  Gagal memperbarui status. Menampilkan data terakhir.
                </p>
              )}

              <div className="divide-border flex flex-col divide-y">
                {data.items.map((item) => (
                  <OrderItemRow
                    key={item.id}
                    item={item}
                    disabled={cancelMutation.isPending}
                    onCancel={setItemToCancel}
                  />
                ))}
              </div>

              <div className="border-border flex flex-col gap-1.5 border-t pt-3 text-sm">
                <div className="text-text-muted flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatRupiah(data.subtotalAmount)}</span>
                </div>
                <div className="text-text-muted flex justify-between">
                  <span>Pajak</span>
                  <span>{formatRupiah(data.taxAmount)}</span>
                </div>
                <div className="text-text flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatRupiah(data.totalAmount)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <AlertDialog
        open={Boolean(itemToCancel)}
        onOpenChange={(next) => !next && setItemToCancel(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan item?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{itemToCancel?.menuName}</strong> akan dibatalkan dari pesanan ini.
              {isPaid && ' Item sudah dibayar, sehingga pembatalan akan diproses sebagai refund.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>Kembali</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={handleConfirmCancel}
            >
              Batalkan Item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
