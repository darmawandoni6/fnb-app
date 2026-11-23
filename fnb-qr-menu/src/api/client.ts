import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'

import { API_ERROR } from '@/constants/errors'
import { isApiError } from '@/lib/apiError'
import type { ApiEnvelope, ApiError } from '@/types/api'

const baseURL = import.meta.env.VITE_API_URL ?? ''

const http = axios.create({ baseURL })

function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const body = error.response?.data as ApiEnvelope<unknown> | undefined
    if (body && body.success === false) {
      return { code: body.error.code, message: body.error.message, status }
    }
    if (!error.response) {
      return { code: API_ERROR.NETWORK_ERROR, message: 'Tidak dapat terhubung ke server' }
    }
    return { code: API_ERROR.INTERNAL_ERROR, message: 'Terjadi kesalahan pada server', status }
  }
  if (isApiError(error)) return error
  return { code: API_ERROR.INTERNAL_ERROR, message: 'Terjadi kesalahan tak terduga' }
}

export async function request<T>(config: AxiosRequestConfig, sessionToken?: string): Promise<T> {
  try {
    const { data } = await http.request<ApiEnvelope<T>>({
      ...config,
      headers: sessionToken
        ? { ...config.headers, 'X-Session-Token': sessionToken }
        : config.headers,
    })

    if (!data.success) {
      const error: ApiError = { code: data.error.code, message: data.error.message }
      throw error
    }

    return data.data
  } catch (error) {
    throw toApiError(error)
  }
}
