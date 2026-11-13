import { USER_ROLE } from '@/constants'
import { z } from 'zod'

export const createUserSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  email: z.string().email('Email tidak valid'),
  role: z.enum([USER_ROLE.CASHIER, USER_ROLE.KITCHEN]),
})

export type CreateUserValues = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
})

export type UpdateUserValues = z.infer<typeof updateUserSchema>
