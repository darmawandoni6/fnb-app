import { useState } from 'react'

import type { Table } from '@/types'
import { Copy, CopyCheck, ExternalLink, Printer, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'

import { QR_MENU_URL, getTableQrUrl, hasQrMenuUrl } from '@/lib/qr'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TableQrCard } from '@/features/tables/TableQrCard'

export function TableQrDialog({
  table,
  cafeName,
  open,
  onOpenChange,
}: {
  table: Table
  cafeName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [copied, setCopied] = useState(false)
  const qrUrl = getTableQrUrl(table.qr_token)

  const copyToken = async () => {
    await navigator.clipboard.writeText(table.qr_token)
    setCopied(true)
    toast.success('Token disalin')
    window.setTimeout(() => setCopied(false), 1500)
  }

  const openQrMenu = () => {
    if (!hasQrMenuUrl) {
      toast.error('VITE_QR_MENU_URL belum diisi')
      return
    }
    window.open(qrUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Meja {table.number}</DialogTitle>
          <DialogDescription>
            Tempel QR ini di meja. Pelanggan memindainya untuk membuka menu.
          </DialogDescription>
        </DialogHeader>

        {!hasQrMenuUrl && (
          <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border p-2 text-xs">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              `VITE_QR_MENU_URL` belum diisi. QR tidak bisa dirender dan tombol buka menu
              dinonaktifkan.
            </span>
          </div>
        )}

        <div data-print-area data-print-single>
          {hasQrMenuUrl ? (
            <TableQrCard table={table} cafeName={cafeName} qrSize={224} />
          ) : (
            <p className="text-muted-foreground flex h-56 items-center justify-center border border-dashed text-center text-xs">
              QR belum tersedia
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-xs">Token</span>
          <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1 font-mono text-xs">
            {table.qr_token}
          </code>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={copyToken}>
            {copied ? <CopyCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="sr-only">Salin token</span>
          </Button>
        </div>

        <p className="text-muted-foreground truncate text-[10px]">
          {QR_MENU_URL ? qrUrl : 'Base URL QR Menu belum dikonfigurasi'}
        </p>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
            Cetak
          </Button>
          <Button type="button" size="sm" disabled={!hasQrMenuUrl} onClick={openQrMenu}>
            <ExternalLink className="h-3.5 w-3.5" />
            Buka QR Menu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
