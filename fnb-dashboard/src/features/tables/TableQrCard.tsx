import type { Table } from '@/types'
import { QRCodeSVG } from 'qrcode.react'

import { getTableQrUrl } from '@/lib/qr'

/**
 * Printed table-tent card. Shared by the preview dialog and the bulk print sheet
 * so what the owner sees is what reaches paper.
 */
export function TableQrCard({
  table,
  cafeName,
  qrSize = 160,
}: {
  table: Table
  cafeName: string
  qrSize?: number
}) {
  return (
    <div className="flex break-inside-avoid flex-col items-center gap-3 rounded-xl border-2 bg-white p-5 text-center text-black">
      <p className="text-xs font-semibold tracking-[0.2em] uppercase">{cafeName}</p>
      <p className="text-[11px] text-neutral-500">Scan untuk lihat menu</p>
      <QRCodeSVG
        value={getTableQrUrl(table.qr_token)}
        size={qrSize}
        marginSize={4}
        level="M"
        title={`QR Menu meja ${table.table_number}`}
      />
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] tracking-[0.3em] text-neutral-500 uppercase">Meja</span>
        <span className="text-4xl leading-none font-black">{table.table_number}</span>
      </div>
    </div>
  )
}
