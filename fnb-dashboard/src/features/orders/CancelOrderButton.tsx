import { useNavigate } from 'react-router-dom'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { ORDER_STATUS, PAYMENT_STATUS, USER_ROLE } from '@/constants'
import type { Order } from '@/types'
import { toast } from 'sonner'

import { ROUTES } from '@/constants/routes'

import { useAuth } from '@/auth/context'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'

/** PRD §4.7 / §11.3: order-level cancel, unpaid orders only, OWNER only. */
export function CancelOrderButton({ order }: { order: Order }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const cancel = useMutation({
    mutationFn: () => api.cancelOrder(order.id, 'Dibatalkan oleh owner'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      toast.success(`Pesanan ${order.order_number} dibatalkan`)
      navigate(ROUTES.ORDERS)
    },
    onError: (error) =>
      toast.error((error as { message?: string }).message ?? 'Gagal membatalkan pesanan'),
  })

  const canCancel =
    user?.role === USER_ROLE.OWNER &&
    order.status === ORDER_STATUS.MENUNGGU &&
    order.payment_status === PAYMENT_STATUS.BELUM
  if (!canCancel) return null

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline" size="sm" className="text-destructive">
          Batalkan Pesanan
        </Button>
      }
      title={`Batalkan pesanan ${order.order_number}?`}
      description="Seluruh item akan dibatalkan, stok dikembalikan, dan pesanan berstatus DIBATALKAN. Tindakan ini tidak bisa diurungkan."
      onConfirm={() => cancel.mutate()}
      pending={cancel.isPending}
    />
  )
}
