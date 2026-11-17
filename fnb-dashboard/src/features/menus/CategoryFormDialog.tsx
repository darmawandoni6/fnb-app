import { useState } from 'react'

import { useMutation } from '@tanstack/react-query'

import { api } from '@/api'
import type { Category } from '@/types'
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
import { type CategoryValues, categorySchema } from '@/features/menus/menuSchema'

export function CategoryFormDialog({
  editing,
  onSaved,
}: {
  editing?: Category
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: editing?.name ?? '', sort_order: editing?.sort_order },
  })

  const mutation = useMutation({
    mutationFn: (values: CategoryValues) =>
      editing
        ? api.updateCategory(editing.id, { name: values.name, sort_order: values.sort_order })
        : api.createCategory({ name: values.name }),
    onSuccess: () => {
      toast.success(editing ? 'Kategori diperbarui' : 'Kategori dibuat')
      setOpen(false)
      onSaved()
    },
    onError: toastApiError,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={editing ? 'ghost' : 'outline'} size="sm">
          {editing ? 'Edit' : '+ Kategori'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Kategori' : 'Kategori Baru'}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="category-name">Nama</Label>
            <Input id="category-name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
            )}
          </div>

          {editing && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="category-sort">Urutan tampil</Label>
              <Input
                id="category-sort"
                type="number"
                min={1}
                {...form.register('sort_order', { valueAsNumber: true })}
              />
              {form.formState.errors.sort_order && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.sort_order.message}
                </p>
              )}
            </div>
          )}

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
