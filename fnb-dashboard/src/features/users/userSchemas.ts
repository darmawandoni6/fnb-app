import { USER_ROLE } from '@/constants'
import { z } from 'zod'

export const createUserSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  email: z.string().email('Format email tidak valid'),
  role: z.enum([USER_ROLE.CASHIER, USER_ROLE.KITCHEN]),
  password: z.string().min(8, 'Password minimal 8 karakter'),
})

export type CreateUserValues = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  email: z.string().optional(),
  role: z.enum([USER_ROLE.CASHIER, USER_ROLE.KITCHEN]).optional(),
  password: z.string().min(8, 'Password minimal 8 karakter').optional().or(z.literal('')),
})

export type UpdateUserValues = z.infer<typeof updateUserSchema>
