import type { ApiErrorCode } from '@/constants/errors'

export type ApiSuccess<T> = {
  success: true
  data: T
}

export type ApiErrorBody = {
  success: false
  error: {
    code: ApiErrorCode
    message: string
    debug?: string
  }
}

export type ApiError = {
  code: ApiErrorCode
  message: string
}
