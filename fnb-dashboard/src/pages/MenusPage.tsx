import { useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { USER_ROLE } from '@/constants'

import { useAuth } from '@/auth/context'

import { Skeleton } from '@/components/ui/skeleton'
import { CategoryFormDialog } from '@/features/menus/CategoryFormDialog'
import { CategorySection } from '@/features/menus/CategorySection'

export function MenusPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  // `../../docs/api.md`: CASHIER may only toggle `is_available`; every other field is OWNER-only.
  const canEdit = user?.role === USER_ROLE.OWNER
  const { data: categories, isLoading } = useQuery({
    queryKey: ['menu-categories'],
    queryFn: api.getMenuCategories,
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['menu-categories'] })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Menus</h1>
          <p className="text-muted-foreground text-xs">
            Kelola kategori dan menu katalog. Tandai habis untuk menyembunyikan menu dari POS.
          </p>
        </div>
        {canEdit && <CategoryFormDialog onSaved={invalidate} />}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-44 w-full" />
          ))}
        </div>
      ) : (categories ?? []).length === 0 ? (
        <div className="text-muted-foreground flex h-56 flex-col items-center justify-center rounded-lg border border-dashed text-sm">
          Belum ada kategori. Tambahkan kategori untuk mulai mengisi menu.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {(categories ?? []).map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              canEdit={canEdit}
              onChanged={invalidate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
