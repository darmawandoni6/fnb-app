import { z } from 'zod'

export const manualOrderSchema = z.object({
  customer_name: z.string().trim().min(1, 'Nama pelanggan wajib diisi'),
  customer_phone: z.string().trim().optional().nullable(),
  items: z
    .array(
      z.object({
        menu_id: z.string(),
        qty: z.number().int().min(1, 'Jumlah minimal 1'),
        note: z.string().optional().nullable(),
      }),
    )
    .min(1, 'Minimal satu menu harus dipilih'),
})

export type ManualOrderValues = z.infer<typeof manualOrderSchema>
