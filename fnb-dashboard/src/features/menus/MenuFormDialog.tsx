import { useState } from 'react'

import { useMutation, useQuery } from '@tanstack/react-query'

import { api } from '@/api'
import type { Menu } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, UtensilsCrossed } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { toastApiError } from '@/lib/errors'
import { getMenuColorClass, getMenuInitials } from '@/lib/menu'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type MenuValues, menuSchema } from '@/features/menus/menuSchema'

type MenuFormDialogProps = {
  editing?: Menu
  categoryId?: string
  onSaved: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function MenuFormDialog({
  editing,
  categoryId,
  onSaved,
  open: controlledOpen,
  onOpenChange,
}: MenuFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [priceInput, setPriceInput] = useState(() => (editing ? String(editing.price) : ''))

  const { data: categories } = useQuery({
    queryKey: ['menu-categories'],
    queryFn: api.getMenuCategories,
    enabled: open,
  })

  const form = useForm<MenuValues>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      name: editing?.name ?? '',
      price: editing?.price ?? 0,
      category_id: categoryId ?? '',
      image_url: editing?.image_url ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: (values: MenuValues) =>
      editing
        ? api.updateMenu(editing.id, {
            name: values.name,
            price: values.price,
            image_url: values.image_url || null,
            category_id: values.category_id,
          })
        : api.createMenu({
            name: values.name,
            price: values.price,
            category_id: values.category_id,
            image_url: values.image_url || null,
          }),
    onSuccess: () => {
      toast.success(editing ? 'Menu diperbarui' : 'Menu dibuat')
      setOpen(false)
      form.reset()
      setPriceInput('')
      onSaved()
    },
    onError: toastApiError,
  })

  const imageUrl = form.watch('image_url')
  const previewName = form.watch('name') || 'Menu'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!onOpenChange && (
        <DialogTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:border-primary hover:text-foreground flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-3 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs font-medium">Tambah Menu</span>
          </button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Menu' : 'Menu Baru'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Perbarui detail menu, harga, atau pindahkan ke kategori lain.'
              : 'Tambahkan menu baru ke katalog. Tandai habis kapan saja dari kartu menu.'}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="bg-muted/40 flex h-36 items-center justify-center overflow-hidden rounded-lg border">
            {imageUrl ? (
              <img src={imageUrl} alt="Pratinjau" className="h-full w-full object-cover" />
            ) : (
              <div
                className={`flex h-full w-full items-center justify-center gap-2 text-3xl font-black tracking-wider ${getMenuColorClass(previewName)}`}
              >
                <UtensilsCrossed className="h-6 w-6 stroke-2" />
                {getMenuInitials(previewName)}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="menu-name">
                Nama <span className="text-destructive">*</span>
              </Label>
              <Input id="menu-name" placeholder="Contoh: Kopi Susu" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="menu-price">
                Harga <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                  Rp
                </span>
                <Input
                  id="menu-price"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={priceInput ? Number(priceInput).toLocaleString('id-ID') : ''}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/\D/g, '')
                    setPriceInput(raw)
                    form.setValue('price', raw ? Number(raw) : 0, { shouldValidate: true })
                  }}
                  className="pl-9 font-mono font-semibold"
                />
              </div>
              {form.formState.errors.price && (
                <p className="text-destructive text-xs">{form.formState.errors.price.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label htmlFor="menu-category">
                Kategori <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.watch('category_id')}
                onValueChange={(value) =>
                  form.setValue('category_id', value, { shouldValidate: true })
                }
              >
                <SelectTrigger id="menu-category" className="w-full">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {(categories ?? []).map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.category_id && (
                <p className="text-destructive text-xs">
                  {form.formState.errors.category_id.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label htmlFor="menu-image">URL gambar (opsional)</Label>
              <Input id="menu-image" placeholder="https://..." {...form.register('image_url')} />
              <p className="text-muted-foreground text-xs">
                Kosongkan untuk memakai inisial nama sebagai gambar.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
