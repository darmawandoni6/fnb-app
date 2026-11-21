import { Check, X } from 'lucide-react'

import { ITEM_STATUS } from '@/constants/itemStatus'
import { ORDER_STATUS } from '@/constants/orderStatus'
import { cn } from '@/lib/utils'
import type { PublicOrderItem } from '@/types/order'

const STEPS = ['Menunggu', 'Diproses', 'Siap', 'Dalam pengantaran'] as const

function deriveStep(items: PublicOrderItem[]): number {
  const statuses = items.map((item) => item.status)
  if (statuses.every((s) => s === ITEM_STATUS.COMPLETED || s === ITEM_STATUS.CANCELLED)) return 4
  if (statuses.every((s) => s === ITEM_STATUS.PENDING || s === ITEM_STATUS.CANCELLED)) return 0
  if (statuses.some((s) => s === ITEM_STATUS.DELIVERED)) return 3
  if (statuses.some((s) => s === ITEM_STATUS.READY)) return 2
  return 1
}

interface StatusStepperProps {
  items: PublicOrderItem[]
  status: string
}

export function StatusStepper({ items, status }: StatusStepperProps) {
  if (status === ORDER_STATUS.DIBATALKAN) {
    return (
      <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium">
        <X className="size-4 shrink-0" />
        Pesanan dibatalkan
      </div>
    )
  }

  const activeIndex = items.length === 0 ? -1 : deriveStep(items)

  return (
    <ol className="flex items-start justify-between gap-1">
      {STEPS.map((label, index) => {
        const isDone = activeIndex === 4 || index < activeIndex
        const isActive = index === activeIndex

        return (
          <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full text-[11px] font-semibold',
                isDone && 'bg-positive text-white',
                isActive && 'bg-accent text-white',
                !isDone && !isActive && 'bg-surface-muted text-text-muted',
              )}
            >
              {isDone ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                'text-center text-[11px] leading-tight',
                isActive ? 'text-text font-semibold' : 'text-text-muted',
              )}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
