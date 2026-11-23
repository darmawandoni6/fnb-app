const RAW_DASHBOARD_URL = (import.meta.env.VITE_DASHBOARD_URL ?? '').trim()

export const DASHBOARD_URL = RAW_DASHBOARD_URL.replace(/\/+$/, '')

export const hasDashboardUrl = DASHBOARD_URL.length > 0

export function getOrderQrUrl(orderNumber: string) {
  return `${DASHBOARD_URL}/orders?q=${encodeURIComponent(orderNumber)}`
}
