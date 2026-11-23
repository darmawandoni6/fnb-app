import { useState } from 'react'

import { ChevronDown } from 'lucide-react'

import { ORDER_STATUS, ORDER_STATUS_LABEL } from '@/constants/orderStatus'
import type { OrderStatus } from '@/constants/orderStatus'
import { PAYMENT_STATUS, PAYMENT_STATUS_LABEL } from '@/constants/paymentStatus'
import { formatRupiah } from '@/lib/formatRupiah'
import { cn } from '@/lib/utils'

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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TrackedOrder } from '@/features/session/store'

import { useCancelOrder } from '../status'
import { OrderItemRow } from './OrderItemRow'
import { StatusStepper } from './StatusStepper'

const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  [ORDER_STATUS.MENUNGGU]: 'bg-secondary text-secondary-foreground',
  [ORDER_STATUS.DIPROSES]: 'bg-warning/10 text-warning',
  [ORDER_STATUS.SELESAI]: 'bg-positive/10 text-positive',
  [ORDER_STATUS.DIBATALKAN]: 'bg-destructive/10 text-destructive',
}

interface OrderCardProps {
  order: TrackedOrder
  open: boolean
  onToggle: () => void
}

export function OrderCard({ order, open, onToggle }: OrderCardProps) {
  const data = order.snapshot
  const cancelMutation = useCancelOrder(data)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reason, setReason] = useState('')

  const canCancel =
    data.status === ORDER_STATUS.MENUNGGU && data.paymentStatus === PAYMENT_STATUS.BELUM

  function handleConfirmCancel() {
    cancelMutation.mutate(reason.trim(), {
      onSettled: () => {
        setConfirmOpen(false)
        setReason('')
      },
    })
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        if (next) onToggle()
      }}
      className="border-border bg-surface overflow-hidden rounded-2xl border shadow-xs"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="hover:bg-surface-muted/50 flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors"
        >
          <div className="min-w-0 flex-1">
            <p className="text-text truncate text-sm font-semibold">Pesanan #{data.orderNumber}</p>
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
                  data.paymentStatus === PAYMENT_STATUS.LUNAS
                    ? 'bg-positive/10 text-positive'
                    : 'bg-warning/10 text-warning',
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
      </CollapsibleTrigger>

      <CollapsibleContent className="border-border flex flex-col gap-4 border-t px-4 py-4">
        <StatusStepper items={data.items} status={data.status} />

        <div className="divide-border flex flex-col divide-y">
          {data.items.map((item) => (
            <OrderItemRow key={item.id} item={item} />
          ))}
        </div>

        <div className="border-border flex flex-col gap-1.5 border-t pt-3 text-sm">
          <div className="text-text-muted flex justify-between">
            <span>Subtotal</span>
            <span>{formatRupiah(data.subtotalAmount)}</span>
          </div>
          <div className="text-text-muted flex justify-between">
            <span>Layanan</span>
            <span>{formatRupiah(data.serviceAmount)}</span>
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

        {data.cancelReason && (
          <p className="text-text-muted border-border border-t pt-3 text-xs italic">
            Alasan: {data.cancelReason}
          </p>
        )}

        {data.paymentStatus === PAYMENT_STATUS.BELUM && (
          <p className="text-text-muted border-border border-t pt-3 text-xs">
            Menunggu konfirmasi pembayaran. Tunjukkan pesanan ke kasir.
          </p>
        )}

        {canCancel && (
          <Button
            type="button"
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10 h-10 rounded-full"
            onClick={() => setConfirmOpen(true)}
          >
            Batalkan Pesanan
          </Button>
        )}
      </CollapsibleContent>

      <AlertDialog open={confirmOpen} onOpenChange={(next) => !next && setConfirmOpen(false)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan pesanan?</AlertDialogTitle>
            <AlertDialogDescription>
              Pesanan #{data.orderNumber} akan dibatalkan seluruhnya. Tindakan ini tidak dapat
              diurungkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`cancel-reason-${order.id}`} className="text-xs">
              Alasan membatalkan (opsional)
            </Label>
            <Input
              id={`cancel-reason-${order.id}`}
              value={reason}
              maxLength={120}
              placeholder="Contoh: salah pesan"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>Kembali</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={handleConfirmCancel}
            >
              Batalkan Pesanan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  )
}
