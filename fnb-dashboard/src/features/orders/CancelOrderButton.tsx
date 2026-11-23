import { useState } from 'react'

import { useNavigate } from 'react-router-dom'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { ORDER_STATUS, PAYMENT_STATUS, USER_ROLE } from '@/constants'
import type { Order } from '@/types'
import { toast } from 'sonner'

import { ROUTES } from '@/constants/routes'

import { useAuth } from '@/auth/context'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

/** PRD §4.7 / §11.3: order-level cancel, unpaid only, OWNER or CASHIER, reason required. */
export function CancelOrderButton({ order }: { order: Order }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  const cancel = useMutation({
    mutationFn: () => api.cancelOrder(order.id, reason.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      toast.success(`Pesanan ${order.order_number} dibatalkan`)
      setOpen(false)
      navigate(ROUTES.ORDERS)
    },
    onError: (error) =>
      toast.error((error as { message?: string }).message ?? 'Gagal membatalkan pesanan'),
  })

  const canCancel =
    (user?.role === USER_ROLE.OWNER || user?.role === USER_ROLE.CASHIER) &&
    order.status === ORDER_STATUS.MENUNGGU &&
    order.payment_status === PAYMENT_STATUS.BELUM
  if (!canCancel) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setReason('')
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="text-destructive">
          Batalkan Pesanan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batalkan pesanan {order.order_number}?</DialogTitle>
          <DialogDescription>
            Seluruh item akan dibatalkan, stok dikembalikan, dan pesanan berstatus DIBATALKAN.
            Tindakan ini tidak bisa diurungkan.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cancel-reason">Alasan pembatalan</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            placeholder="Contoh: pelanggan tidak datang"
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Kembali
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!reason.trim() || cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            {cancel.isPending ? 'Memproses...' : 'Ya, batalkan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
