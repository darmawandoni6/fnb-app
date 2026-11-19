import { type ReactNode, useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { api } from '@/api'
import { USER_ROLE } from '@/constants'
import type { Ingredient } from '@/types'
import { cn } from 'cn'
import { ArrowDown, ArrowUp, ArrowUpDown, Ellipsis } from 'lucide-react'

import { formatNumber } from '@/lib/format'
import { type StockStatus, getStockStatus } from '@/lib/stock'

import { useAuth } from '@/auth/context'

import { DataTable, type DataTableColumn, type DataTableInstance } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { AdjustStockDialog } from '@/features/stock/AdjustStockDialog'
import { IngredientFormDialog } from '@/features/stock/IngredientFormDialog'
import { IngredientUsageDialog } from '@/features/stock/IngredientUsageDialog'
import { RestockDialog } from '@/features/stock/RestockDialog'

const STOCK_COLOR: Record<StockStatus, string> = {
  out: 'text-destructive',
  low: 'text-amber-700 dark:text-amber-300',
  ok: 'text-emerald-700 dark:text-emerald-300',
}

const STATUS_BADGE = {
  out: {
    label: 'Habis',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  low: {
    label: 'Menipis',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  ok: {
    label: 'Aman',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
} as const

const CHIP_TONE = {
  neutral: 'ring-border bg-muted text-foreground',
  danger: 'ring-destructive/30 bg-destructive/10 text-destructive',
  warning: 'ring-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  success: 'ring-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
} as const

type ChipTone = keyof typeof CHIP_TONE

const columns: DataTableColumn<Ingredient>[] = [
  {
    accessorKey: 'name',
    filterFn: 'includesString',
    header: ({ column }) => (
      <SortHeader
        sorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Nama bahan
      </SortHeader>
    ),
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'stock_qty',
    sortFn: 'alphanumeric',
    header: ({ column }) => (
      <SortHeader
        sorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Sisa stok
      </SortHeader>
    ),
    cell: ({ row }) => (
      <span className={cn('font-medium tabular-nums', STOCK_COLOR[getStockStatus(row.original)])}>
        {formatNumber(row.original.stock_qty)}
        <span className="text-muted-foreground ml-1 text-xs font-normal">{row.original.unit}</span>
      </span>
    ),
  },
  {
    accessorKey: 'min_stock',
    enableSorting: false,
    header: 'Batas bawah',
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {formatNumber(row.original.min_stock)} {row.original.unit}
      </span>
    ),
  },
  {
    id: 'status',
    accessorFn: (row) => getStockStatus(row),
    filterFn: 'equalsString',
    enableSorting: false,
    header: 'Status',
    cell: ({ row }) => {
      const badge = STATUS_BADGE[getStockStatus(row.original)]
      return (
        <Badge variant="outline" className={badge.className}>
          {badge.label}
        </Badge>
      )
    },
  },
  {
    id: 'actions',
    enableSorting: false,
    header: () => <span className="sr-only">Aksi</span>,
    cell: ({ row }) => <IngredientActions ingredient={row.original} />,
  },
]

export function IngredientsPanel() {
  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: api.getIngredients,
  })

  const data = [...ingredients].sort((a, b) => a.name.localeCompare(b.name))
  const counts = { out: 0, low: 0, ok: 0 }
  for (const ingredient of ingredients) counts[getStockStatus(ingredient)] += 1

  const statuses: {
    value: StockStatus | 'all'
    label: string
    count: number
    tone: ChipTone
  }[] = [
    { value: 'all', label: 'Semua', count: ingredients.length, tone: 'neutral' },
    { value: 'low', label: 'Menipis', count: counts.low, tone: 'warning' },
    { value: 'out', label: 'Habis', count: counts.out, tone: 'danger' },
    { value: 'ok', label: 'Aman', count: counts.ok, tone: 'success' },
  ]

  const toolbar = (table: DataTableInstance<Ingredient>) => {
    const nameColumn = table.getColumn('name')
    const statusColumn = table.getColumn('status')
    const active = (statusColumn?.getFilterValue() as StockStatus | undefined) ?? 'all'

    return (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Cari bahan…"
          value={(nameColumn?.getFilterValue() as string | undefined) ?? ''}
          onChange={(event) => nameColumn?.setFilterValue(event.target.value)}
          className="sm:max-w-56"
        />
        <div className="flex flex-wrap gap-1">
          {statuses.map((status) => (
            <FilterChip
              key={status.value}
              tone={status.tone}
              count={status.count}
              active={active === status.value}
              onClick={() =>
                statusColumn?.setFilterValue(status.value === 'all' ? undefined : status.value)
              }
            >
              {status.label}
            </FilterChip>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bahan</CardTitle>
        <CardDescription>Stok bahan dan batas minimumnya.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={data}
          toolbar={toolbar}
          empty="Tidak ada bahan yang cocok."
        />
      </CardContent>
    </Card>
  )
}

function FilterChip({
  active,
  tone = 'neutral',
  count,
  onClick,
  children,
}: {
  active: boolean
  tone?: ChipTone
  count?: number
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      size="xs"
      variant="ghost"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'font-medium',
        active ? cn('ring-1', CHIP_TONE[tone]) : 'text-muted-foreground',
      )}
    >
      {children}
      {count !== undefined && <span className="tabular-nums opacity-70">({count})</span>}
    </Button>
  )
}

function SortHeader({
  sorted,
  onToggle,
  children,
}: {
  sorted: false | 'asc' | 'desc'
  onToggle: () => void
  children: ReactNode
}) {
  const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <Button type="button" variant="ghost" size="xs" className="-ml-2" onClick={onToggle}>
      {children}
      <Icon className={cn('size-3', !sorted && 'text-muted-foreground')} />
    </Button>
  )
}

type ActionDialog = 'restock' | 'adjust' | 'edit' | 'usage'

function IngredientActions({ ingredient }: { ingredient: Ingredient }) {
  const { user } = useAuth()
  const isOwner = user?.role === USER_ROLE.OWNER
  const [dialog, setDialog] = useState<ActionDialog | null>(null)
  const onOpenChange = (open: boolean) => setDialog(open ? dialog : null)

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Aksi ${ingredient.name}`}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {isOwner && (
            <>
              <DropdownMenuItem onSelect={() => setDialog('restock')}>Restock</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog('adjust')}>
                Sesuaikan stok
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDialog('edit')}>Edit bahan</DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onSelect={() => setDialog('usage')}>Lihat pemakaian</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {isOwner && (
        <>
          <RestockDialog
            ingredient={ingredient}
            open={dialog === 'restock'}
            onOpenChange={(open) => onOpenChange(open)}
          />
          <AdjustStockDialog
            ingredient={ingredient}
            open={dialog === 'adjust'}
            onOpenChange={(open) => onOpenChange(open)}
          />
          <IngredientFormDialog
            editing={ingredient}
            open={dialog === 'edit'}
            onOpenChange={(open) => onOpenChange(open)}
          />
        </>
      )}
      <IngredientUsageDialog
        ingredient={ingredient}
        open={dialog === 'usage'}
        onOpenChange={(open) => onOpenChange(open)}
      />
    </div>
  )
}
