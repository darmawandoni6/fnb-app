export const USER_ROLE = {
  OWNER: 'OWNER',
  CASHIER: 'CASHIER',
  KITCHEN: 'KITCHEN',
} as const

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE]
