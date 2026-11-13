import { useState } from 'react'

import { useMutation } from '@tanstack/react-query'

import { api } from '@/api'
import type { Order } from '@/types'
import { toast } from 'sonner'

import { PAYMENT_METHOD, type PaymentMethod } from '@/constants/paymentMethod'

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

export function PaymentDialog({ order, onSuccess }: { order: Order; onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>(PAYMENT_METHOD.CASH)
  const payment = useMutation({
    mutationFn: () =>
      api.updatePayment(order.id, { payment_status: 'LUNAS', payment_method: method }),
    onSuccess: () => {
      toast.success('Pembayaran berhasil')
      setOpen(false)
      onSuccess()
    },
    onError: (error) => toast.error((error as { message?: string }).message ?? 'Pembayaran gagal'),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Bayar (LUNAS)</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pembayaran #{order.id}</DialogTitle>
          <DialogDescription>Pilih metode pembayaran.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="payment-method">Metode</Label>
          <select
            id="payment-method"
            className="border-input bg-background rounded-md border px-3 py-2 text-sm"
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
          >
            <option value={PAYMENT_METHOD.CASH}>CASH</option>
            <option value={PAYMENT_METHOD.NON_CASH}>NON_CASH</option>
          </select>
        </div>
        <DialogFooter>
          <Button disabled={payment.isPending} onClick={() => payment.mutate()}>
            {payment.isPending ? 'Memproses…' : 'Konfirmasi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
