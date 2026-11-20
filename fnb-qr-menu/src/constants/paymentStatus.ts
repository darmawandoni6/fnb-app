export const PAYMENT_STATUS = {
  BELUM: 'BELUM',
  LUNAS: 'LUNAS',
} as const

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS]
