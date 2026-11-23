import { queryOptions } from '@tanstack/react-query'

import { getPublicMenu } from '@/api'

import { QUERY_KEYS } from '@/constants/queryKeys'

import { withSessionRetry } from '@/features/session/token'

export const catalogKeys = {
  menu: (sessionToken: string) => QUERY_KEYS.publicMenu(sessionToken),
}

export const menuQuery = (sessionToken: string) =>
  queryOptions({
    queryKey: catalogKeys.menu(sessionToken),
    queryFn: () => withSessionRetry((token) => getPublicMenu(token)),
    enabled: Boolean(sessionToken),
    refetchInterval: (query) => (query.state.data?.isOpen ? 15_000 : false),
  })
