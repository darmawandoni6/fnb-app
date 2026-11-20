import { cn } from '@/lib/utils'
import type { MenuCategory } from '@/types/menu'

interface CategoryTabsProps {
  categories: MenuCategory[]
  selectedCategory: string
  onSelectCategory: (id: string) => void
}

export function CategoryTabs({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryTabsProps) {
  const visibleCategories = categories.filter((c) => c.menus.length > 0)

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-2">
      <button
        type="button"
        onClick={() => onSelectCategory('all')}
        className={cn(
          'h-8 shrink-0 rounded-full px-4 text-xs font-medium transition-colors',
          selectedCategory === 'all'
            ? 'bg-accent text-white shadow-xs'
            : 'bg-surface-muted text-text-muted hover:text-text',
        )}
      >
        Semua
      </button>
      {visibleCategories.map((category) => {
        const isSelected = selectedCategory === category.id
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelectCategory(category.id)}
            className={cn(
              'h-8 shrink-0 rounded-full px-4 text-xs font-medium transition-colors',
              isSelected
                ? 'bg-accent text-white shadow-xs'
                : 'bg-surface-muted text-text-muted hover:text-text',
            )}
          >
            {category.name}
          </button>
        )
      })}
    </div>
  )
}
