import { ITEM_STATUS, ITEM_STATUS_LABEL } from '@/constants/itemStatus'
import type { ItemStatus } from '@/constants/itemStatus'
import { formatRupiah } from '@/lib/formatRupiah'
import { cn } from '@/lib/utils'
import type { PublicOrderItem } from '@/types/order'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const STATUS_CLASS: Record<ItemStatus, string> = {
  [ITEM_STATUS.PENDING]: 'bg-secondary text-secondary-foreground',
  [ITEM_STATUS.COOKING]: 'bg-warning/10 text-warning',
  [ITEM_STATUS.READY]: 'bg-positive/10 text-positive',
  [ITEM_STATUS.DELIVERED]: 'border-border text-text-muted',
  [ITEM_STATUS.CANCELLED]: 'bg-destructive/10 text-destructive',
}

interface OrderItemRowProps {
  item: PublicOrderItem
  disabled?: boolean
  onCancel: (item: PublicOrderItem) => void
}

export function OrderItemRow({ item, disabled = false, onCancel }: OrderItemRowProps) {
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
              {item.menuName}
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

      {item.status === ITEM_STATUS.PENDING && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onCancel(item)}
          className="text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0"
        >
          Batalkan
        </Button>
      )}
    </div>
  )
}
