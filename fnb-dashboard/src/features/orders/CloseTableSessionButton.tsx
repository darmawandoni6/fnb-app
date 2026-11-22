import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { API_ERROR_CODE, ORDER_TYPE } from '@/constants'
import type { Order } from '@/types'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'

/**
 * PRD §4.6 / §9: `CASHIER` and `OWNER` close a table session manually.
 * Only shown for dine-in orders whose session is still `OPEN`; closing never touches history.
 */
export function CloseTableSessionButton({ order }: { order: Order }) {
  const queryClient = useQueryClient()
  const tableId = order.table_id

  const session = useQuery({
    queryKey: ['table-session', tableId],
    queryFn: () => api.getTableSession(tableId!),
    enabled: order.order_type === ORDER_TYPE.DINE_IN && !!tableId,
    retry: (count, error) =>
      (error as { code?: string }).code !== API_ERROR_CODE.NOT_FOUND && count < 1,
  })

  const close = useMutation({
    mutationFn: () => api.closeTableSession(tableId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['table-session', tableId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      toast.success(`Sesi meja ${order.table_number ?? ''} ditutup`.trim())
    },
    onError: (error) =>
      toast.error((error as { message?: string }).message ?? 'Gagal menutup sesi meja'),
  })

  if (session.data?.status !== 'OPEN') return null

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline" size="sm">
          Tutup Sesi Meja
        </Button>
      }
      title={`Tutup sesi meja ${order.table_number ?? ''}?`.trim()}
      description="Pelanggan harus memindai QR meja lagi untuk membuka sesi baru. Riwayat pesanan tetap tersimpan."
      onConfirm={() => close.mutate()}
      pending={close.isPending}
    />
  )
}
