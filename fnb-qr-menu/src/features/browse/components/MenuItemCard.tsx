import type { MouseEvent } from 'react'

import { Plus } from 'lucide-react'

import { formatRupiah } from '@/lib/formatRupiah'
import type { MenuItem } from '@/types/menu'

import { Button } from '@/components/ui/button'

interface MenuItemCardProps {
  menu: MenuItem
  qtyInCart: number
  blocked: boolean
  onClick: () => void
  onQuickAdd: () => void
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function MenuItemCard({ menu, qtyInCart, blocked, onClick, onQuickAdd }: MenuItemCardProps) {
  function handleQuickAdd(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    if (!blocked) {
      onQuickAdd()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="border-border bg-surface flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3.5 shadow-xs transition-shadow hover:shadow-sm"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {menu.imageUrl ? (
          <img
            src={menu.imageUrl}
            alt={menu.name}
            className="size-16 shrink-0 rounded-xl object-cover"
            loading="lazy"
          />
        ) : (
          <div className="bg-surface-muted text-accent font-editorial flex size-16 shrink-0 items-center justify-center rounded-xl text-base font-semibold">
            {getInitials(menu.name)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-text truncate font-medium">{menu.name}</h3>
            {qtyInCart > 0 && (
              <span className="bg-accent/10 text-accent shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold">
                {qtyInCart}
              </span>
            )}
          </div>
          <p className="text-text mt-1 text-sm font-semibold">{formatRupiah(menu.price)}</p>
        </div>
      </div>

      <div className="shrink-0">
        <Button
          type="button"
          size="icon-sm"
          variant={blocked ? 'outline' : 'default'}
          disabled={blocked}
          title={blocked ? 'Pemesanan dinonaktifkan' : `Tambah ${menu.name}`}
          aria-label={blocked ? `Pemesanan dinonaktifkan: ${menu.name}` : `Tambah ${menu.name}`}
          onClick={handleQuickAdd}
          className="rounded-full"
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}
