import { z } from 'zod'

export const manualOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menu_id: z.string(),
        qty: z.number().int().min(1),
        note: z.string().optional(),
      }),
    )
    .min(1, 'Minimal satu item'),
})

export type ManualOrderValues = z.infer<typeof manualOrderSchema>
