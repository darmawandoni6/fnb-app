import { useQuery } from '@tanstack/react-query'

import { api } from '@/api'
import type { Ingredient } from '@/types'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type IngredientUsageDialogProps = {
  ingredient: Ingredient
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IngredientUsageDialog({
  ingredient,
  open,
  onOpenChange,
}: IngredientUsageDialogProps) {
  const { data: recipeItems = [] } = useQuery({
    queryKey: ['recipe-items'],
    queryFn: api.getRecipeItems,
    enabled: open,
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['menu-categories'],
    queryFn: api.getMenuCategories,
    enabled: open,
  })

  const menuNameById = new Map(
    categories.flatMap((category) => category.menus).map((menu) => [menu.id, menu.name]),
  )
  const usages = recipeItems
    .filter((recipe) => recipe.ingredient_id === ingredient.id)
    .map((recipe) => ({
      menuName: menuNameById.get(recipe.menu_id) ?? recipe.menu_id,
      qty_used: recipe.qty_used,
    }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pemakaian {ingredient.name}</DialogTitle>
          <DialogDescription>Bahan ini dikurangi setiap satu porsi menu berikut.</DialogDescription>
        </DialogHeader>
        {usages.length === 0 ? (
          <p className="text-muted-foreground text-sm">Belum dipakai resep mana pun.</p>
        ) : (
          <div className="flex flex-col divide-y rounded-md border">
            {usages.map((usage) => (
              <div
                key={usage.menuName}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span>{usage.menuName}</span>
                <span className="text-muted-foreground">
                  {usage.qty_used} {ingredient.unit}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
