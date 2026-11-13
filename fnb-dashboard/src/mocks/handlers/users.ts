import { API_ERROR_CODE, USER_ROLE, type UserRole } from '@/constants'
import { db } from '@/mocks/db'
import type { User } from '@/types'

import { delay, fail, findOrThrow, requireRole } from './shared'

export const getUsers = async (): Promise<User[]> => {
  await delay()
  return db.users.map((user) => ({ ...user }))
}

export const createUser = async ({
  name,
  email,
  role,
}: {
  name: string
  email: string
  role: UserRole
}): Promise<User> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  if (!name.trim()) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nama wajib diisi')
  if (!email.includes('@')) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Email tidak valid')
  if (role !== USER_ROLE.CASHIER && role !== USER_ROLE.KITCHEN) {
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Role harus CASHIER atau KITCHEN')
  }
  if (db.users.some((user) => user.email === email))
    fail(API_ERROR_CODE.VALIDATION_ERROR, 'Email sudah terdaftar')
  const user: User = { id: `user-${Date.now()}`, name, email, role, is_active: true }
  db.users.push(user)
  return { ...user }
}

export const updateUser = async (
  id: string,
  body: { name?: string; is_active?: boolean },
): Promise<User> => {
  await delay()
  requireRole(USER_ROLE.OWNER)
  const user = findOrThrow(
    db.users.find((candidate) => candidate.id === id),
    API_ERROR_CODE.NOT_FOUND,
    'User tidak ditemukan',
  )
  const targetUser = user!
  if (body.name !== undefined) {
    if (!body.name.trim()) fail(API_ERROR_CODE.VALIDATION_ERROR, 'Nama wajib diisi')
    targetUser.name = body.name
  }
  if (body.is_active === false) {
    if (targetUser.id === db.currentUserId)
      fail(API_ERROR_CODE.VALIDATION_ERROR, 'Tidak bisa menonaktifkan akun sendiri')
    targetUser.is_active = false
  }
  if (body.is_active === true) targetUser.is_active = true
  return { ...targetUser }
}
