import type { ApiError } from '@/types'
import { toast } from 'sonner'

export const toastApiError = (...args: unknown[]) => {
  const error = args[0] as ApiError
  toast.error(error?.message ?? 'Terjadi kesalahan')
}
