import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { ITEM_STATUS, type ItemStatus, PAYMENT_STATUS, TERMINAL_ITEM_STATUS } from '@/constants'
import type { Order, OrderItem } from '@/types'
import { toast } from 'sonner'

import { formatTime } from '@/lib/format'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useOrders } from '@/features/orders/useOrders'

type BoardItem = { order: Order; item: OrderItem }

const MASOK_COLUMNS: ItemStatus[] = [ITEM_STATUS.PENDING, ITEM_STATUS.COOKING]
const PASS_COLUMNS: ItemStatus[] = [ITEM_STATUS.READY, ITEM_STATUS.DELIVERED]

const COLUMN_TITLE: Partial<Record<ItemStatus, string>> = {
  [ITEM_STATUS.PENDING]: 'Menunggu',
  [ITEM_STATUS.COOKING]: 'Dimasak',
  [ITEM_STATUS.READY]: 'Siap',
  [ITEM_STATUS.DELIVERED]: 'Diserahkan',
}

const onError = (error: unknown) =>
  toast.error((error as { message?: string }).message ?? 'Terjadi kesalahan')

export function KitchenPage() {
  const { data: orders, isPending } = useOrders()
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings })
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['orders'] })

  // PRD §5.3: kitchen only reads paid orders that still have active items.
  const boardItems: BoardItem[] = (orders ?? [])
    .filter((order) => order.payment_status === PAYMENT_STATUS.LUNAS)
    .flatMap((order) =>
      order.items
        .filter((item) => !(TERMINAL_ITEM_STATUS as readonly ItemStatus[]).includes(item.status))
        .map((item) => ({ order, item })),
    )

  const itemsIn = (statuses: ItemStatus[]) =>
    boardItems.filter(({ item }) => statuses.includes(item.status))

  return (
    <div className="min-w-full">
      <h1 className="mb-4 text-lg font-semibold">Kitchen Board</h1>
      {isPending ? (
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <Tabs defaultValue="masak">
          <TabsList>
            <TabsTrigger value="masak">Masak</TabsTrigger>
            <TabsTrigger value="pass">Pass / Counter</TabsTrigger>
          </TabsList>
          <TabsContent value="masak" className="pt-4">
            <BoardGrid
              columns={MASOK_COLUMNS}
              items={itemsIn(MASOK_COLUMNS)}
              orderNumbers={new Map((orders ?? []).map((o) => [o.id, o.order_number]))}
              onAdvance={invalidate}
            />
          </TabsContent>
          <TabsContent value="pass" className="pt-4">
            <BoardGrid
              columns={PASS_COLUMNS}
              items={itemsIn(PASS_COLUMNS)}
              orderNumbers={new Map((orders ?? []).map((o) => [o.id, o.order_number]))}
              warningAt={Math.max(
                0,
                (settings?.ready_auto_deliver_minutes ?? 0) -
                  (settings?.ready_auto_deliver_warning_minutes ?? 0),
              )}
              onAdvance={invalidate}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function BoardGrid({
  columns,
  items,
  orderNumbers,
  warningAt = 0,
  onAdvance,
}: {
  columns: ItemStatus[]
  items: BoardItem[]
  orderNumbers: Map<string, string>
  warningAt?: number
  onAdvance: () => void
}) {
  if (items.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">👨‍🍳</EmptyMedia>
          <EmptyTitle>Tidak ada item</EmptyTitle>
          <EmptyDescription>Item lunas akan muncul di sini.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  // PRD §7.3: group per table for dine-in and per order_number for take away,
  // keeping the status columns inside each group.
  const groups = new Map<string, BoardItem[]>()
  items.forEach((entry) => {
    const key = entry.order.table_id ? `table-${entry.order.table_id}` : `order-${entry.order.id}`
    groups.set(key, [...(groups.get(key) ?? []), entry])
  })
  const waitingSince = (group: BoardItem[]) =>
    Math.min(...group.map(({ order }) => new Date(order.created_at).getTime()))
  const sortedGroups = [...groups.entries()].sort(
    ([, left], [, right]) => waitingSince(left) - waitingSince(right),
  )

  return (
    <div className="flex flex-col gap-6">
      {sortedGroups.map(([key, groupItems]) => {
        const { order } = groupItems[0]!
        const label =
          order.order_number ||
          orderNumbers.get(order.id) ||
          (order.table_number ? `Meja ${order.table_number}` : order.id)
        return (
          <section key={key} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge variant={order.table_number ? 'secondary' : 'outline'}>
                {order.table_number ? `Meja ${order.table_number}` : 'Take Away'}
              </Badge>
              <h2 className="text-sm font-semibold">{label}</h2>
              <span className="text-muted-foreground text-xs">
                {groupItems.length} item · masuk {formatTime(order.created_at)}
              </span>
            </div>
            <div
              className={
                columns.length === 2
                  ? 'grid grid-cols-1 gap-4 lg:grid-cols-2'
                  : 'grid grid-cols-1 gap-4'
              }
            >
              {columns.map((status) => (
                <div key={status} className="flex min-w-0 flex-col gap-3">
                  <h3 className="text-muted-foreground text-xs font-semibold">
                    {COLUMN_TITLE[status]}
                  </h3>
                  {groupItems
                    .filter(({ item }) => item.status === status)
                    .map(({ item }) => (
                      <KitchenItemCard
                        key={item.id}
                        orderId={order.id}
                        orderNumber={label}
                        item={item}
                        tableNumber={order.table_number}
                        warningAt={warningAt}
                        onAdvance={onAdvance}
                      />
                    ))}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function KitchenItemCard({
  orderId,
  orderNumber,
  item,
  tableNumber,
  warningAt,
  onAdvance,
}: {
  orderId: string
  orderNumber: string
  item: OrderItem
  tableNumber: string | null
  warningAt: number
  onAdvance: () => void
}) {
  const advance = useMutation({
    mutationFn: (next: ItemStatus) => api.updateItemStatus(orderId, item.id, next),
    onSuccess: onAdvance,
    onError,
  })

  const readyMinutes = item.ready_at
    ? Math.floor((Date.now() - new Date(item.ready_at).getTime()) / 60_000)
    : null
  // Warn shortly before the server auto-delivers a READY item (PRD §4.4).
  const showWarning =
    item.status === ITEM_STATUS.READY &&
    readyMinutes !== null &&
    warningAt > 0 &&
    readyMinutes >= warningAt

  const next =
    item.status === ITEM_STATUS.PENDING
      ? { label: 'Mulai masak', to: ITEM_STATUS.COOKING }
      : item.status === ITEM_STATUS.COOKING
        ? { label: 'Siap', to: ITEM_STATUS.READY }
        : item.status === ITEM_STATUS.READY
          ? { label: 'Serahkan', to: ITEM_STATUS.DELIVERED }
          : { label: 'Selesaikan', to: ITEM_STATUS.COMPLETED }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {tableNumber && <Badge variant="secondary">Meja {tableNumber}</Badge>}
          {item.menu_name_snapshot}
        </CardTitle>
        <p className="text-muted-foreground text-xs">
          {orderNumber} · {item.qty}x
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {item.note && <p className="text-muted-foreground text-xs italic">Catatan: {item.note}</p>}
        {showWarning && (
          <Badge variant="destructive" className="w-fit text-[10px]">
            Segera diserahkan ({readyMinutes} menit siap)
          </Badge>
        )}
        <Button
          size="sm"
          variant={item.status === ITEM_STATUS.PENDING ? 'default' : 'outline'}
          disabled={advance.isPending}
          onClick={() => advance.mutate(next.to)}
        >
          {next.label}
        </Button>
      </CardContent>
    </Card>
  )
}
