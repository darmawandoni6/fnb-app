import { z } from 'zod'

export const settingsSchema = z.object({
  cafe_name: z.string().min(1, 'Nama kafe wajib diisi'),
  tax_percent: z
    .number({ message: 'Pajak wajib diisi' })
    .int('Pajak harus bilangan bulat')
    .min(0, 'Pajak minimal 0')
    .max(100, 'Pajak maksimal 100'),
  is_open: z.boolean(),
})

export type SettingsValues = z.infer<typeof settingsSchema>
