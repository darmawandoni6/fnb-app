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
import { type RestockValues, restockSchema } from '@/features/stock/stockSchemas'

type RestockDialogProps = {
  ingredient: Ingredient
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function RestockDialog({ ingredient, open: openProp, onOpenChange }: RestockDialogProps) {
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (next: boolean) => (onOpenChange ? onOpenChange(next) : setOpenState(next))
  const queryClient = useQueryClient()
  const form = useForm<RestockValues>({
    resolver: zodResolver(restockSchema),
    defaultValues: { qty: 1, note: '' },
  })
  const mutation = useMutation({
    mutationFn: (values: RestockValues) => api.restockIngredient(ingredient.id, values),
    onSuccess: () => {
      toast.success('Stok ditambahkan')
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
          <Button size="sm">Restock</Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restock {ingredient.name}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="restock-qty">Jumlah ({ingredient.unit})</Label>
            <Input
              id="restock-qty"
              type="number"
              {...form.register('qty', { valueAsNumber: true })}
            />
            {form.formState.errors.qty && (
              <p className="text-destructive text-sm">{form.formState.errors.qty.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="restock-note">Catatan (opsional)</Label>
            <Input id="restock-note" placeholder="mis. belanja pasar" {...form.register('note')} />
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
