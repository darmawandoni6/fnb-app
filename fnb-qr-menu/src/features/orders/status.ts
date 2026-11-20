import { useEffect, useRef } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { cancelOrderItem } from '@/api'
import { toast } from 'sonner'

import { API_ERROR } from '@/constants/errors'
import type { OrderStatus } from '@/constants/orderStatus'
import { POLL_INTERVAL_MS } from '@/constants/orderStatus'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { isApiError } from '@/lib/apiError'

import { useCustomerSession } from '@/features/session/store'
import type { TrackedOrder } from '@/features/session/store'

import { orderQuery } from './api'

const isFinished = (status: OrderStatus) => status === 'SELESAI' || status === 'DIBATALKAN'

const isNotFound = (error: unknown) => isApiError(error) && error.code === API_ERROR.NOT_FOUND

const isRateLimited = (error: unknown) => isApiError(error) && error.status === 429

export function useTrackedOrder(order: TrackedOrder, enabled: boolean) {
  const [, updateSession] = useCustomerSession()
  const hasWarnedRateLimit = useRef(false)

  const query = useQuery({
    ...orderQuery(order.trackingToken),
    initialData: order.snapshot,
    initialDataUpdatedAt: 0,
    enabled,
    retry: (failureCount, error) => !isNotFound(error) && !isRateLimited(error) && failureCount < 1,
    refetchIntervalInBackground: true,
    refetchInterval: (query) => {
      if (!enabled) return false

      const status = query.state.data?.status ?? order.snapshot.status
      if (isFinished(status)) return false

      if (query.state.error) {
        if (isNotFound(query.state.error)) return false
        // A 429 skips the next tick instead of retrying immediately.
        if (isRateLimited(query.state.error)) return POLL_INTERVAL_MS * 2
      }

      return POLL_INTERVAL_MS
    },
  })

  useEffect(() => {
    const snapshot = query.data
    if (!snapshot) return

    updateSession((prev) => ({
      ...prev,
      orders: prev.orders.map((entry) =>
        entry.trackingToken === order.trackingToken ? { ...entry, snapshot } : entry,
      ),
    }))
  }, [query.data, order.trackingToken, updateSession])

  useEffect(() => {
    if (!query.error) {
      hasWarnedRateLimit.current = false
      return
    }
    if (isRateLimited(query.error) && !hasWarnedRateLimit.current) {
      hasWarnedRateLimit.current = true
      toast.error(isApiError(query.error) ? query.error.message : 'Terlalu banyak permintaan')
    }
  }, [query.error])

  return query
}

export function useCancelOrderItem(order: TrackedOrder) {
  const [, updateSession] = useCustomerSession()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemId: string) => cancelOrderItem(order.trackingToken, itemId),

    onSuccess: (response) => {
      updateSession((prev) => ({
        ...prev,
        orders: prev.orders.map((entry) =>
          entry.trackingToken === order.trackingToken ? { ...entry, snapshot: response } : entry,
        ),
      }))
      queryClient.setQueryData(QUERY_KEYS.publicOrder(order.trackingToken), response)
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.publicOrder(order.trackingToken),
      })
    },

    onError: (error: unknown) => {
      if (isApiError(error)) {
        toast.error(error.message)
        if (error.code === API_ERROR.INVALID_TRANSITION) {
          void queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.publicOrder(order.trackingToken),
          })
        }
        return
      }
      toast.error('Terjadi kesalahan. Silakan coba lagi.')
    },
  })
}
