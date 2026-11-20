import { queryOptions } from '@tanstack/react-query'

import { getPublicOrder } from '@/api'

import { QUERY_KEYS } from '@/constants/queryKeys'

export const orderQuery = (trackingToken: string) =>
  queryOptions({
    queryKey: QUERY_KEYS.publicOrder(trackingToken),
    queryFn: () => getPublicOrder(trackingToken),
  })
