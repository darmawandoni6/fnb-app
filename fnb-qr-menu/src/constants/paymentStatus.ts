export const PAYMENT_STATUS = {
  BELUM: 'BELUM',
  LUNAS: 'LUNAS',
} as const

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS]

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  BELUM: 'Belum Bayar',
  LUNAS: 'Lunas',
}
