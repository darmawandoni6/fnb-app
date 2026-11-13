import { z } from 'zod'

export const menuSchema = z.object({
  name: z.string().min(1, 'Nama menu wajib diisi'),
  price: z.number().int().min(0, 'Harga tidak valid'),
  category_id: z.string().min(1, 'Kategori wajib dipilih'),
  image_url: z.string().optional(),
})

export type MenuValues = z.infer<typeof menuSchema>

export const categorySchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi'),
})

export type CategoryValues = z.infer<typeof categorySchema>
