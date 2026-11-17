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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type IngredientValues, ingredientSchema } from '@/features/stock/stockSchemas'

type IngredientFormDialogProps = {
  editing?: Ingredient
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function IngredientFormDialog({
  editing,
  open: openProp,
  onOpenChange,
}: IngredientFormDialogProps) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (next: boolean) => (onOpenChange ? onOpenChange(next) : setOpenState(next))
  const queryClient = useQueryClient()
  const form = useForm<IngredientValues>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: {
      name: editing?.name ?? '',
      unit: editing?.unit ?? '',
      stock_qty: editing?.stock_qty ?? 0,
      min_stock: editing?.min_stock ?? 0,
    },
  })
  const mutation = useMutation({
    mutationFn: (values: IngredientValues) =>
      editing
        ? api.updateIngredient(editing.id, {
            name: values.name,
            unit: values.unit,
            min_stock: values.min_stock,
          })
        : api.createIngredient(values),
    onSuccess: () => {
      toast.success(editing ? 'Bahan diperbarui' : 'Bahan dibuat')
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
            {editing ? 'Edit' : '+ Bahan'}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Bahan' : 'Bahan Baru'}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="ingredient-name">Nama</Label>
            <Input id="ingredient-name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ingredient-unit">Satuan</Label>
            <Input id="ingredient-unit" {...form.register('unit')} />
            {form.formState.errors.unit && (
              <p className="text-destructive text-sm">{form.formState.errors.unit.message}</p>
            )}
          </div>
          {!editing && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="ingredient-stock">Stok awal</Label>
              <Input
                id="ingredient-stock"
                type="number"
                {...form.register('stock_qty', { valueAsNumber: true })}
              />
              {form.formState.errors.stock_qty && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.stock_qty.message}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Label htmlFor="ingredient-min">Batas minimum stok</Label>
            <Input
              id="ingredient-min"
              type="number"
              {...form.register('min_stock', { valueAsNumber: true })}
            />
            <p className="text-muted-foreground text-xs">
              Bahan dianggap menipis saat stok di bawah atau sama dengan angka ini.
            </p>
            {form.formState.errors.min_stock && (
              <p className="text-destructive text-sm">{form.formState.errors.min_stock.message}</p>
            )}
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
