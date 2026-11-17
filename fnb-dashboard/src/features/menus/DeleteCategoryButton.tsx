import { useMutation } from '@tanstack/react-query'

import { api } from '@/api'
import type { Category } from '@/types'
import { toast } from 'sonner'

import { toastApiError } from '@/lib/errors'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'

export function DeleteCategoryButton({
  category,
  onDeleted,
}: {
  category: Category
  onDeleted: () => void
}) {
  const remove = useMutation({
    mutationFn: () => api.deleteCategory(category.id),
    onSuccess: () => {
      toast.success('Kategori dihapus')
      onDeleted()
    },
    onError: toastApiError,
  })

  const menuCount = category.menus.length

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="ghost"
          size="sm"
          disabled={menuCount > 0}
          title={menuCount > 0 ? `Masih ada ${menuCount} menu` : undefined}
        >
          Hapus
        </Button>
      }
      title={`Hapus kategori ${category.name}?`}
      description={
        menuCount > 0
          ? `Kategori masih memiliki ${menuCount} menu. Pindahkan atau tandai habis dulu semua menunya.`
          : 'Kategori kosong akan dihapus dari katalog.'
      }
      onConfirm={() => remove.mutate()}
      pending={remove.isPending}
    />
  )
}
