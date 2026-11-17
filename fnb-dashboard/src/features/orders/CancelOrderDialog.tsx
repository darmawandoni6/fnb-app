import { useState } from 'react'

import { useNavigate } from 'react-router-dom'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { ITEM_STATUS, PAYMENT_STATUS } from '@/constants'
import type { Order } from '@/types'
import { toast } from 'sonner'

import { ROUTES } from '@/constants/routes'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

export function CancelOrderDialog({ order }: { order: Order }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const cancel = useMutation({
    mutationFn: () => api.cancelOrder(order.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      toast.success(`Pesanan #${order.id} dibatalkan`)
      navigate(ROUTES.ORDERS_NEW)
    },
    onError: (error) =>
      toast.error((error as { message?: string }).message ?? 'Gagal membatalkan pesanan'),
  })

  const canCancel =
    order.payment_status === PAYMENT_STATUS.BELUM &&
    order.items.length > 0 &&
    order.items.every((item) => item.status === ITEM_STATUS.PENDING)

  if (!canCancel) return null

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="text-destructive">
          Batalkan Pesanan
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Batalkan pesanan?</AlertDialogTitle>
          <AlertDialogDescription>
            Pesanan #{order.id} belum dibayar. Semua item akan dibatalkan dan stok dikembalikan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancel.isPending}>Tetap di Sini</AlertDialogCancel>
          <AlertDialogAction
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
            className="bg-destructive hover:bg-destructive/90 text-white"
          >
            {cancel.isPending ? 'Memproses…' : 'Ya, batalkan'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
