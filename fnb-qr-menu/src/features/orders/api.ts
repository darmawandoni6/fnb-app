import { queryOptions } from '@tanstack/react-query'

import { getPublicOrders } from '@/api'

import { QUERY_KEYS } from '@/constants/queryKeys'

import { withSessionRetry } from '@/features/session/token'

export const ordersQuery = (sessionToken: string) =>
  queryOptions({
    queryKey: QUERY_KEYS.publicOrders(sessionToken),
    queryFn: () => withSessionRetry((token) => getPublicOrders(token)),
    enabled: Boolean(sessionToken),
  })
