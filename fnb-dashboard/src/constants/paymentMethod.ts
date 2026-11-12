export const PAYMENT_METHOD = {
  CASH: 'CASH',
  NON_CASH: 'NON_CASH',
} as const

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD]
