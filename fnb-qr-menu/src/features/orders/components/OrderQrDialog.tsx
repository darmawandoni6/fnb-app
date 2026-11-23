import { useState } from 'react'

import { QRCodeSVG } from 'qrcode.react'

import { getOrderQrUrl } from '@/lib/orderQr'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function OrderQrDialog({ orderNumber }: { orderNumber: string }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-full"
          onClick={(event) => event.stopPropagation()}
        >
          Tunjukkan QR
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Tunjukkan ke kasir</DialogTitle>
          <DialogDescription>
            Kasir memindai QR ini untuk membuka pesanan Anda di dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="border-border rounded-2xl border bg-white p-4">
            <QRCodeSVG
              value={getOrderQrUrl(orderNumber)}
              size={208}
              marginSize={0}
              level="M"
              title={`QR pesanan ${orderNumber}`}
            />
          </div>
          <p className="text-text font-editorial text-lg font-bold">{orderNumber}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
