import type { Order } from '@/types'

import { todayUTC } from '@/lib/format'

export function exportReportCsv(orders: Order[], preset: string) {
  if (orders.length === 0) return

  const headers = [
    'No. Pesanan',
    'Tanggal',
    'Waktu',
    'Tipe Pesanan',
    'Nomor Meja',
    'Status Pembayaran',
    'Metode Pembayaran',
    'Subtotal (Rp)',
    'Service (Rp)',
    'Pajak (Rp)',
    'Total (Rp)',
  ]

  const rows = orders.map((order) => {
    const dateObj = new Date(order.created_at)
    const dateStr = order.created_at.slice(0, 10)
    const timeStr = new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateObj)

    return [
      `"${order.order_number}"`,
      `"${dateStr}"`,
      `"${timeStr}"`,
      `"${order.order_type}"`,
      `"${order.table_number ?? '-'}"`,
      `"${order.payment_status}"`,
      `"${order.payment_method ?? '-'}"`,
      order.subtotal_amount,
      order.service_amount,
      order.tax_amount,
      order.total_amount,
    ].join(',')
  })

  const csvContent = [headers.join(','), ...rows].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `laporan-transaksi-${preset}-${todayUTC()}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
