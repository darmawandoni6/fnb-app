import type { ApiErrorCode } from '@/constants/errors'
import type { ApiError } from '@/types/api'

export function isApiError(error: unknown): error is ApiError {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as Partial<ApiError>
  return typeof candidate.code === 'string' && typeof candidate.message === 'string'
}

export function mockError(code: ApiErrorCode, status: number, message: string): ApiError {
  return { code, message, status }
}
