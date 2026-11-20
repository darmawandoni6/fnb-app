export const QUERY_KEYS = {
  publicMenu: (qrToken: string) => ['public-menu', qrToken] as const,
  publicOrder: (trackingToken: string) => ['public-order', trackingToken] as const,
}
