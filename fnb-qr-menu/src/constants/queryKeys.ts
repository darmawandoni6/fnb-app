export const QUERY_KEYS = {
  publicMenu: (sessionToken: string) => ['public-menu', sessionToken] as const,
  publicOrders: (sessionToken: string) => ['public-orders', sessionToken] as const,
}
