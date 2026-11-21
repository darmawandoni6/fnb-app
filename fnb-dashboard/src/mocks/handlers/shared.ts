import { API_ERROR_CODE, type ApiErrorCode, USER_ROLE, type UserRole } from '@/constants'
import { db } from '@/mocks/db'
import type { ApiError, AuditLogEntry, User } from '@/types'

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

export const isStaff = (role: UserRole) =>
  role === USER_ROLE.OWNER || role === USER_ROLE.CASHIER || role === USER_ROLE.KITCHEN

/** PRD §10.15: append-only audit trail for every status change. */
export const audit = (entry: {
  entity: string
  entity_id: string
  action: string
  from_value: string | null
  to_value: string | null
}) => {
  const actor = db.users.find(({ id }) => id === db.currentUserId)
  const record: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...entry,
    actor_id: actor?.id ?? null,
    actor_role: actor?.role ?? null,
    created_at: new Date().toISOString(),
  }
  db.auditLog.unshift(record)
}

// TS cannot narrow `T | undefined` through `fail()` even though it returns `never`,
// so lookups use this helper which throws or returns a defined value.
export const findOrThrow = <T>(value: T | undefined, code: ApiErrorCode, message: string): T => {
  if (!value) fail(code, message)
  return value!
}
