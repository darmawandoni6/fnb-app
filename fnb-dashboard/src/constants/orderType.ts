export const ORDER_TYPE = {
  DINE_IN: 'DINE_IN',
  TAKE_AWAY: 'TAKE_AWAY',
} as const

export type OrderType = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE]
