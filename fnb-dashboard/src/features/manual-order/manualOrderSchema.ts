import { z } from 'zod'

export const manualOrderSchema = z
  .object({
    dining_option: z.enum(['DINE_IN', 'TAKE_AWAY']),
    customer_name: z.string().trim().min(1, 'Nama pelanggan wajib diisi'),
    table_id: z.string().optional().nullable(),
    table_number: z.string().optional().nullable(),
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
  .superRefine((data, ctx) => {
    if (data.dining_option === 'DINE_IN' && !data.table_number?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['table_number'],
        message: 'Nomor meja wajib dipilih untuk pesanan Dine In',
      })
    }
  })

export type ManualOrderValues = z.infer<typeof manualOrderSchema>
