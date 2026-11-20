export type ApiSuccess<T> = {
  success: true
  data: T
}

export type ApiFailure = {
  success: false
  error: {
    code: string
    message: string
    debug?: string
  }
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure

export type ApiError = {
  code: string
  message: string
  status?: number
}
