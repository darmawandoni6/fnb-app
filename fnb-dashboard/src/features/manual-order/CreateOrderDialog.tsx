import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { toast } from 'sonner'

import { formatRupiah } from '@/lib/format'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

import { manualOrderSchema } from './manualOrderSchema'

type Draft = Record<string, { qty: number; note: string }>

export function CreateOrderDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft>({})
  const { data: categories } = useQuery({
    queryKey: ['menu-categories'],
    queryFn: api.getMenuCategories,
    enabled: open,
  })
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    enabled: open,
  })
  const storeClosed = settings ? !settings.is_open : false

  const create = useMutation({
    mutationFn: (items: { menu_id: string; qty: number; note: string | null }[]) =>
      api.createManualOrder({ items }),
    onSuccess: () => {
      toast.success('Order manual dibuat')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (error) =>
      toast.error((error as { message?: string }).message ?? 'Gagal membuat order'),
  })

  const items = Object.entries(draft)
    .filter(([, value]) => value.qty > 0)
    .map(([menu_id, value]) => ({ menu_id, qty: value.qty, note: value.note || null }))
  const summary = (categories ?? [])
    .flatMap((category) => category.menus)
    .reduce((sum, menu) => {
      const entry = draft[menu.id]
      return entry ? sum + entry.qty * menu.price : sum
    }, 0)

  const submit = () => {
    const result = manualOrderSchema.safeParse({ items })
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? 'Data tidak valid')
      return
    }
    create.mutate(
      result.data.items.map((item) => ({
        menu_id: item.menu_id,
        qty: item.qty,
        note: item.note ?? null,
      })),
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Order Manual</DialogTitle>
          <DialogDescription>Pilih menu dan jumlah.</DialogDescription>
        </DialogHeader>
        <fieldset
          disabled={storeClosed || create.isPending}
          className="flex flex-col gap-6 disabled:opacity-60"
        >
          {(categories ?? []).map((category) => (
            <div key={category.id} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{category.name}</h3>
              {category.menus.map((menu) => (
                <div key={menu.id} className="flex items-center justify-between gap-4 text-sm">
                  <div className="min-w-0">
                    <p className={menu.is_available ? '' : 'text-muted-foreground line-through'}>
                      {menu.name} · {formatRupiah(menu.price)}
                    </p>
                    <Input
                      placeholder="Catatan (opsional)"
                      className="mt-1 h-8 text-xs"
                      value={draft[menu.id]?.note ?? ''}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [menu.id]: { qty: current[menu.id]?.qty ?? 0, note: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          [menu.id]: {
                            qty: Math.max(0, (current[menu.id]?.qty ?? 0) - 1),
                            note: current[menu.id]?.note ?? '',
                          },
                        }))
                      }
                    >
                      −
                    </Button>
                    <span className="w-6 text-center">{draft[menu.id]?.qty ?? 0}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!menu.is_available}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          [menu.id]: {
                            qty: (current[menu.id]?.qty ?? 0) + 1,
                            note: current[menu.id]?.note ?? '',
                          },
                        }))
                      }
                    >
                      +
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div className="text-sm font-medium">Subtotal (tampilan): {formatRupiah(summary)}</div>
        </fieldset>
        {storeClosed && (
          <p className="text-destructive text-sm">Toko tutup — order tidak dapat dibuat.</p>
        )}
        <DialogFooter>
          <Button onClick={submit} disabled={storeClosed || create.isPending}>
            {create.isPending ? 'Menyimpan…' : 'Buat Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
