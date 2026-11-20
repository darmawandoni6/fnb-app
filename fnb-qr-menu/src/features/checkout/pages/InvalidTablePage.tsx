import { QrCode } from 'lucide-react'

import { AppShell } from '@/components/AppShell'

export function InvalidTablePage() {
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-destructive/10 text-destructive mb-4 flex size-14 items-center justify-center rounded-full">
          <QrCode className="size-7" />
        </div>
        <h1 className="font-editorial text-text text-2xl font-bold">QR Meja Tidak Valid</h1>
        <p className="text-text-muted mt-2 max-w-xs text-sm">
          Kode QR meja tidak ditemukan atau belum aktif. Silakan scan ulang kode QR di meja Anda.
        </p>
      </div>
    </AppShell>
  )
}
