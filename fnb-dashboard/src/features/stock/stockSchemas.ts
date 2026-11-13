import { z } from 'zod'

export const ingredientSchema = z.object({
  name: z.string().min(1, 'Nama bahan wajib diisi'),
  unit: z.string().min(1, 'Satuan wajib diisi'),
  stock: z.number().int().min(0, 'Stok tidak valid'),
})

export type IngredientValues = z.infer<typeof ingredientSchema>

export const restockSchema = z.object({
  qty: z.number({ message: 'Jumlah wajib diisi' }).int().min(1, 'Jumlah minimal 1'),
})

export type RestockValues = z.infer<typeof restockSchema>

export const recipeItemSchema = z.object({
  menu_id: z.string().min(1, 'Menu wajib dipilih'),
  ingredient_id: z.string().min(1, 'Bahan wajib dipilih'),
  qty: z.number({ message: 'Jumlah wajib diisi' }).int().min(1, 'Jumlah minimal 1'),
})

export type RecipeItemValues = z.infer<typeof recipeItemSchema>
