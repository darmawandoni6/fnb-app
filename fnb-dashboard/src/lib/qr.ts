const RAW_QR_MENU_URL = (import.meta.env.VITE_QR_MENU_URL ?? '').trim()

export const QR_MENU_URL = RAW_QR_MENU_URL.replace(/\/+$/, '')

export const hasQrMenuUrl = QR_MENU_URL.length > 0

// PRD §9: the QR carries only a public URL with the table token.
// `?meja=` is the param the QR Menu app reads (it accepts the token or the number).
export const getTableQrUrl = (qrToken: string) =>
  QR_MENU_URL ? `${QR_MENU_URL}/?meja=${encodeURIComponent(qrToken)}` : ''
