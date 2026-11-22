import type { User } from '@/types'

import { request } from '../client'

type ServerUser = User

export const getUsers = () => request<ServerUser[]>({ method: 'GET', url: '/users' })

export const createUser = async ({
  name,
  email,
  password,
  role,
}: {
  name: string
  email: string
  password: string
  role: User['role']
}): Promise<User> => {
  await request<Pick<User, 'email' | 'role'>>({
    method: 'POST',
    url: '/users',
    data: { name, email, password, role },
  })
  const users = await request<ServerUser[]>({ method: 'GET', url: '/users' })
  const user = users.find((u) => u.email === email)
  if (!user) throw new Error('User not found after creation')
  return user
}

export const updateUser = async (
  id: string,
  body: { name?: string; role?: User['role']; password?: string; is_active?: boolean },
): Promise<User> =>
  request<User>({
    method: 'PATCH',
    url: `/users/${id}`,
    data: body,
  })
