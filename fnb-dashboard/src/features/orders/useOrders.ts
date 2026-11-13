import { useQuery } from '@tanstack/react-query'

import { api } from '@/api'

import type { OrderStatus } from '@/constants/orderStatus'

export type OrderFilters = { status?: OrderStatus; table_id?: string; date?: string }

export function useOrders(filters?: OrderFilters) {
  return useQuery({
    queryKey: ['orders', filters ?? {}],
    queryFn: () => api.getOrders(filters),
    refetchInterval: 5_000,
  })
}
