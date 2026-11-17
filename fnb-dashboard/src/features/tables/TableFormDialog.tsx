import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
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
import { type TableValues, tableSchema } from '@/features/tables/tableSchema'

export function TableFormDialog() {
  const queryClient = useQueryClient()
  const form = useForm<TableValues>({
    resolver: zodResolver(tableSchema),
    defaultValues: { number: '' },
  })

  const mutation = useMutation({
    mutationFn: (values: TableValues) => api.createTable(values),
    onSuccess: () => {
      toast.success('Meja dibuat')
      form.reset()
      queryClient.invalidateQueries({ queryKey: ['tables'] })
    },
    onError: toastApiError,
  })

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Meja
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Meja Baru</DialogTitle>
          <DialogDescription>
            Nomor meja harus unik. QR dibuat otomatis dan bisa dicetak setelahnya.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="table-number">
              Nomor meja <span className="text-destructive">*</span>
            </Label>
            <Input id="table-number" placeholder="Contoh: 1" {...form.register('number')} />
            {form.formState.errors.number && (
              <p className="text-destructive text-xs">{form.formState.errors.number.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
