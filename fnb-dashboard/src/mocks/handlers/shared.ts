import { API_ERROR_CODE, type ApiErrorCode, USER_ROLE, type UserRole } from '@/constants'
import { db } from '@/mocks/db'
import type { ApiError, User } from '@/types'

export class MockApiError extends Error implements ApiError {
  code: ApiErrorCode

  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.name = 'MockApiError'
    this.code = code
  }
}

export const delay = (milliseconds = 200 + Math.random() * 300) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))

export const fail = (code: ApiErrorCode, message: string): never => {
  throw new MockApiError(code, message)
}

export const currentUser = (): User => {
  const user = db.users.find(({ id }) => id === db.currentUserId)
  return user ?? fail(API_ERROR_CODE.UNAUTHORIZED, 'Mock session is not authenticated')
}

export const requireRole = (...roles: UserRole[]) => {
  const user = currentUser()
  if (!roles.includes(user.role)) fail(API_ERROR_CODE.FORBIDDEN, 'Role is not authorized')
  return user
}

export const isStaff = (role: UserRole) => role === USER_ROLE.OWNER || role === USER_ROLE.CASHIER

// TS cannot narrow `T | undefined` through `fail()` even though it returns `never`,
// so lookups use this helper which throws or returns a defined value.
export const findOrThrow = <T>(value: T | undefined, code: ApiErrorCode, message: string): T => {
  if (!value) fail(code, message)
  return value!
}
