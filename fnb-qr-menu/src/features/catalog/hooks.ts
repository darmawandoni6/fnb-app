import { useQuery } from '@tanstack/react-query'

import { menuQuery } from './queries'

export const usePublicMenu = (sessionToken: string) => useQuery(menuQuery(sessionToken))
