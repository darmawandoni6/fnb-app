import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { api } from '@/api'
import type { StockMovementType } from '@/types'
import { cn } from 'cn'

import { formatNumber } from '@/lib/format'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const TYPE_LABEL: Record<StockMovementType, string> = {
  IN: 'Masuk',
  OUT: 'Keluar',
  RESTORE: 'Restore',
  ADJUSTMENT: 'Penyesuaian',
}

type MovementFilter = 'all' | 'in' | 'out'

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

const formatRelative = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

const formatGroup = (iso: string) => {
  const date = new Date(iso)
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000)
  if (diffDays === 0) return 'Hari ini'
  if (diffDays === 1) return 'Kemarin'
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export function MovementsPanel({ className }: { className?: string } = {}) {
  const [filter, setFilter] = useState<MovementFilter>('all')
  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: api.getIngredients,
  })
  const { data: movements = [] } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: () => api.getStockMovements(),
  })

  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]))
  const visible = movements.filter((movement) => {
    if (filter === 'in') return movement.qty > 0
    if (filter === 'out') return movement.qty < 0
    return true
  })

  const groups: { label: string; movements: typeof visible }[] = []
  for (const movement of visible) {
    const label = formatGroup(movement.created_at)
    const group = groups.at(-1)
    if (group?.label === label) group.movements.push(movement)
    else groups.push({ label, movements: [movement] })
  }

  const chips: { value: MovementFilter; label: string }[] = [
    { value: 'all', label: 'Semua' },
    { value: 'in', label: 'Masuk' },
    { value: 'out', label: 'Keluar' },
  ]

  return (
    <Card
      className={cn('flex h-full max-h-[calc(100dvh-8rem)] flex-col overflow-hidden', className)}
    >
      <CardHeader className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b pb-3">
        <CardTitle>Pergerakan stok</CardTitle>
        <div className="flex gap-1">
          {chips.map((chip) => (
            <Button
              key={chip.value}
              type="button"
              size="xs"
              variant={filter === chip.value ? 'secondary' : 'ghost'}
              aria-pressed={filter === chip.value}
              onClick={() => setFilter(chip.value)}
            >
              {chip.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-3">
        {groups.map((group) => (
          <section key={group.label} className="flex flex-col gap-1">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {group.label}
            </h3>
            <div className="flex flex-col divide-y">
              {group.movements.map((movement) => {
                const ingredient = ingredientById.get(movement.ingredient_id)
                return (
                  <div key={movement.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {ingredient?.name ?? movement.ingredient_id}
                        </span>
                        <Badge variant="outline">{TYPE_LABEL[movement.type]}</Badge>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {formatRelative(movement.created_at)}
                        {movement.order_id
                          ? ` · #${movement.order_id}`
                          : movement.note
                            ? ` · ${movement.note}`
                            : ''}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-sm font-medium tabular-nums',
                        movement.qty > 0
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-destructive',
                      )}
                    >
                      {movement.qty > 0 ? '+' : ''}
                      {formatNumber(movement.qty)} {ingredient?.unit}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
        {visible.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Belum ada pergerakan pada filter ini.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
