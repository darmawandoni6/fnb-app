import { queryOptions } from '@tanstack/react-query'

import { getPublicMenu } from '@/api'

import { QUERY_KEYS } from '@/constants/queryKeys'

export const catalogKeys = {
  menu: (qr: string) => QUERY_KEYS.publicMenu(qr),
}

export const menuQuery = (qr: string) =>
  queryOptions({
    queryKey: catalogKeys.menu(qr),
    queryFn: () => getPublicMenu(qr),
    enabled: Boolean(qr),
  })
