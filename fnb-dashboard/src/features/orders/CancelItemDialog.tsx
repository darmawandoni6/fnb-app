import { useState } from 'react'

import { useMutation } from '@tanstack/react-query'

import { api } from '@/api'
import { ITEM_STATUS } from '@/constants'
import type { Order } from '@/types'
import { toast } from 'sonner'

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

export function CancelItemDialog({ order, onSuccess }: { order: Order; onSuccess: () => void }) {
  const [itemId, setItemId] = useState<string | null>(null)
  const cancel = useMutation({
    mutationFn: () => api.cancelItem(order.id, itemId!),
    onSuccess: () => {
      toast.success('Item dibatalkan')
      setItemId(null)
      onSuccess()
    },
    onError: (error) =>
      toast.error((error as { message?: string }).message ?? 'Gagal membatalkan item'),
  })

  const pendingItems = order.items.filter((item) => item.status === ITEM_STATUS.PENDING)
  if (pendingItems.length === 0) return null

  return (
    <AlertDialog open={itemId !== null} onOpenChange={(open) => !open && setItemId(null)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={() => setItemId(pendingItems[0]!.id)}>
          Batalkan item
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Batalkan item?</AlertDialogTitle>
          <AlertDialogDescription>
            Item {pendingItems[0]!.menu_name} akan dibatalkan. Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction disabled={cancel.isPending} onClick={() => cancel.mutate()}>
            {cancel.isPending ? 'Memproses…' : 'Ya, batalkan'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
