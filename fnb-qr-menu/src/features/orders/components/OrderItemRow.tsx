import { ITEM_STATUS, ITEM_STATUS_LABEL } from '@/constants/itemStatus'
import type { ItemStatus } from '@/constants/itemStatus'
import { formatRupiah } from '@/lib/formatRupiah'
import { cn } from '@/lib/utils'
import type { PublicOrderItem } from '@/types/order'

import { Badge } from '@/components/ui/badge'

const STATUS_CLASS: Record<ItemStatus, string> = {
  [ITEM_STATUS.PENDING]: 'bg-secondary text-secondary-foreground',
  [ITEM_STATUS.COOKING]: 'bg-warning/10 text-warning',
  [ITEM_STATUS.READY]: 'bg-accent-soft text-accent-text',
  [ITEM_STATUS.DELIVERED]: 'border-border text-text-muted',
  [ITEM_STATUS.COMPLETED]: 'bg-positive/10 text-positive',
  [ITEM_STATUS.CANCELLED]: 'bg-destructive/10 text-destructive',
}

export function OrderItemRow({ item }: { item: PublicOrderItem }) {
  const isCancelled = item.status === ITEM_STATUS.CANCELLED

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn(
                'text-text truncate text-sm font-medium',
                isCancelled && 'text-text-muted line-through',
              )}
            >
              {item.menuNameSnapshot}
            </p>
            <p className="text-text-muted mt-0.5 text-xs">
              {item.qty} × {formatRupiah(item.price)}
            </p>
            {item.note && <p className="text-text-muted mt-1 text-xs italic">{item.note}</p>}
          </div>

          <Badge
            variant="outline"
            className={cn('shrink-0 border-transparent', STATUS_CLASS[item.status])}
          >
            {ITEM_STATUS_LABEL[item.status]}
          </Badge>
        </div>
      </div>
    </div>
  )
}
