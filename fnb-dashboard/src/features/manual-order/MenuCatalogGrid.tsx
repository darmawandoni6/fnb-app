import { useMemo, useState } from 'react'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { USER_ROLE } from '@/constants'
import type { Category, Menu } from '@/types'
import { Ban, Search, Undo2, UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'

import { toastApiError } from '@/lib/errors'
import { formatRupiah } from '@/lib/format'
import { getMenuColorClass, getMenuInitials } from '@/lib/menu'

import { useAuth } from '@/auth/context'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

type MenuCatalogGridProps = {
  categories?: Category[]
  isLoading: boolean
  cartItemCounts: Record<string, number> // menu_id -> qty
  onAddMenu: (menu: Menu) => void
  disabled?: boolean
}

export function MenuCatalogGrid({
  categories,
  isLoading,
  cartItemCounts,
  onAddMenu,
  disabled = false,
}: MenuCatalogGridProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const { user } = useAuth()
  const queryClient = useQueryClient()
  const canToggleAvailability = user?.role === USER_ROLE.OWNER || user?.role === USER_ROLE.CASHIER

  const toggleAvailability = useMutation({
    mutationFn: (menu: Menu) => api.updateMenu(menu.id, { is_available: !menu.is_available }),
    onSuccess: (_updated, menu) => {
      toast.success(`Menu ${menu.name} ditandai ${menu.is_available ? 'habis' : 'tersedia'}`)
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] })
    },
    onError: toastApiError,
  })

  const allMenus = useMemo(() => {
    if (!categories) return []
    const menuMap = new Map<string, Menu>()
    for (const cat of categories) {
      for (const menu of cat.menus) {
        if (!menuMap.has(menu.id)) {
          menuMap.set(menu.id, menu)
        }
      }
    }
    return Array.from(menuMap.values())
  }, [categories])

  const filteredMenus = useMemo(() => {
    let list: Menu[] = []

    if (selectedCategoryId === 'ALL') {
      list = allMenus
    } else {
      const targetCat = categories?.find((c) => c.id === selectedCategoryId)
      list = targetCat ? targetCat.menus : []
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((m) => m.name.toLowerCase().includes(q))
    }

    return list
  }, [allMenus, categories, selectedCategoryId, searchQuery])

  return (
    <div className="flex flex-col gap-4">
      {/* Category Tabs & Search Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Horizontal Category Filter */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('ALL')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedCategoryId === 'ALL'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Semua Menu
          </button>
          {(categories ?? []).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedCategoryId === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-60">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-3.5 w-3.5" />
          <Input
            placeholder="Cari menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Grid List */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <Card key={idx} className="overflow-hidden p-0">
              <Skeleton className="h-28 w-full rounded-none" />
              <div className="p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="mt-2 h-3 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      ) : filteredMenus.length === 0 ? (
        <div className="text-muted-foreground flex h-64 flex-col items-center justify-center rounded-lg border border-dashed">
          <UtensilsCrossed className="text-muted-foreground/50 mb-2 h-8 w-8 stroke-1" />
          <p className="text-sm font-medium">Menu tidak ditemukan</p>
          <p className="text-xs">Coba cari dengan kata kunci lain atau pilih kategori berbeda</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
          {filteredMenus.map((menu) => {
            const qtyInCart = cartItemCounts[menu.id] ?? 0
            const isAvailable = menu.is_available
            const colorClass = getMenuColorClass(menu.name)
            const initials = getMenuInitials(menu.name)

            return (
              <Card
                key={menu.id}
                onClick={() => {
                  if (isAvailable && !disabled) {
                    onAddMenu(menu)
                  }
                }}
                className={`group relative flex flex-col overflow-hidden transition-all select-none ${
                  !isAvailable || disabled
                    ? 'cursor-not-allowed opacity-60 grayscale'
                    : 'hover:border-primary cursor-pointer hover:shadow-sm active:scale-[0.98]'
                }`}
              >
                {/* Availability Toggle (owner & cashier) */}
                {canToggleAvailability && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    aria-label={
                      isAvailable ? `Tandai ${menu.name} habis` : `Aktifkan ${menu.name} kembali`
                    }
                    className="absolute top-2 left-2 z-10"
                    disabled={toggleAvailability.isPending}
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleAvailability.mutate(menu)
                    }}
                  >
                    {isAvailable ? (
                      <Ban className="h-3.5 w-3.5" />
                    ) : (
                      <Undo2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}

                {/* Active in Cart Badge */}
                {qtyInCart > 0 && (
                  <Badge className="absolute top-2 right-2 z-10 h-6 min-w-6 px-1.5 text-center font-bold shadow-md">
                    {qtyInCart}x
                  </Badge>
                )}

                {/* Image or 2-Character Initial Placeholder */}
                {menu.image_url ? (
                  <img src={menu.image_url} alt={menu.name} className="h-28 w-full object-cover" />
                ) : (
                  <div
                    className={`flex h-28 w-full items-center justify-center text-2xl font-black tracking-wider ${colorClass}`}
                  >
                    {initials}
                  </div>
                )}

                {/* Card Info */}
                <div className="flex flex-1 flex-col justify-between p-3">
                  <div className="min-w-0">
                    <p className="text-foreground line-clamp-2 text-xs leading-tight font-semibold sm:text-sm">
                      {menu.name}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-600 sm:text-sm dark:text-emerald-400">
                      {formatRupiah(menu.price)}
                    </span>
                    {!isAvailable && (
                      <Badge variant="destructive" className="h-5 text-[10px]">
                        Habis
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
