import { USER_ROLE } from '@/constants'

import { useAuth } from '@/auth/context'

import { IngredientFormDialog } from '@/features/stock/IngredientFormDialog'
import { IngredientsPanel } from '@/features/stock/IngredientsPanel'
import { MovementsPanel } from '@/features/stock/MovementsPanel'

export function StockPage() {
  const { user } = useAuth()
  const isOwner = user?.role === USER_ROLE.OWNER

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Stock</h1>
        {isOwner && <IngredientFormDialog />}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IngredientsPanel />
        </div>
        <div className="lg:sticky lg:top-4 lg:col-span-1 lg:h-[calc(100vh-8rem)]">
          <MovementsPanel />
        </div>
      </div>
    </div>
  )
}
