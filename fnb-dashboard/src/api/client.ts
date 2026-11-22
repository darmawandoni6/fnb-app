import { API_ERROR_CODE, type ApiErrorCode } from '@/constants'
import type { ApiErrorBody, ApiSuccess } from '@/types'
import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'

import { getAccessToken, setAccessToken } from '@/auth/token'

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8081'

/** Shape every caller sees: `code` for branching, `message` for display. */
export class ApiRequestError extends Error {
  code: ApiErrorCode
  status: number | undefined

  constructor(code: ApiErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.status = status
  }
}

export const http = axios.create({ baseURL: API_BASE_URL, withCredentials: true })

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

const toApiError = (error: AxiosError<ApiErrorBody>) => {
  const body = error.response?.data
  if (body && body.success === false) {
    return new ApiRequestError(body.error.code, body.error.message, error.response?.status)
  }
  return new ApiRequestError(
    API_ERROR_CODE.INTERNAL_ERROR,
    error.message || 'Gagal menghubungi server',
    error.response?.status,
  )
}

let refreshing: Promise<string> | null = null

const refreshAccessToken = async () => {
  const response = await http.post<ApiSuccess<{ access_token: string }>>('/auth/refresh')
  const token = response.data.data.access_token
  setAccessToken(token)
  return token
}

http.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as RetriableConfig | undefined
    const isAuthCall = config?.url?.startsWith('/auth/')
    if (error.response?.status !== 401 || !config || config._retried || isAuthCall) {
      return Promise.reject(toApiError(error))
    }
    config._retried = true
    try {
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null
      })
      const token = await refreshing
      config.headers.Authorization = `Bearer ${token}`
      return await http(config)
    } catch {
      setAccessToken(null)
      window.dispatchEvent(new Event('auth:unauthorized'))
      return Promise.reject(toApiError(error))
    }
  },
)

/** Unwraps the `{ success, data }` envelope so callers only see `data`. */
export const request = async <T>(config: AxiosRequestConfig): Promise<T> => {
  const response = await http.request<ApiSuccess<T> | ''>(config)
  return (response.data ? response.data.data : undefined) as T
}
