import type { Category } from '@/types'

import { Badge } from '@/components/ui/badge'

import { CategoryFormDialog } from './CategoryFormDialog'
import { DeleteCategoryButton } from './DeleteCategoryButton'
import { MenuCard } from './MenuCard'
import { MenuFormDialog } from './MenuFormDialog'

export function CategorySection({
  category,
  canEdit,
  onChanged,
}: {
  category: Category
  canEdit: boolean
  onChanged: () => void
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{category.name}</h2>
          <Badge variant="secondary" className="text-[10px]">
            {category.menus.length} menu
          </Badge>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <CategoryFormDialog editing={category} onSaved={onChanged} />
            <DeleteCategoryButton category={category} onDeleted={onChanged} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {category.menus.map((menu) => (
          <MenuCard
            key={menu.id}
            menu={menu}
            categoryId={category.id}
            canEdit={canEdit}
            onChanged={onChanged}
          />
        ))}
        {canEdit && <MenuFormDialog categoryId={category.id} onSaved={onChanged} />}
      </div>
    </section>
  )
}
