import { z } from 'zod'

export const tableSchema = z.object({
  number: z.string().min(1, 'Nomor meja wajib diisi'),
})

export type TableValues = z.infer<typeof tableSchema>
