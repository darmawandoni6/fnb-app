export const PAYMENT_METHOD = {
  CASH: 'CASH',
  NON_CASH: 'NON_CASH',
} as const

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD]

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Tunai',
  NON_CASH: 'Non-tunai',
}
