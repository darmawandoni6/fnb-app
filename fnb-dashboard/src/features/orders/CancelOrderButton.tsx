import { useNavigate } from 'react-router-dom'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { ITEM_STATUS, PAYMENT_STATUS } from '@/constants'
import type { Order } from '@/types'
import { toast } from 'sonner'

import { ROUTES } from '@/constants/routes'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'

export function CancelOrderButton({ order }: { order: Order }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const pendingItems = order.items.filter((item) => item.status === ITEM_STATUS.PENDING)

  const cancel = useMutation({
    mutationFn: async () => {
      // PRD §10 has no full-order cancel; cancel every PENDING item in sequence.
      for (const item of pendingItems) {
        await api.cancelItem(order.id, item.id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      toast.success(`Pesanan #${order.id} dibatalkan`)
      navigate(ROUTES.ORDERS_NEW)
    },
    onError: (error) =>
      toast.error((error as { message?: string }).message ?? 'Gagal membatalkan pesanan'),
  })

  const canCancel = order.payment_status === PAYMENT_STATUS.BELUM && pendingItems.length > 0
  if (!canCancel) return null

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline" size="sm" className="text-destructive">
          Batalkan Pesanan
        </Button>
      }
      title={`Batalkan pesanan #${order.id}?`}
      description={`Semua ${pendingItems.length} item akan dibatalkan, stok dikembalikan, dan total menjadi Rp0. Tindakan ini tidak bisa diurungkan.`}
      onConfirm={() => cancel.mutate()}
      pending={cancel.isPending}
    />
  )
}
