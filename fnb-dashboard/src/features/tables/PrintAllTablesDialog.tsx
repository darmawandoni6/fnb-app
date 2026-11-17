import type { Table } from '@/types'
import { Printer, TriangleAlert } from 'lucide-react'

import { hasQrMenuUrl } from '@/lib/qr'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { TableQrCard } from '@/features/tables/TableQrCard'

// 2×2 per A4: the page break lives in `[data-print-grid]` in index.css.

export function PrintAllTablesDialog({ tables, cafeName }: { tables: Table[]; cafeName: string }) {
  const activeTables = tables.filter((table) => table.is_active)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={activeTables.length === 0}>
          <Printer className="h-4 w-4" />
          Cetak Semua QR
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cetak QR Meja</DialogTitle>
          <DialogDescription>
            {activeTables.length} meja aktif, 2×2 per lembar A4. Meja nonaktif tidak ikut dicetak.
          </DialogDescription>
        </DialogHeader>

        {activeTables.length === 0 ? (
          <div className="text-muted-foreground flex items-start gap-2 rounded-md border border-dashed p-3 text-xs">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Belum ada meja aktif untuk dicetak.
          </div>
        ) : !hasQrMenuUrl ? (
          <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border p-3 text-xs">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>`VITE_QR_MENU_URL` belum diisi. QR tidak bisa dibuat.</span>
          </div>
        ) : (
          <div data-print-area data-print-grid className="grid grid-cols-2 gap-3">
            {activeTables.map((table) => (
              <TableQrCard key={table.id} table={table} cafeName={cafeName} />
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            size="sm"
            disabled={activeTables.length === 0 || !hasQrMenuUrl}
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Cetak
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
