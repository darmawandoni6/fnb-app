export const ORDER_TYPE = {
  QR: 'QR',
  MANUAL: 'MANUAL',
} as const

export type OrderType = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE]
