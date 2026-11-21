import { z } from 'zod'

import { PAYMENT_METHOD } from '@/constants/paymentMethod'

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(1, 'Nama pemesan wajib diisi'),
  customerPhone: z.string().trim(),
  paymentMethod: z.enum([PAYMENT_METHOD.CASH, PAYMENT_METHOD.NON_CASH]),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>
