import { z } from 'zod'

export const settingsSchema = z
  .object({
    cafe_name: z.string().min(1, 'Nama kafe wajib diisi'),
    service_rate: z
      .number({ message: 'Service charge wajib diisi' })
      .min(0, 'Service minimal 0')
      .max(100, 'Service maksimal 100'),
    tax_rate: z
      .number({ message: 'Pajak wajib diisi' })
      .min(0, 'Pajak minimal 0')
      .max(100, 'Pajak maksimal 100'),
    cash_timeout_minutes: z.number().int().min(1, 'Minimal 1 menit'),
    delivered_auto_complete_minutes: z.number().int().min(1, 'Minimal 1 menit'),
    ready_auto_deliver_minutes: z.number().int().min(1, 'Minimal 1 menit'),
    ready_auto_deliver_warning_minutes: z.number().int().min(1, 'Minimal 1 menit'),
  })
  // `../../docs/api.md`: the warning must fire before the auto-deliver fallback.
  .refine(
    (values) => values.ready_auto_deliver_warning_minutes < values.ready_auto_deliver_minutes,
    {
      message: 'Peringatan harus lebih kecil dari auto-deliver',
      path: ['ready_auto_deliver_warning_minutes'],
    },
  )

export type SettingsValues = z.infer<typeof settingsSchema>
