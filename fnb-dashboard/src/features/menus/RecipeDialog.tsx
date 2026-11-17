import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import type { Menu, RecipeItem } from '@/types'
import { FlaskConical } from 'lucide-react'
import { toast } from 'sonner'

import { toastApiError } from '@/lib/errors'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function RecipeDialog({ menu }: { menu: Menu }) {
  const [open, setOpen] = useState(false)
  const [ingredientId, setIngredientId] = useState('')
  const [qty, setQty] = useState(1)
  const queryClient = useQueryClient()

  const { data: recipeItems = [] } = useQuery({
    queryKey: ['recipe-items'],
    queryFn: api.getRecipeItems,
  })
  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: api.getIngredients,
    enabled: open,
  })
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    enabled: open,
  })

  const storeOpen = settings?.is_open ?? false
  const recipes = recipeItems.filter((recipe) => recipe.menu_id === menu.id)
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]))
  const availableIngredients = ingredients.filter(
    (ingredient) => !recipes.some((recipe) => recipe.ingredient_id === ingredient.id),
  )
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['recipe-items'] })

  const add = useMutation({
    mutationFn: () =>
      api.createRecipeItem({ menu_id: menu.id, ingredient_id: ingredientId, qty_used: qty }),
    onSuccess: () => {
      toast.success('Bahan ditambahkan ke resep')
      setIngredientId('')
      setQty(1)
      invalidate()
    },
    onError: toastApiError,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-7 gap-1 px-2 text-xs"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Resep
          <Badge variant="secondary" className="px-1 text-[10px]">
            {recipes.length}
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Resep {menu.name}</DialogTitle>
          <DialogDescription>Bahan yang dikurangi setiap satu porsi menu ini.</DialogDescription>
        </DialogHeader>

        {storeOpen && (
          <p className="bg-muted text-muted-foreground rounded-md border px-3 py-2 text-xs">
            Toko sedang buka. Tutup toko dulu di halaman Settings untuk mengubah resep.
          </p>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bahan</TableHead>
              <TableHead>Per porsi</TableHead>
              <TableHead>Satuan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipes.map((recipe) => (
              <RecipeRow
                key={recipe.id}
                recipe={recipe}
                ingredientName={
                  ingredientById.get(recipe.ingredient_id)?.name ?? recipe.ingredient_id
                }
                unit={ingredientById.get(recipe.ingredient_id)?.unit ?? ''}
                disabled={storeOpen}
                onChanged={invalidate}
              />
            ))}
            {recipes.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-4 text-center">
                  Belum ada bahan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-40 flex-1 flex-col gap-1">
            <Select value={ingredientId} onValueChange={setIngredientId} disabled={storeOpen}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih bahan" />
              </SelectTrigger>
              <SelectContent>
                {availableIngredients.map((ingredient) => (
                  <SelectItem key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="number"
            min={1}
            value={qty}
            disabled={storeOpen}
            onChange={(event) => setQty(Number(event.target.value))}
            className="w-24"
            aria-label="Jumlah per porsi"
          />
          <Button
            type="button"
            disabled={
              storeOpen || !ingredientId || !Number.isInteger(qty) || qty < 1 || add.isPending
            }
            onClick={() => add.mutate()}
          >
            Tambah
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RecipeRow({
  recipe,
  ingredientName,
  unit,
  disabled,
  onChanged,
}: {
  recipe: RecipeItem
  ingredientName: string
  unit: string
  disabled: boolean
  onChanged: () => void
}) {
  const update = useMutation({
    mutationFn: (qtyUsed: number) => api.updateRecipeItem(recipe.id, { qty_used: qtyUsed }),
    onSuccess: () => {
      toast.success('Resep diperbarui')
      onChanged()
    },
    onError: toastApiError,
  })
  const remove = useMutation({
    mutationFn: () => api.deleteRecipeItem(recipe.id),
    onSuccess: () => {
      toast.success('Bahan dihapus dari resep')
      onChanged()
    },
    onError: toastApiError,
  })

  return (
    <TableRow>
      <TableCell className="font-medium">{ingredientName}</TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          defaultValue={recipe.qty_used}
          disabled={disabled}
          className="h-8 w-24"
          onBlur={(event) => {
            const value = Number(event.target.value)
            if (!Number.isInteger(value) || value < 1 || value === recipe.qty_used) return
            update.mutate(value)
          }}
          aria-label={`Jumlah ${ingredientName}`}
        />
      </TableCell>
      <TableCell>{unit}</TableCell>
      <TableCell className="text-right">
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="sm" disabled={disabled || remove.isPending}>
              Hapus
            </Button>
          }
          title={`Hapus ${ingredientName} dari resep?`}
          description="Menu ini tidak akan lagi mengurangi stok bahan tersebut."
          onConfirm={() => remove.mutate()}
          pending={remove.isPending}
        />
      </TableCell>
    </TableRow>
  )
}
