import type { UserRole } from '@/constants/roles'

export type User = {
  id: string
  name: string
  email: string
  role: UserRole
  is_active: boolean
}
