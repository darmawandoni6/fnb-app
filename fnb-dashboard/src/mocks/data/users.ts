import type { User } from '@/types'

export const users: User[] = [
  { id: 'user-1', name: 'Owner', email: 'owner@demo.cafe', role: 'OWNER', is_active: true },
  { id: 'user-2', name: 'Kasir', email: 'kasir@demo.cafe', role: 'CASHIER', is_active: true },
  { id: 'user-3', name: 'Dapur', email: 'dapur@demo.cafe', role: 'KITCHEN', is_active: true },
]
