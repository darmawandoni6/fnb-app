import { useState } from 'react'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import type { Ingredient } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { toastApiError } from '@/lib/errors'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type AdjustStockValues, adjustStockSchema } from '@/features/stock/stockSchemas'

type AdjustStockDialogProps = {
  ingredient: Ingredient
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AdjustStockDialog({
  ingredient,
  open: openProp,
  onOpenChange,
}: AdjustStockDialogProps) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (next: boolean) => (onOpenChange ? onOpenChange(next) : setOpenState(next))
  const queryClient = useQueryClient()
  const form = useForm<AdjustStockValues>({
    resolver: zodResolver(adjustStockSchema),
    defaultValues: { stock_qty: ingredient.stock_qty, note: '' },
  })
  const mutation = useMutation({
    mutationFn: (values: AdjustStockValues) => api.adjustIngredient(ingredient.id, values),
    onSuccess: () => {
      toast.success('Stok disesuaikan')
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      setOpen(false)
      form.reset()
    },
    onError: toastApiError,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {openProp === undefined && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            Sesuaikan
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sesuaikan stok {ingredient.name}</DialogTitle>
          <DialogDescription>
            Isi hasil hitung fisik. Selisih dicatat sebagai pergerakan penyesuaian.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="adjust-stock">Stok fisik ({ingredient.unit})</Label>
            <Input
              id="adjust-stock"
              type="number"
              {...form.register('stock_qty', { valueAsNumber: true })}
            />
            <p className="text-muted-foreground text-xs">
              Stok sistem saat ini: {ingredient.stock_qty} {ingredient.unit}
            </p>
            {form.formState.errors.stock_qty && (
              <p className="text-destructive text-sm">{form.formState.errors.stock_qty.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="adjust-note">Catatan (opsional)</Label>
            <Input id="adjust-note" placeholder="mis. selisih takaran" {...form.register('note')} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
