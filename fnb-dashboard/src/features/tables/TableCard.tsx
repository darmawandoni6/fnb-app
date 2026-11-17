import { useState } from 'react'

import { useMutation } from '@tanstack/react-query'

import { api } from '@/api'
import type { Table } from '@/types'
import { QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'

import { toastApiError } from '@/lib/errors'
import { getTableQrUrl, hasQrMenuUrl } from '@/lib/qr'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import { TableQrDialog } from './TableQrDialog'

export function TableCard({
  table,
  cafeName,
  onChanged,
}: {
  table: Table
  cafeName: string
  onChanged: () => void
}) {
  const [previewOpen, setPreviewOpen] = useState(false)

  const toggle = useMutation({
    mutationFn: () => api.updateTable(table.id, { is_active: !table.is_active }),
    onSuccess: () => {
      toast.success(`Meja ${table.number} ${table.is_active ? 'dinonaktifkan' : 'diaktifkan'}`)
      onChanged()
    },
    onError: toastApiError,
  })

  const activeId = `table-active-${table.id}`

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardContent className="flex flex-1 flex-col items-center gap-2 pt-4">
        <div
          className={`flex h-28 w-28 items-center justify-center rounded-lg border bg-white p-2 ${
            table.is_active ? '' : 'opacity-50 grayscale'
          }`}
        >
          {hasQrMenuUrl ? (
            <QRCodeSVG value={getTableQrUrl(table.qr_token)} size={96} marginSize={2} level="M" />
          ) : (
            <QrCode className="text-muted-foreground h-10 w-10" />
          )}
        </div>
        <p className="text-sm font-semibold">Meja {table.number}</p>
        <Badge variant={table.is_active ? 'default' : 'secondary'} className="text-[10px]">
          {table.is_active ? 'Aktif' : 'Nonaktif'}
        </Badge>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2 border-t px-3 py-2">
        <div className="flex items-center gap-2">
          <Switch
            id={activeId}
            checked={table.is_active}
            disabled={toggle.isPending}
            onCheckedChange={() => toggle.mutate()}
          />
          <Label htmlFor={activeId} className="text-muted-foreground cursor-pointer text-xs">
            {table.is_active ? 'Aktif' : 'Nonaktif'}
          </Label>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-7 gap-1 px-2 text-xs"
          onClick={() => setPreviewOpen(true)}
        >
          <QrCode className="h-3.5 w-3.5" />
          Preview QR
        </Button>
      </CardFooter>

      <TableQrDialog
        table={table}
        cafeName={cafeName}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </Card>
  )
}
