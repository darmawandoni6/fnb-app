import { Check, X } from 'lucide-react'

import { ORDER_STATUS, ORDER_STATUS_LABEL } from '@/constants/orderStatus'
import type { OrderStatus } from '@/constants/orderStatus'
import { cn } from '@/lib/utils'

const STEP_STATUSES = [
  ORDER_STATUS.MENUNGGU,
  ORDER_STATUS.DIPROSES,
  ORDER_STATUS.SIAP,
  ORDER_STATUS.DIANTAR,
] as const

export function StatusStepper({ status }: { status: OrderStatus }) {
  if (status === ORDER_STATUS.DIBATALKAN) {
    return (
      <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium">
        <X className="size-4 shrink-0" />
        Pesanan dibatalkan
      </div>
    )
  }

  const activeIndex =
    status === ORDER_STATUS.SELESAI
      ? STEP_STATUSES.length
      : STEP_STATUSES.findIndex((step) => step === status)

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex items-start justify-between gap-1">
        {STEP_STATUSES.map((step, index) => {
          const isDone = index < activeIndex
          const isCurrent = index === activeIndex

          return (
            <li key={step} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full border text-xs font-semibold',
                  isDone
                    ? 'border-accent bg-accent text-white'
                    : isCurrent
                      ? 'border-accent bg-accent-soft text-accent-text'
                      : 'border-border text-text-faint',
                )}
              >
                {isDone ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  'text-center text-[11px] leading-tight',
                  isDone || isCurrent ? 'text-text font-medium' : 'text-text-faint',
                )}
              >
                {ORDER_STATUS_LABEL[step]}
              </span>
            </li>
          )
        })}
      </ol>

      {status === ORDER_STATUS.SELESAI && (
        <p className="text-positive text-center text-xs font-medium">Pesanan selesai</p>
      )}
    </div>
  )
}
