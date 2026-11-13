import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import type { Category, Menu } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { toastApiError } from '@/lib/errors'
import { formatRupiah } from '@/lib/format'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  type CategoryValues,
  type MenuValues,
  categorySchema,
  menuSchema,
} from '@/features/menus/menuSchema'

export function MenusPage() {
  const queryClient = useQueryClient()
  const { data: categories } = useQuery({
    queryKey: ['menu-categories'],
    queryFn: api.getMenuCategories,
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['menu-categories'] })

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Menus</h1>
        <CategoryFormDialog onSaved={invalidate} />
      </div>
      <div className="flex flex-col gap-6">
        {(categories ?? []).map((category) => (
          <div key={category.id}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-semibold">{category.name}</h2>
              <CategoryFormDialog editing={category} onSaved={invalidate} />
              <DeleteCategoryButton category={category} onDeleted={invalidate} />
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {category.menus.map((menu) => (
                <MenuCard key={menu.id} menu={menu} onSaved={invalidate} />
              ))}
              <MenuFormDialog categoryId={category.id} onSaved={invalidate} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MenuCard({ menu, onSaved }: { menu: Menu; onSaved: () => void }) {
  const toggle = useMutation({
    mutationFn: () => api.updateMenu(menu.id, { is_available: !menu.is_available }),
    onSuccess: onSaved,
    onError: toastApiError,
  })
  const remove = useMutation({
    mutationFn: () => api.deleteMenu(menu.id),
    onSuccess: () => {
      toast.success('Menu dihapus (dinonaktifkan)')
      onSaved()
    },
    onError: toastApiError,
  })

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        {menu.image_url && (
          <img
            src={menu.image_url}
            alt={menu.name}
            className="h-28 w-full rounded-md object-cover"
          />
        )}
        <div className="flex items-center justify-between">
          <span className="font-medium">{menu.name}</span>
          <Badge variant={menu.is_available ? 'default' : 'secondary'}>
            {menu.is_available ? 'Tersedia' : 'Tidak'}
          </Badge>
        </div>
        <span className="text-muted-foreground text-sm">{formatRupiah(menu.price)}</span>
        <div className="flex items-center gap-2">
          <Switch
            checked={menu.is_available}
            disabled={toggle.isPending}
            onCheckedChange={() => toggle.mutate()}
          />
          <MenuFormDialog editing={menu} categoryId={undefined} onSaved={onSaved} />
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm">
                Hapus
              </Button>
            }
            title="Hapus menu?"
            description="Menu akan dinonaktifkan dan tidak bisa dipesan."
            onConfirm={() => remove.mutate()}
            pending={remove.isPending}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function MenuFormDialog({
  editing,
  categoryId,
  onSaved,
}: {
  editing?: Menu
  categoryId?: string
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
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
          })
        : api.createMenu({
            name: values.name,
            price: values.price,
            category_id: values.category_id || categoryId || '',
            image_url: values.image_url || null,
          }),
    onSuccess: () => {
      toast.success(editing ? 'Menu diperbarui' : 'Menu dibuat')
      setOpen(false)
      onSaved()
    },
    onError: toastApiError,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {editing ? 'Edit' : '+ Menu'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Menu' : 'Menu Baru'}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="menu-name">Nama</Label>
            <Input id="menu-name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="menu-price">Harga (rupiah)</Label>
            <Input
              id="menu-price"
              type="number"
              {...form.register('price', { valueAsNumber: true })}
            />
            {form.formState.errors.price && (
              <p className="text-destructive text-sm">{form.formState.errors.price.message}</p>
            )}
          </div>
          {!editing && !categoryId && (
            <div className="flex flex-col gap-1">
              <Label>Kategori</Label>
              <Select onValueChange={(value) => form.setValue('category_id', value)}>
                <SelectTrigger>
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
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Label htmlFor="menu-image">URL gambar (opsional)</Label>
            <Input id="menu-image" {...form.register('image_url')} />
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

function CategoryFormDialog({ editing, onSaved }: { editing?: Category; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: editing?.name ?? '' },
  })
  const mutation = useMutation({
    mutationFn: (values: CategoryValues) =>
      editing ? api.updateCategory(editing.id, values) : api.createCategory(values),
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
        <Button variant="ghost" size="sm">
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

function DeleteCategoryButton({
  category,
  onDeleted,
}: {
  category: Category
  onDeleted: () => void
}) {
  const remove = useMutation({
    mutationFn: () => api.deleteCategory(category.id),
    onSuccess: () => {
      toast.success('Kategori dihapus')
      onDeleted()
    },
    onError: toastApiError,
  })

  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm">
          Hapus
        </Button>
      }
      title="Hapus kategori?"
      description="Kategori hanya bisa dihapus jika tidak memiliki menu."
      onConfirm={() => remove.mutate()}
      pending={remove.isPending}
    />
  )
}
