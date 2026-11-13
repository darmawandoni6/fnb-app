import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api'
import { LOW_STOCK_THRESHOLD } from '@/constants'
import type { Ingredient, RecipeItem } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { toastApiError } from '@/lib/errors'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  type IngredientValues,
  type RecipeItemValues,
  type RestockValues,
  ingredientSchema,
  recipeItemSchema,
  restockSchema,
} from '@/features/stock/stockSchemas'

export function StockPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Stock</h1>
      <Tabs defaultValue="ingredients">
        <TabsList>
          <TabsTrigger value="ingredients">Bahan</TabsTrigger>
          <TabsTrigger value="recipes">Resep</TabsTrigger>
          <TabsTrigger value="movements">Pergerakan</TabsTrigger>
        </TabsList>
        <TabsContent value="ingredients">
          <IngredientsTab />
        </TabsContent>
        <TabsContent value="recipes">
          <RecipesTab />
        </TabsContent>
        <TabsContent value="movements">
          <MovementsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function IngredientsTab() {
  const queryClient = useQueryClient()
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: api.getIngredients })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ingredients'] })

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <IngredientFormDialog onSaved={invalidate} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Satuan</TableHead>
            <TableHead>Stok</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(ingredients ?? []).map((ingredient) => (
            <TableRow key={ingredient.id}>
              <TableCell className="font-medium">{ingredient.name}</TableCell>
              <TableCell>{ingredient.unit}</TableCell>
              <TableCell>
                {ingredient.stock < LOW_STOCK_THRESHOLD ? (
                  <Badge variant="destructive">Rendah · {ingredient.stock}</Badge>
                ) : (
                  ingredient.stock
                )}
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <RestockDialog ingredient={ingredient} onSaved={invalidate} />
                <IngredientFormDialog editing={ingredient} onSaved={invalidate} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function RestockDialog({ ingredient, onSaved }: { ingredient: Ingredient; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const form = useForm<RestockValues>({
    resolver: zodResolver(restockSchema),
    defaultValues: { qty: 0 },
  })
  const mutation = useMutation({
    mutationFn: (values: RestockValues) => api.restockIngredient(ingredient.id, values),
    onSuccess: () => {
      toast.success('Stok ditambahkan')
      setOpen(false)
      onSaved()
    },
    onError: toastApiError,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Restock</Button>
      </DialogTrigger>
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

function IngredientFormDialog({ editing, onSaved }: { editing?: Ingredient; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const form = useForm<IngredientValues>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: {
      name: editing?.name ?? '',
      unit: editing?.unit ?? '',
      stock: editing?.stock ?? 0,
    },
  })
  const mutation = useMutation({
    mutationFn: (values: IngredientValues) =>
      editing
        ? api.updateIngredient(editing.id, { name: values.name, unit: values.unit })
        : api.createIngredient(values),
    onSuccess: () => {
      toast.success(editing ? 'Bahan diperbarui' : 'Bahan dibuat')
      setOpen(false)
      onSaved()
    },
    onError: toastApiError,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {editing ? 'Edit' : '+ Bahan'}
        </Button>
      </DialogTrigger>
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
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ingredient-unit">Satuan</Label>
            <Input id="ingredient-unit" {...form.register('unit')} />
          </div>
          {!editing && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="ingredient-stock">Stok awal</Label>
              <Input
                id="ingredient-stock"
                type="number"
                {...form.register('stock', { valueAsNumber: true })}
              />
            </div>
          )}
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

function RecipesTab() {
  const queryClient = useQueryClient()
  const { data: recipeItems } = useQuery({
    queryKey: ['recipe-items'],
    queryFn: api.getRecipeItems,
  })
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: api.getIngredients })
  const { data: categories } = useQuery({
    queryKey: ['menu-categories'],
    queryFn: api.getMenuCategories,
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['recipe-items'] })
  const ingredientName = (id: string) =>
    (ingredients ?? []).find((ingredient) => ingredient.id === id)?.name ?? id
  const menuName = (id: string) =>
    (categories ?? []).flatMap((category) => category.menus).find((menu) => menu.id === id)?.name ??
    id

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <RecipeFormDialog
          menus={(categories ?? []).flatMap((category) => category.menus)}
          ingredients={ingredients ?? []}
          onSaved={invalidate}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Menu</TableHead>
            <TableHead>Bahan</TableHead>
            <TableHead>Jumlah</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(recipeItems ?? []).map((recipeItem) => (
            <RecipeRow
              key={recipeItem.id}
              recipeItem={recipeItem}
              menuName={menuName(recipeItem.menu_id)}
              ingredientName={ingredientName(recipeItem.ingredient_id)}
              onSaved={invalidate}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function RecipeRow({
  recipeItem,
  menuName,
  ingredientName,
  onSaved,
}: {
  recipeItem: RecipeItem
  menuName: string
  ingredientName: string
  onSaved: () => void
}) {
  const remove = useMutation({
    mutationFn: () => api.deleteRecipeItem(recipeItem.id),
    onSuccess: onSaved,
    onError: toastApiError,
  })

  return (
    <TableRow>
      <TableCell>{menuName}</TableCell>
      <TableCell>{ingredientName}</TableCell>
      <TableCell>{recipeItem.qty}</TableCell>
      <TableCell className="flex justify-end gap-2">
        <RecipeFormDialog editing={recipeItem} menus={[]} ingredients={[]} onSaved={onSaved} />
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="sm">
              Hapus
            </Button>
          }
          title="Hapus recipe?"
          description="Item menu tidak akan lagi mengurangi stok bahan ini."
          onConfirm={() => remove.mutate()}
          pending={remove.isPending}
        />
      </TableCell>
    </TableRow>
  )
}

function RecipeFormDialog({
  editing,
  menus,
  ingredients,
  onSaved,
}: {
  editing?: RecipeItem
  menus: { id: string; name: string }[]
  ingredients: Ingredient[]
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<RecipeItemValues>({
    resolver: zodResolver(recipeItemSchema),
    defaultValues: {
      menu_id: editing?.menu_id ?? '',
      ingredient_id: editing?.ingredient_id ?? '',
      qty: editing?.qty ?? 0,
    },
  })
  const mutation = useMutation({
    mutationFn: (values: RecipeItemValues) =>
      editing
        ? api.updateRecipeItem(editing.id, { qty: values.qty })
        : api.createRecipeItem(values),
    onSuccess: () => {
      toast.success(editing ? 'Recipe diperbarui' : 'Recipe dibuat')
      setOpen(false)
      onSaved()
    },
    onError: toastApiError,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {editing ? 'Edit' : '+ Recipe'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Recipe' : 'Recipe Baru'}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          {!editing && (
            <>
              <div className="flex flex-col gap-1">
                <Label>Menu</Label>
                <Select onValueChange={(value) => form.setValue('menu_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih menu" />
                  </SelectTrigger>
                  <SelectContent>
                    {menus.map((menu) => (
                      <SelectItem key={menu.id} value={menu.id}>
                        {menu.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Bahan</Label>
                <Select onValueChange={(value) => form.setValue('ingredient_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih bahan" />
                  </SelectTrigger>
                  <SelectContent>
                    {ingredients.map((ingredient) => (
                      <SelectItem key={ingredient.id} value={ingredient.id}>
                        {ingredient.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="flex flex-col gap-1">
            <Label htmlFor="recipe-qty">Jumlah per porsi</Label>
            <Input
              id="recipe-qty"
              type="number"
              {...form.register('qty', { valueAsNumber: true })}
            />
            {form.formState.errors.qty && (
              <p className="text-destructive text-sm">{form.formState.errors.qty.message}</p>
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

function MovementsTab() {
  const { data: movements } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: () => api.getStockMovements(),
  })
  const { data: ingredients } = useQuery({ queryKey: ['ingredients'], queryFn: api.getIngredients })
  const ingredientName = (id: string) =>
    (ingredients ?? []).find((ingredient) => ingredient.id === id)?.name ?? id

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tipe</TableHead>
          <TableHead>Bahan</TableHead>
          <TableHead>Jumlah</TableHead>
          <TableHead>Tanggal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(movements ?? []).map((movement) => (
          <TableRow key={movement.id}>
            <TableCell>
              <Badge variant={movement.type === 'IN' ? 'default' : 'secondary'}>
                {movement.type}
              </Badge>
            </TableCell>
            <TableCell>{ingredientName(movement.ingredient_id)}</TableCell>
            <TableCell>{movement.qty}</TableCell>
            <TableCell>{new Date(movement.created_at).toLocaleString('id-ID')}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
