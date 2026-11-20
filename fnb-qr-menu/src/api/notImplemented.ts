import { API_ERROR } from '@/constants/errors'
import type { ApiError } from '@/types/api'

export function notImplemented(source: string): never {
  const error: ApiError = {
    code: API_ERROR.NOT_IMPLEMENTED,
    message: `${source} is not implemented yet`,
  }
  throw error
}
