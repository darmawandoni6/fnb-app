import { z } from 'zod'

export const ingredientSchema = z.object({
  name: z.string().min(1, 'Nama bahan wajib diisi'),
  unit: z.string().min(1, 'Satuan wajib diisi'),
  stock_qty: z.number().int().min(0, 'Stok tidak valid'),
  min_stock: z
    .number({ message: 'Batas minimum wajib diisi' })
    .int()
    .min(0, 'Batas minimum tidak valid'),
})

export type IngredientValues = z.infer<typeof ingredientSchema>

export const restockSchema = z.object({
  qty: z.number({ message: 'Jumlah wajib diisi' }).int().min(1, 'Jumlah minimal 1'),
  note: z.string().optional(),
})

export type RestockValues = z.infer<typeof restockSchema>

export const adjustStockSchema = z.object({
  stock_qty: z.number({ message: 'Stok fisik wajib diisi' }).int().min(0, 'Stok fisik tidak valid'),
  note: z.string().optional(),
})

export type AdjustStockValues = z.infer<typeof adjustStockSchema>
