import { useEffect } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { cancelPublicOrder } from '@/api'
import { toast } from 'sonner'

import { API_ERROR } from '@/constants/errors'
import { ORDER_STATUS } from '@/constants/orderStatus'
import type { OrderStatus } from '@/constants/orderStatus'
import { POLL_INTERVAL_MS } from '@/constants/orderStatus'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { isApiError } from '@/lib/apiError'
import type { PublicOrder } from '@/types/order'

import { useCustomerSession } from '@/features/session/store'
import type { TrackedOrder } from '@/features/session/store'
import { withSessionRetry } from '@/features/session/token'

import { ordersQuery } from './api'

export const isFinished = (status: OrderStatus) =>
  status === ORDER_STATUS.SELESAI || status === ORDER_STATUS.DIBATALKAN

export const unfinishedOrderCount = (orders: TrackedOrder[]) =>
  orders.filter((order) => !isFinished(order.snapshot.status)).length

const isRateLimited = (error: unknown) => isApiError(error) && error.status === 429

export function useOrderList(enabled: boolean) {
  const [session, updateSession] = useCustomerSession()

  const query = useQuery({
    ...ordersQuery(session.sessionToken),
    enabled: enabled && Boolean(session.sessionToken),
    refetchIntervalInBackground: true,
    retry: (failureCount, error) => !isRateLimited(error) && failureCount < 1,
    refetchInterval: (query) => {
      if (!enabled) return false
      const latest = query.state.data
      if (latest && latest.length > 0 && latest.every((order) => isFinished(order.status))) {
        return false
      }
      if (isRateLimited(query.state.error)) return POLL_INTERVAL_MS * 2
      return POLL_INTERVAL_MS
    },
  })

  useEffect(() => {
    const list = query.data
    if (!list) return

    updateSession((prev) => ({
      ...prev,
      orders: prev.orders.map((entry) => {
        const fresh = list.find((order) => order.id === entry.id)
        return fresh ? { ...entry, snapshot: fresh } : entry
      }),
    }))
  }, [query.data, updateSession])

  return query
}

export function useCancelOrder(order: PublicOrder) {
  const [session, updateSession] = useCustomerSession()
  const queryClient = useQueryClient()
  const listKey = QUERY_KEYS.publicOrders(session.sessionToken)

  return useMutation({
    mutationFn: (reason: string) =>
      withSessionRetry((token) => cancelPublicOrder(token, order.id, { reason })),

    onSuccess: (response) => {
      updateSession((prev) => ({
        ...prev,
        orders: prev.orders.map((entry) =>
          entry.id === response.id ? { ...entry, snapshot: response } : entry,
        ),
      }))
      void queryClient.invalidateQueries({ queryKey: listKey })
    },

    onError: (error: unknown) => {
      if (isApiError(error)) {
        toast.error(error.message)
        if (error.code === API_ERROR.INVALID_TRANSITION) {
          void queryClient.invalidateQueries({ queryKey: listKey })
        }
        return
      }
      toast.error('Terjadi kesalahan. Silakan coba lagi.')
    },
  })
}
