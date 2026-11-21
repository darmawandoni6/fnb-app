export const ORDER_STATUS = {
  MENUNGGU: 'MENUNGGU',
  DIPROSES: 'DIPROSES',
  SELESAI: 'SELESAI',
  DIBATALKAN: 'DIBATALKAN',
} as const

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]
